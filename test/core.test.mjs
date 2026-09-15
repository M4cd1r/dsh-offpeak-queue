// dsh-offpeak-queue — core state machine unit tests (no Cordis context required)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore, phaseOf } from '../src/core.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 2026-09-07 is a Monday, 09-05 a Saturday, and 09-06 a Sunday.
const MON = (isoTime) => new Date('2026-09-07T' + isoTime)
const SAT = (isoTime) => new Date('2026-09-05T' + isoTime)
const SUN = (isoTime) => new Date('2026-09-06T' + isoTime)

function makeCore(overrides = {}) {
  const delivered = []
  const core = createOffpeakCore({
    now: overrides.now ?? (() => MON('13:30:00')),
    deliver: overrides.deliver ?? (async (item) => { delivered.push(item) }),
    ...(overrides.phaseForItem === undefined ? {} : { phaseForItem: overrides.phaseForItem }),
  })
  return { core, delivered }
}

test('phase: weekday peaks 09-12/14-18 and the lunch edge', () => {
  const { core } = makeCore()
  assert.equal(core.phase(MON('10:30:00')), 'peak')
  assert.equal(core.phase(MON('12:00:00')), 'trough')
  assert.equal(core.phase(MON('15:00:00')), 'peak')
  assert.equal(core.phase(MON('19:00:00')), 'trough')
})

test('phase: overnight windows wrap past midnight', () => {
  const { core } = makeCore()
  core.setPeaks([{ startH: 23, endH: 8 }])
  assert.equal(core.phase(MON('02:00:00')), 'peak')
  assert.equal(core.phase(MON('12:00:00')), 'trough')
})

test('weekends are off-peak by default and can be disabled', () => {
  const { core } = makeCore()
  assert.equal(core.phase(SUN('10:30:00')), 'trough')
  assert.equal(core.phase(SAT('15:00:00')), 'trough')
  core.setWeekendsOffPeak(false)
  assert.equal(core.phase(SUN('10:30:00')), 'peak')
})

test('defaults: direct send, weekends off-peak, 09-12/14-18 peaks, concurrency 1', () => {
  const s = makeCore().core.snapshot()
  assert.equal(s.planMode, false)
  assert.equal(s.weekendsOffPeak, true)
  assert.equal(s.enabled, true)
  assert.equal(s.concurrency, 1)
  assert.deepEqual(s.peaks, [{ startH: 9, endH: 12 }, { startH: 14, endH: 18 }])
})

test('peak enqueue does not deliver on tick; trough tick delivers and clears', async () => {
  const { core, delivered } = makeCore({ now: () => MON('10:30:00') })
  assert.equal(core.enqueue({ text: 'hello' }).ok, true)
  await core.tick()
  assert.equal(delivered.length, 0)
  await core.tick(MON('13:30:00'))
  await sleep(10)
  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].text, 'hello')
  assert.equal(core.snapshot().counts.waiting + core.snapshot().counts.work, 0)
  assert.equal(core.snapshot().history[0].status, 'done')
})

test('trough delivery respects the concurrency limit', async () => {
  let resolveOne
  const gate = new Promise((r) => { resolveOne = r })
  const { core, delivered } = makeCore({
    now: () => MON('13:30:00'),
    deliver: async (item) => { delivered.push(item); await gate },
  })
  core.setConcurrency(2)
  core.enqueue({ text: 'a' })
  core.enqueue({ text: 'b' })
  core.enqueue({ text: 'c' })
  await core.tick()
  await sleep(10)
  assert.equal(delivered.length, 2)
  assert.equal(core.snapshot().counts.waiting, 1)
  resolveOne()
  await sleep(10)
  await core.tick()
  await sleep(10)
  assert.equal(delivered.length, 3)
})

test('failed deliveries retry: two failures then success', async () => {
  let attempts = 0
  const { core, delivered } = makeCore({
    now: () => MON('13:30:00'),
    deliver: async (item) => {
      attempts++
      if (attempts < 3) throw new Error('boom ' + attempts)
      delivered.push(item)
    },
  })
  core.enqueue({ text: 'retry-me' })
  await core.tick(MON('13:30:00'))
  await sleep(10)
  assert.equal(core.snapshot().waiting.length, 1)
  assert.equal(core.snapshot().waiting[0].attempts, 1)
  await core.tick(MON('13:30:06'))
  await sleep(10)
  assert.equal(core.snapshot().waiting[0].attempts, 2)
  await core.tick(MON('13:30:12'))
  await sleep(10)
  const s = core.snapshot()
  assert.equal(s.waiting.length, 0)
  assert.equal(s.history[0].status, 'done')
  assert.equal(delivered.length, 1)
})

test('three consecutive failures move the item to failed history', async () => {
  const { core, delivered } = makeCore({
    now: () => MON('13:30:00'),
    deliver: async () => { throw new Error('always') },
  })
  core.enqueue({ text: 'doomed' })
  for (const t of ['13:30:00', '13:30:06', '13:30:12']) {
    await core.tick(MON(t))
    await sleep(10)
  }
  const s = core.snapshot()
  assert.equal(s.waiting.length, 0)
  assert.equal(s.history.length, 1)
  assert.equal(s.history[0].status, 'failed')
  assert.equal(delivered.length, 0)
})

test('force ignores the window; revoke/reorder/clear history work', async () => {
  const { core, delivered } = makeCore({ now: () => MON('10:30:00') })
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

test('config export/import round-trips', () => {
  const { core } = makeCore()
  core.setPlanMode(true)
  core.setWeekendsOffPeak(false)
  core.setConcurrency(2)
  core.setPeaks([{ startH: 8, endH: 22 }])
  const json = core.exportConfig()
  const core2 = makeCore().core
  core2.importConfig(json)
  const s = core2.snapshot()
  assert.equal(s.planMode, true)
  assert.equal(s.weekendsOffPeak, false)
  assert.equal(s.concurrency, 2)
  assert.deepEqual(s.peaks, [{ startH: 8, endH: 22 }])
})

test('disabled mode rejects enqueue but still allows revoking existing items', () => {
  const { core, delivered } = makeCore({ now: () => MON('13:30:00') })
  core.enqueue({ text: 'x' })
  core.setEnabled(false)
  assert.equal(core.enqueue({ text: 'y' }).ok, false)
  assert.equal(core.revoke(core.snapshot().waiting[0].id).ok, true)
  core.setEnabled(true)
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
    now: () => new Date('2026-09-07T10:30:00Z'),
    deliver: async (item) => { delivered.push(item) },
    phaseForItem: (item) => {
      if (item.providerId === 'zai') return 'trough'
      return 'peak'
    },
  })
  core.enqueue({ text: 'deepseek task', providerId: 'deepseek-official' })
  core.enqueue({ text: 'zai task', providerId: 'zai' })
  await core.tick(new Date('2026-09-07T10:30:00Z'))
  await sleep(10)
  assert.deepEqual(delivered.map((i) => i.text), ['zai task'])
  assert.equal(core.snapshot().waiting.length, 1)
  assert.equal(core.snapshot().waiting[0].text, 'deepseek task')
})

test('default phaseForItem falls back to the legacy configured peaks', async () => {
  const { core, delivered } = makeCore({ now: () => MON('13:30:00') })
  core.enqueue({ text: 'no provider' })
  await core.tick(MON('13:30:00'))
  await sleep(10)
  assert.equal(delivered.length, 1)
})

test('minute-level peaks: same-hour ranges and end boundary', () => {
  const peaks = [{ startH: 20, startM: 15, endH: 20, endM: 16 }]
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:15:00')), 'peak')
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:15:59')), 'peak')
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:16:00')), 'trough')
})

test('minute-level peaks: config export/import keeps minutes', () => {
  const core = createOffpeakCore({ deliver: async () => {} })
  core.importConfig({ peaks: [{ startH: 23, startM: 59, endH: 0, endM: 1 }] })
  assert.deepEqual(core.exportConfig().peaks, [{ startH: 23, startM: 59, endH: 0, endM: 1 }])
  assert.equal(core.phase(new Date('2026-09-07T23:59:30')), 'peak')
  assert.equal(core.phase(new Date('2026-09-08T00:01:00')), 'trough')
})
