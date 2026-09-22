// dsh-offpeak-queue — core state machine tests (no legacy fallback)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore } from '../src/core.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NOW = new Date('2026-09-07T10:30:00Z')
const trough = () => 'trough'
const peak = () => 'peak'

function makeCore(overrides = {}) {
  const delivered = []
  const core = createOffpeakCore({
    now: overrides.now ?? (() => NOW),
    phaseForItem: overrides.phaseForItem ?? trough,
    deliver: overrides.deliver ?? (async (item) => { delivered.push(item) }),
  })
  return { core, delivered }
}

test('createOffpeakCore requires a phaseForItem resolver', () => {
  assert.throws(() => createOffpeakCore({ deliver: async () => {} }), /phaseForItem/)
})

test('snapshot no longer exposes legacy peaks or weekends settings', () => {
  const s = makeCore().core.snapshot()
  assert.equal('peaks' in s, false)
  assert.equal('weekendsOffPeak' in s, false)
  assert.equal('phase' in s, false)
})

test('defaults: direct send, concurrency 1, enabled', () => {
  const s = makeCore().core.snapshot()
  assert.equal(s.planMode, false)
  assert.equal(s.enabled, true)
  assert.equal(s.concurrency, 1)
})

test('queued items keep their provider/model pair', () => {
  const { core } = makeCore()
  const out = core.enqueue({ text: 'hello', sessionId: 's', providerId: 'deepseek-official', modelId: 'deepseek-chat' })
  assert.equal(out.ok, true)
  const item = core.snapshot().waiting[0]
  assert.equal(item.providerId, 'deepseek-official')
  assert.equal(item.modelId, 'deepseek-chat')
})

test('tick delivers only items whose provider is off-peak', async () => {
  const delivered = []
  const core = createOffpeakCore({
    now: () => NOW,
    deliver: async (item) => { delivered.push(item) },
    phaseForItem: (item) => item.providerId === 'zai' ? 'trough' : 'peak',
  })
  core.enqueue({ text: 'deepseek task', providerId: 'deepseek-official' })
  core.enqueue({ text: 'zai task', providerId: 'zai' })
  await core.tick(NOW)
  await sleep(10)
  assert.deepEqual(delivered.map((i) => i.text), ['zai task'])
  assert.equal(core.snapshot().waiting.length, 1)
  assert.equal(core.snapshot().waiting[0].text, 'deepseek task')
})

test('peak items never deliver on tick', async () => {
  const { core, delivered } = makeCore({ phaseForItem: peak })
  core.enqueue({ text: 'x', providerId: 'deepseek-official' })
  await core.tick(NOW)
  await sleep(10)
  assert.equal(delivered.length, 0)
  assert.equal(core.snapshot().waiting.length, 1)
})

test('trough delivery respects the concurrency limit', async () => {
  let resolveOne
  const gate = new Promise((r) => { resolveOne = r })
  const { core, delivered } = makeCore({
    deliver: async (item) => { delivered.push(item); await gate },
  })
  core.setConcurrency(2)
  core.enqueue({ text: 'a' })
  core.enqueue({ text: 'b' })
  core.enqueue({ text: 'c' })
  await core.tick(NOW)
  await sleep(10)
  assert.equal(delivered.length, 2)
  assert.equal(core.snapshot().counts.waiting, 1)
  resolveOne()
  await sleep(10)
  await core.tick(NOW)
  await sleep(10)
  assert.equal(delivered.length, 3)
})

test('failed deliveries retry: two failures then success', async () => {
  let attempts = 0
  const { core, delivered } = makeCore({
    deliver: async (item) => {
      attempts++
      if (attempts < 3) throw new Error('boom ' + attempts)
      delivered.push(item)
    },
  })
  core.enqueue({ text: 'retry-me' })
  await core.tick(NOW)
  await sleep(10)
  assert.equal(core.snapshot().waiting.length, 1)
  assert.equal(core.snapshot().waiting[0].attempts, 1)
  await core.tick(new Date(NOW.getTime() + 6000))
  await sleep(10)
  assert.equal(core.snapshot().waiting[0].attempts, 2)
  await core.tick(new Date(NOW.getTime() + 12000))
  await sleep(10)
  const s = core.snapshot()
  assert.equal(s.waiting.length, 0)
  assert.equal(s.history[0].status, 'done')
  assert.equal(delivered.length, 1)
})

test('three consecutive failures move the item to failed history', async () => {
  const { core, delivered } = makeCore({ deliver: async () => { throw new Error('always') } })
  core.enqueue({ text: 'doomed' })
  for (const offset of [0, 6000, 12000]) {
    await core.tick(new Date(NOW.getTime() + offset))
    await sleep(10)
  }
  const s = core.snapshot()
  assert.equal(s.waiting.length, 0)
  assert.equal(s.history.length, 1)
  assert.equal(s.history[0].status, 'failed')
  assert.equal(delivered.length, 0)
})

test('force ignores the window; revoke/reorder/clear history work', async () => {
  const { core, delivered } = makeCore({ phaseForItem: peak })
  const a = core.enqueue({ text: 'A' })
  const b = core.enqueue({ text: 'B' })
  assert.equal(a.ok && b.ok, true)
  assert.equal(core.reorder(a.item.id, 'waiting', 0).ok, true)
  assert.equal(core.snapshot().waiting[0].id, a.item.id)
  assert.equal(core.revoke(b.item.id).ok, true)
  assert.equal(core.snapshot().waiting.some((i) => i.id === b.item.id), false)
  assert.equal(core.force(a.item.id).ok, true)
  await sleep(10)
  assert.equal(delivered.length, 1)
  assert.equal(core.snapshot().history[0].status, 'done')
  core.clearHistory()
  assert.equal(core.snapshot().history.length, 0)
})

test('config export/import round-trips only the remaining policy fields', () => {
  const { core } = makeCore()
  core.setPlanMode(true)
  core.setConcurrency(2)
  core.setEnabled(false)
  const json = core.exportConfig()
  assert.equal('peaks' in json, false)
  assert.equal('weekendsOffPeak' in json, false)
  const core2 = makeCore().core
  core2.importConfig(json)
  const s = core2.snapshot()
  assert.equal(s.planMode, true)
  assert.equal(s.concurrency, 2)
  assert.equal(s.enabled, false)
})

test('disabled mode rejects enqueue but still allows revoking existing items', () => {
  const { core } = makeCore()
  core.enqueue({ text: 'x' })
  core.setEnabled(false)
  assert.equal(core.enqueue({ text: 'y' }).ok, false)
  assert.equal(core.revoke(core.snapshot().waiting[0].id).ok, true)
})
