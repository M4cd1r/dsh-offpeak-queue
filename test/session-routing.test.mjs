// dsh-offpeak-queue — session routing tests
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOffpeakCore } from '../src/core.mjs'

test('three queued messages keep their own A/B/C target sessions', async () => {
  const delivered = []
  const core = createOffpeakCore({
    deliver: async (item) => { delivered.push({ id: item.id, sessionId: item.sessionId, text: item.text }) },
    now: () => new Date(2026, 8, 7, 20, 0, 0),
    phaseForItem: () => 'trough',
  })
  core.setConcurrency(3)

  const targets = [
    ['existing session A', 'session-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    ['new session B', 'session-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    ['existing session C', 'session-cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  ]
  for (const [text, sessionId] of targets) assert.equal(core.enqueue({ text, sessionId }).ok, true)

  await core.tick(new Date(2026, 8, 7, 20, 0, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(delivered.map((item) => item.sessionId), targets.map((entry) => entry[1]))
  const historyByText = new Map(core.snapshot().history.map((item) => [item.text, item.sessionId]))
  assert.deepEqual(targets.map(([text]) => historyByText.get(text)), targets.map((entry) => entry[1]))
})
