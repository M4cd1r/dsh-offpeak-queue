// dsh-offpeak-queue — host delivery unit tests (no Cordis context required)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverOnce } from '../index.js'

const ITEM = {
  id: 'q1',
  sessionId: 'session-test',
  text: 'queued text',
}

test('host delivery: cold sessions use apiProxy.sessions.prompt first', async () => {
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

test('host delivery: apiProxy rejection surfaces as a delivery failure', async () => {
  const ctx = {
    apiProxy: {
      sessions: {
        async prompt() {
          return { result: { ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'target session missing' } } }
        },
      },
    },
  }
  await assert.rejects(() => deliverOnce(ctx, ITEM), /SESSION_NOT_FOUND: target session missing/)
})

test('host delivery: explicit accepted=false fails the delivery', async () => {
  const ctx = {
    apiProxy: {
      sessions: {
        async prompt() { return { result: { ok: true, value: { accepted: false } } } },
      },
    },
  }
  await assert.rejects(() => deliverOnce(ctx, ITEM), /refused to accept/)
})

test('host delivery: legacy online-agent fallback sends a full UserMessage', async () => {
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

test('host delivery: missing standard channel with an offline target fails clearly', async () => {
  await assert.rejects(
    () => deliverOnce({ agents: { get: () => undefined } }, ITEM),
    /session.prompt is unavailable/,
  )
})

test('host delivery: an item without a session id is rejected', async () => {
  await assert.rejects(() => deliverOnce({}, { text: 'x' }), /missing target session/)
})
