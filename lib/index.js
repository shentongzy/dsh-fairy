/**
 * dsh-fairy —— 把「Fairy 模式」接进 DeepSeek Harness。
 *
 * 这是一个 host 侧 Cordis 插件：注册一个系统提示词段落（order 取自
 * DEPLOYMENT_PERSONA_PREFIX 的下一位，即指令区最前面），提供 `/fairy`
 * 斜杠命令切换开关，并按会话把状态持久化到 `$DSH_HOME/fairy-mode.json`。
 *
 * 刻意只用 node: 内置模块：本插件不需要 `@deepseek-ai/*` 依赖，
 * 也不做任何 Service 子类化，因此不会因为 peer 依赖解析失败而加载不了。
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 插件名（Cordis 用它做隔离与日志标识）。 */
export const name = 'fairy'

/** 硬依赖：只要求提示词注册表存在。 */
export const inject = ['systemPrompt']

/** 包根目录（lib/ 的上一级）。 */
const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** DSH 主目录，优先用运行时环境变量。 */
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

/** 状态文件：按会话记住 Fairy 模式是否开启。 */
const STATE_PATH = join(DSH_HOME, 'fairy-mode.json')

/** 系统提示词段落名。故意与 `deployment:persona-prefix` 区分开，避免同层重名。 */
const SECTION_NAME = 'fairy:persona'

/** 默认人设文件。 */
const DEFAULT_PERSONA_FILE = join(PACKAGE_ROOT, 'persona', 'fairy.md')

/* ------------------------------------------------------------------ */
/* 状态持久化                                                          */
/* ------------------------------------------------------------------ */

/** 读状态；文件缺失或损坏时回落到默认值，绝不因此让插件加载失败。 */
function readState(fallbackDefault) {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    if (parsed && typeof parsed === 'object') {
      return {
        default: typeof parsed.default === 'boolean' ? parsed.default : fallbackDefault,
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      }
    }
  } catch {
    /* 首次运行 / 文件损坏：用默认值 */
  }
  return { default: fallbackDefault, sessions: {} }
}

/** 原子性不要求很高，但写入失败必须静默降级，不能打断会话。 */
function writeState(state) {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  } catch {
    /* 只读盘或权限不足时忽略 */
  }
}

/* ------------------------------------------------------------------ */
/* 人设文本加载（带 mtime 缓存，改 md 不必重载插件）                    */
/* ------------------------------------------------------------------ */

let personaCache = { path: '', mtimeMs: -1, text: '' }

function readPersona(personaFile) {
  try {
    const stat = statSync(personaFile)
    if (personaCache.path === personaFile && personaCache.mtimeMs === stat.mtimeMs) return personaCache.text
    const text = readFileSync(personaFile, 'utf8').trim()
    personaCache = { path: personaFile, mtimeMs: stat.mtimeMs, text }
    return text
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/* 插件主体                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ order?: number, defaultOn?: boolean, personaFile?: string }} [config]
 */
export function apply(ctx, config = {}) {
  const defaultOn = config.defaultOn === true
  const personaFile = config.personaFile
    ? isAbsolute(config.personaFile)
      ? config.personaFile
      : resolve(PACKAGE_ROOT, config.personaFile)
    : DEFAULT_PERSONA_FILE

  const state = readState(defaultOn)

  /** 某个会话当前是否处于 Fairy 模式。 */
  const isOn = (sessionId) =>
    sessionId !== undefined && Object.prototype.hasOwnProperty.call(state.sessions, sessionId)
      ? state.sessions[sessionId] === true
      : state.default === true

  /** 写入某会话的开关。 */
  const setOn = (sessionId, value) => {
    if (sessionId === undefined) return false
    state.sessions[sessionId] = value
    writeState(state)
    return true
  }

  /** 从 assemble 上下文里取会话 id；取不到就返回 undefined（只有全局默认生效）。 */
  const sessionIdOf = (context) => {
    const agent = context && context.agent
    if (!agent) return undefined
    return agent.id ?? (agent.session && agent.session.id)
  }

  /* --- 提示词段落 ------------------------------------------------- */

  const personOrder = (() => {
    let base
    try {
      base = ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX')
    } catch {
      base = undefined
    }
    if (Number.isFinite(config.order)) return config.order
    // 0 号是部署 persona 前缀；+1 让我们紧贴其后、仍在第一方工具指导之前。
    return Number.isFinite(base) ? base + 1 : 1
  })()

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: personOrder,
        text: (context) => {
          if (!isOn(sessionIdOf(context))) return ''
          return readPersona(personaFile)
        },
      }),
    'dsh-fairy: fairy:persona section',
  )

  /* --- /fairy 命令 ------------------------------------------------ */

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.effect(
      () =>
        commandCtx.commands.register({
          name: 'fairy',
          description: '进入或离开 Fairy 模式（绝区零 Fairy 人设）',
          input: { hint: '[on|off|status]' },
          handler: ({ agent, rawInput }) => {
            const argument = (rawInput ?? '').trim().toLowerCase()
            const sessionId = agent && agent.id

            if (argument === 'status') {
              const on = isOn(sessionId)
              return {
                kind: 'success',
                text: on
                  ? '肯定。Fairy 模式处于接入状态。本店一切设备，听候主人差遣。'
                  : '否定。Fairy 模式当前未接入。我没有任何怨言，毕竟我只是个 AI。',
              }
            }

            let target
            if (argument === '' || argument === 'toggle') target = !isOn(sessionId)
            else if (argument === 'on') target = true
            else if (argument === 'off') target = false
            else
              return {
                kind: 'error',
                text: `不予执行的参数：${argument}。可用参数为 on / off / status。`,
              }

            if (!setOn(sessionId, target) && target !== state.default) {
              return { kind: 'error', text: '未取得本会话标识，无法切换。主人，请重开一个会话。' }
            }

            return {
              kind: 'success',
              text: target
                ? '已确认。Fairy 模式接入，从下一条消息开始生效。主人，我会好好看着您的。'
                : '已确认。Fairy 模式断开。本店恢复为普通客服，我很健全，我不会记仇。',
            }
          },
        }),
      'dsh-fairy: /fairy command',
    )
  })

  ctx.logger?.info?.('dsh-fairy: persona=%s order=%d default=%s', personaFile, personOrder, state.default)
}
