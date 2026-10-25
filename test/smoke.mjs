/**
 * dsh-fairy 的离线自测：用假的 Cordis 上下文跑一遍 register / 切开关 / 隔离 / 持久化。
 * 用 DSH_HOME 指到临时目录，绝不碰真实 profile 的状态文件。
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const home = mkdtempSync(join(tmpdir(), 'fairy-test-'))
process.env.DSH_HOME = home

const mod = await import('../lib/index.js')

assert.equal(mod.name, 'fairy')
assert.deepEqual(mod.inject, ['systemPrompt'])

/* ---- 假上下文 ---- */
const sections = []
let commandDef
const ctx = {
  systemPrompt: {
    getSectionOrder: (n) => (n === 'DEPLOYMENT_PERSONA_PREFIX' ? 0 : undefined),
    section: (s) => {
      sections.push(s)
      return () => {}
    },
  },
  effect: (fn) => fn(),
  inject: (deps, cb) => {
    assert.deepEqual(deps, ['commands'])
    cb({
      effect: (fn) => fn(),
      commands: {
        register: (def) => {
          commandDef = def
          return () => {}
        },
      },
    })
  },
  logger: { info: () => {} },
}

mod.apply(ctx, {})

// 段落注册了、名字与排序正确
assert.equal(sections.length, 1)
const section = sections[0]
assert.equal(section.name, 'fairy:persona')
assert.equal(section.order, 1, 'persona 段落应紧贴 persona-prefix 之后')
console.log('✓ section registered:', section.name, 'order=' + section.order)

// 命令注册了
assert.equal(commandDef.name, 'fairy')
assert.equal(typeof commandDef.handler, 'function')
console.log('✓ command registered: /fairy', commandDef.input.hint)

const s1 = { agent: { id: 'session-A' } }
const s2 = { agent: { id: 'session-B' } }

// 默认关闭
assert.equal(section.text(s1), '')
assert.equal(section.text({}), '', '没有 agent 时不应该注入人设')
console.log('✓ default off (no persona text)')

// 打开 A
let r = commandDef.handler({ agent: { id: 'session-A' }, rawInput: '' })
assert.equal(r.kind, 'success')
const on = section.text(s1)
assert.ok(on.includes('Fairy'), '人设文本应包含 Fairy')
assert.ok(on.includes('主人'), '人设文本应包含对「主人」的称呼')
console.log('✓ /fairy toggled ON, persona is', on.length, 'chars')

// B 不受影响（按会话隔离）
assert.equal(section.text(s2), '')
console.log('✓ session isolation: B still off')

// status
r = commandDef.handler({ agent: { id: 'session-A' }, rawInput: 'status' })
assert.match(r.text, /接入/)
r = commandDef.handler({ agent: { id: 'session-B' }, rawInput: 'status' })
assert.match(r.text, /否定/)
console.log('✓ /fairy status works for both sessions')

// 持久化：文件里应该有 session-A
const state = JSON.parse(readFileSync(join(home, 'fairy-mode.json'), 'utf8'))
assert.equal(state.sessions['session-A'], true)
assert.equal(state.default, false)
console.log('✓ persisted to', join(home, 'fairy-mode.json'))

// 关掉
r = commandDef.handler({ agent: { id: 'session-A' }, rawInput: 'off' })
assert.equal(r.kind, 'success')
assert.equal(section.text(s1), '')
console.log('✓ /fairy off clears the persona')

// 非法参数
r = commandDef.handler({ agent: { id: 'session-A' }, rawInput: 'loud' })
assert.equal(r.kind, 'error')
console.log('✓ invalid argument rejected')

// 重载后从磁盘恢复
sections.length = 0
commandDef = undefined
mod.apply(ctx, {})
assert.equal(sections[0].text(s1), '', 'A 已关闭，重载后仍应为空')
commandDef.handler({ agent: { id: 'session-C' }, rawInput: 'on' })
const reloaded = sections[sections.length - 1]
assert.ok(reloaded.text({ agent: { id: 'session-C' } }).includes('Fairy'))
console.log('✓ state survives a plugin reload')

console.log('\nALL PASS')
