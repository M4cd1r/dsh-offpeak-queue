// 冒烟：index.js 可被 import，导出契约正确（name/apply），且 src/core.mjs 存在
import { name, apply } from '../index.js'
import { createOffpeakCore } from '../src/core.mjs'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

assert.equal(name, 'offpeak-queue')
assert.equal(typeof apply, 'function')
assert.equal(typeof createOffpeakCore, 'function')

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
assert.match(client, /slots\.inject\('conversation\.composer\.dock'/)
assert.match(client, /native fallback committed/)
assert.match(client, /document\.body\.appendChild\(host\)/)
assert.match(client, /data-oq-surface/)
assert.match(client, /DOM probe: dock=/)
assert.doesNotMatch(client, /slots\.inject\('conversation\.input\.dock'/)
assert.doesNotMatch(client, /slots\.inject\('conversation\.composer',/)
assert.match(client, /send intercepted:/)

console.log('smoke OK: host exports + composer dock + visible fallback')
