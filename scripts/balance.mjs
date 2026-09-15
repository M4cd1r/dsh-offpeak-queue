// Structural balance check for client.js: skip strings and comments,
// then verify that every bracket closes in the right order.
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const stack = []
let i = 0
const pairs = { ')': '(', ']': '[', '}': '{' }
let line = 1
let mode = 'code'
let tplDepth = 0
while (i < src.length) {
  const ch = src[i]
  const next = src[i + 1]
  if (ch === '\n') line++
  if (mode === 'line') { if (ch === '\n') mode = 'code'; i++; continue }
  if (mode === 'block') { if (ch === '*' && next === '/') { mode = 'code'; i += 2 } else i++; continue }
  if (mode === 'single' || mode === 'double') {
    if (ch === '\\') { i += 2; continue }
    if ((mode === 'single' && ch === "'") || (mode === 'double' && ch === '"')) mode = 'code'
    i++; continue
  }
  if (mode === 'tpl') {
    if (ch === '\\') { i += 2; continue }
    if (ch === '`') { if (tplDepth === 0) mode = 'code'; else tplDepth--; i++; continue }
    if (ch === '$' && next === '{') { tplDepth++; i += 2; continue }
    i++; continue
  }
  if (ch === '/' && next === '/') { mode = 'line'; i += 2; continue }
  if (ch === '/' && next === '*') { mode = 'block'; i += 2; continue }
  if (ch === "'") { mode = 'single'; i++; continue }
  if (ch === '"') { mode = 'double'; i++; continue }
  if (ch === '`') { mode = 'tpl'; i++; continue }
  if (ch === '(' || ch === '[' || ch === '{') { stack.push([ch, line]); i++; continue }
  if (ch === ')' || ch === ']' || ch === '}') {
    const open = stack.pop()
    if (!open || open[0] !== pairs[ch]) {
      console.log('FIRST MISMATCH at line ' + line + ' char ' + ch + '; expected close of ' + (open ? open[0] : 'nothing') + ' opened line ' + (open ? open[1] : '-'))
      process.exit(0)
    }
    i++; continue
  }
  i++
}
if (stack.length) console.log('UNCLOSED: ' + stack.map((s) => s[0] + '@L' + s[1]).join(', '))
else console.log('balanced OK')
