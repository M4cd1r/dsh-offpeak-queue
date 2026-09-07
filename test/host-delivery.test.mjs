import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverOnce } from '../index.js'

const ITEM = {
  id: 'q1',
  sessionId: 'session-test',
  text: 'queued text',
}

test('host delivery：优先通过 apiProxy.sessions.prompt 投递冷会话', async () => {
  let request
  let agentsRead = false
  const ctx = {
    get(name) {
      if (name === 'apiProxy') {
        return {
          sessions: {
            async prompt(value) {
              request = value
              return { rpcId: 'rpc-test', result: { ok: true, value: { accepted: true } } }
            },
          },
        }
      }
      if (name === 'agents') agentsRead = true
      return undefined
    },
  }

  await deliverOnce(ctx, ITEM)
  assert.match(request.rpcId, /^offpeak-queue-[0-9a-f-]{36}$/i)
  assert.deepEqual(request.payload, {
      sessionId: 'session-test',
      mode: 'queue',
      content: [{ type: 'text', text: 'queued text' }],
    })
  assert.equal(agentsRead, false)
})

test('host delivery：apiProxy 拒绝时作为失败向核心状态机返回', async () => {
  const ctx = {
    apiProxy: {
      sessions: {
        async prompt() {
          return { result: { ok: false, error: { code: 'SESSION_NOT_FOUND', message: '目标会话不存在' } } }
        },
      },
    },
  }
  await assert.rejects(() => deliverOnce(ctx, ITEM), /SESSION_NOT_FOUND: 目标会话不存在/)
})

test('host delivery：apiProxy 明确返回 accepted=false 时作为失败', async () => {
  const ctx = {
    apiProxy: {
      sessions: {
        async prompt() { return { result: { ok: true, value: { accepted: false } } } },
      },
    },
  }
  await assert.rejects(() => deliverOnce(ctx, ITEM), /拒绝接收/)
})

test('host delivery：旧宿主在线 agent 后备消息包含完整 UserMessage 字段', async () => {
  let message
  const ctx = {
    agents: {
      get(id) {
        assert.equal(id, 'session-test')
        return { followup(value) { message = value } }
      },
    },
  }

  await deliverOnce(ctx, ITEM)
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'user')
  assert.deepEqual(message.content, [{ type: 'text', text: 'queued text' }])
  assert.match(message.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})

test('host delivery：无标准通道且目标会话离线时明确失败', async () => {
  await assert.rejects(
    () => deliverOnce({ agents: { get: () => undefined } }, ITEM),
    /session\.prompt 不可用/,
  )
})

test('host delivery：拒绝缺少会话标识的队列项', async () => {
  await assert.rejects(() => deliverOnce({}, { text: 'x' }), /缺少目标会话/)
})
