// dsh-offpeak-queue — host delivery unit tests (no Cordis context required)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverOnce } from '../index.js'

const ITEM = {
  id: 'q1',
  sessionId: 'session-test',
  text: 'queued text',
}

/**
 * Emulate a Cordis context: services resolve through `get`, while reading an
 * undeclared service as a plain property throws exactly like the real proxy
 * (cannot get property "x" without inject).
 */
function cordisCtx(services) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'string' && Object.hasOwn(services, prop)) return services[prop]
      if (prop === 'get') return (name) => services[name]
      throw new Error('cannot get property "' + String(prop) + '" without inject')
    },
  })
}

function sessionControllerCalls() {
  const calls = []
  return {
    calls,
    service: {
      prompt(request, signal) {
        calls.push({ request, signal })
        return Promise.resolve({ accepted: true })
      },
    },
  }
}

test('host delivery: sessionController.prompt delivers a cold session on a Cordis context', async () => {
  const { calls, service } = sessionControllerCalls()
  const ctx = cordisCtx({ sessionController: service })

  await deliverOnce(ctx, ITEM)

  assert.equal(calls.length, 1)
  const { request, signal } = calls[0]
  assert.match(request.requestId, /^offpeak-queue-[0-9a-f-]{36}$/i)
  assert.equal(request.sessionId, 'session-test')
  assert.equal(request.mode, 'queue')
  assert.deepEqual(request.content, [{ type: 'text', text: 'queued text' }])
  assert.equal(typeof signal?.throwIfAborted, 'function')
})

test('host delivery: an undeclared service read never crashes delivery', async () => {
  const { calls, service } = sessionControllerCalls()
  const ctx = cordisCtx({ sessionController: service })

  await assert.doesNotReject(() => deliverOnce(ctx, ITEM))
  assert.equal(calls.length, 1)
})

test('host delivery: sessionController rejection surfaces as a delivery failure', async () => {
  const ctx = cordisCtx({
    sessionController: {
      prompt() {
        return Promise.reject(Object.assign(new Error('session "session-test" not found'), { code: 'session/not-found' }))
      },
    },
  })

  await assert.rejects(() => deliverOnce(ctx, ITEM), /session "session-test" not found/)
})

test('host delivery: apiProxy hosts are served with the payload shape they expect', async () => {
  let call
  const ctx = cordisCtx({
    apiProxy: {
      sessions: {
        prompt(payload, signal) {
          call = { payload, signal }
          return Promise.resolve({ rpcId: 'rpc-test', result: { ok: true, value: { accepted: true } } })
        },
      },
    },
  })

  await deliverOnce(ctx, ITEM)

  assert.deepEqual(call.payload, {
    sessionId: 'session-test',
    mode: 'queue',
    content: [{ type: 'text', text: 'queued text' }],
  })
  assert.equal(typeof call.signal?.throwIfAborted, 'function')
})

test('host delivery: apiProxy rejection surfaces as a delivery failure', async () => {
  const ctx = cordisCtx({
    apiProxy: {
      sessions: {
        prompt() {
          return Promise.resolve({ result: { ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'target session missing' } } })
        },
      },
    },
  })

  await assert.rejects(() => deliverOnce(ctx, ITEM), /SESSION_NOT_FOUND: target session missing/)
})

test('host delivery: explicit accepted=false fails the delivery', async () => {
  const ctx = cordisCtx({
    apiProxy: {
      sessions: {
        prompt() {
          return Promise.resolve({ result: { ok: true, value: { accepted: false } } })
        },
      },
    },
  })

  await assert.rejects(() => deliverOnce(ctx, ITEM), /refused to accept/)
})

test('host delivery: online-agent fallback sends a full UserMessage', async () => {
  let message
  const ctx = cordisCtx({
    agents: {
      get(id) {
        assert.equal(id, 'session-test')
        return { followup(value) { message = value } }
      },
    },
  })

  await deliverOnce(ctx, ITEM)

  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'user')
  assert.deepEqual(message.content, [{ type: 'text', text: 'queued text' }])
  assert.match(message.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})

test('host delivery: no prompt channel with an offline target fails clearly', async () => {
  const ctx = cordisCtx({ agents: { get: () => undefined } })

  await assert.rejects(() => deliverOnce(ctx, ITEM), /no prompt channel/)
})

test('host delivery: an item without a session id is rejected', async () => {
  await assert.rejects(() => deliverOnce(cordisCtx({}), { text: 'x' }), /missing target session/)
})
