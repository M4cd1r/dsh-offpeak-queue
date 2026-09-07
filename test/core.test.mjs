// dsh-offpeak-queue —— 核心逻辑单元测试（不依赖任何 Cordis ctx）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore } from '../src/core.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 2026-09-07 周一 / 09-05 周六 / 09-06 周日
const MON = (isoTime) => new Date('2026-09-07T' + isoTime)
const SAT = (isoTime) => new Date('2026-09-05T' + isoTime)
const SUN = (isoTime) => new Date('2026-09-06T' + isoTime)

function makeCore(overrides = {}) {
  const delivered = []
  const core = createOffpeakCore({
    now: overrides.now ?? (() => MON('13:30:00')),
    deliver: overrides.deliver ?? (async (item) => { delivered.push(item) }),
  })
  return { core, delivered }
}

test('phase：工作日高峰窗口 09-12/14-18 与午休边界', () => {
  const { core } = makeCore()
  assert.equal(core.phase(MON('10:30:00')), 'peak')
  assert.equal(core.phase(MON('12:00:00')), 'trough')
  assert.equal(core.phase(MON('15:00:00')), 'peak')
  assert.equal(core.phase(MON('19:00:00')), 'trough')
})

test('phase：跨午夜窗口', () => {
  const { core } = makeCore()
  core.setPeaks([{ startH: 23, endH: 8 }])
  assert.equal(core.phase(MON('02:00:00')), 'peak')
  assert.equal(core.phase(MON('12:00:00')), 'trough')
})

test('周末默认视为低谷（周六日全天 trough）；可关闭', () => {
  const { core } = makeCore()
  assert.equal(core.phase(SUN('10:30:00')), 'trough')
  assert.equal(core.phase(SAT('15:00:00')), 'trough')
  core.setWeekendsOffPeak(false)
  assert.equal(core.phase(SUN('10:30:00')), 'peak')
})

test('默认配置：直接发送(planMode=false)、周末低谷开、窗口 09-12/14-18、并发 1', () => {
  const s = makeCore().core.snapshot()
  assert.equal(s.planMode, false)
  assert.equal(s.weekendsOffPeak, true)
  assert.equal(s.enabled, true)
  assert.equal(s.concurrency, 1)
  assert.deepEqual(s.peaks, [{ startH: 9, endH: 12 }, { startH: 14, endH: 18 }])
})

test('高峰入队后 tick 不投递；低谷 tick 自动投递并清空队列', async () => {
  const { core, delivered } = makeCore({ now: () => MON('10:30:00') })
  assert.equal(core.enqueue({ text: 'hello' }).ok, true)
  await core.tick()
  assert.equal(delivered.length, 0)
  // 推进到低谷再 tick
  await core.tick(MON('13:30:00'))
  await sleep(10)
  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].text, 'hello')
  assert.equal(core.snapshot().counts.waiting + core.snapshot().counts.work, 0)
  assert.equal(core.snapshot().history[0].status, 'done')
})

test('低谷自动投递遵守并发上限', async () => {
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
  assert.equal(delivered.length, 2) // 并发 2：只有 2 条进入投递
  assert.equal(core.snapshot().counts.waiting, 1)
  resolveOne()
  await sleep(10)
  // 放行后下一次 tick 再投递第 3 条
  await core.tick()
  await sleep(10)
  assert.equal(delivered.length, 3)
})

test('投递失败自动重试：前两次失败第三次成功 → done', async () => {
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
  await core.tick(MON('13:30:06'))   // 冷却后
  await sleep(10)
  assert.equal(core.snapshot().waiting[0].attempts, 2)
  await core.tick(MON('13:30:12'))
  await sleep(10)
  const s = core.snapshot()
  assert.equal(s.waiting.length, 0)
  assert.equal(s.history[0].status, 'done')
  assert.equal(delivered.length, 1)
})

test('连续失败 3 次 → failed 入历史', async () => {
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

test('强制执行无视时段立即投递；撤销/排序/清历史可用', async () => {
  const { core, delivered } = makeCore({ now: () => MON('10:30:00') }) // 高峰
  const a = core.enqueue({ text: 'A' })
  const b = core.enqueue({ text: 'B' })
  assert.equal(a.ok && b.ok, true)
  // 重排：A 排到队首
  assert.equal(core.reorder(a.item.id, 'waiting', 0).ok, true)
  assert.equal(core.snapshot().waiting[0].id, a.item.id)
  // 撤销 B
  assert.equal(core.revoke(b.item.id).ok, true)
  assert.equal(core.snapshot().waiting.some((i) => i.id === b.item.id), false)
  // 强制执行 A（高峰也立即投递）
  assert.equal(core.force(a.item.id).ok, true)
  await sleep(10)
  assert.equal(delivered.length, 1)
  assert.equal(core.snapshot().history[0].status, 'done')
  core.clearHistory()
  assert.equal(core.snapshot().history.length, 0)
})

test('配置序列化/解析往返', () => {
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

test('禁用时拒绝入队但允许撤销已有队列', () => {
  const { core, delivered } = makeCore({ now: () => MON('13:30:00') })
  core.enqueue({ text: 'x' })
  core.setEnabled(false)
  assert.equal(core.enqueue({ text: 'y' }).ok, false)
  assert.equal(core.revoke(core.snapshot().waiting[0].id).ok, true)
  core.setEnabled(true)
})
