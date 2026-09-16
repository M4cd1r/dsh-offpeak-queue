// dsh-offpeak-queue —— Host 半侧（原生静态 bundle · 防御版）
// 硬约束：apply() 永不向外抛异常 —— 任何一步失败都只写 host.log，绝不拖垮启动/组合。
// 对外通道：GET /dsh-offpeak-queue/state（轮询快照）、POST /action（动作）、POST /report（客户端错误上报）。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import os from 'node:os'
import { createOffpeakCore } from './src/core.mjs'

export const name = 'offpeak-queue'
const VERSION = '0.1.7'
const ROUTE_PREFIX = '/dsh-offpeak-queue'

function homeRoot() {
  const env = typeof process !== 'undefined' && process.env ? process.env.DSH_HOME : undefined
  return typeof env === 'string' && env !== '' ? env : join(os.homedir(), '.dsh')
}

/**
 * 通过 ctx.get 读取可选服务。Cordis 对未在 inject 中声明的服务读取会抛
 * «cannot get property "x" without inject»，所以 ctx[name] 只能兜底且必须捕获异常。
 */
export function getService(ctx, name) {
  if (!ctx) return undefined
  try {
    if (typeof ctx.get === 'function') {
      const value = ctx.get(name)
      if (value !== undefined) return value
    }
  } catch { /* 继续尝试直接读取 */ }
  try {
    const direct = ctx[name]
    if (direct !== undefined) return direct
  } catch { /* 未声明的服务读取失败即视为缺席 */ }
  return undefined
}

/** 把一个排队消息投递到它记录的目标会话。 */
export async function deliverOnce(ctx, item) {
  if (!item || typeof item.sessionId !== 'string' || item.sessionId === '') {
    throw new Error('缺少目标会话')
  }

  const content = [{ type: 'text', text: item.text }]

  // 首选宿主的标准 prompt 通道：DSH >= 0.1.2 由 api session controller 提供
  // （ctx.sessionController）。它会生成完整 UserMessage，并按会话已保存的
  // composition/provider/model 恢复冷会话；直接 agents.resume 缺少这些参数会在等待数小时后失败。
  const controller = getService(ctx, 'sessionController')
  if (controller && typeof controller.prompt === 'function') {
    await controller.prompt({
      requestId: 'offpeak-queue-' + randomUUID(),
      sessionId: item.sessionId,
      mode: 'queue',
      content,
    }, new AbortController().signal)
    return
  }

  // DSH 0.1.0/0.1.1 的等价通道（host-apiproxy）自 0.1.2 起被 session controller 取代。
  // prompt 的入参就是请求体本身；{ rpcId, payload } 是传输层信封，塞进入参会校验失败。
  const apiProxy = getService(ctx, 'apiProxy')
  if (apiProxy && apiProxy.sessions && typeof apiProxy.sessions.prompt === 'function') {
    const response = await apiProxy.sessions.prompt({
      sessionId: item.sessionId,
      mode: 'queue',
      content,
    }, new AbortController().signal)
    const result = response && typeof response === 'object' ? response.result : undefined
    if (result && typeof result === 'object' && result.ok === false) {
      const error = result.error && typeof result.error === 'object' ? result.error : {}
      const code = typeof error.code === 'string' && error.code !== '' ? error.code + ': ' : ''
      const message = typeof error.message === 'string' && error.message !== '' ? error.message : 'DSH 拒绝接收队列消息'
      throw new Error(code + message)
    }
    const accepted = result && typeof result === 'object' && result.value && typeof result.value === 'object'
      ? result.value.accepted
      : result && typeof result === 'object' && 'accepted' in result
        ? result.accepted
      : response && typeof response === 'object' ? response.accepted : undefined
    if (accepted === false) throw new Error('DSH 拒绝接收队列消息')
    return
  }

  // 两条 prompt 通道都缺席时（宿主过旧或未挂载 api session controller），仅复用仍在线的
  // agent。消息必须包含 DSH UserMessage 的 role/id；冷会话不在这里猜测模型配置，
  // 以免投递到错误的 composition。
  const agents = getService(ctx, 'agents')
  const agent = agents && typeof agents.get === 'function' ? agents.get(item.sessionId) : undefined
  if (!agent || typeof agent.followup !== 'function') {
    throw new Error('宿主未提供 session.prompt 通道，且目标会话当前未在线')
  }
  const message = {
    content,
    source: { kind: 'user' },
    role: 'user',
    id: randomUUID(),
  }
  const maybe = agent.followup(message)
  if (maybe && typeof maybe.then === 'function') await maybe
}

export function apply(ctx) {
  // 日志先于一切就位（幂等）
  let dir = ''
  let cfgPath = ''
  let logPath = ''
  const tryWrite = (line) => {
    if (logPath === '') {
      try {
        const root = homeRoot()
        dir = join(root, 'offpeak-queue')
        mkdirSync(dir, { recursive: true })
        cfgPath = join(dir, 'config.json')
        logPath = join(dir, 'host.log')
      } catch { return }
    }
    try { appendFileSync(logPath, '[' + new Date().toISOString() + '] ' + line + '\n') } catch { /* 忽略 */ }
  }
  const log = (...parts) => tryWrite(parts.join(' '))

  // 整体兜底：apply 内任何异常只写日志，绝不外抛。
  try {
    tryWrite('boot start v' + VERSION)

    let core = null
    try {
      core = createOffpeakCore({
        deliver: async (item) => {
          try {
            await deliverOnce(ctx, item)
            log('delivery ' + item.id + ' target=' + item.sessionId + ': ok')
          } catch (error) {
            const message = error && error.message ? String(error.message) : String(error)
            log('delivery ' + item.id + ' target=' + item.sessionId + ': failed: ' + message.slice(0, 1000))
            throw error
          }
        },
      })
    } catch (error) {
      log('core create failed:', error && error.message)
      return
    }

    const loadConfig = () => {
      try {
        if (existsSync(cfgPath)) core.importConfig(JSON.parse(readFileSync(cfgPath, 'utf8')))
      } catch (error) { log('config load failed:', error && error.message) }
    }
    const commit = () => {
      try {
        mkdirSync(dir, { recursive: true })
        writeFileSync(cfgPath, JSON.stringify(core.exportConfig(), null, 2), 'utf8')
      } catch (error) { log('config write failed:', error && error.message) }
    }
    const snapshot = () => Object.assign({}, core.snapshot(), {
      version: VERSION,
      configPath: cfgPath,
      route: ROUTE_PREFIX,
    })

    const dispatch = (action, args) => {
      const fail = (message) => ({ resp: { ok: false, error: message, state: snapshot() } })
      const done = () => ({ resp: { ok: true, state: snapshot() } })
      const flag = (key) => typeof args[key] === 'boolean'
      switch (action) {
        case 'setPlanMode':
          if (!flag('planMode')) return fail('参数无效：planMode 须为布尔')
          core.setPlanMode(args.planMode); commit(); return done()
        case 'setEnabled':
          if (!flag('enabled')) return fail('参数无效：enabled 须为布尔')
          core.setEnabled(args.enabled); commit(); return done()
        case 'setWeekendsOffPeak':
          if (!flag('weekendsOffPeak')) return fail('参数无效：weekendsOffPeak 须为布尔')
          core.setWeekendsOffPeak(args.weekendsOffPeak); commit(); return done()
        case 'setConcurrency': {
          const n = args.concurrency
          if (!Number.isInteger(n) || n < 1 || n > 5) return fail('参数无效：并发须为 1-5')
          core.setConcurrency(n); commit(); return done()
        }
        case 'setPeaks':
          if (!core.setPeaks(args.peaks)) return fail('参数无效：高峰时段须为 1-6 个有效且起止不同的时段')
          commit(); return done()
        case 'enqueue': {
          const out = core.enqueue({ text: args.text, sessionId: args.sessionId })
          if (out.ok !== true) return { resp: { ok: false, error: out.error, state: snapshot() } }
          log('enqueue ' + out.item.id + ' target=' + out.item.sessionId)
          return done()
        }
        case 'force': {
          const out = core.force(typeof args.id === 'string' ? args.id : '')
          if (out.ok !== true) return fail(out.error)
          return done()
        }
        case 'revoke': {
          const out = core.revoke(typeof args.id === 'string' ? args.id : '')
          if (out.ok !== true) return fail(out.error)
          return done()
        }
        case 'reorder': {
          const out = core.reorder(typeof args.id === 'string' ? args.id : '', args.zone, args.toIndex)
          if (out.ok !== true) return fail(out.error)
          return done()
        }
        case 'clearHistory':
          core.clearHistory(); return done()
        default:
          return fail('未知动作：' + action)
      }
    }

    const respondJson = (res, status, obj) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(obj))
    }
    const readBody = (req) => new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk) => {
        data += chunk
        if (data.length > 200000) { req.removeAllListeners(); resolve('') }
      })
      req.on('end', () => resolve(data))
      req.on('error', () => resolve(''))
    })

    const handleState = (_req, res) => respondJson(res, 200, snapshot())
    const handleAction = async (req, res) => {
      try {
        const raw = await readBody(req)
        let body = null
        try { body = JSON.parse(raw === '' ? '{}' : raw) } catch { /* 空处理 */ }
        const action = body && typeof body.action === 'string' ? body.action : ''
        const args = body && typeof body.args === 'object' && body.args !== null ? body.args : {}
        const out = dispatch(action, args)
        log('action ' + (action || '(empty)') + ': ' + (out.resp && out.resp.ok === true ? 'ok' : 'failed'))
        respondJson(res, out.httpStatus || 200, out.resp)
      } catch (error) {
        respondJson(res, 500, { ok: false, error: error && error.message ? String(error.message) : '内部错误' })
      }
    }
    const handleReport = async (req, res) => {
      try {
        const raw = await readBody(req)
        let body = null
        try { body = JSON.parse(raw === '' ? '{}' : raw) } catch { /* 空处理 */ }
        const level = body && body.level === 'error' ? 'error' : 'info'
        log('[client ' + level + ']', body && typeof body.message === 'string' ? body.message.slice(0, 1000) : '(empty)')
        respondJson(res, 200, { ok: true })
      } catch (error) {
        respondJson(res, 200, { ok: false })
      }
    }

    loadConfig()
    commit()
    log('boot ok v' + VERSION)

    ctx.effect(() => {
      const id = setInterval(() => { void core.tick().catch((e) => log('tick error:', e && e.message)) }, 2000)
      return () => clearInterval(id)
    }, 'offpeak-queue: ticker')
    void core.tick().catch((e) => log('tick error:', e && e.message))

    // webServer 缺席/注册失败都只是「无 UI 通道」，不影响 host 运行。
    try {
      ctx.inject(['webServer'], (scope) => {
        try {
          scope.effect(
            () => scope.webServer.register({ kind: 'exact', path: ROUTE_PREFIX + '/state', handler: handleState }),
            'offpeak-queue: state route',
          )
          scope.effect(
            () => scope.webServer.register({ kind: 'exact', path: ROUTE_PREFIX + '/action', handler: handleAction }),
            'offpeak-queue: action route',
          )
          scope.effect(
            () => scope.webServer.register({ kind: 'exact', path: ROUTE_PREFIX + '/report', handler: handleReport }),
            'offpeak-queue: report route',
          )
          log('routes registered: ' + ROUTE_PREFIX)
        } catch (error) {
          log('route registration failed:', error && error.message)
        }
      })
    } catch (error) {
      log('webServer inject failed:', error && error.message)
    }
  } catch (error) {
    log('apply crashed:', error && error.stack ? error.stack : String(error))
  }
}
