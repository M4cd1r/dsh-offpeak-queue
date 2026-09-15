// dsh-offpeak-queue — core state machine (pure JS, no framework dependencies)
// Responsibility: per-item off-peak delivery. The host supplies a phaseForItem
// resolver that consults dsh-offpeak; there is no legacy fallback scheduler.
import { randomUUID } from 'node:crypto'

const FAIL_MAX = 3
const FAIL_COOLDOWN_MS = 5000
const QUEUE_LIMIT = 200
const TEXT_LIMIT = 50000

export function createOffpeakCore({ deliver, now = () => new Date(), phaseForItem }) {
  if (typeof phaseForItem !== 'function') throw new Error('createOffpeakCore requires phaseForItem')
  if (typeof deliver !== 'function') throw new Error('createOffpeakCore requires deliver')

  const state = {
    enabled: true,
    planMode: false,
    concurrency: 1,
    waiting: [],
    work: [],
    history: [],
    seq: 0,
    lastFailAt: 0,
  }
  const submit = deliver

  const view = (item) => ({
    id: item.id,
    text: item.text,
    sessionId: item.sessionId,
    providerId: item.providerId,
    modelId: item.modelId,
    createdAt: item.createdAt,
    status: item.status,
    attempts: item.attempts,
    error: item.error,
  })
  const viewHistory = (h) => ({
    id: h.id,
    text: typeof h.text === 'string' ? h.text.slice(0, 2000) : '',
    sessionId: h.sessionId,
    providerId: h.providerId,
    modelId: h.modelId,
    createdAt: h.createdAt,
    status: h.status,
    attempts: h.attempts,
    error: h.error,
    doneAt: h.doneAt,
  })
  const findItem = (id) =>
    state.waiting.find((i) => i.id === id) ?? state.work.find((i) => i.id === id)
  const removeFromZones = (item) => {
    for (const arr of [state.waiting, state.work]) {
      const idx = arr.indexOf(item)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }
  const pushHistory = (item, status, error) => {
    state.history.unshift({
      id: item.id,
      text: item.text,
      sessionId: item.sessionId,
      providerId: item.providerId,
      modelId: item.modelId,
      createdAt: item.createdAt,
      status,
      attempts: item.attempts,
      error,
      doneAt: Date.now(),
    })
    if (state.history.length > 50) state.history.length = 50
  }

  async function execute(item, when) {
    try {
      await submit(item)
      removeFromZones(item)
      pushHistory(item, 'done')
    } catch (error) {
      item.attempts = (item.attempts || 0) + 1
      item.error = error instanceof Error ? error.message : String(error)
      if (item.attempts >= FAIL_MAX) {
        removeFromZones(item)
        pushHistory(item, 'failed', item.error)
      } else {
        removeFromZones(item)
        item.status = 'waiting'
        state.waiting.unshift(item)
        state.lastFailAt = when.getTime()
      }
    }
  }

  const api = {
    snapshot: () => ({
      version: 1,
      enabled: state.enabled,
      planMode: state.planMode,
      concurrency: state.concurrency,
      counts: { waiting: state.waiting.length, work: state.work.length },
      waiting: state.waiting.map(view),
      work: state.work.map(view),
      history: state.history.slice(0, 20).map(viewHistory),
    }),
    setEnabled: (v) => { state.enabled = v === true },
    setPlanMode: (v) => { state.planMode = v === true },
    setConcurrency: (n) => { if (Number.isInteger(n) && n >= 1 && n <= 5) state.concurrency = n },
    enqueue: ({ text, sessionId, providerId, modelId }) => {
      if (state.enabled !== true) return { ok: false, error: 'plugin disabled' }
      if (state.waiting.length + state.work.length >= QUEUE_LIMIT) return { ok: false, error: 'queue is full' }
      const clean = typeof text === 'string' ? text.trim() : ''
      if (clean === '') return { ok: false, error: 'input is empty' }
      if (clean.length > TEXT_LIMIT) return { ok: false, error: 'input is too long' }
      const item = {
        id: 'q' + (++state.seq),
        text: clean,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        providerId: typeof providerId === 'string' && providerId !== '' ? providerId : undefined,
        modelId: typeof modelId === 'string' && modelId !== '' ? modelId : undefined,
        createdAt: now().getTime(),
        status: 'waiting',
        attempts: 0,
      }
      state.waiting.push(item)
      return { ok: true, item: view(item) }
    },
    force: (id) => {
      const item = findItem(id)
      if (!item) return { ok: false, error: 'item not found' }
      removeFromZones(item)
      item.status = 'work'
      state.work.push(item)
      void execute(item, now())
      return { ok: true }
    },
    revoke: (id) => {
      const item = findItem(id)
      if (!item) return { ok: false, error: 'item not found' }
      removeFromZones(item)
      pushHistory(item, 'revoked')
      return { ok: true }
    },
    reorder: (id, zone, toIndex) => {
      const arr = zone === 'waiting' ? state.waiting : zone === 'work' ? state.work : null
      if (!arr) return { ok: false, error: 'invalid zone' }
      const from = arr.findIndex((i) => i.id === id)
      if (from < 0) return { ok: false, error: 'item not found' }
      const [moved] = arr.splice(from, 1)
      arr.splice(Math.max(0, Math.min(typeof toIndex === 'number' ? toIndex : arr.length, arr.length)), 0, moved)
      return { ok: true }
    },
    clearHistory: () => { state.history.length = 0 },
    exportConfig: () => ({
      enabled: state.enabled,
      planMode: state.planMode,
      concurrency: state.concurrency,
    }),
    importConfig: (cfg) => {
      if (!cfg || typeof cfg !== 'object') return
      if (typeof cfg.enabled === 'boolean') state.enabled = cfg.enabled
      if (typeof cfg.planMode === 'boolean') state.planMode = cfg.planMode
      if (Number.isInteger(cfg.concurrency) && cfg.concurrency >= 1 && cfg.concurrency <= 5) state.concurrency = cfg.concurrency
    },
    tick: async (date) => {
      const when = date ?? now()
      if (state.enabled !== true) return
      if (when.getTime() - state.lastFailAt < FAIL_COOLDOWN_MS) return
      let index = 0
      while (index < state.waiting.length && state.work.length < state.concurrency) {
        const item = state.waiting[index]
        if (phaseForItem(item, when) !== 'trough') {
          index += 1
          continue
        }
        state.waiting.splice(index, 1)
        item.status = 'work'
        state.work.push(item)
        void execute(item, when)
      }
    },
  }
  return api
}
