// dsh-offpeak-queue — host integration with the dsh-offpeak plugin
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { offpeakPhase, resolveSessionPair } from '../index.js'

function serviceCtx(map) {
  return {
    get(name) {
      return map[name]
    },
  }
}

test('resolveSessionPair reads the live session header config', () => {
  const ctx = serviceCtx({
    sessions: {
      get() {
        return {
          requestHeader() {
            return { config: { provider: 'deepseek-official', model: 'deepseek-chat' } }
          },
        }
      },
    },
  })
  assert.deepEqual(resolveSessionPair(ctx, 'session-test'), {
    providerId: 'deepseek-official',
    modelId: 'deepseek-chat',
  })
})

test('resolveSessionPair falls back to the default model selection', () => {
  const ctx = serviceCtx({
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'zai', model: 'glm-5.2' }
      },
    },
  })
  assert.deepEqual(resolveSessionPair(ctx, 'session-test'), {
    providerId: 'zai',
    modelId: 'glm-5.2',
  })
})

test('resolveSessionPair returns an empty pair when nothing is known', () => {
  assert.deepEqual(resolveSessionPair(serviceCtx({}), 'session-test'), {})
})

test('offpeakPhase maps dsh-offpeak window kinds to peak/trough', () => {
  const ctx = serviceCtx({
    offpeak: {
      windowKindFor(providerId, modelId, at) {
        if (providerId === 'deepseek-official') return 'peak'
        if (providerId === 'zai') return 'offpeak'
        return null
      },
    },
  })
  assert.equal(offpeakPhase(ctx, 'deepseek-official', 'deepseek-chat', new Date()), 'peak')
  assert.equal(offpeakPhase(ctx, 'zai', 'glm-5.2', new Date()), 'trough')
  assert.equal(offpeakPhase(ctx, 'unknown-provider', 'model', new Date()), null)
})

test('offpeakPhase returns null without a usable offpeak service', () => {
  assert.equal(offpeakPhase(serviceCtx({}), 'deepseek-official', 'deepseek-chat', new Date()), null)
  const broken = serviceCtx({ offpeak: { windowKindFor() { throw new Error('boom') } } })
  assert.equal(offpeakPhase(broken, 'deepseek-official', 'deepseek-chat', new Date()), null)
})
