import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore } from '../src/core.mjs'

test('三条队列消息保持各自的 A/B/C 目标会话', async () => {
  const delivered = []
  const core = createOffpeakCore({
    deliver: async (item) => { delivered.push({ id: item.id, sessionId: item.sessionId, text: item.text }) },
    now: () => new Date(2026, 8, 7, 20, 0, 0),
  })
  core.setConcurrency(3)
  core.setPeaks([{ startH: 9, endH: 12 }])

  const targets = [
    ['已有会话 A', 'session-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    ['新会话 B', 'session-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    ['已有会话 C', 'session-cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  ]
  for (const [text, sessionId] of targets) assert.equal(core.enqueue({ text, sessionId }).ok, true)

  await core.tick(new Date(2026, 8, 7, 20, 0, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(delivered.map((item) => item.sessionId), targets.map((entry) => entry[1]))
  const historyByText = new Map(core.snapshot().history.map((item) => [item.text, item.sessionId]))
  assert.deepEqual(targets.map(([text]) => historyByText.get(text)), targets.map((entry) => entry[1]))
})
