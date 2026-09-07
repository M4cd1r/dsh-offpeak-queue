import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore, phaseOf } from '../src/core.mjs'

test('分钟级高峰窗口：支持同小时区间及结束边界', () => {
  const peaks = [{ startH: 20, startM: 15, endH: 20, endM: 16 }]
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:15:00')), 'peak')
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:15:59')), 'peak')
  assert.equal(phaseOf(peaks, false, new Date('2026-09-07T20:16:00')), 'trough')
})

test('分钟级高峰窗口：配置导入导出保留分钟', () => {
  const core = createOffpeakCore({ deliver: async () => {} })
  core.importConfig({ peaks: [{ startH: 23, startM: 59, endH: 0, endM: 1 }] })
  assert.deepEqual(core.exportConfig().peaks, [{ startH: 23, startM: 59, endH: 0, endM: 1 }])
  assert.equal(core.phase(new Date('2026-09-07T23:59:30')), 'peak')
  assert.equal(core.phase(new Date('2026-09-08T00:01:00')), 'trough')
})
