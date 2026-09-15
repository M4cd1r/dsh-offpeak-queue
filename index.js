// dsh-offpeak-queue —— Host 半侧（原生静态 bundle · 防御版）
// 硬约束：apply() 永不向外抛异常 —— 任何一步失败都只写 host.log，绝不拖垮启动/组合。
// 对外通道：GET /dsh-offpeak-queue/state（轮询快照）、POST /action（动作）、POST /report（客户端错误上报）。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import os from 'node:os'
import { createOffpeakCore } from './src/core.mjs'

export const name = 'offpeak-queue'
const VERSION = '0.1.8'
const ROUTE_PREFIX = '/dsh-offpeak-queue'

function homeRoot() {
  const env = typeof process !== 'undefined' && process.env ? process.env.DSH_HOME : undefined
  return typeof env === 'string' && env !== '' ? env : join(os.homedir(), '.dsh')
}

/** 把一个排队消息投递到它记录的目标会话。 */
export async function deliverOnce(ctx, item) {
  if (!item || typeof item.sessionId !== 'string' || item.sessionId === '') {
    throw new Error('missing target session')
  }

  // 首选宿主的标准 session.prompt 通道。它会生成完整 UserMessage，并按会话已保存的
  // composition/provider/model 恢复冷会话；直接 agents.resume 缺少这些参数会在等待数小时后失败。
  let apiProxy
  try {
    apiProxy = ctx && typeof ctx.get === 'function' ? ctx.get('apiProxy') : undefined
  } catch { apiProxy = undefined }
  if (!apiProxy && ctx) apiProxy = ctx.apiProxy
  if (apiProxy && apiProxy.sessions && typeof apiProxy.sessions.prompt === 'function') {
    const response = await apiProxy.sessions.prompt({
      rpcId: 'offpeak-queue-' + randomUUID(),
      payload: {
        sessionId: item.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: item.text }],
      },
    })
    const result = response && typeof response === 'object' ? response.result : undefined
    if (result && typeof result === 'object' && result.ok === false) {
      const error = result.error && typeof result.error === 'object' ? result.error : {}
      const code = typeof error.code === 'string' && error.code !== '' ? error.code + ': ' : ''
      const message = typeof error.message === 'string' && error.message !== '' ? error.message : 'DSH refused to accept the queued message'
      throw new Error(code + message)
    }
    const accepted = result && typeof result === 'object' && result.value && typeof result.value === 'object'
      ? result.value.accepted
      : result && typeof result === 'object' && 'accepted' in result
        ? result.accepted
      : response && typeof response === 'object' ? response.accepted : undefined
    if (accepted === false) throw new Error('DSH refused to accept the queued message')
    return
  }

  // 兼容缺少 apiProxy 的旧宿主：仅复用仍在线的 agent。消息必须包含 DSH UserMessage
  // 的 role/id；冷会话不在这里猜测模型配置，以免投递到错误的 composition。
  let agents
  try {
    agents = ctx && typeof ctx.get === 'function' ? ctx.get('agents') : undefined
  } catch { agents = undefined }
  if (!agents && ctx) agents = ctx.agents
  const agent = agents && typeof agents.get === 'function' ? agents.get(item.sessionId) : undefined
  if (!agent || typeof agent.followup !== 'function') {
    throw new Error('session.prompt is unavailable and the target session is offline')
  }
  const message = {
    content: [{ type: 'text', text: item.text }],
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
          if (!flag('planMode')) return fail('invalid argument: planMode must be a boolean')
          core.setPlanMode(args.planMode); commit(); return done()
        case 'setEnabled':
          if (!flag('enabled')) return fail('invalid argument: enabled must be a boolean')
          core.setEnabled(args.enabled); commit(); return done()
        case 'setWeekendsOffPeak':
          if (!flag('weekendsOffPeak')) return fail('invalid argument: weekendsOffPeak must be a boolean')
          core.setWeekendsOffPeak(args.weekendsOffPeak); commit(); return done()
        case 'setConcurrency': {
          const n = args.concurrency
          if (!Number.isInteger(n) || n < 1 || n > 5) return fail('invalid argument: concurrency must be between 1 and 5')
          core.setConcurrency(n); commit(); return done()
        }
        case 'setPeaks':
          if (!core.setPeaks(args.peaks)) return fail('invalid argument: peak hours must be 1-6 valid windows whose start and end differ')
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
          return fail('unknown action: ' + action)
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
        respondJson(res, 500, { ok: false, error: error && error.message ? String(error.message) : 'internal error' })
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
