// dsh-offpeak-queue —— Web Client 半侧（原生静态 bundle · 防御版）
// 硬约束：模块加载与 apply 均不向外抛异常 —— 任何失败只 console + 上报 host /report，
// 绝不导致渲染器/启动异常。UI 契约：window.__ModuleLoader__.load({ id, factory })，
// factory CommonJS 导出 { apply(ctx), inject: ['slots', 'sessions'] }。
// v0.1.7-ui：发送时从当前输入框与 sessions 服务双重解析会话，杜绝切换/新建时串会话。

;(function () {
  let load = null
  try {
    if (typeof window !== 'undefined' && window && typeof window.__ModuleLoader__ === 'object') {
      load = window.__ModuleLoader__.load.bind(window.__ModuleLoader__)
    }
  } catch { load = null }
  if (!load) {
    try { if (typeof console !== 'undefined') console.warn('[offpeak-queue] client loader unavailable') } catch { /* ignore */ }
    return
  }

  try {
    load({
      id: 'dsh-offpeak-queue',
      factory: (require) => {
    /* ---- __dshOffpeakQueueI18n: gettext-style i18n (the Chinese source string is the msgid) ---- */
    var __dshOffpeakQueueI18n_EN = {
      "client boot: slots 服务不可用，UI 不挂载": "client boot: the slots service is unavailable, UI not mounted",
      "等待中": "Waiting",
      "投递中": "Delivering",
      "重试 ": "Retry ",
      "强制执行：立即投递（无视时段）": "Force: deliver immediately (ignore the window)",
      "强制": "Force",
      "撤销：移出队列": "Cancel: remove from the queue",
      "撤销": "Cancel",
      "已完成": "Done",
      "失败": "Failed",
      "已撤销": "Cancelled",
      "已暂存 · 低谷自动投递": "Staged · delivered automatically off-peak",
      "入队失败，请查看队列面板": "Could not queue the message — see the queue panel",
      "高峰暂存 · 低谷再发": "Stage at peak · send off-peak",
      "切回直接发送：本条及后续消息立即发送": "Switch back to direct send: this message and the following ones send immediately",
      "直接发送": "Direct send",
      "输入内容后按 Enter 暂存入队，低谷自动投递…（Shift+Enter 换行）": "Type a message and press Enter to stage it for off-peak delivery… (Shift+Enter for a newline)",
      "Enter 暂存 · Shift+Enter 换行 · 可点「暂存」入队": "Enter stages · Shift+Enter newline · or click Stage",
      "暂存到低谷队列": "Stage into the off-peak queue",
      "暂存入队": "Stage",
      "已是并发 ": "Already at concurrency ",
      "已生效：并发 ": "Applied: concurrency ",
      "设置失败": "Could not save the setting",
      "已开启：高峰发送的消息先入队，低谷自动投递": "Enabled: messages sent at peak are queued and delivered off-peak",
      "开启后：高峰发送的消息先入队、低谷自动投递": "When on, messages sent at peak are queued and delivered off-peak",
      "低谷再发": "Send off-peak",
      "打开任务队列与设置": "Open the task queue and settings",
      "队列": "Queue",
      "任务队列，共 ": "Task queue, ",
      " 条": " item(s)",
      "低谷发送队列": "Off-peak send queue",
      "高峰时段": "Peak hours",
      "低谷时段": "Off-peak hours",
      "收起面板": "Collapse the panel",
      "收起": "Collapse",
      "收起队列面板": "Collapse the queue panel",
      "运行设置": "Runtime settings",
      "已开启低谷再发": "Off-peak sending is on",
      "当前直接发送": "Currently sending directly",
      "高峰时段（时）": "Peak hours (hour of day)",
      "至": "to",
      "删除该时段": "Remove this window",
      "删": "Del",
      "添加高峰时段": "Add a peak window",
      "+ 时段": "+ window",
      "应用时段设置": "Apply the window settings",
      "应用": "Apply",
      "周末视为低谷（官方谷价，周六日不拦截）": "Treat weekends as off-peak (no interception on Saturday or Sunday)",
      "启用本插件": "Enable this plugin",
      "低谷并发投递": "Off-peak delivery concurrency",
      "并发 ": "concurrency ",
      "配置：": "Config: ",
      "工作中": "Delivering",
      "当前没有正在投递的消息": "Nothing is being delivered right now",
      "等待": "Waiting",
      "低谷后自动投递": "delivered automatically off-peak",
      "将尽快投递": "delivered as soon as possible",
      "暂无等待消息": "Nothing waiting",
      "执行记录": "Delivery log",
      "清空记录": "Clear the log",
      "清空": "Clear",
      "暂无记录": "No entries yet",
      "未识别当前会话，已阻止直接发送": "The current session could not be identified, so direct send was blocked",
      "正在暂存…": "Staging…",
      "入队失败，原文字已保留": "Queueing failed; your text was kept",
      "立即投递（无视时段）": "Deliver immediately (ignore the window)",
      "移出队列": "Remove from the queue",
      "✓ 已完成": "✓ Done",
      "✗ 失败": "✗ Failed",
      "↩ 已撤销": "↩ Cancelled",
      "队列连接中…": "Connecting to the queue…",
      "正在读取插件状态": "Reading plugin state",
      "开启低谷再发": "Turn on off-peak sending",
      "周末视为低谷（周六日不拦截）": "Treat weekends as off-peak (no Saturday/Sunday interception)",
      "清空执行记录": "Clear the delivery log"
    }
    var __dshOffpeakQueueI18n_OVERRIDE_KEY = 'dsh-offpeak-queue.locale'
    function __dshOffpeakQueueI18n_locale() {
      try {
        var forced = globalThis.localStorage && globalThis.localStorage.getItem(__dshOffpeakQueueI18n_OVERRIDE_KEY)
        if (forced) return String(forced)
      } catch (e) { /* storage unavailable */ }
      try {
        var lang = document && document.documentElement && document.documentElement.lang
        if (lang) return String(lang)
      } catch (e) { /* no document */ }
      try {
        var nav = globalThis.navigator && (globalThis.navigator.language || (globalThis.navigator.languages && globalThis.navigator.languages[0]))
        if (nav) return String(nav)
      } catch (e) { /* no navigator */ }
      return 'en'
    }
    /** Translate one msgid; unknown ids fall back to the id itself, so nothing renders blank. */
    function T(msgid) {
      var zh = __dshOffpeakQueueI18n_locale().toLowerCase().indexOf('zh') === 0
      return zh ? msgid : (__dshOffpeakQueueI18n_EN[msgid] || msgid)
    }
    /* ---- end __dshOffpeakQueueI18n ---- */

        const module = { exports: {} }
        const inject = ['slots', 'sessions']
        const BASE = '/dsh-offpeak-queue'
        const CLIENT_BUILD = '0.1.8-concurrency-feedback'
        const consoleError = (...a) => { try { if (typeof console !== 'undefined') console.error('[offpeak-queue]', ...a) } catch { /* ignore */ } }

        const report = (kind, error) => {
          try {
            const message = (error && error.message ? String(error.message) : String(error || kind)).slice(0, 1000)
            const stack = error && error.stack ? String(error.stack).slice(0, 600) : ''
            void fetch(BASE + '/report', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ level: 'error', kind, message, stack }),
            }).catch(() => {})
          } catch { /* ignore */ }
        }
        const reportInfo = (message) => {
          try {
            void fetch(BASE + '/report', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ level: 'info', kind: 'client', message }),
            }).catch(() => {})
          } catch { /* ignore */ }
        }

        // ---------- 纯逻辑 ----------
        function localPhase(snap, date) {
          if (!snap || !Array.isArray(snap.peaks) || snap.peaks.length === 0) return null
          if (snap.weekendsOffPeak === true) {
            const day = date.getDay()
            if (day === 0 || day === 6) return 'trough'
          }
          const minuteOfDay = date.getHours() * 60 + date.getMinutes()
          for (const peak of snap.peaks) {
            const s = peak.startH * 60 + (Number.isInteger(peak.startM) ? peak.startM : 0)
            const e = peak.endH * 60 + (Number.isInteger(peak.endM) ? peak.endM : 0)
            if (s === e) continue
            if (s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e) return 'peak'
          }
          return 'trough'
        }
        function decideTakeover(snap, owner, date) {
          if (!snap || typeof snap !== 'object') return null
          if (snap.enabled !== true || snap.planMode !== true) return null
          if (localPhase(snap, date) !== 'peak') return null
          const hasPending = owner !== null && typeof owner === 'object' && (
            (Array.isArray(owner.interactions) && owner.interactions.length > 0)
            || (owner.pendingInteraction !== null && owner.pendingInteraction !== undefined)
          )
          if (hasPending) return null
          return { takeover: 'price-peak' }
        }
        const time = (ms) => {
          try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
        }
        const el = (React) => React.createElement
        const pill = (React, className, onClick, title, children, extra) =>
          el(React, 'button', Object.assign({ type: 'button', className, onClick, title }, extra || {}), children)
        const ui = {
          layer: 'var(--dsw-alias-bg-layer-1, #ffffff)',
          layer2: 'var(--dsw-alias-bg-layer-2, #f4f5f7)',
          line: 'var(--dsw-alias-border-l1, rgba(0,0,0,.08))',
          line2: 'var(--dsw-alias-border-l2, rgba(0,0,0,.16))',
          text: 'var(--dsw-alias-label-primary, #1c1f26)',
          text2: 'var(--dsw-alias-label-secondary, #6b7280)',
          brand: 'var(--dsw-alias-brand-primary, #4d7cfe)',
          warn: 'var(--dsw-alias-state-warn-primary, #e8a23c)',
          ok: 'var(--dsw-alias-state-success-primary, #2f9e6e)',
          err: 'var(--dsw-alias-state-error-primary, #d64545)',
        }
        const CSSV = {
          cardRadius: 14,
          radius: 10,
          gap: 10,
        }

        function apply(ctx) {
          try {
            applyInner(ctx)
          } catch (error) {
            consoleError('apply crashed', error)
            report('client-apply-crash', error)
          }
        }

        const useDraftHook = (props) => {
          const value = typeof props.useInput === 'function'
            ? props.useInput((s) => (s === null || s === undefined ? '' : s.draft))
            : ''
          return {
            draft: typeof value === 'string' ? value : '',
            setDraft: (next) => {
              if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
                props.inputActions.setDraft(next)
              }
            },
          }
        }

        function applyInner(ctx) {
          const React = require('react')
          const { useState, useEffect, useRef } = React
          const slots = (ctx && typeof ctx.get === 'function' && ctx.get('slots'))
            || (ctx && ctx.slots)
          if (!slots) {
            reportInfo(T('client boot: slots 服务不可用，UI 不挂载'))
            return
          }

          // 全局兜底：捕获渲染期之外的未处理错误并上报 host.log
          const onWindowError = (ev) => {
            const err = ev && ev.error ? ev.error : (ev && ev.message ? new Error(String(ev.message)) : null)
            report('window-error', err || ev)
          }
          const onUnhandled = (ev) => report('unhandledrejection', ev && ev.reason)
          try {
            window.addEventListener('error', onWindowError)
            window.addEventListener('unhandledrejection', onUnhandled)
            ctx.effect(() => () => {
              try {
                window.removeEventListener('error', onWindowError)
                window.removeEventListener('unhandledrejection', onUnhandled)
              } catch { /* ignore */ }
            }, 'offpeak-queue: window listeners')
          } catch { /* ignore */ }

          let latest = null
          let activeSessionId = ''
          let activeSetDraft = null
          const subs = new Set()
          const emit = () => { const s = latest; for (const fn of [...subs]) fn(s) }
          async function refresh() {
            try {
              const r = await fetch(BASE + '/state')
              if (r.ok) {
                const j = await r.json()
                if (j && typeof j === 'object') { latest = j; emit() }
              }
            } catch { /* 下次轮询重试 */ }
          }
          async function act(action, args) {
            try {
              const r = await fetch(BASE + '/action', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action, args }),
              })
              if (r.ok) {
                const j = await r.json()
                if (j && typeof j === 'object' && j.state) latest = j.state
                emit()
                return j && j.ok === true
              }
            } catch { /* fallthrough */ }
            void refresh()
            return false
          }
          function useOffpeak() {
            const [s, setS] = useState(latest)
            useEffect(() => {
              const fn = () => setS(latest)
              subs.add(fn)
              return () => { subs.delete(fn) }
            }, [])
            return s
          }
          function rememberSession(props) {
            try {
              const candidates = [
                props && props.sessionId,
                props && props.session && props.session.id,
                props && props.owner && props.owner.sessionId,
                props && props.owner && props.owner.id,
              ]
              const found = candidates.map(normalizeSessionId).find((value) => value !== '')
              if (found) activeSessionId = found
              if (props && props.inputActions && typeof props.inputActions.setDraft === 'function') {
                activeSetDraft = props.inputActions.setDraft.bind(props.inputActions)
              }
            } catch { /* ignore */ }
          }
          function normalizeSessionId(value) {
            try {
              const text = typeof value === 'string' ? value.trim() : ''
              return /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : ''
            } catch { return '' }
          }
          function sessionFromService() {
            try {
              const list = ctx && ctx.sessions && ctx.sessions.list
              if (!list || typeof list.getSnapshot !== 'function') return { available: false, id: '' }
              const snapshot = list.getSnapshot()
              return { available: true, id: normalizeSessionId(snapshot && snapshot.current) }
            } catch { return { available: false, id: '' } }
          }
          function sessionFromEditor(editor) {
            try {
              if (!editor || typeof editor !== 'object') return ''
              const key = Object.keys(editor).find((name) => name.indexOf('__reactFiber$') === 0)
              let fiber = key ? editor[key] : null
              for (let depth = 0; fiber && depth < 30; depth += 1, fiber = fiber.return) {
                const candidates = [
                  fiber.memoizedProps && fiber.memoizedProps.sessionId,
                  fiber.pendingProps && fiber.pendingProps.sessionId,
                ]
                const found = candidates.map(normalizeSessionId).find((value) => value !== '')
                if (found) return found
              }
            } catch { /* fall through */ }
            return ''
          }
          function currentSessionId(editor) {
            const editorId = sessionFromEditor(editor)
            const service = sessionFromService()
            if (editorId !== '' && service.id !== '' && editorId !== service.id) {
              reportInfo('session mismatch blocked: editor=' + editorId + ' current=' + service.id + ' build=' + CLIENT_BUILD)
              return ''
            }
            if (editorId !== '') return editorId
            if (service.id !== '') return service.id
            // sessions 服务明确存在但 current 为空时，当前处于切换过渡态；不能沿用旧缓存。
            if (service.available) return ''
            try {
              const raw = decodeURIComponent(String(window.location && window.location.href ? window.location.href : ''))
              const match = raw.match(/(?:session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
              if (match) return normalizeSessionId(match[0])
            } catch { /* fall through */ }
            return activeSessionId
          }

          // 渲染期隔离：任何组件渲染错误 → 上报并降级为空，而不是整槽被弃用
          class Boundary extends React.Component {
            constructor(props) {
              super(props)
              this.state = { crashed: false }
            }
            static getDerivedStateFromError() { return { crashed: true } }
            componentDidCatch(error) {
              report('render-crash', error)
            }
            render() {
              return this.state.crashed ? null : this.props.children
            }
          }
          const guard = (Comp) => function Guarded(props) {
            return React.createElement(Boundary, null, React.createElement(Comp, props))
          }

          // ================= 样式（贴近产品原生：token 优先，无 token 时走中性降级） =================
          const css = [
            ':root{--oq-l1:' + ui.layer + ';--oq-l2:' + ui.layer2 + ';--oq-ln:' + ui.line + ';--oq-ln2:' + ui.line2 + ';--oq-tx:' + ui.text + ';--oq-tx2:' + ui.text2 + ';--oq-br:' + ui.brand + ';--oq-warn:' + ui.warn + ';--oq-ok:' + ui.ok + ';--oq-err:' + ui.err + '}',
            '.oq-dock{display:flex;flex-direction:column;align-items:stretch;gap:8px;color:var(--oq-tx);font-family:inherit;text-shadow:none!important;filter:none!important}',
            '.oq-dock *{box-sizing:border-box;text-shadow:none!important;-webkit-text-stroke:0 transparent!important}',
            '.oq-dock button::before,.oq-dock button::after{content:none!important;display:none!important}',
            '.oq-dock-slot{box-sizing:border-box;width:100%;max-width:var(--dsh-chat-content-width,720px);margin:0 auto;padding:4px calc(var(--dsh-composer-side-clearance,0px) + 16px) 0}',
            '.oq-strip{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}',
            '.oq-chip{appearance:none;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--oq-ln);background:var(--oq-l2);color:var(--oq-tx2);font-family:inherit;font-size:12px;font-weight:400;line-height:1;letter-spacing:normal;white-space:nowrap;cursor:pointer;filter:none!important;transition:border-color .15s ease,color .15s ease,background .15s ease,transform .12s ease}',
            '.oq-chip:hover{border-color:var(--oq-ln2);background:color-mix(in srgb,var(--oq-l2) 76%,var(--oq-tx) 4%)}',
            '.oq-chip:active{transform:translateY(.5px)}',
            '.oq-chip:focus-visible,.oq-btn:focus-visible,.oq-input:focus-visible{outline:2px solid var(--oq-br);outline-offset:1px}',
            '.oq-chip-on{border-color:color-mix(in srgb,var(--oq-ok) 58%,transparent);color:var(--oq-ok);background:color-mix(in srgb,var(--oq-ok) 9%,transparent)}',
            '.oq-chip-peak.oq-chip-on{border-color:color-mix(in srgb,var(--oq-warn) 62%,transparent);color:var(--oq-warn);background:color-mix(in srgb,var(--oq-warn) 10%,transparent)}',
            '.oq-dot{width:7px;height:7px;border-radius:50%;background:var(--oq-tx2);flex:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--oq-tx2) 10%,transparent)}',
            '.oq-dot-on{background:var(--oq-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--oq-ok) 12%,transparent)}',
            '.oq-chip-peak .oq-dot-on{background:var(--oq-warn);box-shadow:0 0 0 3px color-mix(in srgb,var(--oq-warn) 14%,transparent)}',
            '.oq-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;box-sizing:border-box;padding:0 5px;border-radius:999px;background:var(--oq-tx2);color:#fff;font-size:10.5px;font-weight:650;font-variant-numeric:tabular-nums}',
            '.oq-count-on{background:var(--oq-warn)}',
            '.oq-panel{display:flex;flex-direction:column;gap:10px;box-sizing:border-box;max-height:min(58vh,620px);overflow:auto;padding:11px;border:1px solid var(--oq-ln);border-radius:16px;background:color-mix(in srgb,var(--oq-l1) 96%,transparent);box-shadow:0 14px 38px rgba(0,0,0,.12);scrollbar-width:thin}',
            '.oq-panel-head{position:sticky;top:-11px;z-index:1;display:flex;align-items:center;gap:8px;margin:-11px -11px 0;padding:11px 12px 9px;border-bottom:1px solid var(--oq-ln);background:var(--oq-l1);border-radius:16px 16px 0 0}',
            '.oq-panel-title{font-size:13px;font-weight:650;color:var(--oq-tx)}',
            '.oq-state{display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 8px;border-radius:999px;background:var(--oq-l2);color:var(--oq-tx2);font-size:11px;white-space:nowrap}',
            '.oq-state-peak{background:color-mix(in srgb,var(--oq-warn) 12%,transparent);color:var(--oq-warn)}',
            '.oq-card{background:var(--oq-l1);border:1px solid var(--oq-ln);border-radius:14px;padding:11px 12px;display:flex;flex-direction:column;gap:8px}',
            '.oq-card-head{display:flex;align-items:center;gap:8px;min-height:20px;font-size:12px;font-weight:650;color:var(--oq-tx2);letter-spacing:.1px}',
            '.oq-card-head .oq-count,.oq-card-head .oq-sec:last-child{margin-left:auto}',
            '.oq-list{display:flex;flex-direction:column;gap:4px}',
            '.oq-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px;border-radius:11px;transition:background .14s ease}',
            '.oq-item:hover{background:var(--oq-l2)}',
            '.oq-item-meta{font-size:11px;color:var(--oq-tx2);font-variant-numeric:tabular-nums}',
            '.oq-item-main{min-width:0}',
            '.oq-item-text{font-size:12.5px;line-height:1.48;color:var(--oq-tx);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;white-space:pre-wrap}',
            '.oq-item-sub{display:flex;gap:7px;align-items:center;min-width:0;font-size:11px;color:var(--oq-tx2);margin-top:3px}',
            '.oq-item-error{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--oq-err)}',
            '.oq-item-actions{display:flex;align-items:center;gap:6px}',
            '.oq-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:27px;padding:0 10px;border-radius:9px;border:1px solid var(--oq-ln);background:transparent;color:var(--oq-tx);font-family:inherit;font-size:11.5px;font-weight:400;line-height:1;letter-spacing:normal;cursor:pointer;white-space:nowrap;filter:none!important;transition:border-color .15s ease,background .15s ease,color .15s ease}',
            '.oq-btn:hover{border-color:var(--oq-ln2);background:var(--oq-l2)}',
            '.oq-btn:disabled{opacity:.45;cursor:not-allowed}',
            '.oq-btn-ghost{color:var(--oq-tx2)}',
            '.oq-btn-primary{background:var(--oq-br);border-color:transparent;color:#fff;height:30px;padding:0 15px;font-weight:650}',
            '.oq-btn-primary:hover{border-color:transparent;background:color-mix(in srgb,var(--oq-br) 88%,#000)}',
            '.oq-btn-danger{color:var(--oq-err)}',
            // 选中态必须放在 .oq-btn 之后且用双类提升优先级，否则同优先级时后面的 .oq-btn 规则会盖掉高亮。
            '.oq-btn.oq-chip-on{border-color:color-mix(in srgb,var(--oq-ok) 58%,transparent);color:var(--oq-ok);background:color-mix(in srgb,var(--oq-ok) 10%,transparent);font-weight:650}',
            '.oq-btn.oq-chip-on:hover{border-color:color-mix(in srgb,var(--oq-ok) 72%,transparent);background:color-mix(in srgb,var(--oq-ok) 15%,transparent)}',
            '.oq-sec{font-size:11px;font-weight:400;color:var(--oq-tx2)}',
            '.oq-setrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--oq-tx)}',
            '.oq-input{width:56px;height:27px;box-sizing:border-box;font:inherit;font-size:12px;border-radius:8px;border:1px solid var(--oq-ln);background:var(--oq-l2);color:var(--oq-tx);padding:0 6px;text-align:center}',
            '.oq-check{accent-color:var(--oq-br)}',
            '.oq-empty{padding:11px 8px;font-size:12px;color:var(--oq-tx2);text-align:center}',
            '.oq-path{font-size:10.5px;color:var(--oq-tx2);word-break:break-all;line-height:1.4}',
            '.oq-dock-floating{position:fixed;right:16px;bottom:16px;z-index:2147482000;align-items:flex-end;pointer-events:none}',
            '.oq-dock-floating .oq-strip{pointer-events:auto}',
            '.oq-native-notice{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--oq-ok) 42%,transparent);background:var(--oq-l1);color:var(--oq-ok);font-size:11px;line-height:1;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.08)}',
            '.oq-native-notice-error{border-color:color-mix(in srgb,var(--oq-err) 42%,transparent);color:var(--oq-err)}',
            '[data-oq-planning-editor="true"]{outline:2px solid color-mix(in srgb,var(--oq-warn) 72%,transparent)!important;outline-offset:2px!important}',
            '.oq-modal{position:fixed;inset:0;z-index:2147482001;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto;background:rgba(10,14,24,.24)}',
            '.oq-modal .oq-panel{position:relative;width:min(640px,100%);max-height:min(82vh,760px);pointer-events:auto;box-shadow:0 22px 64px rgba(0,0,0,.24)}',
            // ---- 规划模式输入卡（贴近原生 composer 观感） ----
            '.oq-composer{position:relative;display:flex;flex-direction:column;gap:0;border:1px solid var(--oq-ln);border-radius:14px;background:var(--oq-l1);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.06)}',
            '.oq-composer::before{content:"";position:absolute;left:14px;right:14px;top:0;height:2px;border-radius:0 0 2px 2px;background:var(--oq-warn)}',
            '.oq-composer-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--oq-ln)}',
            '.oq-mode-tag{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;background:color-mix(in srgb,var(--oq-warn) 14%,transparent);color:var(--oq-warn);font-size:11.5px;font-weight:600}',
            '.oq-spacer{flex:1 1 auto}',
            '.oq-composer-input{width:100%;box-sizing:border-box;border:none;background:transparent;color:var(--oq-tx);font:inherit;font-size:14px;line-height:1.55;resize:none;outline:none;padding:11px 12px;min-height:48px;max-height:180px;overflow-y:auto}',
            '.oq-composer-input::placeholder{color:var(--oq-tx2)}',
            '.oq-composer-foot{display:flex;align-items:center;gap:10px;padding:6px 12px 10px}',
            '.oq-hint{flex:1 1 auto;font-size:11.5px;color:var(--oq-tx2)}',
            '.oq-flash{font-size:11.5px;color:var(--oq-ok)}',
            '.oq-flash-err{color:var(--oq-err)}',
            '@media (max-width:640px){.oq-dock-slot{padding-left:10px;padding-right:10px}.oq-modal{padding:12px}.oq-modal .oq-panel{max-height:88vh}.oq-item{grid-template-columns:38px minmax(0,1fr)}.oq-item-actions{grid-column:2;justify-content:flex-end}.oq-panel{padding:9px}.oq-panel-head{top:-9px;margin:-9px -9px 0}.oq-hint{display:none}}',
            '@media (prefers-reduced-motion:reduce){.oq-chip,.oq-btn,.oq-item{transition:none}}',
          ].join('\n')

          ctx.effect(() => {
            try {
              const elStyle = document.createElement('style')
              elStyle.setAttribute('data-oq', '1')
              elStyle.textContent = css
              document.head.appendChild(elStyle)
              return () => { if (elStyle.parentNode) elStyle.parentNode.removeChild(elStyle) }
            } catch (error) { consoleError('styles', error); report('styles', error); return undefined }
          }, 'offpeak-queue: styles')

          // ================= 组件 =================
          function ItemRow(props) {
            const it = props.item
            const zoneLabel = props.zone === 'waiting' ? T('等待中') : T('投递中')
            return el(React, 'div', { className: 'oq-item' },
              el(React, 'div', { className: 'oq-item-meta' }, time(it.createdAt)),
              el(React, 'div', { className: 'oq-item-main' },
                el(React, 'div', { className: 'oq-item-text', title: it.text }, it.text),
                el(React, 'div', { className: 'oq-item-sub' },
                  el(React, 'span', null, zoneLabel),
                  it.attempts > 0 ? el(React, 'span', null, T('重试 ') + it.attempts) : null,
                  it.error ? el(React, 'span', { className: 'oq-item-error', title: String(it.error) }, String(it.error)) : null,
                ),
              ),
              el(React, 'div', { className: 'oq-item-actions' },
                pill(React, 'oq-btn oq-btn-ghost', () => force(props.id), T('强制执行：立即投递（无视时段）'), T('强制')),
                pill(React, 'oq-btn oq-btn-danger', () => revoke(props.id), T('撤销：移出队列'), T('撤销')),
              ),
            )
            function force(id) { try { void act('force', { id }) } catch { /* ignore */ } }
            function revoke(id) { try { void act('revoke', { id }) } catch { /* ignore */ } }
          }

          function HistoryRow(props) {
            const h = props.h
            const mark = h.status === 'done' ? '✓' : h.status === 'failed' ? '✗' : '↩'
            const color = h.status === 'done' ? ui.ok : h.status === 'failed' ? ui.err : ui.text2
            return el(React, 'div', { className: 'oq-item' },
              el(React, 'div', { className: 'oq-item-meta' }, time(h.doneAt || h.createdAt)),
              el(React, 'div', { className: 'oq-item-main' },
                el(React, 'div', { className: 'oq-item-text', title: h.text }, h.text),
                el(React, 'div', { className: 'oq-item-sub' },
                  el(React, 'span', { style: { color } }, mark + ' ' + statusText(h)),
                  h.error ? el(React, 'span', { className: 'oq-item-error', title: String(h.error) }, String(h.error)) : null,
                ),
              ),
            )
            function statusText(hh) {
              return hh.status === 'done' ? T('已完成')
                : hh.status === 'failed' ? T('失败')
                  : hh.status === 'revoked' ? T('已撤销') : String(hh.status)
            }
          }

          // ---------- 规划模式输入卡（贴近原生） ----------
          function PeakComposer(props) {
            const snap = useOffpeak()
            const { draft, setDraft } = useDraftHook(props)
            const [flash, setFlash] = useState('')
            const [flashKind, setFlashKind] = useState('ok')
            const inputRef = useRef(null)
            useEffect(() => {
              try {
                const node = inputRef.current
                if (!node) return
                node.style.height = 'auto'
                node.style.height = Math.min(180, Math.max(48, node.scrollHeight)) + 'px'
              } catch { /* ignore */ }
            }, [draft])
            const enqueueNow = () => {
              try {
                if (!snap || snap.planMode !== true) { setDraft(typeof draft === 'string' ? draft : ''); return }
                const text = (typeof draft === 'string' ? draft : '').trim()
                if (text === '') return
                void act('enqueue', { text, sessionId: currentSessionId() }).then((ok) => {
                  setFlashKind(ok ? 'ok' : 'err')
                  setFlash(ok ? T('已暂存 · 低谷自动投递') : T('入队失败，请查看队列面板'))
                  if (ok) setDraft('')
                  setTimeout(() => setFlash(''), 3000)
                })
              } catch (error) { consoleError('enqueueNow', error); report('enqueue', error) }
            }
            const exitDirect = () => {
              try {
                void act('setPlanMode', { planMode: false }).then(() => setDraft(typeof draft === 'string' ? draft : ''))
              } catch { /* ignore */ }
            }
            return el(React, 'div', { className: 'oq-composer' },
              el(React, 'div', { className: 'oq-composer-bar' },
                el(React, 'span', { className: 'oq-mode-tag' },
                  el(React, 'span', { className: 'oq-dot oq-dot-on', style: { background: ui.warn } }),
                  T('高峰暂存 · 低谷再发'),
                ),
                el(React, 'span', { className: 'oq-spacer' }),
                pill(React, 'oq-btn oq-btn-ghost', exitDirect, T('切回直接发送：本条及后续消息立即发送'), T('直接发送')),
              ),
              el(React, 'textarea', {
                ref: inputRef,
                className: 'oq-composer-input',
                rows: 1,
                value: draft,
                placeholder: T('输入内容后按 Enter 暂存入队，低谷自动投递…（Shift+Enter 换行）'),
                autoFocus: true,
                onChange: (e) => setDraft(e.target.value),
                onKeyDown: (e) => {
                  if (e.key !== 'Enter' || e.shiftKey) return
                  if (e.nativeEvent && e.nativeEvent.isComposing === true) return
                  e.preventDefault()
                  enqueueNow()
                },
              }),
              el(React, 'div', { className: 'oq-composer-foot' },
                el(React, 'span', { className: flashKind === 'err' ? 'oq-flash oq-flash-err' : 'oq-flash' }, flash || T('Enter 暂存 · Shift+Enter 换行 · 可点「暂存」入队')),
                pill(React, 'oq-btn oq-btn-primary', enqueueNow, T('暂存到低谷队列'), T('暂存入队')),
              ),
            )
          }

          // ---------- 输入条上方状态条 + 分区队列面板 ----------
          const committedSurfaces = new Set()
          function DockStrip(props) {
            const snap = useOffpeak()
            const [open, setOpen] = useState(false)
            const { draft, setDraft } = useDraftHook(props)
            const [rows, setRows] = useState([])
            const [rowsKey, setRowsKey] = useState('')
            const confTimer = useRef(null)
            const [confFlash, setConfFlash] = useState('')
            const [confFlashErr, setConfFlashErr] = useState(false)
            const surface = props.surface === 'floating' ? 'floating' : 'composer-dock'
            const peaksKey = snap && Array.isArray(snap.peaks) ? JSON.stringify(snap.peaks) : ''
            useEffect(() => {
              if (peaksKey !== rowsKey && snap && Array.isArray(snap.peaks)) {
                setRowsKey(peaksKey)
                setRows(snap.peaks.map((p) => ({ start: p.startH, end: p.endH })))
              }
            }, [peaksKey, rowsKey, snap])
            if (!snap || !snap.counts) return null
            const planning = snap.enabled === true && snap.planMode === true
            const peak = snap.phase === 'peak'
            const total = snap.counts.waiting + snap.counts.work
            const togglePlan = () => { try { void act('setPlanMode', { planMode: !planning }).then(() => setDraft(typeof draft === 'string' ? draft : '')) } catch { /* ignore */ } }
            const setField = (action, value) => { try { void act(action, value) } catch { /* ignore */ } }
            const applyPeaks = () => {
              const peaks = []
              for (const r of (rows || [])) {
                const s = Number(r.start)
                const e = Number(r.end)
                if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || s > 23 || e < 0 || e > 23 || s === e) return
                peaks.push({ startH: s, endH: e })
              }
              try { void act('setPeaks', { peaks }) } catch { /* ignore */ }
            }
            const pickConcurrency = (n) => {
              const show = (text, err) => {
                setConfFlashErr(err === true)
                setConfFlash(text)
                if (confTimer.current) clearTimeout(confTimer.current)
                confTimer.current = setTimeout(() => setConfFlash(''), 2600)
              }
              try {
                if (snap && snap.concurrency === n) { show(T('已是并发 ') + n); return }
                void act('setConcurrency', { concurrency: n }).then((ok) => show(ok ? T('已生效：并发 ') + n : T('设置失败'), !ok))
              } catch { show(T('设置失败'), true) }
            }
            const waiting = snap.waiting || []
            const work = snap.work || []
            const history = snap.history || []
            const markCommit = (node) => {
              if (!node || committedSurfaces.has(surface)) return
              committedSurfaces.add(surface)
              try { reportInfo('dock component rendered and committed: surface=' + surface + ' build=' + CLIENT_BUILD) } catch { /* ignore */ }
            }
            return el(React, 'div', {
              ref: markCommit,
              className: 'oq-dock ' + (surface === 'floating' ? 'oq-dock-floating' : 'oq-dock-slot'),
              'data-oq-surface': surface,
              'data-oq-build': CLIENT_BUILD,
            },
              el(React, 'div', { className: 'oq-strip' },
                pill(React, 'oq-chip' + (planning ? ' oq-chip-on' : '') + (peak ? ' oq-chip-peak' : ''), togglePlan,
                  planning ? T('已开启：高峰发送的消息先入队，低谷自动投递') : T('开启后：高峰发送的消息先入队、低谷自动投递'),
                  el(React, React.Fragment, null,
                    el(React, 'span', { className: 'oq-dot' + (planning ? ' oq-dot-on' : '') }),
                    el(React, 'span', null, planning ? T('低谷再发') : T('直接发送')),
                  ),
                  { 'aria-pressed': planning },
                ),
                pill(React, 'oq-chip' + (peak ? ' oq-chip-peak' : ''), () => setOpen(!open), T('打开任务队列与设置'),
                  el(React, React.Fragment, null,
                    el(React, 'span', { className: 'oq-dot' + (peak ? ' oq-dot-on' : '') }),
                    el(React, 'span', null, T('队列')),
                    el(React, 'span', { className: 'oq-count' + (total > 0 ? ' oq-count-on' : '') }, String(total)),
                  ),
                  { 'aria-expanded': open, 'aria-label': T('任务队列，共 ') + total + T(' 条') },
                ),
              ),
              open ? el(React, 'div', { className: 'oq-panel' },
                el(React, 'div', { className: 'oq-panel-head' },
                  el(React, 'span', { className: 'oq-panel-title' }, T('低谷发送队列')),
                  el(React, 'span', { className: 'oq-state' + (peak ? ' oq-state-peak' : '') }, peak ? T('高峰时段') : T('低谷时段')),
                  el(React, 'span', { className: 'oq-spacer' }),
                  pill(React, 'oq-btn oq-btn-ghost', () => setOpen(false), T('收起面板'), T('收起'), { 'aria-label': T('收起队列面板') }),
                ),
                // 设置
                el(React, 'div', { className: 'oq-card' },
                  el(React, 'div', { className: 'oq-card-head' },
                    el(React, 'span', null, T('运行设置')),
                    el(React, 'span', { className: 'oq-sec' }, planning ? T('已开启低谷再发') : T('当前直接发送')),
                  ),
                  el(React, 'div', { className: 'oq-setrow' }, el(React, 'span', { className: 'oq-sec' }, T('高峰时段（时）'))),
                  (rows || []).map((r, i) => el(React, 'div', { key: i, className: 'oq-setrow' },
                    el(React, 'input', { className: 'oq-input', type: 'number', min: 0, max: 23, value: r.start, onChange: (e) => { const next = rows.slice(); next[i] = Object.assign({}, r, { start: e.target.value }); setRows(next) } }),
                    el(React, 'span', { className: 'oq-sec' }, T('至')),
                    el(React, 'input', { className: 'oq-input', type: 'number', min: 0, max: 23, value: r.end, onChange: (e) => { const next = rows.slice(); next[i] = Object.assign({}, r, { end: e.target.value }); setRows(next) } }),
                    (rows.length > 1) ? pill(React, 'oq-btn oq-btn-danger', () => { const next = rows.filter((_x, j) => j !== i); setRows(next) }, T('删除该时段'), T('删')) : null,
                  )),
                  el(React, 'div', { className: 'oq-setrow' },
                    (rows.length < 6) ? pill(React, 'oq-btn oq-btn-ghost', () => setRows(rows.concat([{ start: '23', end: '8' }])), T('添加高峰时段'), T('+ 时段')) : null,
                    pill(React, 'oq-btn oq-btn-primary', applyPeaks, T('应用时段设置'), T('应用')),
                  ),
                  el(React, 'label', { className: 'oq-setrow' },
                    el(React, 'input', { className: 'oq-check', type: 'checkbox', checked: snap.weekendsOffPeak === true, onChange: (e) => setField('setWeekendsOffPeak', { weekendsOffPeak: e.target.checked }) }),
                    el(React, 'span', null, T('周末视为低谷（官方谷价，周六日不拦截）')),
                  ),
                  el(React, 'label', { className: 'oq-setrow' },
                    el(React, 'input', { className: 'oq-check', type: 'checkbox', checked: snap.enabled === true, onChange: (e) => setField('setEnabled', { enabled: e.target.checked }) }),
                    el(React, 'span', null, T('启用本插件')),
                  ),
                  el(React, 'div', { className: 'oq-setrow' },
                    el(React, 'span', null, T('低谷并发投递')),
                    [1, 2, 3].map((n) => pill(React, 'oq-btn' + (snap.concurrency === n ? ' oq-chip-on' : ''), () => pickConcurrency(n), T('并发 ') + n, String(n), { 'aria-pressed': snap.concurrency === n })),
                    confFlash !== '' ? el(React, 'span', { className: confFlashErr ? 'oq-flash-err' : 'oq-flash' }, confFlash) : null,
                  ),
                  typeof snap.configPath === 'string' && snap.configPath !== '' ? el(React, 'div', { className: 'oq-path' }, T('配置：') + snap.configPath) : null,
                ),
                // 工作中
                el(React, 'div', { className: 'oq-card' },
                  el(React, 'div', { className: 'oq-card-head' },
                    el(React, 'span', null, T('工作中')),
                    el(React, 'span', { className: 'oq-count' + (work.length > 0 ? ' oq-count-on' : '') }, String(work.length)),
                  ),
                  el(React, 'div', { className: 'oq-list' },
                    work.length === 0
                      ? el(React, 'div', { className: 'oq-empty' }, T('当前没有正在投递的消息'))
                      : work.map((it) => el(React, ItemRow, { key: it.id, id: it.id, item: it, zone: 'work' })),
                  ),
                ),
                // 等待
                el(React, 'div', { className: 'oq-card' },
                  el(React, 'div', { className: 'oq-card-head' },
                    el(React, 'span', null, T('等待')),
                    el(React, 'span', { className: 'oq-sec' }, peak && planning ? T('低谷后自动投递') : T('将尽快投递')),
                    el(React, 'span', { className: 'oq-count' + (waiting.length > 0 ? ' oq-count-on' : '') }, String(waiting.length)),
                  ),
                  el(React, 'div', { className: 'oq-list' },
                    waiting.length === 0
                      ? el(React, 'div', { className: 'oq-empty' }, T('暂无等待消息'))
                      : waiting.map((it) => el(React, ItemRow, { key: it.id, id: it.id, item: it, zone: 'waiting' })),
                  ),
                ),
                // 执行记录
                el(React, 'div', { className: 'oq-card' },
                  el(React, 'div', { className: 'oq-card-head' },
                    el(React, 'span', null, T('执行记录')),
                    el(React, 'span', { className: 'oq-sec' }, String(history.length) + T(' 条')),
                    history.length > 0 ? pill(React, 'oq-btn oq-btn-ghost', () => setField('clearHistory', {}), T('清空记录'), T('清空')) : null,
                  ),
                  el(React, 'div', { className: 'oq-list' },
                    history.length === 0
                      ? el(React, 'div', { className: 'oq-empty' }, T('暂无记录'))
                      : history.map((h) => el(React, HistoryRow, { key: h.id + ':' + h.doneAt, h })),
                  ),
                ),
              ) : null,
            )
          }

          function isActuallyVisible(node) {
            try {
              if (!node || typeof node.getBoundingClientRect !== 'function') return false
              const style = window.getComputedStyle(node)
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
              const rect = node.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0
            } catch { return false }
          }
          function hasVisiblePrimaryDock() {
            try {
              return [...document.querySelectorAll('[data-oq-surface="composer-dock"]')].some(isActuallyVisible)
            } catch { return false }
          }
          function domNode(tag, className, textValue) {
            const node = document.createElement(tag)
            if (className) node.className = className
            if (textValue !== undefined && textValue !== null) node.textContent = String(textValue)
            return node
          }
          function domButton(className, textValue, title, onClick) {
            const button = domNode('button', className, textValue)
            button.type = 'button'
            if (title) button.title = title
            button.addEventListener('click', (event) => {
              try { onClick(event) } catch (error) { report('native-click', error) }
            })
            return button
          }
          let lastComposerRect = null
          function findComposerEditor(ignoreNode) {
            try {
              const candidates = [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
                .filter((candidate) => (!ignoreNode || !ignoreNode.contains(candidate)) && isActuallyVisible(candidate))
                .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
                .filter((entry) => entry.rect.width >= 220 && entry.rect.bottom <= window.innerHeight + 8)
                .sort((a, b) => b.rect.bottom - a.rect.bottom)
              return candidates.length > 0 ? candidates[0].candidate : null
            } catch { return null }
          }
          function positionNearComposer(node) {
            try {
              const editor = findComposerEditor(node)
              if (editor) lastComposerRect = editor.getBoundingClientRect()
              const rect = lastComposerRect
              if (!rect) { node.style.right = '16px'; node.style.bottom = '16px'; return }
              node.style.right = Math.max(12, window.innerWidth - rect.right) + 'px'
              node.style.bottom = Math.max(12, window.innerHeight - rect.top + 8) + 'px'
            } catch { /* keep CSS fallback position */ }
          }

          // ---------- 挂载（每处单独 try，杜绝一处失败拖垮整体） ----------
          try {
            // cost-meter 当前也使用 conversation.composer.dock；该槽位紧邻输入框且已有实证。
            ctx.effect(
              () => slots.inject('conversation.composer.dock', () => {
                try { reportInfo('primary slot ready: conversation.composer.dock build=' + CLIENT_BUILD) } catch { /* ignore */ }
                return slots.register(
                  { name: 'conversation.composer.dock', id: 'offpeak-queue', order: 4 },
                  guard(function ComposerDockSurface(props) {
                    rememberSession(props)
                    return el(React, DockStrip, Object.assign({}, props, { surface: 'composer-dock' }))
                  }),
                )
              }),
              'offpeak-queue: composer-dock',
            )
          } catch (error) { consoleError('dock register', error); report('dock-register', error) }
          try {
            // 原生 DOM 保底不依赖 React commit；只在主槽位没有真实可见 DOM 时显示。
            ctx.effect(() => {
              let host = null
              let disposed = false
              let panelOpen = false
              let rows = []
              let rowsKey = ''
              let rowsDirty = false
              let renderKey = ''
              let notice = ''
              let noticeKind = 'ok'
              let noticeTimer = null
              let settingsNote = ''
              let settingsNoteKind = 'ok'
              let settingsNoteTimer = null
              let markedEditor = null
              let lastCaptureKey = ''
              let lastCaptureAt = 0
              try {
                host = domNode('div', 'oq-dock oq-dock-floating')
                host.setAttribute('data-oq-surface', 'native-floating')
                host.setAttribute('data-oq-build', CLIENT_BUILD)
                document.body.appendChild(host)

                const runAction = (action, args, after) => {
                  try {
                    void act(action, args).then((ok) => {
                      try { if (typeof after === 'function') after(ok) } catch { /* ignore */ }
                      renderNative(true)
                    })
                  } catch (error) { report('native-action', error) }
                }
                const setNotice = (message, kind) => {
                  notice = message
                  noticeKind = kind === 'error' ? 'error' : 'ok'
                  if (noticeTimer !== null) clearTimeout(noticeTimer)
                  renderNative(true)
                  noticeTimer = setTimeout(() => {
                    notice = ''
                    noticeTimer = null
                    renderNative(true)
                  }, 3200)
                }
                // 面板内设置行的短暂确认文字（随面板 DOM 一起重建，故存闭包变量而非 DOM）。
                const noteSettings = (message, kind) => {
                  settingsNote = message
                  settingsNoteKind = kind === 'error' ? 'error' : 'ok'
                  if (settingsNoteTimer !== null) clearTimeout(settingsNoteTimer)
                  renderNative(true)
                  settingsNoteTimer = setTimeout(() => {
                    settingsNote = ''
                    settingsNoteTimer = null
                    renderNative(true)
                  }, 2600)
                }
                const updatePlanningEditor = (snap) => {
                  try {
                    const editor = findComposerEditor(host)
                    const planningPeak = Boolean(snap && snap.enabled === true && snap.planMode === true && snap.phase === 'peak')
                    if (markedEditor && (markedEditor !== editor || !planningPeak)) {
                      markedEditor.removeAttribute('data-oq-planning-editor')
                      markedEditor = null
                    }
                    if (editor && planningPeak) {
                      editor.setAttribute('data-oq-planning-editor', 'true')
                      markedEditor = editor
                    }
                  } catch { /* ignore */ }
                }
                const editorText = (editor) => {
                  try {
                    if (!editor) return ''
                    if ('value' in editor && typeof editor.value === 'string') return editor.value
                    return typeof editor.innerText === 'string' ? editor.innerText : String(editor.textContent || '')
                  } catch { return '' }
                }
                const clearEditor = (editor) => {
                  try { if (typeof activeSetDraft === 'function') activeSetDraft('') } catch { /* ignore */ }
                  try {
                    if ('value' in editor) {
                      const proto = editor.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype : window.HTMLInputElement && window.HTMLInputElement.prototype
                      const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')
                      if (setter && typeof setter.set === 'function') setter.set.call(editor, '')
                      else editor.value = ''
                    } else {
                      editor.textContent = ''
                    }
                    editor.dispatchEvent(new Event('input', { bubbles: true }))
                    editor.dispatchEvent(new Event('change', { bubbles: true }))
                  } catch (error) { report('clear-composer', error) }
                }
                const stopSendEvent = (event) => {
                  try { event.preventDefault() } catch { /* ignore */ }
                  try { event.stopPropagation() } catch { /* ignore */ }
                  try { event.stopImmediatePropagation() } catch { /* ignore */ }
                }
                const editorForEvent = (event) => {
                  try {
                    const target = event && event.target
                    if (!target || host.contains(target)) return null
                    const preferred = findComposerEditor(host)
                    if (typeof target.closest === 'function') {
                      const direct = target.closest('textarea,[contenteditable="true"],[role="textbox"]')
                      if (direct && isActuallyVisible(direct)) {
                        return preferred && (direct === preferred || direct.contains(preferred) || preferred.contains(direct)) ? direct : null
                      }
                      const form = target.closest('form')
                      if (form) {
                        const inForm = [...form.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].find(isActuallyVisible)
                        if (inForm) return preferred && (inForm === preferred || inForm.contains(preferred) || preferred.contains(inForm)) ? inForm : null
                      }
                    }
                    return preferred
                  } catch { return null }
                }
                const shouldQueueNow = () => {
                  const snap = latest
                  if (!snap || snap.enabled !== true || snap.planMode !== true) return false
                  return snap.phase === 'peak' || localPhase(snap, new Date()) === 'peak'
                }
                const queueFromEditor = (editor, source, event) => {
                  if (!shouldQueueNow()) return false
                  const textValue = editorText(editor).trim()
                  if (textValue === '') return false
                  stopSendEvent(event)
                  const sessionId = currentSessionId(editor)
                  if (sessionId === '') {
                    setNotice(T('未识别当前会话，已阻止直接发送'), 'error')
                    reportInfo('send intercepted but session missing: source=' + source + ' build=' + CLIENT_BUILD)
                    return true
                  }
                  const now = Date.now()
                  const captureKey = sessionId + '\n' + textValue
                  if (captureKey === lastCaptureKey && now - lastCaptureAt < 800) return true
                  lastCaptureKey = captureKey
                  lastCaptureAt = now
                  setNotice(T('正在暂存…'), 'ok')
                  reportInfo('send intercepted: source=' + source + ' session=yes build=' + CLIENT_BUILD)
                  try {
                    void act('enqueue', { text: textValue, sessionId }).then((ok) => {
                      if (ok) {
                        clearEditor(editor)
                        setNotice(T('已暂存 · 低谷自动投递'), 'ok')
                        reportInfo('enqueue from composer: ok build=' + CLIENT_BUILD)
                      } else {
                        setNotice(T('入队失败，原文字已保留'), 'error')
                        reportInfo('enqueue from composer: failed build=' + CLIENT_BUILD)
                      }
                    })
                  } catch (error) {
                    setNotice(T('入队失败，原文字已保留'), 'error')
                    report('enqueue-intercept', error)
                  }
                  return true
                }
                const makeCount = (count) => domNode('span', 'oq-count' + (count > 0 ? ' oq-count-on' : ''), count)
                const makeCard = (title, count, note) => {
                  const card = domNode('div', 'oq-card')
                  const head = domNode('div', 'oq-card-head')
                  head.appendChild(domNode('span', '', title))
                  if (note) head.appendChild(domNode('span', 'oq-sec', note))
                  if (typeof count === 'number') head.appendChild(makeCount(count))
                  card.appendChild(head)
                  return card
                }
                const makeItem = (item, zone) => {
                  const row = domNode('div', 'oq-item')
                  row.appendChild(domNode('div', 'oq-item-meta', time(item.createdAt)))
                  const main = domNode('div', 'oq-item-main')
                  const textNode = domNode('div', 'oq-item-text', item.text)
                  textNode.title = typeof item.text === 'string' ? item.text : ''
                  main.appendChild(textNode)
                  const sub = domNode('div', 'oq-item-sub')
                  sub.appendChild(domNode('span', '', zone === 'work' ? T('投递中') : T('等待中')))
                  if (item.attempts > 0) sub.appendChild(domNode('span', '', T('重试 ') + item.attempts))
                  if (item.error) {
                    const errorNode = domNode('span', 'oq-item-error', item.error)
                    errorNode.title = String(item.error)
                    sub.appendChild(errorNode)
                  }
                  main.appendChild(sub)
                  row.appendChild(main)
                  const actions = domNode('div', 'oq-item-actions')
                  actions.appendChild(domButton('oq-btn oq-btn-ghost', T('强制'), T('立即投递（无视时段）'), () => runAction('force', { id: item.id })))
                  actions.appendChild(domButton('oq-btn oq-btn-danger', T('撤销'), T('移出队列'), () => runAction('revoke', { id: item.id })))
                  row.appendChild(actions)
                  return row
                }
                const makeHistory = (item) => {
                  const row = domNode('div', 'oq-item')
                  row.appendChild(domNode('div', 'oq-item-meta', time(item.doneAt || item.createdAt)))
                  const main = domNode('div', 'oq-item-main')
                  const textNode = domNode('div', 'oq-item-text', item.text)
                  textNode.title = typeof item.text === 'string' ? item.text : ''
                  main.appendChild(textNode)
                  const status = item.status === 'done' ? T('✓ 已完成') : item.status === 'failed' ? T('✗ 失败') : T('↩ 已撤销')
                  const sub = domNode('div', 'oq-item-sub')
                  sub.appendChild(domNode('span', '', status))
                  if (item.error) {
                    const errorNode = domNode('span', 'oq-item-error', item.error)
                    errorNode.title = String(item.error)
                    sub.appendChild(errorNode)
                  }
                  main.appendChild(sub)
                  row.appendChild(main)
                  return row
                }
                const makeList = (items, emptyText, mapper) => {
                  const list = domNode('div', 'oq-list')
                  if (items.length === 0) list.appendChild(domNode('div', 'oq-empty', emptyText))
                  else for (const item of items) list.appendChild(mapper(item))
                  return list
                }
                const renderNative = (force) => {
                  try {
                    if (disposed || !host) return
                    const snap = latest
                    updatePlanningEditor(snap)
                    const primaryVisible = hasVisiblePrimaryDock()
                    host.style.display = primaryVisible ? 'none' : 'flex'
                    if (primaryVisible) return
                    positionNearComposer(host)
                    const active = document.activeElement
                    if (!force && active && host.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return
                    const nextKey = snap ? JSON.stringify([
                      panelOpen, notice, noticeKind, snap.enabled, snap.planMode, snap.phase, snap.weekendsOffPeak, snap.concurrency,
                      snap.peaks, snap.counts, snap.waiting, snap.work, snap.history,
                    ]) : 'loading:' + panelOpen
                    if (!force && nextKey === renderKey) return
                    renderKey = nextKey
                    host.replaceChildren()

                    const strip = domNode('div', 'oq-strip')
                    if (!snap || !snap.counts) {
                      const loading = domButton('oq-chip', T('队列连接中…'), T('正在读取插件状态'), () => { void refresh() })
                      loading.disabled = true
                      strip.appendChild(loading)
                      host.appendChild(strip)
                      return
                    }
                    const planning = snap.enabled === true && snap.planMode === true
                    const peak = snap.phase === 'peak'
                    const waiting = Array.isArray(snap.waiting) ? snap.waiting : []
                    const work = Array.isArray(snap.work) ? snap.work : []
                    const history = Array.isArray(snap.history) ? snap.history : []
                    const total = waiting.length + work.length
                    const planButton = domButton('oq-chip' + (planning ? ' oq-chip-on' : '') + (peak ? ' oq-chip-peak' : ''), planning ? T('低谷再发') : T('直接发送'), planning ? T('已开启低谷再发') : T('开启低谷再发'), () => runAction('setPlanMode', { planMode: !planning }))
                    planButton.setAttribute('aria-pressed', String(planning))
                    planButton.prepend(domNode('span', 'oq-dot' + (planning ? ' oq-dot-on' : '')))
                    strip.appendChild(planButton)
                    const queueButton = domButton('oq-chip' + (peak ? ' oq-chip-peak' : ''), T('队列'), T('打开任务队列与设置'), () => { panelOpen = !panelOpen; renderNative(true) })
                    queueButton.setAttribute('aria-expanded', String(panelOpen))
                    queueButton.prepend(domNode('span', 'oq-dot' + (peak ? ' oq-dot-on' : '')))
                    queueButton.appendChild(makeCount(total))
                    strip.appendChild(queueButton)
                    if (notice !== '') strip.appendChild(domNode('span', 'oq-native-notice' + (noticeKind === 'error' ? ' oq-native-notice-error' : ''), notice))
                    host.appendChild(strip)
                    if (!panelOpen) return

                    const panel = domNode('div', 'oq-panel')
                    panel.setAttribute('role', 'dialog')
                    panel.setAttribute('aria-modal', 'true')
                    panel.setAttribute('aria-label', T('低谷发送队列'))
                    const panelHead = domNode('div', 'oq-panel-head')
                    panelHead.appendChild(domNode('span', 'oq-panel-title', T('低谷发送队列')))
                    panelHead.appendChild(domNode('span', 'oq-state' + (peak ? ' oq-state-peak' : ''), peak ? T('高峰时段') : T('低谷时段')))
                    panelHead.appendChild(domNode('span', 'oq-spacer'))
                    panelHead.appendChild(domButton('oq-btn oq-btn-ghost', T('收起'), T('收起面板'), () => { panelOpen = false; renderNative(true) }))
                    panel.appendChild(panelHead)

                    const peakKey = JSON.stringify(Array.isArray(snap.peaks) ? snap.peaks : [])
                    if (!rowsDirty && peakKey !== rowsKey) {
                      rowsKey = peakKey
                      rows = (snap.peaks || []).map((entry) => ({ start: entry.startH, end: entry.endH }))
                    }
                    const settings = makeCard(T('运行设置'), undefined, planning ? T('已开启低谷再发') : T('当前直接发送'))
                    settings.appendChild(domNode('div', 'oq-sec', T('高峰时段（时）')))
                    rows.forEach((entry, index) => {
                      const row = domNode('div', 'oq-setrow')
                      const start = domNode('input', 'oq-input')
                      start.type = 'number'; start.min = '0'; start.max = '23'; start.value = String(entry.start)
                      start.addEventListener('input', () => { rows[index].start = start.value; rowsDirty = true })
                      const end = domNode('input', 'oq-input')
                      end.type = 'number'; end.min = '0'; end.max = '23'; end.value = String(entry.end)
                      end.addEventListener('input', () => { rows[index].end = end.value; rowsDirty = true })
                      row.appendChild(start); row.appendChild(domNode('span', 'oq-sec', T('至'))); row.appendChild(end)
                      if (rows.length > 1) row.appendChild(domButton('oq-btn oq-btn-danger', T('删'), T('删除该时段'), () => { rows.splice(index, 1); rowsDirty = true; renderNative(true) }))
                      settings.appendChild(row)
                    })
                    const peakActions = domNode('div', 'oq-setrow')
                    if (rows.length < 6) peakActions.appendChild(domButton('oq-btn oq-btn-ghost', T('+ 时段'), T('添加高峰时段'), () => { rows.push({ start: '23', end: '8' }); rowsDirty = true; renderNative(true) }))
                    peakActions.appendChild(domButton('oq-btn oq-btn-primary', T('应用'), T('应用时段设置'), () => {
                      const peaks = rows.map((entry) => ({ startH: Number(entry.start), endH: Number(entry.end) }))
                      const valid = peaks.length >= 1 && peaks.length <= 6 && peaks.every((entry) => Number.isInteger(entry.startH) && Number.isInteger(entry.endH) && entry.startH >= 0 && entry.startH <= 23 && entry.endH >= 0 && entry.endH <= 23 && entry.startH !== entry.endH)
                      if (!valid) return
                      runAction('setPeaks', { peaks }, (ok) => { if (ok) { rowsDirty = false; rowsKey = '' } })
                    }))
                    settings.appendChild(peakActions)
                    const weekend = domNode('label', 'oq-setrow')
                    const weekendInput = domNode('input', 'oq-check')
                    weekendInput.type = 'checkbox'; weekendInput.checked = snap.weekendsOffPeak === true
                    weekendInput.addEventListener('change', () => runAction('setWeekendsOffPeak', { weekendsOffPeak: weekendInput.checked }))
                    weekend.appendChild(weekendInput); weekend.appendChild(domNode('span', '', T('周末视为低谷（周六日不拦截）')))
                    settings.appendChild(weekend)
                    const enabled = domNode('label', 'oq-setrow')
                    const enabledInput = domNode('input', 'oq-check')
                    enabledInput.type = 'checkbox'; enabledInput.checked = snap.enabled === true
                    enabledInput.addEventListener('change', () => runAction('setEnabled', { enabled: enabledInput.checked }))
                    enabled.appendChild(enabledInput); enabled.appendChild(domNode('span', '', T('启用本插件')))
                    settings.appendChild(enabled)
                    const concurrency = domNode('div', 'oq-setrow')
                    concurrency.appendChild(domNode('span', '', T('低谷并发投递')))
                    for (const count of [1, 2, 3]) {
                      const pick = domButton('oq-btn' + (snap.concurrency === count ? ' oq-chip-on' : ''), count, T('并发 ') + count, () => {
                        if (snap && snap.concurrency === count) noteSettings(T('已是并发 ') + count, 'ok')
                        else runAction('setConcurrency', { concurrency: count }, (ok) => noteSettings(ok ? T('已生效：并发 ') + count : T('设置失败'), ok ? 'ok' : 'error'))
                      })
                      pick.setAttribute('aria-pressed', String(snap.concurrency === count))
                      concurrency.appendChild(pick)
                    }
                    if (settingsNote !== '') concurrency.appendChild(domNode('span', settingsNoteKind === 'error' ? 'oq-flash-err' : 'oq-flash', settingsNote))
                    settings.appendChild(concurrency)
                    if (typeof snap.configPath === 'string' && snap.configPath !== '') settings.appendChild(domNode('div', 'oq-path', T('配置：') + snap.configPath))
                    panel.appendChild(settings)

                    const workingCard = makeCard(T('工作中'), work.length)
                    workingCard.appendChild(makeList(work, T('当前没有正在投递的消息'), (item) => makeItem(item, 'work')))
                    panel.appendChild(workingCard)
                    const waitingCard = makeCard(T('等待'), waiting.length, peak && planning ? T('低谷后自动投递') : T('将尽快投递'))
                    waitingCard.appendChild(makeList(waiting, T('暂无等待消息'), (item) => makeItem(item, 'waiting')))
                    panel.appendChild(waitingCard)
                    const historyCard = makeCard(T('执行记录'), undefined, history.length + T(' 条'))
                    const historyHead = historyCard.firstChild
                    if (history.length > 0) historyHead.appendChild(domButton('oq-btn oq-btn-ghost', T('清空'), T('清空执行记录'), () => runAction('clearHistory', {})))
                    historyCard.appendChild(makeList(history, T('暂无记录'), makeHistory))
                    panel.appendChild(historyCard)
                    const modal = domNode('div', 'oq-modal')
                    modal.addEventListener('mousedown', (event) => {
                      if (event.target !== modal) return
                      panelOpen = false
                      renderNative(true)
                    })
                    modal.appendChild(panel)
                    host.appendChild(modal)
                  } catch (error) { report('native-render', error) }
                }

                const onSnapshot = () => renderNative(false)
                subs.add(onSnapshot)
                renderNative(true)
                const id = setInterval(() => renderNative(false), 1200)
                const onResize = () => positionNearComposer(host)
                const onEscape = (event) => {
                  if (event.key !== 'Escape' || !panelOpen) return
                  panelOpen = false
                  renderNative(true)
                }
                const onCaptureKeyDown = (event) => {
                  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
                  const editor = editorForEvent(event)
                  if (editor) queueFromEditor(editor, 'keydown', event)
                }
                const onCaptureSubmit = (event) => {
                  const editor = editorForEvent(event)
                  if (editor) queueFromEditor(editor, 'submit', event)
                }
                const onCaptureClick = (event) => {
                  if (!shouldQueueNow()) return
                  try {
                    const target = event.target
                    const button = target && typeof target.closest === 'function' ? target.closest('button,[role="button"]') : null
                    if (!button || host.contains(button)) return
                    const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ')
                    const likelySend = String(button.getAttribute('type')).toLowerCase() === 'submit' || /发送|send|submit/i.test(label)
                    if (!likelySend) return
                    const editor = editorForEvent(event)
                    if (editor) queueFromEditor(editor, 'click', event)
                  } catch (error) { report('capture-click', error) }
                }
                window.addEventListener('resize', onResize)
                window.addEventListener('keydown', onEscape)
                document.addEventListener('keydown', onCaptureKeyDown, true)
                document.addEventListener('submit', onCaptureSubmit, true)
                document.addEventListener('click', onCaptureClick, true)
                void refresh().then(() => renderNative(true)).catch(() => {})
                reportInfo('native fallback committed build=' + CLIENT_BUILD)
                reportInfo('send interceptor armed: session=' + (currentSessionId() === '' ? 'pending' : 'yes') + ' build=' + CLIENT_BUILD)
                return () => {
                  disposed = true
                  clearInterval(id)
                  if (noticeTimer !== null) clearTimeout(noticeTimer)
                  if (settingsNoteTimer !== null) clearTimeout(settingsNoteTimer)
                  subs.delete(onSnapshot)
                  try { if (markedEditor) markedEditor.removeAttribute('data-oq-planning-editor') } catch { /* ignore */ }
                  try { window.removeEventListener('resize', onResize) } catch { /* ignore */ }
                  try { window.removeEventListener('keydown', onEscape) } catch { /* ignore */ }
                  try { document.removeEventListener('keydown', onCaptureKeyDown, true) } catch { /* ignore */ }
                  try { document.removeEventListener('submit', onCaptureSubmit, true) } catch { /* ignore */ }
                  try { document.removeEventListener('click', onCaptureClick, true) } catch { /* ignore */ }
                  try { if (host && host.parentNode) host.parentNode.removeChild(host) } catch { /* ignore */ }
                }
              } catch (error) {
                consoleError('fallback mount', error)
                report('fallback-mount', error)
              }
              return () => { disposed = true; try { if (host && host.parentNode) host.parentNode.removeChild(host) } catch { /* ignore */ } }
            }, 'offpeak-queue: floating fallback')
          } catch (error) { consoleError('fallback effect', error); report('fallback-effect', error) }
          try {
            ctx.effect(() => {
              void refresh()
              const id = setInterval(() => { void refresh() }, 1500)
              return () => clearInterval(id)
            }, 'offpeak-queue: poll')
          } catch (error) { consoleError('poll start', error); report('poll-start', error) }

          try {
            fetch(BASE + '/state').then((r) => { if (r.ok) reportInfo('client boot ok, state reachable, build=' + CLIENT_BUILD) }).catch(() => {})
          } catch { /* ignore */ }

          // 诊断标记：注册后检查真实可见 DOM；render 调用本身不再算成功。
          try {
            ctx.effect(() => {
              const id = setTimeout(() => {
                try {
                  const nodes = [...document.querySelectorAll('[data-oq-surface]')]
                  const visible = nodes.filter(isActuallyVisible)
                  const chips = visible.reduce((sum, node) => sum + node.querySelectorAll('.oq-chip').length, 0)
                  const surfaces = visible.map((node) => node.getAttribute('data-oq-surface')).filter(Boolean).join(',') || 'none'
                  reportInfo('DOM probe: dock=' + (visible.length > 0 ? 'yes' : 'NO') + ' chips=' + chips + ' visible=' + surfaces + ' build=' + CLIENT_BUILD)
                } catch (error) { report('dom-probe', error) }
              }, 3500)
              return () => clearTimeout(id)
            }, 'offpeak-queue: DOM probe')
          } catch { /* ignore */ }
        }

        module.exports = { apply, inject }
        return module.exports
      },
    })
  } catch (error) {
    try { if (typeof console !== 'undefined') console.error('[offpeak-queue] client module load failed', error) } catch { /* ignore */ }
  }
})()
