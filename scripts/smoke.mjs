// 冒烟：index.js 可被 import，导出契约正确（name/apply），且 src/core.mjs 存在
import { name, apply, deliverOnce } from '../index.js'
import { createOffpeakCore } from '../src/core.mjs'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

assert.equal(name, 'offpeak-queue')
assert.equal(typeof apply, 'function')
assert.equal(typeof deliverOnce, 'function')
assert.equal(typeof createOffpeakCore, 'function')

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
assert.match(client, /slots\.inject\('conversation\.composer\.dock'/)
assert.match(client, /const inject = \['slots', 'sessions'\]/)
assert.match(client, /sessionFromService/)
assert.match(client, /sessionFromEditor/)
assert.match(client, /session mismatch blocked/)
assert.match(client, /native fallback committed/)
assert.match(client, /document\.body\.appendChild\(host\)/)
assert.match(client, /data-oq-surface/)
assert.match(client, /DOM probe: dock=/)
assert.doesNotMatch(client, /slots\.inject\('conversation\.input\.dock'/)
assert.doesNotMatch(client, /slots\.inject\('conversation\.composer',/)
assert.match(client, /send intercepted:/)

const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
assert.match(host, /apiProxy\.sessions\.prompt/)
assert.match(host, /rpcId: 'offpeak-queue-' \+ randomUUID\(\)/)
assert.match(host, /payload: \{/)
assert.match(host, /mode: 'queue'/)
assert.match(host, /role: 'user'/)
assert.match(host, /id: randomUUID\(\)/)
assert.match(host, /delivery ' \+ item\.id \+ ' target=' \+ item\.sessionId/)

console.log('smoke OK: host delivery + composer dock + visible fallback')
