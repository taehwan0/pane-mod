import type { AgentRow, AgentState, Alert, AlertKind, Limit, LogAgent, LogCall, LogEntry, LogError, Memory, Recent, SessionColor, Snapshot, TaskItem, Totals } from '../types'

/** The sprite's three motions: working through a turn, idle between turns, and the cheer that follows a finished turn. */
export type Motion = 'working' | 'idle' | 'complete'

/** Whether each motion loops or holds its last frame; its frames are the PNG files its folder holds. */
export const MOTIONS: Readonly<Record<Motion, { isLooping: boolean }>> = {
  working: { isLooping: true },
  idle: { isLooping: true },
  complete: { isLooping: false },
}

/** Each motion's frames, as paths under the sprite folder (`idle/frame_001.png`). */
export type Frames = Readonly<Record<Motion, readonly string[]>>

export const NO_FRAMES: Frames = { working: [], idle: [], complete: [] }

/** A motion's frames: the PNG files its folder holds, in name order, as paths under the sprite folder. */
export const spriteFrames = (motion: Motion, entries: readonly { name: string; kind: string }[]): string[] =>
  entries
    .filter(entry => entry.kind === 'file' && /\.png$/i.test(entry.name))
    .map(entry => `${motion}/${entry.name}`)
    .sort()

/** The frames a motion is drawn with: its own, else idle's, else any motion's; none where no folder holds a frame. */
export const framesFor = (motion: Motion, frames: Frames): readonly string[] =>
  [frames[motion], frames.idle, frames.working, frames.complete].find(list => list.length > 0) ?? []

/** The frames with one of them left out: a frame that could not be read is not asked for again. */
export const withoutFrame = (frames: Frames, file: string): Frames => ({
  working: frames.working.filter(one => one !== file),
  idle: frames.idle.filter(one => one !== file),
  complete: frames.complete.filter(one => one !== file),
})

/** Frame `index` (0-based) of `frames`, held within them; none where there are none. */
export const frameAt = (frames: readonly string[], index: number): string | undefined =>
  frames[Math.min(Math.max(0, index), frames.length - 1)]

/** The frame after `index` of `count`: a looping motion wraps, the cheer holds its last. */
export const nextFrame = (motion: Motion, index: number, count: number): number => {
  if (count <= 0) return 0

  return MOTIONS[motion].isLooping ? (index + 1) % count : Math.min(index + 1, count - 1)
}

/**
 * The folder a setting names, as an absolute path without a trailing slash:
 * `~` is the home folder, and a relative path is read from it. None where the
 * setting is empty, or names `~` with no home known.
 */
export const folderOf = (value: unknown, home: string | undefined): string | null => {
  const text = typeof value === 'string' ? value.trim() : ''

  if (text === '') return null
  const trimmed = text.length > 1 ? text.replace(/\/+$/, '') : text

  if (trimmed.startsWith('/')) return trimmed
  if (home === undefined || home === '') return null
  if (trimmed === '~') return home

  return `${home.replace(/\/+$/, '')}/${trimmed.replace(/^~\//, '')}`
}

/** The characters a gauge's lit and unlit steps are drawn with. */
export type BarGlyphs = { filled: string; empty: string }

/** The default steps, which stand short of the cell's height, so gauges on rows one above the other do not run together. */
export const BAR_GLYPHS: BarGlyphs = { filled: '▰', empty: '▱' }

/**
 * A gauge of `width` cells filled to `percent`, as its lit part and its unlit
 * part, drawn in two colors with `glyphs`.
 */
export const bar = (percent: number, width: number, glyphs: BarGlyphs = BAR_GLYPHS): [lit: string, unlit: string] => {
  const lit = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

  return [glyphs.filled.repeat(lit), glyphs.empty.repeat(width - lit)]
}

/** Green under 60%, yellow from 60%, red from 90%. */
export const tint = (percent: number): string => (percent >= 90 ? '#ef5350' : percent >= 60 ? '#fbc02d' : '#66bb6a')

/** How long until `at`, as `6d8h`, `4h15m`, `14m` or `<1m`. */
export const until = (at: number, now: number): string => {
  const minutes = Math.floor((at - now) / 60_000)

  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)

  return hours < 24 ? `${hours}h${String(minutes % 60).padStart(2, '0')}m` : `${Math.floor(hours / 24)}d${hours % 24}h`
}

/** Elapsed minutes as `42m` or `3h12m`. */
export const elapsed = (minutes: number): string => (minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`)

/** The branch a `.git/HEAD` names, or the short commit of a detached one. */
export const headName = (text: string): string | null => {
  const head = text.trim()

  if (head.startsWith('ref: refs/heads/')) return head.slice('ref: refs/heads/'.length)
  if (head.startsWith('ref: ')) return head.slice('ref: '.length)

  return /^[0-9a-f]{7,}$/.test(head) ? head.slice(0, 7) : null
}

/** Whether a git directory is a linked worktree's (`<repo>/.git/worktrees/<name>`), not a submodule's or the main one. */
export const isWorktreeDir = (gitDir: string): boolean => /\/worktrees\/[^/]+\/?$/.test(gitDir)

/** Where a worktree's `.git` file points, made absolute against the directory that holds it. */
export const gitDirOf = (text: string, dir: string): string | null => {
  const found = /^gitdir:\s*(.+)$/m.exec(text)?.[1]?.trim()

  if (found === undefined || found === '') return null

  return found.startsWith('/') ? found : `${dir === '/' ? '' : dir}/${found}`
}

/** The directory above `path`, `/` at the top. */
export const parentOf = (path: string): string => {
  const cut = path.replace(/\/+$/, '').lastIndexOf('/')

  return cut <= 0 ? '/' : path.slice(0, cut)
}

/** The last segment of a path. */
export const baseName = (path: string): string => path.replace(/\/+$/, '').split('/').pop() ?? path

/** Counts the commands a settings `hooks` block registers, across every event and matcher. */
export const countHooks = (hooks: unknown): number => {
  if (typeof hooks !== 'object' || hooks === null) return 0
  let count = 0

  for (const matchers of Object.values(hooks)) {
    if (!Array.isArray(matchers)) continue
    for (const matcher of matchers) {
      const inner: unknown = typeof matcher === 'object' && matcher !== null ? (matcher as { hooks?: unknown }).hooks : undefined

      count += Array.isArray(inner) ? inner.length : 1
    }
  }

  return count
}

/** A rate-limit reading with the time left until its reset, when there is one. */
export const limitOf = (limit: { kind: string; percentUsed: number; resetsAt?: string }, now: number): Limit => {
  const at = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt)

  return { kind: limit.kind, percentUsed: limit.percentUsed, resetsIn: Number.isNaN(at) ? null : until(at, now) }
}

/** A span of seconds as `12s`, `1m12s` or `1h05m`. */
export const duration = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))

  if (whole < 60) return `${whole}s`
  if (whole < 3600) return `${Math.floor(whole / 60)}m${String(whole % 60).padStart(2, '0')}s`

  return `${Math.floor(whole / 3600)}h${String(Math.floor((whole % 3600) / 60)).padStart(2, '0')}m`
}

/** The memory files counted by where they were loaded from, the most first. */
export const memoryOf = (files: readonly { type: string }[]): Memory => {
  const counts = new Map<string, number>()

  for (const file of files) counts.set(file.type, (counts.get(file.type) ?? 0) + 1)

  return { total: files.length, byType: [...counts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count) }
}

/** How many MCP servers the tool names (`mcp__<server>__<tool>`) come from. */
export const mcpServersOf = (names: readonly string[]): number =>
  new Set(names.map(name => /^mcp__(.+?)__/.exec(name)?.[1]).filter(server => server !== undefined)).size

/** The engine's agent status, with the three ways of ending folded into two. */
export const stateOf = (status: string): AgentState =>
  status === 'completed' ? 'done' : status === 'failed' || status === 'killed' ? 'failed' : status === 'pending' || status === 'waiting' || status === 'idle' ? status : 'running'

export const isEnded = (state: AgentState): boolean => state === 'done' || state === 'failed'

/**
 * What a subagent's row says it did: its tool calls, where any were seen (a
 * teammate in a terminal of its own runs its calls where no hook sees them),
 * and the tool it runs now.
 */
export const toolsOf = (agent: Pick<AgentRow, 'tools' | 'tool'>): string =>
  `${agent.tools === 0 ? '' : ` · ${agent.tools} tools`}${agent.tool === null ? '' : ` · ${agent.tool}`}`

/** The subagents' states in the order they are counted: those at work first, the ended last. */
export const STATE_ORDER: readonly AgentState[] = ['running', 'waiting', 'idle', 'pending', 'done', 'failed']

/** The subagents by state, then how many in all: `2 running · 1 idle · 3`; a teammate that waits for a message is idle, not running. */
export const agentCounts = (states: readonly AgentState[]): string =>
  [...STATE_ORDER.flatMap(state => {
    const count = states.filter(one => one === state).length

    return count > 0 ? [`${count} ${state}`] : []
  }), `${states.length}`].join(' · ')

/** A model's name without a `[1m]` tag or a date, so two spellings of one model compare equal. */
export const modelBase = (model: string): string => model.replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '')

/** The model families a name is known for, as Claude Code writes them. */
const MODEL_FAMILIES: Readonly<Record<string, string>> = { fable: 'Fable', mythos: 'Mythos', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

/**
 * A model as a person names it: `Opus 5.5` for `claude-opus-5-5[1m]`, `Sonnet
 * 3.5` for `claude-3-5-sonnet-20241022`, `Opus` for the alias `opus`. A
 * provider's prefix and suffix (`us.anthropic.`, `-v2:0`, `@20241022`), a
 * date and a context tag are left out. An id of a family or a shape not known
 * here (a model newer than this mod) is shown as it is.
 */
export const modelName = (model: string): string => {
  const id = model
    .trim()
    .replace(/\[[^\]]*\]$/, '')
    .replace(/^(?:[a-z]{2,6}\.)?anthropic\./, '')
    .replace(/@\d{8}$/, '')
    .replace(/-v\d+(?::\d+)?$/, '')
    .replace(/-\d{8}$/, '')
  const alias = MODEL_FAMILIES[id]

  if (alias !== undefined) return alias
  const modern = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?$/.exec(id)
  const legacy = /^claude-(\d+)(?:-(\d{1,2}))?-([a-z]+)$/.exec(id)
  const [family, major, minor] = modern !== null ? [modern[1], modern[2], modern[3]] : legacy !== null ? [legacy[3], legacy[1], legacy[2]] : []
  const name = family === undefined ? undefined : MODEL_FAMILIES[family]

  if (name === undefined || major === undefined) return model

  return minor === undefined || minor === '0' ? `${name} ${major}` : `${name} ${major}.${minor}`
}

/** The effort levels in order, the gauge's steps. */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type EffortLevel = (typeof EFFORT_LEVELS)[number]

/** A level as settings or an environment variable spell it (`med` is medium); anything else is none. */
export const effortLevelOf = (value: unknown): EffortLevel | null => {
  if (typeof value !== 'string') return null
  const word = value.trim().toLowerCase()
  const level = word === 'med' ? 'medium' : word

  return EFFORT_LEVELS.find(one => one === level) ?? null
}

/** One step lit per level, low lighting one and max all five: the lit steps and the unlit ones, drawn with `glyphs`. */
export const effortGauge = (level: EffortLevel, glyphs: BarGlyphs = BAR_GLYPHS): [lit: string, unlit: string] => {
  const lit = EFFORT_LEVELS.indexOf(level) + 1

  return [glyphs.filled.repeat(lit), glyphs.empty.repeat(EFFORT_LEVELS.length - lit)]
}

/** Gray at low, warming to red at max. */
export const effortTint = (level: EffortLevel): string =>
  ({ low: '#9e9e9e', medium: '#66bb6a', high: '#fbc02d', xhigh: '#ffa726', max: '#ef5350' })[level]

/**
 * What a `/effort` line says it set: a level, `other` for a word that is none
 * (a reset to the model's default), or null for text that says nothing of it.
 */
export const effortSaid = (text: string): EffortLevel | 'other' | null => {
  const word = /effort level to (\w+)/i.exec(text)?.[1]

  return word === undefined ? null : (effortLevelOf(word) ?? 'other')
}

/** A command's row as it reads, the tags the transcript wraps it in dropped. */
const commandText = (text: string): string => text.replace(/<\/?local-command-std(?:out|err)>/g, '').trim()

/** The colors `/color` takes, as the engine lists them. */
export const SESSION_COLORS: readonly SessionColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']

/** A kept or said color, if it is one `/color` gives. */
export const sessionColorOf = (value: unknown): SessionColor | null => SESSION_COLORS.find(color => color === value) ?? null

/**
 * What a `/color` row says it set: a color, `default` for a reset, or null for
 * text that says nothing of it (an invalid color, a teammate's refusal).
 */
export const colorSaid = (text: string): SessionColor | 'default' | null => {
  const said = commandText(text)

  if (/^Session color reset to default/.test(said)) return 'default'

  return sessionColorOf(/^Session color set to: (\w+)/.exec(said)?.[1])
}

/**
 * The name a `/rename` row says the session took, without the notes the engine
 * may add after it (another live session holds the name asked for, a newer
 * rename landed first, the registry could not be updated); null for any other row.
 */
export const renameSaid = (text: string): string | null => {
  const said = commandText(text)
    .replace(/\. Other sessions may still show the old name: [\s\S]*$/, '')
    .replace(/ \("[\s\S]*" is held by another live session on this machine\)$/, '')
    .replace(/ \(a newer rename landed first\)$/, '')
  const name = /^Session (?:renamed to|is named): ([\s\S]+)$/.exec(said)?.[1]?.trim()

  return name === undefined || name === '' ? null : name
}

/**
 * The level a model starts with before its first request says: the environment
 * variable, then the level saved for the model (a dated or `[1m]` spelling of
 * its name included), then the top-level one.
 */
export const effortGuess = (model: string, env: string | undefined, settings: Readonly<Record<string, unknown>>): EffortLevel | null => {
  const fromEnv = effortLevelOf(env)

  if (fromEnv !== null) return fromEnv
  const saved = settings.modelSettings
  const base = modelBase(model)

  if (typeof saved === 'object' && saved !== null) {
    const byModel = saved as Readonly<Record<string, { effortLevel?: unknown } | undefined>>
    const level = effortLevelOf(byModel[model]?.effortLevel) ?? effortLevelOf(byModel[base]?.effortLevel)

    if (level !== null) return level
  }

  return effortLevelOf(settings.effortLevel)
}

/** The audio files a player on the host can take (`afplay` on macOS). */
const SOUND_FILE = /\.(caf|wav|aiff?|mp3|m4a|aac)$/i

/** The clips a state's folder holds, as paths under the sound folder (`working/working1.caf`), in name order. */
export const soundFiles = (state: string, entries: readonly { name: string; kind: string }[]): string[] =>
  entries
    .filter(entry => entry.kind === 'file' && SOUND_FILE.test(entry.name))
    .map(entry => `${state}/${entry.name}`)
    .sort()

/** What a clip's bytes are, by its name, for a clip sent as its bytes. */
export const audioMime = (name: string): string => {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()

  if (ext === 'wav') return 'audio/wav'
  if (ext === 'aif' || ext === 'aiff') return 'audio/aiff'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a') return 'audio/mp4'
  if (ext === 'aac') return 'audio/aac'

  return 'audio/x-caf'
}

/** A count of tokens in a few characters: `840`, `12.4k`, `840k`, `1M`, `1.5M`. */
export const tokensShort = (count: number): string => {
  const round = (value: number): string => (value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10))

  if (count < 1_000) return String(count)
  if (count < 1_000_000) return `${round(count / 1_000)}k`

  return `${round(count / 1_000_000)}M`
}

/** Whether a code point takes two cells: Hangul, CJK, full-width forms and most emoji. */
const isWide = (code: number): boolean =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6) ||
  (code >= 0x1f300 && code <= 0x1faff) ||
  (code >= 0x20000 && code <= 0x3fffd)

/** The cells a text takes in a terminal, a wide character counted as two. */
export const cellsOf = (text: string): number => [...text].reduce((sum, char) => sum + (isWide(char.codePointAt(0) ?? 0) ? 2 : 1), 0)

/** Cuts a text to `max` cells, ending in an ellipsis where it was longer. */
export const clipCells = (text: string, max: number): string => {
  if (cellsOf(text) <= max) return text
  let kept = ''
  let used = 0

  for (const char of text) {
    const cells = cellsOf(char)

    if (used + cells > max - 1) break
    kept += char
    used += cells
  }

  return `${kept}…`
}

/** Cuts a text to `max` characters, ending in an ellipsis where it was longer. */
export const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text)

/** A prompt as one line: its tags dropped, its whitespace folded. */
export const oneLine = (text: string, max: number): string => clip(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), max)

/** A prompt as the log keeps it for its detail: its tags and control characters dropped, the spaces in each line folded, its blank lines left out. */
export const promptOf = (text: string, max: number): string =>
  clip(
    text
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(line => line !== '')
      .join('\n'),
    max,
  )

/** What a tool call works on, in a few words: a file's name, a command's start, a pattern, a query, a page. */
export const targetOf = (args: Readonly<Record<string, unknown>>): string | null => {
  const text = (key: string): string | null => {
    const value = args[key]

    return typeof value === 'string' && value.trim() !== '' ? value : null
  }
  const path = text('file_path') ?? text('notebook_path') ?? text('path')

  if (path !== null) return baseName(path)
  const command = text('command')

  if (command !== null) return clip(command.split('\n')[0]?.trim() ?? command, 40)
  const other = text('pattern') ?? text('query') ?? text('url') ?? text('description') ?? text('skill')

  return other === null ? null : clip(oneLine(other, 60), 40)
}

/** The kinds of work a turn's tool calls are counted under. */
export type ToolKind = 'edit' | 'run' | 'read' | 'agent' | 'other'
const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const READS = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebSearch', 'WebFetch'])
const AGENTS = new Set(['Agent', 'Task'])

export const toolKind = (tool: string): ToolKind =>
  EDITS.has(tool) ? 'edit' : tool === 'Bash' ? 'run' : READS.has(tool) ? 'read' : AGENTS.has(tool) ? 'agent' : 'other'

/** A local time as `HH:MM`. */
export const clockOf = (at: number): string => {
  const date = new Date(at)

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Minutes until a window reaches 100% at the pace its readings rose: from the
 * first reading to the last, which must be at least five minutes and one point
 * apart. Null where that pace cannot be told.
 */
export const minutesToFull = (readings: readonly { at: number; percent: number }[]): number | null => {
  const first = readings[0]
  const last = readings[readings.length - 1]

  if (first === undefined || last === undefined) return null
  const minutes = (last.at - first.at) / 60_000
  const rise = last.percent - first.percent

  if (minutes < 5 || rise < 1) return null

  return Math.max(0, Math.ceil((100 - last.percent) / (rise / minutes)))
}

/** A share of a turn's input the prompt cache served, 0 to 100, from the API's four counts. */
export const cacheHitOf = (usage: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }): number | null => {
  const total = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

  return total === 0 ? null : Math.round((usage.cache_read_input_tokens / total) * 100)
}

const OUTCOMES = new Set(['answer', 'aborted', 'refusal', 'error'])

/**
 * What a log line keeps at most of what its turn did: the items of each list,
 * and the characters of each of their strings. Every string is kept without
 * control characters, so each of its characters takes at most three bytes of
 * the kept JSON.
 */
export const LOG_CAPS = {
  /** Tools counted by name; calls to any other are counted together under OTHER_TOOLS. */
  tools: 10,
  /** A tool's, a skill's, an MCP tool's, or a subagent type's name. */
  name: 64,
  /** A file's name. */
  file: 60,
  skills: 6,
  mcp: 6,
  subagents: 6,
  /** A subagent's task. */
  task: 60,
  errors: 5,
  /** The first line of an error. */
  error: 100,
  /** Approvals asked for, and denials, each. */
  calls: 5,
  /** What a call worked on. */
  target: 40,
} as const

/** Where the calls to the tools past LOG_CAPS.tools are counted. */
export const OTHER_TOOLS = '(other)'

/**
 * Cuts a text to `max` UTF-16 units, ending in an ellipsis where it was
 * longer; a character of two units is never split.
 */
const cut = (text: string, max: number): string => {
  if (text.length <= max) return text
  const head = text.slice(0, Math.max(0, max - 1))

  return `${/[\ud800-\udbff]$/.test(head) ? head.slice(0, -1) : head}…`
}

/** A text as a log line keeps it: its tags and control characters dropped, its whitespace folded, cut to `max`. */
export const cleanOf = (text: string, max: number): string =>
  cut(
    text
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    max,
  )

/** An error's first line with any text, as a log line keeps it. */
export const errorLine = (text: string, max: number): string =>
  cleanOf(
    text
      .split('\n')
      .map(line => line.replace(/<[^>]+>/g, ' ').trim())
      .find(line => line !== '') ?? '',
    max,
  )

/** An MCP tool (`mcp__<server>__<tool>`) as `server:tool`; null for any other tool. */
export const mcpNameOf = (tool: string): string | null => {
  const found = /^mcp__(.+?)__(.+)$/.exec(tool)

  return found === null ? null : `${found[1]}:${found[2]}`
}

/** The calls by tool with one more call to `tool`: past LOG_CAPS.tools names, a new one is counted under OTHER_TOOLS. */
export const countTool = (tools: Readonly<Record<string, number>>, tool: string): Record<string, number> => {
  const name = cleanOf(tool, LOG_CAPS.name)
  const named = Object.keys(tools).filter(one => one !== OTHER_TOOLS).length
  const key = Object.hasOwn(tools, name) || named < LOG_CAPS.tools ? name : OTHER_TOOLS

  return { ...tools, [key]: (Object.hasOwn(tools, key) ? (tools[key] ?? 0) : 0) + 1 }
}

/** A list with `value` added at its end, unless it holds it already or holds `max`. */
export const withOnce = (list: readonly string[], value: string, max: number): string[] => (value === '' || list.includes(value) || list.length >= max ? [...list] : [...list, value])

/** The strings of a kept list; none where it is no list. */
const stringsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [])

/** The strings of a kept list, the first `max`, each cut to `chars`. */
const namesOf = (value: unknown, max: number, chars: number): string[] => stringsOf(value).slice(0, max).map(one => cleanOf(one, chars))

/** The objects of a kept list; none where it is no list. */
const recordsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null && !Array.isArray(one)) : []

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Kept calls by tool read back: the counts that are numbers, under their names cut short. */
const toolsFrom = (value: unknown): Record<string, number> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value)
          .filter((pair): pair is [string, number] => isCount(pair[1]))
          .slice(0, LOG_CAPS.tools + 1)
          .map(([name, count]) => [cleanOf(name, LOG_CAPS.name), Math.round(count)]),
      )
    : {}

const AGENT_OUTCOMES = new Set(['answer', 'aborted', 'refusal', 'error', 'running'])

/** Kept subagents read back: those with every field, the first few. */
const agentsFrom = (value: unknown): LogAgent[] =>
  recordsOf(value)
    .filter(one => typeof one.type === 'string' && typeof one.description === 'string' && typeof one.outcome === 'string' && AGENT_OUTCOMES.has(one.outcome) && isCount(one.seconds))
    .slice(0, LOG_CAPS.subagents)
    .map(one => ({
      type: cleanOf(String(one.type), LOG_CAPS.name),
      description: cleanOf(String(one.description), LOG_CAPS.task),
      outcome: one.outcome as LogAgent['outcome'],
      seconds: Math.round(one.seconds as number),
    }))

/** Kept errors read back: those with every field, the first few. */
const errorsFrom = (value: unknown): LogError[] =>
  recordsOf(value)
    .filter(one => typeof one.tool === 'string' && typeof one.isSubagent === 'boolean' && typeof one.text === 'string')
    .slice(0, LOG_CAPS.errors)
    .map(one => ({ tool: cleanOf(String(one.tool), LOG_CAPS.name), isSubagent: one.isSubagent === true, text: cleanOf(String(one.text), LOG_CAPS.error) }))

/** Kept approvals or denials read back: those with every field, the first few. */
const callsFrom = (value: unknown): LogCall[] =>
  recordsOf(value)
    .filter(one => typeof one.tool === 'string' && (one.target === null || typeof one.target === 'string'))
    .slice(0, LOG_CAPS.calls)
    .map(one => ({ tool: cleanOf(String(one.tool), LOG_CAPS.name), target: typeof one.target === 'string' ? cleanOf(one.target, LOG_CAPS.target) : null }))

/**
 * A kept log read back: the entries that still have every field, the newest
 * `max` of them, each with the fields a log line has and no other. A line kept
 * before its files and commands, or the tools, skills, MCP tools, subagents,
 * errors, approvals and denials, were has none of them.
 */
export const logFrom = (kept: unknown, max: number): LogEntry[] => {
  const entries = typeof kept === 'object' && kept !== null && Array.isArray((kept as { entries?: unknown }).entries) ? (kept as { entries: unknown[] }).entries : []
  const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
  const valid = entries.filter((entry): entry is Pick<LogEntry, 'endedAt' | 'seconds' | 'outcome' | 'text' | 'edits' | 'runs' | 'reads' | 'agents' | 'out' | 'cacheHit'> & Record<string, unknown> => {
    if (typeof entry !== 'object' || entry === null) return false
    const one = entry as Record<string, unknown>

    return (
      isNumber(one.endedAt) &&
      isNumber(one.seconds) &&
      typeof one.outcome === 'string' &&
      OUTCOMES.has(one.outcome) &&
      typeof one.text === 'string' &&
      isNumber(one.edits) &&
      isNumber(one.runs) &&
      isNumber(one.reads) &&
      isNumber(one.agents) &&
      (one.out === null || isNumber(one.out)) &&
      (one.cacheHit === null || isNumber(one.cacheHit))
    )
  })

  return valid.slice(-max).map(entry => ({
    endedAt: entry.endedAt,
    seconds: entry.seconds,
    outcome: entry.outcome,
    text: entry.text,
    edits: entry.edits,
    runs: entry.runs,
    reads: entry.reads,
    agents: entry.agents,
    out: entry.out,
    cacheHit: entry.cacheHit,
    files: stringsOf(entry.files),
    commands: stringsOf(entry.commands),
    tools: toolsFrom(entry.tools),
    skills: namesOf(entry.skills, LOG_CAPS.skills, LOG_CAPS.name),
    mcp: namesOf(entry.mcp, LOG_CAPS.mcp, LOG_CAPS.name),
    subagents: agentsFrom(entry.subagents),
    errors: errorsFrom(entry.errors),
    approvals: callsFrom(entry.approvals),
    denials: callsFrom(entry.denials),
  }))
}

/**
 * The skills and MCP tools used lately, the most recent first: those of the
 * turn under way (`current`), then those of the log's lines, newest first;
 * `max` of each.
 */
export const recentOf = (entries: readonly Pick<LogEntry, 'skills' | 'mcp'>[], current: Pick<LogEntry, 'skills' | 'mcp'> | null, max: number): Recent => {
  const newestFirst = [...(current === null ? [] : [current]), ...[...entries].reverse()]
  const latest = (lists: readonly (readonly string[])[]): string[] => [...new Set(lists.flatMap(list => [...list].reverse()))].slice(0, max)

  return { skills: latest(newestFirst.map(one => one.skills)), mcp: latest(newestFirst.map(one => one.mcp)) }
}

/**
 * A limit setting as a whole count: 0 for no limit, any other at least `min`;
 * a number, or a string that holds one; `fallback` for anything else.
 */
export const limitSetting = (value: unknown, fallback: number, min: number): number => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN

  if (!Number.isFinite(number)) return fallback
  const count = Math.round(number)

  return count <= 0 ? 0 : Math.max(min, count)
}

/**
 * The sessions whose logs stay: the `keep` most recently saved within `days`
 * (0 for either: no such limit). The rest are dropped.
 */
export const pruneLogs = (index: Readonly<Record<string, number>>, now: number, keep: number, days: number): { kept: Record<string, number>; dropped: string[] } => {
  const fresh = Object.entries(index)
    .filter(([, savedAt]) => days === 0 || now - savedAt <= days * 86_400_000)
    .sort((a, b) => b[1] - a[1])
    .slice(0, keep === 0 ? undefined : keep)
  const kept = Object.fromEntries(fresh)

  return { kept, dropped: Object.keys(index).filter(id => !(id in kept)) }
}

/**
 * A kept log's file read back by its name: the session's id, and which of its
 * files it is (0 for `<id>.json`, the newest lines; k for `<id>.<k>.json`, the
 * k-th oldest LOG_PART lines); null for a name no log is kept under.
 */
export const keptFileOf = (name: string): { id: string; part: number } | null => {
  const match = /^([A-Za-z0-9_-]+)(?:\.([1-9]\d*))?\.json$/.exec(name)

  return match === null || match[1] === undefined ? null : { id: match[1], part: match[2] === undefined ? 0 : Number(match[2]) }
}

/**
 * How many full files of `per` lines the oldest of a log's `lines` are sealed
 * in, the newest file keeping the rest (one line at least, `per` at most).
 */
export const sealedOf = (lines: number, per: number): number => (lines <= per ? 0 : Math.floor((lines - 1) / per))

/** The JSON a log's `part`-th sealed file holds: its lines from the oldest, `per` to a file. */
export const partText = (log: readonly LogEntry[], part: number, per: number): string => JSON.stringify({ entries: log.slice((part - 1) * per, part * per) })

/** A file as a folder's listing names it. */
type Listed = { name: string; size: number; mtimeMs: number }

/**
 * The kept files to let go of, of a folder's `files`: every file of the
 * sessions `pruneLogs` drops (one is saved when its newest file was last
 * written, or, with none, any of its other files), every file of a session
 * whose newest file is empty (emptied where nothing could be removed), and
 * `session`'s own files past its `sealed` ones. `session` itself, saved `now`,
 * stays.
 */
export const sweepOf = <File extends Listed>(files: readonly File[], session: string, sealed: number, now: number, keep: number, days: number): File[] => {
  const savedAt: Record<string, number> = {}
  const emptied = new Set<string>()

  for (const file of files) {
    const kept = keptFileOf(file.name)

    if (kept === null) continue
    if (kept.part === 0 && file.size === 0) emptied.add(kept.id)
    else if (kept.part === 0) savedAt[kept.id] = file.mtimeMs
  }
  for (const file of files) {
    const kept = keptFileOf(file.name)

    if (kept !== null && kept.part > 0 && !files.some(one => one.name === `${kept.id}.json`)) savedAt[kept.id] = Math.max(savedAt[kept.id] ?? 0, file.mtimeMs)
  }
  emptied.delete(session)
  const { dropped } = pruneLogs({ ...savedAt, [session]: now }, now, keep, days)
  const gone = new Set([...dropped, ...emptied])

  return files.filter(file => {
    const kept = keptFileOf(file.name)

    return kept !== null && (kept.id === session ? kept.part > sealed : gone.has(kept.id))
  })
}

/** When a log line ended: `HH:MM` on the day it is read, `MM/DD HH:MM` on another. */
export const stampOf = (at: number, now: number): string => {
  const date = new Date(at)
  const today = new Date(now)
  const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()

  return isToday ? clockOf(at) : `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${clockOf(at)}`
}

/** A local date and time in full, as `2026-10-10 14:09`. */
export const dateOf = (at: number): string => {
  const date = new Date(at)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${clockOf(at)}`
}

/** The alerts by how pressing they are: a dialog holding the turn first, then a limit near. */
export const ALERT_ORDER: readonly AlertKind[] = ['approval', 'limit']

/** The alerts still standing at `now` (one that goes by itself has not yet gone), the most pressing first, newest first within a kind. */
export const standing = (alerts: readonly Alert[], now: number): Alert[] =>
  alerts.filter(alert => alert.until === null || alert.until > now).sort((a, b) => ALERT_ORDER.indexOf(a.kind) - ALERT_ORDER.indexOf(b.kind) || b.at - a.at)

/**
 * The highest of `marks` that `percent` has reached and was not told yet, and
 * the marks told from now on: a mark it has fallen back under is forgotten (a
 * compaction, a new window), so reaching it again tells it again; a jump past
 * two marks tells only the higher.
 */
export const markReached = (percent: number | null, marks: readonly number[], told: readonly number[]): { reached: number | null; told: number[] } => {
  if (percent === null) return { reached: null, told: [...told] }
  const still = told.filter(mark => percent >= mark)
  const fresh = marks.filter(mark => percent >= mark && !still.includes(mark))

  if (fresh.length === 0) return { reached: null, told: still }
  const reached = Math.max(...fresh)

  return { reached, told: [...new Set([...still, ...marks.filter(mark => mark <= reached)])] }
}

/** How a turn ended, in a word. */
export const OUTCOME_WORDS: Readonly<Record<LogEntry['outcome'], string>> = { answer: 'answered', aborted: 'stopped', refusal: 'refused', error: 'failed' }

/**
 * Whether a log line has every word of a search in it, in any case: in what
 * was asked, the files it edited, the commands it ran, the tools, skills and
 * MCP tools it used, its subagents, and its failed calls. A search of no words
 * finds every line.
 */
export const logMatches = (entry: LogEntry, query: string): boolean => {
  const words = query.toLowerCase().split(/\s+/).filter(word => word !== '')

  if (words.length === 0) return true
  const text = [
    entry.text,
    ...entry.files,
    ...entry.commands,
    ...Object.keys(entry.tools),
    ...entry.skills,
    ...entry.mcp,
    ...entry.subagents.map(agent => `${agent.type} ${agent.description}`),
    ...entry.errors.map(errorText),
  ]
    .join('\n')
    .toLowerCase()

  return words.every(word => text.includes(word))
}

/**
 * The HUD in one line, as the hint under the prompt carries it where neither
 * the band nor the pane draws: the context's fill and the 5h window first,
 * then the model and its effort, the tasks done of all, the subagents
 * running, and the tool the main thread runs now.
 */
export const hintTail = (shot: Snapshot): string => {
  const five = shot.limits.find(limit => limit.kind === 'five_hour')
  const effort = effortLevelOf(shot.effort)
  const running = shot.agents.filter(agent => !isEnded(agent.state)).length
  const done = shot.tasks.filter(task => task.status === 'completed').length

  return [
    `ctx ${shot.contextPercent === null ? '--' : `${shot.contextPercent}%`}`,
    `5h ${five === undefined ? '--' : `${five.percentUsed}%`}`,
    `${modelName(shot.model)}${effort === null ? '' : ` ${effort}`}`,
    shot.tasks.length > 0 ? `tasks ${done}/${shot.tasks.length}` : '',
    running > 0 ? `subagents ${running}` : '',
    shot.activity === null ? '' : shot.activity.tool,
  ]
    .filter(part => part !== '')
    .join(' · ')
}

/** What a turn did, in counts: edits, commands, reads, subagents, failed and denied calls, then the tokens it wrote and its cache hits. */
export const doneOf = (entry: LogEntry): string[] =>
  [
    entry.edits > 0 ? `edit ${entry.edits}` : '',
    entry.runs > 0 ? `bash ${entry.runs}` : '',
    entry.reads > 0 ? `read ${entry.reads}` : '',
    entry.agents > 0 ? `agent ${entry.agents}` : '',
    entry.errors.length > 0 ? `err ${entry.errors.length}` : '',
    entry.denials.length > 0 ? `denied ${entry.denials.length}` : '',
    entry.out === null ? '' : `${tokensShort(entry.out)} out`,
    entry.cacheHit === null ? '' : `cache ${entry.cacheHit}%`,
  ].filter(part => part !== '')

/** The main thread's calls by tool, the most first (the others last): `Read 3 · Edit 2`, an MCP tool as `server:tool`. */
export const toolsLine = (tools: Readonly<Record<string, number>>): string =>
  Object.entries(tools)
    .sort((a, b) => Number(a[0] === OTHER_TOOLS) - Number(b[0] === OTHER_TOOLS) || b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tool, count]) => `${mcpNameOf(tool) ?? tool} ${count}`)
    .join(' · ')

/** How a subagent's own turn ended, in a word. */
const AGENT_WORDS: Readonly<Record<LogAgent['outcome'], string>> = { answer: 'done', aborted: 'stopped', refusal: 'refused', error: 'failed', running: 'running' }

/** A subagent as its line reads: its type, its task, how it ended, and how long it ran. */
export const agentLine = (agent: LogAgent): string =>
  [agent.type, agent.description, AGENT_WORDS[agent.outcome], duration(agent.seconds)].filter(part => part !== '').join(' · ')

/** A failed call as its line reads: the tool (a subagent's marked), then the error where it said one. */
export const errorText = (error: LogError): string => `${error.tool}${error.isSubagent ? ' (subagent)' : ''}${error.text === '' ? '' : `: ${error.text}`}`

/** Approvals asked for, or denials, on one line: each tool with what it worked on. */
export const callsLine = (calls: readonly LogCall[]): string => calls.map(call => (call.target === null ? call.tool : `${call.tool} ${call.target}`)).join(' · ')

/** What heads a session's log file: its name, where it ran, its id, and when the file was written. */
export type LogFileHead = { title: string | null; project: string; branch: string | null; session: string; savedAt: number }

/** A text as inline code, its backticks made quotes. */
const codeOf = (text: string): string => `\`${text.replace(/`/g, "'")}\``

/**
 * A session's log as a Markdown file to read: a heading per turn, newest
 * first, with the prompt quoted line by line and what the turn did under it:
 * the files edited, the commands run, the calls by tool, the skills and MCP
 * tools used, the subagents spawned, the calls that failed, the approvals
 * asked for and the calls denied, and its counts.
 */
export const logMarkdown = (entries: readonly LogEntry[], head: LogFileHead): string => {
  const lines = [
    `# ${head.title ?? 'pane-mod log'}`,
    '',
    `- project: ${head.project}${head.branch === null ? '' : ` (${head.branch})`}`,
    `- session: ${head.session}`,
    `- written: ${dateOf(head.savedAt)}, ${entries.length} turn${entries.length === 1 ? '' : 's'}, newest first`,
  ]

  for (const entry of [...entries].reverse()) {
    const unnamed = entry.edits - entry.files.length
    const done = doneOf(entry)

    lines.push('', `## ${dateOf(entry.endedAt)} · ${OUTCOME_WORDS[entry.outcome]} · ${duration(entry.seconds)}`, '')
    lines.push(...entry.text.split('\n').map(line => `> ${line}`))
    const items = [
      ...(entry.files.length > 0 ? [`- edited: ${entry.files.join(', ')}${unnamed > 0 ? ` +${unnamed}` : ''}`] : []),
      ...(entry.commands.length > 0 ? [`- bash: ${entry.commands.map(codeOf).join(', ')}`] : []),
      ...(Object.keys(entry.tools).length > 0 ? [`- tools: ${toolsLine(entry.tools)}`] : []),
      ...(entry.skills.length > 0 ? [`- skills: ${entry.skills.join(', ')}`] : []),
      ...(entry.mcp.length > 0 ? [`- mcp: ${entry.mcp.join(', ')}`] : []),
      ...(entry.subagents.length > 0 ? ['- subagents:', ...entry.subagents.map(agent => `  - ${agentLine(agent)}`)] : []),
      ...(entry.errors.length > 0 ? ['- errors:', ...entry.errors.map(error => `  - ${errorText({ ...error, text: codeOf(error.text) })}`)] : []),
      ...(entry.approvals.length > 0 ? [`- asked: ${callsLine(entry.approvals)}`] : []),
      ...(entry.denials.length > 0 ? [`- denied: ${callsLine(entry.denials)}`] : []),
      ...(done.length > 0 ? [`- done: ${done.join(' · ')}`] : []),
    ]

    if (items.length > 0) lines.push('', ...items)
  }

  return `${lines.join('\n')}\n`
}

const TASK_STATES: readonly TaskItem['status'][] = ['in_progress', 'pending', 'completed']

/** Whether a value read back is a task with every field. */
const isTask = (value: unknown): value is TaskItem => {
  if (typeof value !== 'object' || value === null) return false
  const one = value as Record<string, unknown>

  return typeof one.id === 'string' && typeof one.subject === 'string' && TASK_STATES.some(state => state === one.status) && (one.activeForm === null || typeof one.activeForm === 'string')
}

/** Kept tasks read back: those that still have every field. */
export const tasksFrom = (value: unknown): TaskItem[] => (Array.isArray(value) ? value.filter(isTask) : [])

/** A TodoWrite list as tasks, numbered in its order; null for arguments that hold no list. */
export const tasksOfTodos = (todos: unknown): TaskItem[] | null => {
  if (!Array.isArray(todos)) return null

  return todos
    .map((todo, index): TaskItem | null => {
      const one = (typeof todo === 'object' && todo !== null ? todo : {}) as Record<string, unknown>
      const status = TASK_STATES.find(state => state === one.status)

      return typeof one.content === 'string' && status !== undefined
        ? { id: `todo-${index}`, subject: one.content, status, activeForm: typeof one.activeForm === 'string' ? one.activeForm : null }
        : null
    })
    .filter((task): task is TaskItem => task !== null)
}

/** A TaskUpdate applied: its status, subject and active form where given; `deleted` takes the task off. */
export const updateTask = (tasks: readonly TaskItem[], update: Readonly<Record<string, unknown>>): TaskItem[] => {
  if (update.status === 'deleted') return tasks.filter(task => task.id !== update.taskId)

  return tasks.map(task => {
    if (task.id !== update.taskId) return task
    const status = TASK_STATES.find(state => state === update.status) ?? task.status

    return {
      ...task,
      status,
      subject: typeof update.subject === 'string' ? update.subject : task.subject,
      activeForm: typeof update.activeForm === 'string' ? update.activeForm : task.activeForm,
    }
  })
}

/** The tasks as the pane lists them: those under way first, then those waiting, then those done, each in the order they came. */
export const tasksInOrder = (tasks: readonly TaskItem[]): TaskItem[] => TASK_STATES.flatMap(state => tasks.filter(task => task.status === state))

/** Nothing used yet. */
export const NO_TOTALS: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }

/** Kept totals read back, zero where a figure is missing. */
export const totalsFrom = (value: unknown): Totals => {
  const one = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const count = (key: keyof Totals): number => (typeof one[key] === 'number' && Number.isFinite(one[key]) ? (one[key] as number) : 0)

  return { input: count('input'), output: count('output'), cacheRead: count('cacheRead'), cacheWrite: count('cacheWrite'), turns: count('turns') }
}

/** A turn's usage added to the totals. */
export const addUsage = (
  totals: Totals,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number },
): Totals => ({
  input: totals.input + usage.input_tokens,
  output: totals.output + usage.output_tokens,
  cacheRead: totals.cacheRead + usage.cache_read_input_tokens,
  cacheWrite: totals.cacheWrite + usage.cache_creation_input_tokens,
  turns: totals.turns + 1,
})

/**
 * A text broken into lines of at most `width` cells: at its own line breaks,
 * then at the last space that fits, or mid-word where none does. The HUD draws
 * each line as its own row, so it knows how many rows a text takes.
 */
export const wrapCells = (text: string, width: number): string[] => {
  const room = Math.max(1, width)
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    let rest = paragraph

    while (cellsOf(rest) > room) {
      const chars = [...rest]
      let count = 0
      let used = 0

      while (count < chars.length && used + cellsOf(chars[count] ?? '') <= room) {
        used += cellsOf(chars[count] ?? '')
        count += 1
      }
      const head = chars.slice(0, Math.max(1, count)).join('')
      const space = head.lastIndexOf(' ')
      // A head that ends where a word does is taken whole; otherwise it breaks at its last space, or mid-word.
      const taken = chars[count] === ' ' || space <= 0 ? head : head.slice(0, space)

      lines.push(taken)
      rest = rest.slice(taken.length).replace(/^ /, '')
    }
    lines.push(rest)
  }

  return lines
}

/**
 * Where the person's wheel over the pane goes: a tick over the log's rows (the
 * last `height` rows of the pane's tree) moves the log by its rows while the
 * log can move that way, and the new offset is returned. Any other tick
 * scrolls the pane (null): one off the log, one the log has no room for, one
 * toward a part of the log the window does not show yet (the log's bottom
 * below the window's, its top above), which the pane brings into view first,
 * and every one while a line shown is open (`isReading`): its detail is read
 * by scrolling the pane, and the lines stay put under it until it is closed.
 * The window shows the tree's rows from `top`, `bodyRows` of them.
 */
export const logWheel = (
  tick: { row: number | null; top: number; bodyRows: number; contentRows: number; by: number },
  log: { height: number; offset: number; total: number; shown: number; isReading: boolean },
): number | null => {
  if (tick.row === null || log.height === 0 || tick.by === 0 || log.isReading) return null
  const logTop = tick.contentRows - log.height

  if (tick.row < logTop || tick.row >= tick.contentRows) return null
  if (tick.by > 0 && tick.top + tick.bodyRows < tick.contentRows) return null
  if (tick.by < 0 && tick.top > logTop) return null
  const last = Math.max(0, log.total - log.shown)
  const to = Math.min(last, Math.max(0, log.offset + tick.by))

  return to === log.offset ? null : to
}

/** The pane's cards under its first two (the session's and the model's), in their default order. */
export const PANE_CARDS = ['tasks', 'agents', 'context', 'recent', 'log'] as const
export type PaneCard = (typeof PANE_CARDS)[number]

/**
 * The order a `paneOrder` setting puts the pane's lower cards in: names split
 * at commas or spaces, in any case, an unknown name or a repeated one left
 * out, and every card the setting does not name following in its default
 * order, so that an order never hides a card.
 */
export const paneOrderOf = (value: unknown): PaneCard[] => {
  const words = typeof value === 'string' ? value.toLowerCase().split(/[\s,]+/) : []
  const named = words.filter((word): word is PaneCard => PANE_CARDS.some(card => card === word))

  return [...new Set([...named, ...PANE_CARDS])]
}

/** The theme keys a `Text` or `Box` color takes (`ThemeKey` in the mods types), which follow the person's theme. */
export const THEME_COLORS = [
  'text',
  'inverseText',
  'inactive',
  'subtle',
  'suggestion',
  'remember',
  'success',
  'error',
  'warning',
  'merged',
  'claude',
  'permission',
  'planMode',
  'autoAccept',
  'promptBorder',
  'bashBorder',
  'ide',
  'diffAdded',
  'diffRemoved',
  'diffAddedDimmed',
  'diffRemovedDimmed',
  'diffAddedWord',
  'diffRemovedWord',
] as const

/**
 * A color a setting names, as a border takes it: a theme key in any case
 * (spelled as the theme spells it), or a `#rrggbb` hex; `fallback` for
 * anything else, so a mistyped setting never gets a drawing refused.
 */
export const colorOf = <T>(value: unknown, fallback: T): string | T => {
  const text = typeof value === 'string' ? value.trim() : ''

  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase()

  return THEME_COLORS.find(key => key.toLowerCase() === text.toLowerCase()) ?? fallback
}

/**
 * A gauge step a setting names: one character a cell wide (a code point that
 * is no mark, control, format, unassigned or space character, no emoji drawn
 * as a picture and no wide character); `fallback` for anything else.
 */
export const barGlyphOf = (value: unknown, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  const chars = [...text]
  const char = chars[0]

  if (chars.length !== 1 || char === undefined) return fallback
  if (/[\p{M}\p{Cc}\p{Cf}\p{Cs}\p{Cn}\p{Z}\p{Emoji_Presentation}]/u.test(char) || isWide(char.codePointAt(0) ?? 0)) return fallback

  return char
}
