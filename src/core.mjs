// dsh-offpeak-queue —— 核心状态机（纯 JS，无任何框架依赖）
// 职责：价格时段/周末判定、待办队列（等待区/投递中）、失败重试、配置。
// 与 Cordis/UI 完全解耦：投递动作由调用方通过 deliver(item) 注入。

const DEFAULT_PEAKS = [
  { startH: 9, endH: 12 },
  { startH: 14, endH: 18 },
]
const FAIL_MAX = 3
const FAIL_COOLDOWN_MS = 5000
const QUEUE_LIMIT = 200
const TEXT_LIMIT = 50000

/** 纯时段判定：返回 'peak' | 'trough'。weekendsOffPeak=true 时周末全天低谷。 */
export function phaseOf(peaks, weekendsOffPeak, date) {
  if (weekendsOffPeak === true) {
    const day = date.getDay()
    if (day === 0 || day === 6) return 'trough'
  }
  const minuteOfDay = date.getHours() * 60 + date.getMinutes()
  for (const peak of peaks) {
    const s = peak.startH * 60 + (Number.isInteger(peak.startM) ? peak.startM : 0)
    const e = peak.endH * 60 + (Number.isInteger(peak.endM) ? peak.endM : 0)
    if (s === e) continue
    if (s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e) return 'peak'
  }
  return 'trough'
}

function validPeaks(value) {
  if (!Array.isArray(value)) return undefined
  const peaks = []
  for (const p of value) {
    if (p === null || typeof p !== 'object') return undefined
    const s = p.startH
    const e = p.endH
    const sm = p.startM === undefined ? 0 : p.startM
    const em = p.endM === undefined ? 0 : p.endM
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || s > 23 || e < 0 || e > 23) return undefined
    if (!Number.isInteger(sm) || !Number.isInteger(em) || sm < 0 || sm > 59 || em < 0 || em > 59) return undefined
    if (s * 60 + sm === e * 60 + em) return undefined
    const normalized = { startH: s, endH: e }
    if (p.startM !== undefined || p.endM !== undefined) {
      normalized.startM = sm
      normalized.endM = em
    }
    peaks.push(normalized)
  }
  if (peaks.length < 1 || peaks.length > 6) return undefined
  return peaks
}

export function createOffpeakCore({ deliver, now = () => new Date() }) {
  const state = {
    enabled: true,
    planMode: false,
    weekendsOffPeak: true,
    concurrency: 1,
    peaks: DEFAULT_PEAKS.map((p) => ({ ...p })),
    waiting: [],
    work: [],
    history: [],
    seq: 0,
    lastFailAt: 0,
  }
  const submit = typeof deliver === 'function' ? deliver : async () => { throw new Error('no deliver') }

  const view = (item) => ({
    id: item.id,
    text: item.text,
    sessionId: item.sessionId,
    createdAt: item.createdAt,
    status: item.status,
    attempts: item.attempts,
    error: item.error,
  })
  const viewHistory = (h) => ({
    id: h.id,
    text: typeof h.text === 'string' ? h.text.slice(0, 2000) : '',
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
    phase: (date) => phaseOf(state.peaks, state.weekendsOffPeak, date ?? now()),
    snapshot: () => ({
      version: 1,
      phase: api.phase(),
      enabled: state.enabled,
      planMode: state.planMode,
      weekendsOffPeak: state.weekendsOffPeak,
      concurrency: state.concurrency,
      peaks: state.peaks.map((p) => ({ ...p })),
      counts: { waiting: state.waiting.length, work: state.work.length },
      waiting: state.waiting.map(view),
      work: state.work.map(view),
      history: state.history.slice(0, 20).map(viewHistory),
    }),
    setEnabled: (v) => { state.enabled = v === true },
    setPlanMode: (v) => { state.planMode = v === true },
    setWeekendsOffPeak: (v) => { state.weekendsOffPeak = v === true },
    setConcurrency: (n) => { if (Number.isInteger(n) && n >= 1 && n <= 5) state.concurrency = n },
    setPeaks: (peaks) => {
      const next = validPeaks(peaks)
      if (next) { state.peaks = next; return true }
      return false
    },
    enqueue: ({ text, sessionId }) => {
      if (state.enabled !== true) return { ok: false, error: '插件已停用' }
      if (state.waiting.length + state.work.length >= QUEUE_LIMIT) return { ok: false, error: '队列已满' }
      const clean = typeof text === 'string' ? text.trim() : ''
      if (clean === '') return { ok: false, error: '输入为空' }
      if (clean.length > TEXT_LIMIT) return { ok: false, error: '输入过长' }
      const item = {
        id: 'q' + (++state.seq),
        text: clean,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        createdAt: now().getTime(),
        status: 'waiting',
        attempts: 0,
      }
      state.waiting.push(item)
      return { ok: true, item: view(item) }
    },
    force: (id) => {
      const item = findItem(id)
      if (!item) return { ok: false, error: '未找到该输入项' }
      removeFromZones(item)
      item.status = 'work'
      state.work.push(item)
      void execute(item, now())
      return { ok: true }
    },
    revoke: (id) => {
      const item = findItem(id)
      if (!item) return { ok: false, error: '未找到该输入项' }
      removeFromZones(item)
      pushHistory(item, 'revoked')
      return { ok: true }
    },
    reorder: (id, zone, toIndex) => {
      const arr = zone === 'waiting' ? state.waiting : zone === 'work' ? state.work : null
      if (!arr) return { ok: false, error: '无效区域' }
      const from = arr.findIndex((i) => i.id === id)
      if (from < 0) return { ok: false, error: '未找到该输入项' }
      const [moved] = arr.splice(from, 1)
      arr.splice(Math.max(0, Math.min(typeof toIndex === 'number' ? toIndex : arr.length, arr.length)), 0, moved)
      return { ok: true }
    },
    clearHistory: () => { state.history.length = 0 },
    exportConfig: () => ({
      enabled: state.enabled,
      planMode: state.planMode,
      weekendsOffPeak: state.weekendsOffPeak,
      concurrency: state.concurrency,
      peaks: state.peaks.map((p) => ({ ...p })),
    }),
    importConfig: (cfg) => {
      if (!cfg || typeof cfg !== 'object') return
      if (typeof cfg.enabled === 'boolean') state.enabled = cfg.enabled
      if (typeof cfg.planMode === 'boolean') state.planMode = cfg.planMode
      if (typeof cfg.weekendsOffPeak === 'boolean') state.weekendsOffPeak = cfg.weekendsOffPeak
      if (Number.isInteger(cfg.concurrency) && cfg.concurrency >= 1 && cfg.concurrency <= 5) state.concurrency = cfg.concurrency
      const peaks = validPeaks(cfg.peaks)
      if (peaks) state.peaks = peaks
    },
    /** 主循环：低谷且有配额时把等待区投递出去。date 注入便于测试/重启后对齐。 */
    tick: async (date) => {
      const when = date ?? now()
      if (state.enabled !== true) return
      if (api.phase(when) !== 'trough') return
      if (when.getTime() - state.lastFailAt < FAIL_COOLDOWN_MS) return
      while (state.waiting.length > 0 && state.work.length < state.concurrency) {
        const item = state.waiting.shift()
        item.status = 'work'
        state.work.push(item)
        void execute(item, when)
      }
    },
  }
  return api
}
