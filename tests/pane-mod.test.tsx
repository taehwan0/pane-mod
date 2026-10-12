import type { AgentInfo, On, SessionUsage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { MockClock, TestBody } from 'claude-code/testing'

import { agentCounts, audioMime, bar, barGlyphOf, colorOf, paneOrderOf, modelName, cacheHitOf, cellsOf, clipCells, logWheel, wrapCells, colorSaid, countHooks, dateOf, duration, folderOf, frameAt, framesFor, logFrom, logMatches, logMarkdown, markReached, NO_FRAMES, promptOf, standing, pruneLogs, renameSaid, stampOf, effortGauge, effortGuess, effortLevelOf, effortSaid, gitDirOf, headName, isWorktreeDir, mcpServersOf, memoryOf, minutesToFull, nextFrame, oneLine, soundFiles, spriteFrames, stateOf, targetOf, tint, tokensShort, toolKind, toolsOf, until, withoutFrame } from '../hooks/format'
import { countTool, errorLine, keptFileOf, limitSetting, LOG_CAPS, mcpNameOf, OTHER_TOOLS, partText, recentOf, sealedOf, sweepOf, toolsLine, withOnce } from '../hooks/format'

const START = { cwd: '/w/app', surface: 'terminal', isInteractive: true } as const
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 140, scroll: { offset: 0, bodyRows: 12 }, view: {} }
const NOW = 95 * 60_000
const ACCENT = '#F7D02C'

const USAGE = {
  startedAt: 0,
  context: {
    window: 200_000,
    tokens: 84_000,
    percent: 42,
    breakdown: {
      memoryFiles: [
        { path: '/w/app/CLAUDE.md', type: 'Project', tokens: 10 },
        { path: '/w/app/AGENTS.md', type: 'Project', tokens: 10 },
        { path: '/home/CLAUDE.md', type: 'User', tokens: 10 },
      ],
      mcpTools: [],
      agents: [],
      skills: { totalSkills: 12, includedSkills: 12, tokens: 100, skillFrontmatter: [] },
      slashCommands: { totalCommands: 30, includedCommands: 30, tokens: 100 },
    },
  },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 70, resetsAt: new Date(NOW + 125 * 60_000).toISOString() },
    { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(NOW + 3 * 24 * 60 * 60_000).toISOString() },
  ],
  cost: { usd: 1.5 },
} as unknown as SessionUsage

const agent = (id: string, type: string, description: string, status: AgentInfo['status']): AgentInfo => ({ id, type, description, status }) as AgentInfo

/** The panes the engine beneath reports, and each pane the mod opened or closed. */
type PaneWorld = {
  panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[]
  opened: string[]
  closed: string[]
  usage?: () => SessionUsage
  /** The id of the session in view. */
  sessionId: string
  /** The files the mod wrote, and those a test put there, by path: their text, and when each was last written. */
  files: Record<string, { text: string; mtimeMs: number }>
  /** Each command the mod ran; with `noProcess` none can run, as in the desktop app. */
  ran: string[][]
  noProcess?: boolean
  /**
   * The folders the engine lists, by the end of their path (`assets/idle`, or a whole path), each with its files;
   * a file named in `unreadable` is listed but cannot be read; and each clip played, in order.
   */
  folders: Record<string, string[]>
  unreadable: string[]
  played: string[]
}
/** `count` frames as the mod's own are named: frame_001.png, frame_002.png, ... */
const framesNamed = (count: number): string[] => Array.from({ length: count }, (_, index) => `frame_${String(index + 1).padStart(3, '0')}.png`)
/** The mod's own frames as the repository's folder holds them: 36 idle, 29 working, 22 for the cheer; no clips. */
const OWN_FRAMES = { 'assets/idle': framesNamed(36), 'assets/working': framesNamed(29), 'assets/complete': framesNamed(22) }
const paneWorld = (): PaneWorld => ({ panes: [], opened: [], closed: [], sessionId: 'sess-A', files: {}, ran: [], folders: { ...OWN_FRAMES }, unreadable: [], played: [] })

/** The plugin's data folder as the engine names it (as HOME's would be), and the folder the logs are kept in. */
const DATA = '/Users/me/.claude/plugins/data/pane-mod-pane-mod'
const SESSIONS = `${DATA}/sessions`
/** Puts a kept file in the sessions folder (`sess-A` for `sess-A.json`, `sess-A.1` for a sealed one), as last written at `mtimeMs`. */
const keep = (ui: PaneWorld, name: string, record: Readonly<Record<string, unknown>>, mtimeMs = NOW): void => {
  ui.files[`${SESSIONS}/${name}.json`] = { text: JSON.stringify(record), mtimeMs }
}
/** What a kept file holds, read back; undefined where it is not there or empty. */
const savedOf = (ui: PaneWorld, name: string): Record<string, unknown> | undefined => {
  const text = ui.files[`${SESSIONS}/${name}.json`]?.text

  return text === undefined || text === '' ? undefined : (JSON.parse(text) as Record<string, unknown>)
}
/** The texts of a kept file's lines. */
const textsOf = (ui: PaneWorld, name: string): string[] => ((savedOf(ui, name)?.entries ?? []) as { text: string }[]).map(entry => entry.text)
/** The names in the sessions folder. */
const keptNames = (ui: PaneWorld): string[] =>
  Object.keys(ui.files)
    .filter(path => path.startsWith(`${SESSIONS}/`))
    .map(path => path.slice(SESSIONS.length + 1))
    .sort()

/** A terminal that reads the PNG files itself, as Ghostty does. */
const GHOSTTY = { GHOSTTY_RESOURCES_DIR: '/Applications/Ghostty.app/Contents/Resources/ghostty' } as const
/** Orca's terminal: xterm.js inside the app, which draws a sent picture but cannot open a path. */
const ORCA = { TERM_PROGRAM: 'Orca', TERM: 'xterm-256color' } as const

/** The first 33 bytes of a frame (the PNG signature and its IHDR chunk, 220x218 RGBA), in base64. */
const PNG_HEAD = 'iVBORw0KGgoAAAANSUhEUgAAANwAAADaCAYAAADNAyyc'

/**
 * A frame's stand-in for its PNG data: a PNG's opening, then its name with every other
 * character an `A`, padded to standard base64, so the engine takes it and a test can tell
 * the frames apart.
 */
const token = (frame: string): string => {
  const letters = frame.replace(/[^A-Za-z0-9]/g, 'A')

  return PNG_HEAD + letters + 'A'.repeat((4 - (letters.length % 4)) % 4)
}

/** The engine beneath the mod: a session in `cwd` over the given files and directories, with these subagents, in this terminal. */
const world = (
  on: On,
  cwd: string,
  files: Readonly<Record<string, string>>,
  dirs: readonly string[],
  agents: () => AgentInfo[] = () => [],
  terminal: Readonly<Record<string, string>> = GHOSTTY,
  reads: string[] = [],
  extraSettings: Readonly<Record<string, unknown>> = {},
  ui: PaneWorld = paneWorld(),
): MockClock => {
  const clock = mock.clock(on, { now: NOW })

  mock.env(on, { CLAUDE_PLUGIN_DATA: DATA, ...terminal })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    ui.opened.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  on('ui.close', ($, e) => {
    ui.closed.push(e.id)

    return { value: undefined }
  })
  on('ui.panes', () => ({ value: ui.panes.map(pane => ({ ...pane })) }))
  on('session.id', () => ({ value: ui.sessionId }))

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.usage', () => ({ value: ui.usage?.() ?? USAGE }))
  on('session.turns', () => ({ value: 12 }))
  on('agent.list', () => ({ value: agents() }))
  on('settings.read', () => ({
    value: {
      ...extraSettings,
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'a' }, { type: 'command', command: 'b' }] }],
        Stop: [{ hooks: [{ type: 'command', command: 'c' }] }],
      },
    },
  }))
  on('tool.list', () => ({
    value: ['Read', 'Edit', 'mcp__a__x', 'mcp__b__y', 'mcp__b__z'].map(name => ({ name, description: '', mcp: name.startsWith('mcp__') })),
  }))
  on('fs.stat', ($, e) => {
    if (dirs.includes(e.path)) return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
    if (files[e.path] !== undefined) return { value: { kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false } }
    throw new Error(`ENOENT: ${e.path}`)
  })
  on('fs.write', ($, e) => {
    ui.files[e.path] = { text: e.text, mtimeMs: clock.now() }

    return { value: undefined }
  })
  on('process.run', ($, e) => {
    ui.ran.push([...e.argv])
    if (ui.noProcess === true) return { deny: 'no process runs here' }
    if (e.argv[0] === '/bin/rm') for (const path of e.argv.slice(e.argv.indexOf('--') + 1)) delete ui.files[path]

    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', ($, e) => {
    const written = Object.entries(ui.files).filter(([path]) => path.slice(0, path.lastIndexOf('/')) === e.path)

    if (written.length > 0) return { value: written.map(([path, file]) => ({ name: path.slice(path.lastIndexOf('/') + 1), kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false })) }
    const folder = Object.keys(ui.folders).find(end => e.path === end || e.path.endsWith(`/${end}`))

    if (folder === undefined) return { deny: `ENOENT: ${e.path}` }

    return { value: (ui.folders[folder] ?? []).map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('audio.play', ($, e) => {
    ui.played.push(e.clip.asset ?? `${e.clip.mime}:${e.clip.base64}`)

    return { value: undefined }
  })
  on('fs.read', ($, e) => {
    // A frame read as bytes comes back as a token naming it, so a test can tell which frame was sent.
    if (e.as === 'bytes') {
      reads.push(e.path)
      if (ui.unreadable.some(file => e.path.endsWith(`/${file}`))) return { deny: `EACCES: ${e.path}` }

      return { value: { base64: token(e.path.replace(/^.*\/assets\//, '')) } }
    }
    const text = files[e.path] ?? ui.files[e.path]?.text

    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

    return { value: text }
  })

  return clock
}

const REPO = { '/w/app/.git/HEAD': 'ref: refs/heads/refactor/global-search\n' }

test('under a yellow rule the band shows the sprite at the left and the figures in five rows beside it', { options: { showContext: true } }, async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  // The rule spans the band in the accent yellow.
  expect(await band.find({ type: 'Text', text: /^━+$/ })).toMatchObject({ props: { color: ACCENT }, text: '━'.repeat(140) })
  // Row 1: project with its branch in brackets, then session time.
  expect(await band.find({ type: 'Text', text: /^app\(refactor\/global-search\)$/ })).toBeDefined()
  // Row 2: the model on a badge, its effort (unknown here: nothing saved, no request yet), and cost.
  expect(await band.find({ type: 'Text', text: /^ Opus 5\.5  effort -- · \$1\.50$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^ Opus 5\.5 $/ })).toMatchObject({ props: { bold: true, inverse: true } })
  // Row 3: context, then each window as its gauge and the time to its reset.
  expect(await band.find({ type: 'Text', text: /^ctx ▰▰▰▰▱▱▱▱▱▱ 42% · 5h ▰▰▰▰▰▰▰▱▱▱ 70% ↻2h05m · 7d ▰▱▱▱▱▱▱▱▱▱ 12% ↻3d0h$/ })).toBeDefined()
  // A gauge is two colors: its lit steps and percent in the figure's tint, its unlit steps in the theme's gray.
  expect(await band.find({ type: 'Text', text: /^ 42%$/ })).toMatchObject({ props: { color: '#66bb6a' } })
  expect(await band.find({ type: 'Text', text: /^▰▰▰▰$/ })).toMatchObject({ props: { color: '#66bb6a' } })
  expect(await band.find({ type: 'Text', text: /^▱▱▱▱▱▱$/ })).toMatchObject({ props: { color: 'subtle' } })
  expect(await band.find({ type: 'Text', text: /^ 70%$/ })).toMatchObject({ props: { color: '#fbc02d' } })
  // Row 4: memory files by source, hooks, and the tools split by where they come from.
  expect(await band.find({ type: 'Text', text: /^context 3 md \(Project 2 · User 1\) · hooks 3 · tools 2 · MCP 3\/2srv · skills 12 · cmds 30$/ })).toBeDefined()
  // Row 5: mode and session status.
  expect(await band.find({ type: 'Text', text: /^mode -- · ○ idle · turns 12$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^↳/ })).toBeUndefined()
  // Two cells stand on each side of the sprite: the figures take what the slot of 2 + 10 + 2 leaves.
  const boxes = await band.findAll({ type: 'Box' })

  expect(boxes.filter(box => box.props.gap === 2 && box.props.paddingLeft === 2)).toHaveLength(1)
  expect(boxes.filter(box => box.props.width === 140 - 14)).toHaveLength(1)
  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { columns: 10, rows: 5, source: { file: expect.stringMatching(/\/assets\/idle\/frame_001\.png$/), format: 'png' } } })
  await band.unmount()
})

const LIST = { options: { agents: 'list' } } as const

test('subagents are listed under the rows, those at work first, and an ended one leaves after its linger', LIST, async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [
    agent('a2', 'code-reviewer', 'review the diff', 'completed'),
    agent('a1', 'Explore', 'find the login bug', 'running'),
  ])

  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const rows = await band.findAll({ type: 'Text', text: /^↳ ./ })

  expect(rows.map(row => row.text)).toEqual(['↳ ● Explore  find the login bug  · 0s', '↳ ✓ code-reviewer  review the diff  · 0s'])
  expect(await band.find({ type: 'Text', text: /^●$/ })).toMatchObject({ props: { color: ACCENT } })
  await band.unmount()

  await clock.advance(32_000)
  const later = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect((await later.findAll({ type: 'Text', text: /^↳ ./ })).map(row => row.text)).toEqual(['↳ ● Explore  find the login bug  · 32s'])
  await later.unmount()
})

test('a list longer than the band has room for ends in a count', { options: { agents: 'list', showContext: true } }, async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'], () => [agent('a1', 'Explore', 'one', 'running'), agent('a2', 'Explore', 'two', 'running'), agent('a3', 'Explore', 'three', 'running')])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, maxRows: 8 } })

  expect((await band.findAll({ type: 'Text', text: /^↳ ./ })).map(row => row.text)).toEqual(['↳ ● Explore  one  · 0s', '↳ +2 more'])
  await band.unmount()
})

test('a subagent shows by its name, its type after it; an idle teammate stops its clock and counts as idle, not running', LIST, async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [
    { ...agent('a1', 'general-purpose', 'Detailed log', 'running'), name: 'log-detail' },
    { ...agent('a2', 'general-purpose', 'Research', 'idle'), name: 'researcher', teammateId: 'researcher@team' },
  ])

  await $.session.start(START)
  await clock.advance(32_000)
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  // No `0 tools` for a teammate whose calls run in a terminal of its own, where no hook sees them.
  expect((await band.findAll({ type: 'Text', text: /^↳ ./ })).map(row => row.text)).toEqual([
    '↳ ● log-detail general-purpose  Detailed log  · 32s',
    '↳ ○ researcher general-purpose  Research  · 0s',
  ])
  await band.unmount()
  expect(await paneRows($)).toContain('1 running · 1 idle · 2')
})

const MIXED = (): AgentInfo[] => [
  agent('a1', 'Explore', 'one', 'running'),
  agent('a2', 'Explore', 'two', 'running'),
  agent('a3', 'Plan', 'three', 'waiting'),
  agent('a4', 'code-reviewer', 'four', 'completed'),
  agent('a5', 'code-reviewer', 'five', 'killed'),
]

test('by default the subagents are one row of counts by state', async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'], MIXED)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  // One row: the nested pieces of it (`↳ subagents 5`, each count) are not rows of their own.
  expect((await band.findAll({ type: 'Text', text: /^↳ .*  / })).map(row => row.text)).toEqual(['↳ subagents 5  ● running 2  ◐ waiting 1  ✓ done 1  ✗ failed 1'])
  expect(await band.find({ type: 'Text', text: /^  ● running 2$/ })).toMatchObject({ props: { color: ACCENT } })
  await band.unmount()
})

test('with no subagents the summary draws no row', async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^↳/ })).toBeUndefined()
  await band.unmount()
})

test('turned off, the HUD shows no subagents and does not ask for them', { options: { agents: 'off' } }, async ($, on) => {
  let asked = 0

  world(on, '/w/app', REPO, ['/w/app/.git'], () => {
    asked += 1

    return MIXED()
  })
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^↳/ })).toBeUndefined()
  expect(asked).toBe(0)
  await band.unmount()
})

test('a narrow band gives the sprite room to the text', async ($, on) => {
  world(on, '/w/app', { '/w/app/.git/HEAD': 'ref: refs/heads/main\n' }, ['/w/app/.git'])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 60 } })

  expect(await band.find({ type: 'Image' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^\(main\)$/ })).toBeDefined()
  await band.unmount()
})

test('the sprite is left out when the setting turns it off', { options: { sprite: false } }, async ($, on) => {
  world(on, '/w/app', {}, [])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Image' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^\(.*\)$/ })).toBeUndefined()
  await band.unmount()
})

test("a worktree's branch is read from the HEAD its .git file points to, and marked as a worktree's", async ($, on) => {
  world(on, '/w/wt', { '/w/wt/.git': 'gitdir: /w/main/.git/worktrees/wt\n', '/w/main/.git/worktrees/wt/HEAD': 'ref: refs/heads/feature/x\n' }, [])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^\(feature\/x ⎇\)$/ })).toBeDefined()
  await band.unmount()
})

/** The engine beneath the mod, recording each frame the sprite is swapped to. */
const playing = (on: On, ui: PaneWorld = paneWorld(), terminal: Readonly<Record<string, string>> = GHOSTTY): { clock: MockClock; blits: string[] } => {
  const blits: string[] = []
  const clock = world(on, '/w/app', {}, [], () => [], terminal, [], {}, ui)

  on('ui.blit', ($, e) => {
    if ('source' in e && 'file' in e.source) blits.push(e.source.file.replace(/^.*\/assets\//, ''))

    return { value: {} }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return { clock, blits }
}

const TURN = { durationMs: 1000, isAborted: false, turnId: 'turn_1', answer: '' } as const

test('the sprite rests between turns, focuses while a model turn runs, and rests again after it without the cheer', async ($, on) => {
  const { clock, blits } = playing(on)

  await $.session.start(START)
  const idle = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await idle.find({ type: 'Image' })).toMatchObject({ props: { source: { file: expect.stringMatching(/\/assets\/idle\/frame_001\.png$/) } } })
  // Idle, it still moves.
  await clock.advance(80 * 2)
  expect(blits.at(-1)).toBe('idle/frame_003.png')
  await idle.unmount()

  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  const working = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  await clock.advance(80 * 3)
  expect(blits.at(-1)).toBe('working/frame_004.png')
  await working.unmount()

  // The cheer is off for now: an answered turn goes straight to idle, and stays there.
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(blits.at(-1)).toBe('idle/frame_001.png')
  await clock.advance(3_000)
  expect(blits.some(file => file.startsWith('complete/'))).toBe(false)
  expect(blits.at(-1)).toMatch(/^idle\//)
})

test('a turn that ends without an answer goes straight to idle', async ($, on) => {
  const { clock, blits } = playing(on)

  await $.session.start(START)
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  const working = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  await clock.advance(80)
  expect(blits.at(-1)).toBe('working/frame_002.png')
  await working.unmount()

  await $.turn.complete({ ...TURN, reason: 'aborted' })
  expect(blits.at(-1)).toBe('idle/frame_001.png')
  expect(blits.some(file => file.startsWith('complete/'))).toBe(false)
})

test('a slash command that starts no model turn (/effort, /reload-plugins) leaves the sprite idle, even while the band says it is at work', async ($, on) => {
  const { clock, blits } = playing(on)

  await $.session.start(START)
  const busy = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  await clock.advance(80 * 3)
  expect(blits.length).toBeGreaterThan(0)
  expect(blits.every(file => file.startsWith('idle/'))).toBe(true)
  await busy.unmount()
})

test("a subagent's turn ending does not end the main turn's working motion; the main turn's end does", async ($, on) => {
  const { clock, blits } = playing(on)

  await $.session.start(START)
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, turnId: 'turn_sub', reason: 'answer', agentId: 'agent_1' })
  await clock.advance(80)
  expect(blits.at(-1)).toBe('working/frame_002.png')

  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(blits.at(-1)).toBe('idle/frame_001.png')
  await band.unmount()
})

/** The mod's own folder of clips per state, laid in the world beneath it; each clip played is recorded there. */
const listening = (ui: PaneWorld): { played: string[] } => {
  Object.assign(ui.folders, { 'assets/sounds/working': ['working1.caf', 'working2.caf', 'notes.txt'], 'assets/sounds/idle': ['idle1.caf'] })

  return { played: ui.played }
}

test('a model turn starting plays one of the working clips, its end one of the idle clips', async ($, on) => {
  const ui = paneWorld()

  playing(on, ui)
  const { played } = listening(ui)

  await $.session.start(START)
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(played).toHaveLength(2)
  expect(played[0]).toMatch(/^assets\/sounds\/working\/working[12]\.caf$/)
  expect(played[1]).toBe('assets/sounds/idle/idle1.caf')
})

test('the sound setting off plays nothing', { options: { sound: false } }, async ($, on) => {
  const ui = paneWorld()

  playing(on, ui)
  const { played } = listening(ui)

  await $.session.start(START)
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(played).toHaveLength(0)
})

test('in a terminal that cannot open a path, such as Orca, the frames are sent as PNG data, each read once', async ($, on) => {
  const reads: string[] = []
  const blits: string[] = []
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], ORCA, reads)

  on('ui.blit', ($, e) => {
    if ('source' in e && 'png' in e.source) blits.push(e.source.png)

    return { value: {} }
  })
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { png: token('idle/frame_001.png') } } })
  // Played on, every frame goes as data; a loop of 36 frames and back to the first reads each file once.
  await clock.advance(80 * 37)
  expect(blits.at(-1)).toBe(token('idle/frame_002.png'))
  expect(blits.every(png => png.startsWith(`${PNG_HEAD}idleAframe`))).toBe(true)
  expect(reads).toHaveLength(36)
  expect(new Set(reads).size).toBe(36)
  await band.unmount()
})

test('the setting can hold the source to the path or to the data whatever the terminal', { options: { spriteSource: 'file' } }, async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], ORCA)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { file: expect.stringMatching(/\/assets\/idle\/frame_001\.png$/), format: 'png' } } })
  await band.unmount()
})

test('held to bytes, even Ghostty is sent the data', { options: { spriteSource: 'bytes' } }, async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'])
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { png: token('idle/frame_001.png') } } })
  await band.unmount()
})

test('where the terminal has no placeholder images, the sprite and its margins leave the band once the engine says so', async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], ORCA)

  // Orca's xterm.js: the engine draws the alt in the picture's place and refuses every swap.
  on('ui.blit', () => ({ value: { deny: 'Image "sprite" draws its alt there: no placeholder images' } }))
  await $.session.start(START)

  const before = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await before.find({ type: 'Image' })).toBeDefined()
  await clock.advance(80)
  await before.unmount()

  const after = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const boxes = await after.findAll({ type: 'Box' })

  expect(await after.find({ type: 'Image' })).toBeUndefined()
  expect(boxes.filter(box => box.props.paddingLeft === 2 || box.props.gap === 2)).toHaveLength(0)
  expect(boxes.filter(box => box.props.width === 140)).toHaveLength(2)
  expect(await after.find({ type: 'Text', text: /^app\(refactor\/global-search\)$/ })).toBeDefined()
  await after.unmount()
})

test('a path the terminal cannot read is sent as data from then on', async ($, on) => {
  const sent: string[] = []
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'])

  on('ui.blit', ($, e) => {
    if (!('source' in e)) return { value: {} }
    if ('file' in e.source) {
      sent.push('file')

      return { value: { deny: 'Image "sprite" draws its alt there: a file this terminal cannot read' } }
    }
    sent.push('png')

    return { value: {} }
  })
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  await clock.advance(80 * 3)
  expect(sent).toEqual(['file', 'png', 'png'])
  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { png: expect.stringMatching(/idleAframeA00/) } } })
  await band.unmount()
})

const RUN = { args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const SAVED = { effortLevel: 'high', modelSettings: { 'claude-opus-5-5': { effortLevel: 'xhigh' } } } as const

/** The band's second row, as one string. */
const rowTwo = async (band: { find: (query: { type: 'Text'; text: RegExp }) => Promise<{ text?: string } | undefined> }): Promise<string | undefined> =>
  (await band.find({ type: 'Text', text: /^ Opus 5\.5  / }))?.text

test('before any request the effort is the level saved for the model, drawn as a gauge of five steps', async ($, on) => {
  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(band)).toBe(' Opus 5.5  ▰▰▰▰▱ xhigh · $1.50')
  expect(await band.find({ type: 'Text', text: /^▰▰▰▰$/ })).toMatchObject({ props: { color: '#ffa726' } })
  expect(await band.find({ type: 'Text', text: /^▱$/ })).toMatchObject({ props: { color: 'subtle' } })
  await band.unmount()
})

/** The row a slash command leaves in the transcript: `/effort`'s once a level is picked from its menu, `/rename`'s, `/color`'s. */
const commandRow = (text: string, agentId?: string) => ({
  message: { type: 'system' as const, name: 'local_command', content: [{ type: 'text' as const, text: `<local-command-stdout>${text}</local-command-stdout>` }] },
  door: 'command' as const,
  origin: { kind: 'composer' as const },
  uuid: `row_${text.length}`,
  ...(agentId === undefined ? {} : { agentId }),
})

test("/effort's row sets the level at once, max included, which no settings file holds", async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED)

  on('session.append', ($, e, next) => next(e))
  await $.session.start(START)
  await $.session.append(commandRow('Set effort level to max (this session only): Maximum capability with deepest reasoning.'))
  await clock.advance(2_000)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(band)).toBe(' Opus 5.5  ▰▰▰▰▰ max · $1.50')
  expect(await band.find({ type: 'Text', text: /^ max$/ })).toMatchObject({ props: { color: '#ef5350', bold: true } })
  await band.unmount()

  // A word that is no level is a reset to the default: the settings tell again.
  await $.session.append(commandRow('Set effort level to auto'))
  await clock.advance(2_000)

  const reset = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(reset)).toBe(' Opus 5.5  ▰▰▰▰▱ xhigh · $1.50')
  await reset.unmount()
})

test("a subagent's /effort row and a command result with no text leave the main thread's level as it was", async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED)

  on('session.append', ($, e, next) => next(e))
  on('command.run', () => ({}))
  await $.session.start(START)
  await $.session.append(commandRow('Set effort level to low', 'agent_1'))
  // A level picked from the menu: the command's own result carries no text.
  await $.command.run({ command: 'effort', ...RUN })
  await clock.advance(2_000)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(band)).toBe(' Opus 5.5  ▰▰▰▰▱ xhigh · $1.50')
  await band.unmount()
})

test("a request of the main thread says the level it goes out with, over the saved one; a subagent's does not", async ($, on) => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED)

  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  await $.session.start(START)
  for await (const _ of $.turn.step({ turnId: 'turn_1', index: 0, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1, agentId: 'agent_1' })) void _
  await clock.advance(2_000)

  const before = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(before)).toBe(' Opus 5.5  ▰▰▰▰▱ xhigh · $1.50')
  await before.unmount()

  for await (const _ of $.turn.step({ turnId: 'turn_1', index: 1, model: 'claude-opus-5-5', effort: 'low', messageCount: 2 })) void _
  await clock.advance(2_000)

  const after = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await rowTwo(after)).toBe(' Opus 5.5  ▰▱▱▱▱ low · $1.50')
  await after.unmount()
})

const DOCKING = { columns: 200, rows: 60, isFullscreen: true } as const
const PANE_PROPS = { title: 'pane-mod', isFocused: false, bodyColumns: 56, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 50 }, view: {} }
const SHOWN = { id: 'pane-mod', title: 'pane-mod', isShown: true, isFocused: false, isPlaced: true }

test('auto opens the side pane where the screen docks one; while it is docked and shown the band draws one row', { options: { bandWithPane: 'line', showContext: true } }, async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)

  const first = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })

  expect(ui.opened).toEqual(['pane-mod'])
  await first.unmount()

  ui.panes = [SHOWN]
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  // The pane holds the small sprite beside its first card, with no rule, and every figure in a card by what it is about.
  expect(await pane.find({ type: 'Image' })).toMatchObject({ props: { columns: 12, rows: 6 } })
  expect(await pane.find({ type: 'Text', text: /^━+$/ })).toBeUndefined()
  const cards = await pane.findAll({ type: 'Box' })

  expect(cards.filter(box => box.props.borderStyle === 'round').map(box => box.props.borderColor)).toEqual([ACCENT, 'claude', 'subtle'])
  // The first card spans the pane and holds the sprite, its rows beside it.
  const identity = cards.find(box => box.props.borderStyle === 'round')

  expect(identity?.props.width).toBe(PANE_PROPS.bodyColumns)
  expect(JSON.stringify(identity)).toContain('"type":"Image"')
  // The rows stand left of the sprite, as tall as it; how long the session has run is not drawn.
  const drawn = JSON.stringify(identity)

  expect(drawn.indexOf('card-session-rows')).toBeLessThan(drawn.indexOf('"type":"Image"'))
  expect(await pane.find({ key: 'card-session-rows' })).toMatchObject({ props: { height: 6 } })
  expect(drawn).not.toContain('⏱')
  const rows = (await pane.findAll({ type: 'Text', text: /\S/ })).map(row => row.text)

  expect(rows).toEqual(
    expect.arrayContaining([
      'app (refactor/global-search)',
      'mode -- · 12 turns',
      '○ idle',
      'Opus 5.5',
      '▰▰▰▰▱ xhigh',
      // The context's tokens over its window: the percent alone does not say how big the window is.
      'ctx ▰▰▰▰▱▱▱▱▱▱ 42%  84k/200k',
      '5h  ▰▰▰▰▰▰▰▱▱▱ 70%  ↻ 2h05m',
      '7d  ▰▱▱▱▱▱▱▱▱▱ 12%  ↻ 3d0h',
      '$1.50',
      'context',
      'md 3 (Project 2 · User 1) · hooks 3 · tools 2',
      'MCP 3 tools / 2 servers · skills 12 · commands 30',
    ]),
  )

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })

  expect(await band.find({ type: 'Image' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^━━  Opus 5\.5  ▰▰▰▰▱ xhigh · ctx 42% · 5h 70% · ○ idle ─+$/ })).toBeDefined()
  await band.unmount()

  // Narrowed below what a dock needs, the pane is no longer placed: the band draws the whole HUD again.
  ui.panes = [{ ...SHOWN, isPlaced: false }]
  const narrow = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })

  expect(await narrow.find({ type: 'Text', text: /^━+$/ })).toBeDefined()
  expect(await narrow.find({ type: 'Image' })).toMatchObject({ props: { columns: 10, rows: 5 } })
  await narrow.unmount()
  await pane.unmount()
})

test('a screen that docks no pane keeps the HUD in the band and opens none', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 200, rows: 60, isFullscreen: false } })

  expect(ui.opened).toEqual([])
  expect(await band.find({ type: 'Text', text: /^━+$/ })).toBeDefined()
  await band.unmount()
})

test('in auto a pane seated above the prompt closes, and the band keeps the HUD', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)
  await (await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })).unmount()

  ui.panes = [SHOWN]
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: { ...PANE_PROPS, placement: 'inline' as const }, viewport: DOCKING })

  expect(ui.closed).toEqual(['pane-mod'])
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: { columns: 200, rows: 60, isFullscreen: false } })

  expect(await band.find({ type: 'Text', text: /^━+$/ })).toBeDefined()
  await band.unmount()
})

test('/pane-mod sets the layout for the session: band closes the pane, pane brings it back, a bare /pane-mod opens it', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)
  await (await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })).unmount()
  expect(ui.opened).toEqual(['pane-mod'])

  expect(await $.command.run({ command: 'pane-mod', ...RUN, args: 'band' })).toMatchObject({ text: 'band only.' })
  expect(ui.closed).toEqual(['pane-mod'])
  await (await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })).unmount()
  expect(ui.opened).toEqual(['pane-mod'])

  expect(await $.command.run({ command: 'pane-mod', ...RUN, args: 'pane' })).toMatchObject({ text: 'pane only.' })
  expect(ui.opened).toEqual(['pane-mod', 'pane-mod'])
  expect(await $.command.run({ command: 'pane-mod', ...RUN, args: 'sideways' })).toMatchObject({ text: 'Unknown layout "sideways". Use auto, band, pane or hint.' })
  expect(await $.command.run({ command: 'pane-mod', ...RUN, args: '' })).toMatchObject({ text: 'Opened the side pane.' })
})

test('/pane-mod hint leaves the band to the engine and ends the hint under the prompt with the HUD in one line; the pane, once shown, holds it instead', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  // What the engine draws in the band and the hint line when no plugin draws there.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>the engine's own band</Text>
  })
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{`${e.props.hint}${e.props.tail ?? ''}`}</Text>
  })
  await $.session.start(START)

  const hintOf = async (): Promise<string | undefined> => {
    const hint = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })
    const text = (await hint.find({ type: 'Text' }))?.text

    await hint.unmount()

    return text
  }

  // In auto the band holds the HUD, and the hint is the engine's.
  expect(await hintOf()).toBe('? for shortcuts')
  expect(await $.command.run({ command: 'pane-mod', ...RUN, args: 'hint' })).toMatchObject({ text: 'hint: the HUD in one line after the hint under the prompt; /pane-mod opens the pane.' })

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })

  expect(await band.find({ type: 'Text', text: /^the engine's own band$/ })).toBeDefined()
  await band.unmount()
  expect(await hintOf()).toBe('? for shortcuts · ctx 42% · 5h 70% · Opus 5.5 xhigh')

  // A bare /pane-mod opens the pane, which holds the HUD while it is shown.
  await $.command.run({ command: 'pane-mod', ...RUN, args: '' })
  ui.panes = [SHOWN]
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect(await hintOf()).toBe('? for shortcuts')
  await pane.unmount()
})

test('by default the band gives its place back while the pane is shown', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  // What the engine draws in the band when no plugin draws there.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>the engine's own band</Text>
  })
  await $.session.start(START)
  await (await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })).unmount()
  ui.panes = [SHOWN]
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: DOCKING })

  expect(await band.find({ type: 'Text', text: /━/ })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^the engine's own band$/ })).toBeDefined()
  await band.unmount()
  await pane.unmount()
})

test('held to the pane, a pane seated above the prompt stays, and the band keeps one row beside it', { options: { layout: 'pane', bandWithPane: 'line' } }, async ($, on) => {
  const ui = paneWorld()
  const flat = { columns: 160, rows: 50, isFullscreen: false } as const

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)
  await (await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: flat })).unmount()
  expect(ui.opened).toEqual(['pane-mod'])

  ui.panes = [SHOWN]
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: { ...PANE_PROPS, placement: 'inline' as const }, viewport: flat })

  expect(ui.closed).toEqual([])
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, viewport: flat })

  expect(await band.find({ type: 'Text', text: /^━━  Opus 5\.5  / })).toBeDefined()
  await band.unmount()
  await pane.unmount()
})

/** The engine beneath the mod with turns and tool calls answered, for the work log. */
const working = (on: On, ui: PaneWorld, terminal: Readonly<Record<string, string>> = GHOSTTY): MockClock => {
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], terminal, [], SAVED, ui)

  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return clock
}

const paneRows = async ($: Parameters<TestBody>[0]): Promise<string[]> => {
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const rows = (await pane.findAll({ type: 'Text', text: /\S/ })).map(row => row.text ?? '')

  await pane.unmount()

  return rows
}

test("a finished turn leaves one line in the pane's log: when, how it ended, how long, what was asked and what was done", async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  on('tool.call', () => ({ result: {} as never, text: 'ok' }))
  await $.session.start(START)
  await $.turn.start({ text: 'Refactor the search API\n\n<system-reminder>keep tests green</system-reminder>', turnId: 'turn_1' })
  await $.tool.call({ tool: 'Edit', file_path: '/w/app/src/A.java', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/app/src/A.java', old_string: 'b', new_string: 'c' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/w/app/src/B.java', content: 'x' } as never)
  await $.tool.call({ tool: 'Bash', command: './mvnw test' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'search' } as never)
  await $.turn.complete({
    ...TURN,
    durationMs: 134_000,
    reason: 'answer',
    usage: { input_tokens: 100, output_tokens: 41_000, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
  })

  const rows = await paneRows($)

  // Two edits of one file count once; the tags of a reminder do not reach the line.
  expect(rows).toContain(`${rows.find(row => /^\d\d:\d\d ✓/.test(row))?.slice(0, 5)} ✓  2m14s  Refactor the search API keep tests green · edit 2 · bash 1 · read 1 · 41k out · cache 90%`)
  // The log is a card: its title, and which lines of how many it shows.
  expect(rows).toEqual(expect.arrayContaining(['log', '1–1 of 1']))
})

test("a log line's mark opens its detail under it: the prompt whole, the files edited, the commands run, and a copy of the prompt", async ($, on) => {
  const ui = paneWorld()
  const copied: string[] = []
  const asked = `Rename the search API\n\n${'and keep the tests green '.repeat(4)}`

  working(on, ui)
  on('tool.call', () => ({ result: {} as never, text: 'ok' }))
  on('ui.copy', ($, e) => {
    copied.push(e.text)

    return { value: { isCopied: true as const } }
  })
  await $.session.start(START)
  await $.turn.start({ text: asked, turnId: 'turn_1' })
  await $.tool.call({ tool: 'Edit', file_path: '/w/app/src/A.java', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Bash', command: './mvnw test\necho done' } as never)
  await $.tool.call({ tool: 'Bash', command: 'git status' } as never)
  await $.turn.complete({ ...TURN, durationMs: 134_000, reason: 'answer' })

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const prompt = `Rename the search API\n${'and keep the tests green '.repeat(4).trim()}`

  expect(await pane.find({ key: 'log-detail' })).toBeUndefined()
  await pane.press({ key: 'log-1-open' })

  // The detail holds what the row has no room for, its lines kept, and wraps rather than cuts.
  expect(await pane.find({ key: 'log-detail' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^\d{4}-\d\d-\d\d \d\d:\d\d · answered · 2m14s$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Rename the search API' })).toBeDefined()
  // The detail wraps at the log card's inner width less its indent: 56 - 4 - 2.
  expect(await pane.find({ type: 'Text', text: /^and keep the tests green and keep the tests green$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'edited    A.java' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'bash      ./mvnw test' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '          git status' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'done      edit 1 · bash 2' })).toBeDefined()

  await pane.press({ key: 'log-copy' })
  expect(copied).toEqual([prompt])

  await pane.press({ key: 'log-1-open' })
  expect(await pane.find({ key: 'log-detail' })).toBeUndefined()
  await pane.unmount()
  expect(savedOf(ui, 'sess-A')).toMatchObject({ entries: [{ text: prompt, files: ['A.java'], commands: ['./mvnw test', 'git status'] }] })
})

test("the key f writes the session's log as a Markdown file in the plugin's data folder and opens it with the system's app", async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: [{ ...kept('Fix the login\nthen the tests', 5), files: ['A.java'], commands: ['git status'] }, kept('later task', 1)] })
  // No CLAUDE_PLUGIN_DATA: the folder is found under HOME, as Claude Code names it.
  working(on, ui, { ...GHOSTTY, CLAUDE_PLUGIN_DATA: '', HOME: '/Users/me' })
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  await pane.press({ key: 'log-file' })
  await pane.unmount()

  const path = `${DATA}/logs/sess-A.md`
  const text = ui.files[path]?.text ?? ''

  expect(ui.ran).toEqual([['/usr/bin/open', path]])
  // Newest first, each turn under its own heading with the prompt quoted line by line.
  expect(text).toMatch(/^# pane-mod log\n\n- project: app \(refactor\/global-search\)\n- session: sess-A\n/)
  expect(text.indexOf('> later task')).toBeLessThan(text.indexOf('> Fix the login'))
  expect(text).toContain('· answered · 30s\n\n> Fix the login\n> then the tests\n\n- edited: A.java\n- bash: `git status`\n- done: edit 1 · 1k out · cache 50%\n')
})

/** The engine beneath the mod for alerts: the settings hooks' events answered, and the lines put under approval dialogs. */
test('with no frame and no clip found (a clone without assets/), the sprite and its margins are left out of the band and the pane, nothing plays, and nothing fails', async ($, on) => {
  const ui = { ...paneWorld(), folders: {} }
  const blits: string[] = []
  const clock = working(on, ui)

  on('ui.blit', () => {
    blits.push('blit')

    return { value: {} }
  })
  await $.session.start(START)

  const band = await bandOf($)
  const boxes = await band.findAll({ type: 'Box' })

  expect(await band.find({ type: 'Image' })).toBeUndefined()
  expect(boxes.filter(box => box.props.paddingLeft === 2 || box.props.gap === 2)).toHaveLength(0)
  expect(boxes.filter(box => box.props.width === 140)).toHaveLength(2)
  expect(await band.find({ type: 'Text', text: /^app\(refactor\/global-search\)$/ })).toBeDefined()

  // A turn starts, runs and ends: there is no frame to swap in, and no state has a clip to play.
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  await clock.advance(80 * 3)
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(blits).toEqual([])
  expect(ui.played).toEqual([])
  await band.unmount()

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect(await pane.find({ type: 'Image' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /^app \(refactor\/global-search\)$/ })).toBeDefined()
  await pane.unmount()
})

test('a frame listed but not readable is skipped, and the next one is drawn in its place', async ($, on) => {
  const ui = { ...paneWorld(), folders: { 'assets/idle': ['a.png', 'b.png'] }, unreadable: ['idle/a.png'] }

  // Orca's terminal is sent each frame's data, so each frame is read.
  working(on, ui, ORCA)
  await $.session.start(START)
  const band = await bandOf($)

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { png: token('idle/b.png') } } })
  await band.unmount()
})

test('with no frame readable the sprite and its margins leave the band', async ($, on) => {
  const ui = { ...paneWorld(), folders: { 'assets/idle': ['a.png', 'b.png'] }, unreadable: ['idle/a.png', 'idle/b.png'] }

  working(on, ui, ORCA)
  await $.session.start(START)
  const band = await bandOf($)
  const boxes = await band.findAll({ type: 'Box' })

  expect(await band.find({ type: 'Image' })).toBeUndefined()
  expect(boxes.filter(box => box.props.paddingLeft === 2 || box.props.gap === 2)).toHaveLength(0)
  await band.unmount()
})

test("a motion whose folder holds no frame borrows idle's, and each motion plays as many frames as its folder holds", async ($, on) => {
  const ui = { ...paneWorld(), folders: { 'assets/idle': ['b.png', 'a.png', 'notes.txt'] } }
  const { clock, blits } = playing(on, ui)

  await $.session.start(START)
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { file: expect.stringMatching(/\/assets\/idle\/a\.png$/) } } })
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  // Working has no frame of its own: idle's two play in its place, in name order, round and round.
  expect(blits.at(-1)).toBe('idle/a.png')
  await clock.advance(80)
  expect(blits.at(-1)).toBe('idle/b.png')
  await clock.advance(80)
  expect(blits.at(-1)).toBe('idle/a.png')
  await band.unmount()
})

test("the sprite and sound folders the settings name are read in place of the mod's own; a clip of the person's own is sent as its bytes", { options: { spriteDir: '/Users/me/buddy/sprites/', soundDir: '~/buddy/sounds' } }, async ($, on) => {
  const ui = {
    ...paneWorld(),
    folders: { '/Users/me/buddy/sprites/idle': ['r2.png', 'r1.png'], '/Users/me/buddy/sprites/working': ['f1.png'], '/Users/me/buddy/sounds/working': ['go.wav'], ...OWN_FRAMES },
  }
  const { blits } = playing(on, ui, { ...GHOSTTY, HOME: '/Users/me' })

  await $.session.start(START)
  const band = await bandOf($)

  expect(await band.find({ type: 'Image' })).toMatchObject({ props: { source: { file: '/Users/me/buddy/sprites/idle/r1.png', format: 'png' } } })
  await $.turn.start({ text: 'fix the bug', turnId: 'turn_1' })
  expect(blits.at(-1)).toBe('/Users/me/buddy/sprites/working/f1.png')
  // The idle folder holds no clip: the turn's end plays nothing.
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(ui.played).toEqual([`audio/wav:${token('/Users/me/buddy/sounds/working/go.wav')}`])
  await band.unmount()
})

const alerting = (on: On, ui: PaneWorld): { clock: MockClock; notices: { tool_use_id: string; text: string | undefined }[] } => {
  const clock = working(on, ui)
  const notices: { tool_use_id: string; text: string | undefined }[] = []

  on('ui.notice', ($, e) => {
    notices.push({ tool_use_id: e.tool_use_id, text: e.text })

    return { value: undefined }
  })
  for (const event of ['classic.PermissionRequest', 'classic.Notification', 'classic.UserPromptSubmit', 'classic.PostToolUse'] as const) on(event, () => ({}))
  on('ui.render', { component: 'ToolProgress' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.hint}</Text>
  })

  return { clock, notices }
}

const bandOf = async ($: Parameters<TestBody>[0], viewport?: typeof DOCKING) =>
  $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND, ...(viewport === undefined ? {} : { viewport }) })

test('an approval waiting on the person gets a line under the dialog and nothing else; the band keeps its rule, the dialog says the rest', async ($, on) => {
  const ui = paneWorld()
  let percent = 40

  ui.usage = () => ({ ...USAGE, context: { ...USAGE.context, percent } }) as unknown as SessionUsage
  const { clock, notices } = alerting(on, ui)
  const ids: string[] = []
  let release: (answer: { result: never; text: string }) => void = () => undefined

  on('tool.call', ($, e) => {
    ids.push(e.tool_use_id)

    return new Promise(resolve => (release = resolve))
  })
  await $.session.start(START)
  await $.turn.start({ text: 'run the tests', turnId: 'turn_1' })
  const call = $.tool.call({ tool: 'Bash', command: './mvnw test' } as never)

  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: './mvnw test' } })
  // Six seconds on, the engine's own notice: the line under the dialog goes again.
  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })

  // Under the dialog, what it does not say itself: since when the call has waited.
  expect(notices).toHaveLength(2)
  expect(notices[0]).toMatchObject({ tool_use_id: ids[0], text: expect.stringMatching(/^pane-mod · waiting since \d\d:\d\d$/) })

  const band = await bandOf($)

  expect(await band.find({ type: 'Text', text: /^━+$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /approval/ })).toBeUndefined()
  await band.unmount()

  // Approved, the long command shows its "run in background" hint: the approval is no longer awaited, so an alert
  // raised after it puts no line under a dialog.
  const hint = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'ToolProgress', props: { tool_use_id: ids[0] ?? '', kind: 'background_hint' as const, hint: '(ctrl+b to run in background)' } })

  await hint.unmount()
  percent = 85
  await clock.advance(2_000)
  expect(notices).toHaveLength(2)
  release({ result: {} as never, text: 'ok' })
  await call
})

test('while the pane holds the HUD, the band gives its place back even with an approval standing, which neither draws', async ($, on) => {
  const ui = paneWorld()

  alerting(on, ui)

  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>the engine's own band</Text>
  })
  await $.session.start(START)
  await (await bandOf($, DOCKING)).unmount()
  ui.panes = [SHOWN]
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } })

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const band = await bandOf($, DOCKING)

  expect(await band.find({ type: 'Text', text: /^the engine's own band$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /approval/ })).toBeUndefined()
  await band.unmount()
  await pane.unmount()
})

test('the context reaching 80% and then 90% is named once each under an approval dialog; a compaction lets the marks be named again', async ($, on) => {
  const ui = paneWorld()
  let percent = 70

  ui.usage = () => ({ ...USAGE, context: { ...USAGE.context, percent } }) as unknown as SessionUsage
  const { clock, notices } = alerting(on, ui)
  let release: (answer: { result: never; text: string }) => void = () => undefined
  const lines = (): (string | undefined)[] => notices.map(notice => notice.text)

  on('tool.call', () => new Promise(resolve => (release = resolve)))
  await $.session.start(START)
  await $.turn.start({ text: 'run the tests', turnId: 'turn_1' })
  const call = $.tool.call({ tool: 'Bash', command: './mvnw test' } as never)

  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: './mvnw test' } })
  expect(lines()).toEqual([expect.stringMatching(/^pane-mod · waiting since \d\d:\d\d$/)])

  // A mark reached while the dialog is up is named under it at once.
  percent = 85
  await clock.advance(2_000)
  expect(lines().at(-1)).toMatch(/ · ▲ context 85%$/)

  // Named once: 86% says nothing; 92% reaches the next mark.
  percent = 86
  await clock.advance(2_000)
  expect(lines()).toHaveLength(2)
  percent = 92
  await clock.advance(2_000)
  expect(lines().at(-1)).toMatch(/ · ▲ context 92%$/)

  percent = 30
  await clock.advance(2_000)
  percent = 81
  await clock.advance(2_000)
  expect(lines().at(-1)).toMatch(/ · ▲ context 81%$/)
  release({ result: {} as never, text: 'ok' })
  await call
})
test('by default the context, which seldom changes, is left out of the band and the pane; each section follows its setting', async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^context / })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^mode / })).toBeDefined()
  await band.unmount()

  const rows = await paneRows($)

  expect(rows.includes('context')).toBe(false)
  expect(rows.some(row => row.startsWith('ctx '))).toBe(true)
})

test('a section turned off leaves the band row and the pane rows it holds; with nothing left beside it, the first card holds the sprite alone', { options: { showSession: false, showUsage: false, showNow: false } }, async ($, on) => {
  const ui = paneWorld()

  world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)
  await $.session.start(START)

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^app\(/ })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^ctx / })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /^ Opus 5\.5  / })).toBeDefined()
  await band.unmount()

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const rows = (await pane.findAll({ type: 'Text', text: /\S/ })).map(row => row.text ?? '')
  const cards = (await pane.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round')

  // No name given, and the session and now sections off: the first card keeps the sprite alone, then the model's.
  expect(cards.map(box => box.props.borderColor)).toEqual([ACCENT, 'claude'])
  expect(JSON.stringify(cards[0])).toContain('"type":"Image"')
  expect(rows.some(row => row.startsWith('app'))).toBe(false)
  expect(rows.some(row => /^(ctx|5h|7d) /.test(row) || /WORKING|idle/.test(row))).toBe(false)
  expect(rows).toContain('Opus 5.5')
  await pane.unmount()
})

test("the pane lists Claude's tasks as the task tools and TodoWrite leave them: under way first, then waiting, then done", async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  on('tool.call', () => ({ result: {} as never, text: 'ok' }))
  for (const event of ['classic.TaskCreated', 'classic.TaskCompleted'] as const) on(event, () => ({}))
  await $.session.start(START)
  await $.turn.start({ text: 'plan it', turnId: 'turn_1' })
  await $.classic.TaskCreated({ task_id: '1', task_subject: 'Write the parser' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write the parser', description: 'd', activeForm: 'Writing the parser' } as never)
  await $.classic.TaskCreated({ task_id: '2', task_subject: 'Add the tests' })
  await $.classic.TaskCreated({ task_id: '3', task_subject: 'Update the README' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' } as never)
  await $.classic.TaskCompleted({ task_id: '3', task_subject: 'Update the README' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  const rows = await paneRows($)
  // The tasks card: its title, how many of how many are done, then the tasks.
  const at = rows.indexOf('1/3')

  expect(rows[at - 1]).toBe('tasks')

  expect(at).toBeGreaterThan(-1)
  expect(rows.slice(at + 1, at + 4)).toEqual(['▶ Writing the parser', '○ Add the tests', '✓ Update the README'])
  // Kept with the session's log, so a session taken up again finds them.
  expect(savedOf(ui, 'sess-A')).toMatchObject({ tasks: [{ id: '1', status: 'in_progress' }, { id: '2' }, { id: '3', status: 'completed' }] })

  // A TodoWrite list replaces them all.
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'One', status: 'completed', activeForm: 'Doing one' }, { content: 'Two', status: 'in_progress', activeForm: 'Doing two' }] } as never)
  const after = await paneRows($)

  expect(after[after.indexOf('1/2') - 1]).toBe('tasks')
  expect(after).toEqual(expect.arrayContaining(['▶ Doing two', '✓ One']))
})

test("the totals add every turn's usage, a subagent's too, with the cache's share and the session's cost alone; the model section leaves the cost to them", async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer', usage: { input_tokens: 1_000, output_tokens: 20_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 9_000, model: 'claude-opus-5-5' } })
  await $.turn.complete({ ...TURN, turnId: 'sub_1', agentId: 'agent_1', reason: 'answer', usage: { input_tokens: 0, output_tokens: 5_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } } as never)

  const rows = await paneRows($)

  expect(rows).toEqual(expect.arrayContaining(['$1.50', '100k in · 25k out · cache 90%']))
  // No cost per hour: it falls while the session sits idle.
  expect(rows.some(row => row.endsWith('/h'))).toBe(false)
  // While the totals show, the model's row leaves the cost to them.
  expect(rows).toContain('Opus 5.5')
  expect(rows.some(row => row.startsWith('Opus 5.5 · $'))).toBe(false)
})

test('turned off, no line goes under an approval dialog', { options: { alerts: false } }, async ($, on) => {
  const ui = paneWorld()
  const { notices } = alerting(on, ui)
  let release: (answer: { result: never; text: string }) => void = () => undefined

  on('tool.call', () => new Promise(resolve => (release = resolve)))
  await $.session.start(START)
  await $.turn.start({ text: 'run the tests', turnId: 'turn_1' })
  const call = $.tool.call({ tool: 'Bash', command: './mvnw test' } as never)

  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: './mvnw test' } })
  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
  const band = await bandOf($)

  expect(notices).toEqual([])
  expect(await band.find({ type: 'Text', text: /^━+$/ })).toBeDefined()
  await band.unmount()
  release({ result: {} as never, text: 'ok' })
  await call
})
test('the pane heads its first section with the name the session was given, in the color /color set it; the color is kept for the session', async ($, on) => {
  const ui = paneWorld()
  const clock = working(on, ui)
  const pane = async () => $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const first = async (): Promise<string | undefined> => (await paneRows($))[0]

  on('session.append', ($, e, next) => next(e))
  on('classic.SessionStart', () => ({}))
  await $.session.start(START)
  // No name given: the first card begins with where the session is.
  expect(await first()).toBe('app (refactor/global-search)')

  // Taken up again with a name: the settings hooks' input says it.
  await $.classic.SessionStart({ source: 'resume', session_title: 'plugin-test' })
  await clock.advance(2_000)
  expect(await first()).toBe('plugin-test')

  await $.session.append(commandRow('Session color set to: blue'))
  const blue = await pane()

  expect(await blue.find({ type: 'Text', text: /^plugin-test$/ })).toMatchObject({ props: { bold: true, color: 'blue_FOR_SUBAGENTS_ONLY' } })
  // The first card's border takes the color too.
  expect((await blue.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')?.props.borderColor).toBe('blue_FOR_SUBAGENTS_ONLY')
  await blue.unmount()
  expect(savedOf(ui, 'sess-A')).toMatchObject({ color: 'blue' })

  // A name another live session holds is given with a suffix: the row names the one taken.
  await $.session.append(commandRow('Session renamed to: pane-ui-2 ("pane-ui" is held by another live session on this machine)'))
  expect(await first()).toBe('pane-ui-2')

  await $.session.append(commandRow('Session color reset to default'))
  const reset = await pane()

  expect((await reset.find({ type: 'Text', text: /^pane-ui-2$/ }))?.props).not.toHaveProperty('color')
  await reset.unmount()
  expect(savedOf(ui, 'sess-A')).toMatchObject({ color: null })
})

test('a session taken up again finds the color it was given, which no hook says', async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: [], color: 'pink' })
  working(on, ui)
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect((await pane.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')?.props.borderColor).toBe('pink_FOR_SUBAGENTS_ONLY')
  await pane.unmount()
})

test('while a turn runs the pane says what the main thread is doing now, and the band names the tool', async ($, on) => {
  const ui = paneWorld()
  const clock = working(on, ui)
  let release: (answer: { result: never; text: string }) => void = () => undefined

  on('tool.call', () => new Promise(resolve => (release = resolve)))
  await $.session.start(START)
  await $.turn.start({ text: 'run the tests', turnId: 'turn_1' })
  // The first card's rows, from its top: as many while a tool runs as before, the tool's row kept in place.
  const firstRows = async (): Promise<number> => {
    const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
    const card = (await pane.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')
    const count = ((await pane.find({ key: 'card-session-top' }))?.children ?? []).length

    expect(card?.props.alignItems).toBe('flex-start')
    await pane.unmount()

    return count
  }
  const before = await firstRows()

  // Where the session is, its mode and turns, the status, and the tool's row kept blank.
  expect(before).toBe(4)
  const call = $.tool.call({ tool: 'Bash', command: './mvnw -q test\necho done' } as never)

  await clock.advance(4_000)
  const rows = await paneRows($)

  expect(rows).toEqual(expect.arrayContaining([' ● WORKING  4s', '▶ Bash ./mvnw -q test · 4s']))
  expect(await firstRows()).toBe(before)
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  // The turn under way stands on a yellow badge.
  expect(await pane.find({ type: 'Text', text: /^ ● WORKING $/ })).toMatchObject({ props: { bold: true, backgroundColor: ACCENT } })
  await pane.unmount()

  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })

  expect(await band.find({ type: 'Text', text: /^mode .* ● WORKING  4s  ▶ Bash \.\/mvnw -q test/ })).toBeDefined()
  await band.unmount()
  release({ result: {} as never, text: 'ok' })
  await call
  await clock.advance(2_000)
  expect((await paneRows($)).some(row => row.startsWith('▶ '))).toBe(false)
  expect(await firstRows()).toBe(before)
})

test('the pane tells when the 5h window will fill at the present pace, only where that comes before it resets', async ($, on) => {
  const ui = paneWorld()
  let percent = 40
  let resetsIn = 125

  ui.usage = () =>
    ({
      ...USAGE,
      rateLimits: [{ kind: 'five_hour', percentUsed: percent, resetsAt: new Date(NOW + resetsIn * 60_000).toISOString() }],
    }) as unknown as SessionUsage
  const clock = world(on, '/w/app', REPO, ['/w/app/.git'], () => [], GHOSTTY, [], SAVED, ui)

  await $.session.start(START)
  percent = 50
  await clock.advance(10 * 60_000)

  // Ten points in ten minutes: fifty points left, fifty minutes, before the reset at 125.
  expect(await paneRows($)).toContain('    ≈ 50m to the 5h limit')

  resetsIn = 30
  await clock.advance(2_000)
  expect((await paneRows($)).some(row => row.includes('to the 5h limit'))).toBe(false)

  // However the 5h moves within the hour, the pane draws no trend of it, only the gauge.
  percent = 60
  await clock.advance(12 * 60_000)
  expect((await paneRows($)).some(row => /[▁▂▃▄▅▆▇█]/.test(row))).toBe(false)
})

/** A finished turn as the log keeps it, `minutesAgo` before NOW. */
const kept = (text: string, minutesAgo: number): Record<string, unknown> => ({
  endedAt: NOW - minutesAgo * 60_000,
  seconds: 30,
  outcome: 'answer',
  text,
  edits: 1,
  runs: 0,
  reads: 0,
  agents: 0,
  out: 1_000,
  cacheHit: 50,
})

test("each session keeps its own log in a file of the plugin's data folder, named by the session's id", async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  on('tool.call', () => ({ result: {} as never, text: 'ok' }))
  await $.session.start(START)
  await $.turn.start({ text: 'first task', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, durationMs: 5_000, reason: 'answer' })

  expect(savedOf(ui, 'sess-A')).toMatchObject({ savedAt: NOW, sealed: 0, entries: [{ text: 'first task', seconds: 5, outcome: 'answer' }] })
  expect(keptNames(ui)).toEqual(['sess-A.json'])
  // Nothing to let go of: no command runs.
  expect(ui.ran).toEqual([])
})

test('a session taken up again (-c, --resume) finds its own log; another session sees none of it', async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: [kept('from before', 5)] })
  keep(ui, 'sess-B', { savedAt: NOW, entries: [kept('another session', 5)] })
  working(on, ui)
  await $.session.start(START)

  const rows = await paneRows($)

  expect(rows.some(row => row.includes('from before'))).toBe(true)
  expect(rows.some(row => row.includes('another session'))).toBe(false)
})

test('the files of sessions past the newest thirty, or last saved over two weeks ago, and of one emptied, are removed when one is saved', async ($, on) => {
  const ui = paneWorld()

  for (let index = 0; index < 31; index += 1) keep(ui, `old-${index}`, { entries: [] }, NOW - (index + 1) * 60_000)
  keep(ui, 'old-30.1', { entries: [] }, 0)
  keep(ui, 'stale', { entries: [] }, NOW - 15 * 86_400_000)
  ui.files[`${SESSIONS}/gone.json`] = { text: '', mtimeMs: NOW }
  ui.files[`${SESSIONS}/notes.txt`] = { text: 'mine', mtimeMs: 0 }
  working(on, ui)
  await $.session.start(START)
  await $.turn.start({ text: 'task', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  const removed = ['gone.json', 'old-29.json', 'old-30.1.json', 'old-30.json', 'stale.json']

  expect(ui.ran.map(argv => argv.slice(0, 3))).toEqual([['/bin/rm', '-f', '--']])
  expect(ui.ran[0]?.slice(3).sort()).toEqual(removed.map(name => `${SESSIONS}/${name}`))
  // Thirty sessions stay, this one with them; a file no log is kept in stays as it is.
  expect(keptNames(ui).filter(name => name.endsWith('.json'))).toHaveLength(30)
  expect(keptNames(ui)).toContain('notes.txt')
  expect(textsOf(ui, 'sess-A')).toEqual(['task'])
})

test('where no command can run (as in the desktop app), the files let go of are emptied instead, and one emptied already is not written again', async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'stale', { entries: [kept('long ago', 5)] }, NOW - 15 * 86_400_000)
  ui.noProcess = true
  const clock = working(on, ui)

  await $.session.start(START)
  await $.turn.start({ text: 'task 1', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(ui.files[`${SESSIONS}/stale.json`]).toEqual({ text: '', mtimeMs: NOW })
  expect(textsOf(ui, 'sess-A')).toEqual(['task 1'])

  await clock.advance(60_000)
  await $.turn.start({ text: 'task 2', turnId: 'turn_2' })
  await $.turn.complete({ ...TURN, turnId: 'turn_2', reason: 'answer' })
  // Tried again, and left as it is.
  expect(ui.ran.filter(argv => argv[0] === '/bin/rm')).toHaveLength(2)
  expect(ui.files[`${SESSIONS}/stale.json`]).toEqual({ text: '', mtimeMs: NOW })
  expect(textsOf(ui, 'sess-A')).toEqual(['task 1', 'task 2'])
})

test('with every limit at 0 nothing is let go of: past 200 lines the oldest are sealed in a file of their own, which a save does not write again, and all are read back', { options: { logTurns: 0, logSessions: 0, logDays: 0 } }, async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: Array.from({ length: 200 }, (_, index) => kept(`task ${index + 1}`, 300 - index)) })
  for (let index = 0; index < 31; index += 1) keep(ui, `old-${index}`, { entries: [] }, NOW - (index + 1) * 60_000)
  keep(ui, 'stale', { entries: [] }, NOW - 100 * 86_400_000)
  const clock = working(on, ui)

  await $.session.start(START)
  await $.turn.start({ text: 'task 201', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(textsOf(ui, 'sess-A.1')).toEqual(Array.from({ length: 200 }, (_, index) => `task ${index + 1}`))
  expect(savedOf(ui, 'sess-A')).toMatchObject({ sealed: 1 })
  expect(textsOf(ui, 'sess-A')).toEqual(['task 201'])
  expect(ui.ran).toEqual([])
  expect(keptNames(ui)).toHaveLength(34)

  const sealedAt = ui.files[`${SESSIONS}/sess-A.1.json`]?.mtimeMs

  await clock.advance(60_000)
  await $.turn.start({ text: 'task 202', turnId: 'turn_2' })
  await $.turn.complete({ ...TURN, turnId: 'turn_2', reason: 'answer' })
  expect(ui.files[`${SESSIONS}/sess-A.1.json`]?.mtimeMs).toBe(sealedAt)
  expect(textsOf(ui, 'sess-A')).toEqual(['task 201', 'task 202'])

  // Another session in view, then this one again: its log is read back from its files, every line.
  ui.sessionId = 'sess-B'
  await clock.advance(2_000)
  ui.sessionId = 'sess-A'
  await clock.advance(2_000)
  expect(await paneRows($)).toContain('1–5 of 202')
})

test('a log sealed while every turn was kept, read with a limit, keeps its newest lines in one file and lets go of the sealed ones', async ($, on) => {
  const ui = paneWorld()
  const lines = (name: string, count: number): Record<string, unknown>[] => Array.from({ length: count }, (_, index) => kept(`${name} ${index + 1}`, 1))

  keep(ui, 'sess-A.1', { entries: lines('first', 200) })
  keep(ui, 'sess-A.2', { entries: lines('second', 200) })
  keep(ui, 'sess-A', { savedAt: NOW, sealed: 2, entries: lines('newest', 3) })
  working(on, ui)
  await $.session.start(START)

  expect(await paneRows($)).toContain('1–5 of 50')
  await $.turn.start({ text: 'task', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(savedOf(ui, 'sess-A')).toMatchObject({ sealed: 0 })
  expect(textsOf(ui, 'sess-A')).toEqual([...Array.from({ length: 46 }, (_, index) => `second ${index + 155}`), 'newest 1', 'newest 2', 'newest 3', 'task'])
  expect(ui.ran[0]?.slice(3).sort()).toEqual([`${SESSIONS}/sess-A.1.json`, `${SESSIONS}/sess-A.2.json`])
  expect(keptNames(ui)).toEqual(['sess-A.json'])
})

test("the pane's log shows the newest five lines; a page older or newer moves by five, kept within the lines there are", async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: Array.from({ length: 23 }, (_, index) => kept(`task ${index + 1}`, 23 - index)) })
  working(on, ui)
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const lines = async (): Promise<string[]> => (await pane.findAll({ type: 'Text', text: /✓ .* task \d+/ })).map(row => /task \d+/.exec(row.text ?? '')?.[0] ?? '')

  expect(await pane.find({ type: 'Text', text: '1–5 of 23' })).toBeDefined()
  expect(await lines()).toEqual(['task 23', 'task 22', 'task 21', 'task 20', 'task 19'])
  expect(await pane.find({ key: 'log-newer' })).toBeUndefined()

  // 0, 5, 10, 15, then 18: the last five, no further.
  for (let page = 0; page < 4; page += 1) await pane.press({ key: 'log-older' })
  expect(await pane.find({ type: 'Text', text: '19–23 of 23' })).toBeDefined()
  expect(await lines()).toEqual(['task 5', 'task 4', 'task 3', 'task 2', 'task 1'])
  expect(await pane.find({ key: 'log-older' })).toBeUndefined()

  await pane.press({ key: 'log-newer' })
  expect((await lines())[0]).toBe('task 10')
  await pane.unmount()
})

test("the log's search field shows the lines that have every word typed, newest first; the key x shows them all again", async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', {
    savedAt: NOW,
    entries: [
      { ...kept('Fix the login form', 9), files: ['Login.tsx'] },
      kept('Write the parser', 8),
      kept('task a', 7),
      kept('task b', 6),
      kept('task c', 5),
      { ...kept('Run the tests', 4), commands: ['npm test -- Login'] },
    ],
  })
  working(on, ui)
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const lines = async (): Promise<string[]> => (await pane.findAll({ type: 'Text', text: /✓ / })).map(row => /✓ +\S+ +(.*?)( · |$)/.exec(row.text ?? '')?.[1] ?? '')

  // More lines than a page: the field shows, and the key s goes to it.
  expect(await pane.find({ key: 'log-find' })).toBeDefined()
  expect(await pane.find({ key: 'log-find-focus' })).toBeDefined()

  // As it is typed, in any case: what was asked, the files edited and the commands run are searched.
  await $.ui.input({ plugin: 'pane-mod', key: 'log-find', text: 'LOGIN', kind: 'change' })
  expect(await pane.find({ type: 'Text', text: '1–2 of 2 found' })).toBeDefined()
  expect(await lines()).toEqual(['Run the tests', 'Fix the login form'])
  expect(await pane.find({ key: 'log-clear' })).toBeDefined()

  // Every word must be there.
  await $.ui.input({ plugin: 'pane-mod', key: 'log-find', text: 'login parser' })
  expect(await pane.find({ type: 'Text', text: 'none found' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'no line has "login parser" (6 kept)' })).toBeDefined()

  await pane.press({ key: 'log-clear' })
  expect(await pane.find({ type: 'Text', text: '1–5 of 6' })).toBeDefined()
  expect(await pane.find({ key: 'log-clear' })).toBeUndefined()
  await pane.unmount()
})

test('a log of one page or less draws no search field', async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', { savedAt: NOW, entries: [kept('task a', 2), kept('task b', 1)] })
  working(on, ui)
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect(await pane.find({ key: 'log-find' })).toBeUndefined()
  expect(await pane.find({ key: 'log-find-focus' })).toBeUndefined()
  await pane.unmount()
})

/** The keys of the pane's cards, top to bottom. */
const cardKeys = async (pane: { findAll: (query: { type: 'Box' }) => Promise<{ key: string | undefined; props: Record<string, unknown> }[]> }): Promise<(string | undefined)[]> =>
  (await pane.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round').map(box => box.key)

/** A session kept with 23 finished turns and one task, so that the tasks card and the log card both draw. */
const keptWithTask = (): Record<string, unknown> => ({
  savedAt: NOW,
  entries: Array.from({ length: 23 }, (_, index) => kept(`task ${index + 1}`, 23 - index)),
  tasks: [{ id: '1', subject: 'Write the parser', status: 'pending', activeForm: null }],
})

/** A wheel tick of the person's over row `row` of a pane whose whole tree (40 rows) shows. */
const wheel = (row: number, by: number) =>
  ({ component: 'Pane', requestId: 'pane-mod', offset: by, by, bodyRows: 50, contentRows: 40, origin: { kind: 'person' }, pointer: { column: 5, row } }) as const

test('by default the wheel over the log, the pane\'s last card, pages the log and leaves the pane where it is', { options: { showContext: true } }, async ($, on) => {
  const ui = paneWorld()
  const scrolled: number[] = []

  keep(ui, 'sess-A', keptWithTask())
  working(on, ui)
  // The engine beneath: the pane's window moves to the offset the chain leaves it.
  on('ui.scroll', ($, e) => {
    scrolled.push(e.offset)

    return {}
  })
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect(await cardKeys(pane)).toEqual(['card-session', 'card-model', 'card-tasks', 'card-context', 'card-log'])
  // The log's ten rows (its search field among them) are the tree's last: a tick over them moves the log a line, the pane not at all.
  expect(await $.ui.scroll(wheel(35, 1))).toEqual({})
  expect(await pane.find({ type: 'Text', text: '2–6 of 23' })).toBeDefined()
  expect(scrolled).toEqual([])
  // A tick above them scrolls the pane.
  await $.ui.scroll(wheel(10, 1))
  expect(scrolled).toEqual([1])
  await pane.unmount()
})

test('ordered anywhere but last, the log is paged by its buttons alone; the wheel over it scrolls the pane', { options: { paneOrder: 'LOG, context bogus log', showContext: true } }, async ($, on) => {
  const ui = paneWorld()
  const scrolled: number[] = []

  keep(ui, 'sess-A', keptWithTask())
  working(on, ui)
  on('ui.scroll', ($, e) => {
    scrolled.push(e.offset)

    return {}
  })
  await $.session.start(START)

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  // The first two cards stay on top; the named ones follow in the order given, a repeat and an unknown name dropped,
  // and the cards not named after them in their own order (the subagents' draws nothing with none running).
  expect(await cardKeys(pane)).toEqual(['card-session', 'card-model', 'card-log', 'card-context', 'card-tasks'])
  await $.ui.scroll(wheel(35, 1))
  expect(scrolled).toEqual([1])
  expect(await pane.find({ type: 'Text', text: '1–5 of 23' })).toBeDefined()
  await pane.press({ key: 'log-older' })
  expect(await pane.find({ type: 'Text', text: '6–10 of 23' })).toBeDefined()
  await pane.unmount()
})

test('a color the settings fix holds the first card whatever /color says; the other cards take theirs, an invalid one its default', { options: { sessionColor: 'Success', modelColor: '#FF00aa', cardColor: 'not-a-color' } }, async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'sess-A', keptWithTask())
  working(on, ui)
  on('session.append', ($, e, next) => next(e))
  on('classic.SessionStart', () => ({}))
  await $.session.start(START)
  await $.classic.SessionStart({ source: 'resume', session_title: 'plugin-test' })
  await $.session.append(commandRow('Session color set to: blue'))

  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
  const cards = (await pane.findAll({ type: 'Box' })).filter(box => box.props.borderStyle === 'round')

  expect(cards.map(box => box.props.borderColor)).toEqual(['success', '#ff00aa', 'subtle', 'subtle'])
  expect(cards[0]?.props.borderDimColor).toBe(false)
  expect(await pane.find({ type: 'Text', text: /^plugin-test$/ })).toMatchObject({ props: { color: 'success' } })
  // Kept with the log all the same, for a time the setting is auto again.
  expect(savedOf(ui, 'sess-A')).toMatchObject({ color: 'blue' })
  await pane.unmount()
})

test('an invalid first card color counts as auto: a dim yellow, then the color /color sets', { options: { sessionColor: 'blue-ish' } }, async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  on('session.append', ($, e, next) => next(e))
  await $.session.start(START)
  const first = async (): Promise<Record<string, unknown> | undefined> => {
    const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
    const card = (await pane.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')

    await pane.unmount()

    return card?.props
  }

  expect(await first()).toMatchObject({ borderColor: ACCENT, borderDimColor: true })
  await $.session.append(commandRow('Session color set to: blue'))
  expect(await first()).toMatchObject({ borderColor: 'blue_FOR_SUBAGENTS_ONLY', borderDimColor: false })
})

test('every gauge draws its steps with the characters the settings give, an invalid one left at its default', { options: { barFilled: '#', barEmpty: '🙂' } }, async ($, on) => {
  const ui = paneWorld()

  working(on, ui)
  await $.session.start(START)

  const rows = await paneRows($)

  expect(rows).toEqual(expect.arrayContaining(['####▱ xhigh', 'ctx ####▱▱▱▱▱▱ 42%  84k/200k', '5h  #######▱▱▱ 70%  ↻ 2h05m']))
  const band = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(await band.find({ type: 'Text', text: /^ctx ####▱▱▱▱▱▱ 42% · 5h #######▱▱▱ 70% / })).toBeDefined()
  await band.unmount()
})

/** The engine beneath the mod for a turn's detail: calls answered, subagents spawned by their task's first word, and the classic events the log notes. */
const noting = (on: On, ui: PaneWorld): MockClock => {
  const clock = working(on, ui)

  on('tool.call', () => ({ result: {} as never, text: 'ok' }))
  on('agent.spawn', ($, e) => ({ model: 'claude-haiku-4-5', agentId: `agent-${e.description.split(' ')[0]}` }))
  for (const event of ['classic.PermissionRequest', 'classic.PostToolUseFailure', 'classic.PermissionDenied'] as const) on(event, () => ({}))

  return clock
}

/** What the engine fills in of a subagent the main loop spawns. */
const SPAWN = { provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: false, fork: false } as const

/** The newest kept line of session A, as its file holds it. */
const savedLine = (ui: PaneWorld): Record<string, unknown> | undefined => (savedOf(ui, 'sess-A')?.entries as Record<string, unknown>[] | undefined)?.at(-1)

test("a turn's line also keeps its calls by tool, the skills and MCP tools used, the subagents spawned, the calls that failed, and the approvals asked and the calls denied", { options: { alerts: false } }, async ($, on) => {
  const ui = paneWorld()
  const clock = noting(on, ui)

  await $.session.start(START)
  await $.turn.start({ text: 'Ship the release', turnId: 'turn_1' })
  for (const call of [
    { tool: 'Read', file_path: '/w/app/a.ts' },
    { tool: 'Read', file_path: '/w/app/b.ts' },
    { tool: 'Edit', file_path: '/w/app/a.ts', old_string: 'a', new_string: 'b' },
    { tool: 'Skill', skill: 'review' },
    { tool: 'Skill', skill: 'review', args: 'again' },
    { tool: 'mcp__slack__send_message', channel: 'release', text: 'shipped' },
    { tool: 'Bash', command: 'make test' },
  ]) {
    await $.tool.call(call as never)
  }
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_a', prompt: 'Scan the repository', description: 'scan', subagentType: 'Explore' })
  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_b', prompt: 'Watch the CI run', description: 'background job', subagentType: 'general-purpose', background: true })
  await clock.advance(42_000)
  await $.turn.complete({ ...TURN, turnId: 'sub_1', agentId: 'agent-scan', reason: 'answer' })
  await $.classic.PostToolUseFailure({ tool_name: 'Bash', tool_input: { command: 'make test' }, tool_use_id: 'toolu_1', error: '<tool_use_error>Exit code 2\nmake: *** [test] Error 1</tool_use_error>' })
  await $.classic.PostToolUseFailure({ tool_name: 'Read', tool_input: { file_path: '/w/app/c.ts' }, tool_use_id: 'toolu_2', error: 'File does not exist.', agent_id: 'agent-scan' })
  // A call the person interrupted did not fail.
  await $.classic.PostToolUseFailure({ tool_name: 'Bash', tool_input: { command: 'sleep 60' }, tool_use_id: 'toolu_3', error: 'Interrupted by user', is_interrupt: true })
  // Noted whether the alerts are on or off.
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'git push origin main' } })
  await $.classic.PermissionDenied({ tool_name: 'Write', tool_input: { file_path: '/w/app/.env', content: 'x' }, tool_use_id: 'toolu_4', reason: 'denied by the auto mode classifier' })
  await $.turn.complete({ ...TURN, durationMs: 42_000, reason: 'answer' })

  expect(savedLine(ui)).toMatchObject({
    tools: { Read: 2, Edit: 1, Skill: 2, mcp__slack__send_message: 1, Bash: 1 },
    skills: ['review'],
    mcp: ['slack:send_message'],
    subagents: [
      { type: 'Explore', description: 'scan', outcome: 'answer', seconds: 42 },
      { type: 'general-purpose', description: 'background job', outcome: 'running', seconds: 42 },
    ],
    errors: [
      { tool: 'Bash', isSubagent: false, text: 'Exit code 2' },
      { tool: 'Read', isSubagent: true, text: 'File does not exist.' },
    ],
    approvals: [{ tool: 'Bash', target: 'git push origin main' }],
    denials: [{ tool: 'Write', target: '.env' }],
  })

  // The line's one row adds the failed and denied calls to its counts; its detail lists every part, each wrapped.
  const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })

  expect(await pane.find({ type: 'Text', text: /Ship the release · edit 1 · bash 1 · read 2 · err 2 · denied 1$/ })).toBeDefined()
  await pane.press({ key: 'log-1-open' })
  for (const row of [
    'tools     Read 2 · Skill 2 · Bash 1 · Edit 1 ·',
    '          slack:send_message 1',
    'skills    review',
    'mcp       slack:send_message',
    'subagents Explore · scan · done · 42s',
    '          general-purpose · background job ·',
    '          running · 42s',
    'errors    Bash: Exit code 2',
    '          Read (subagent): File does not exist.',
    'asked     Bash git push origin main',
    'denied    Write .env',
    'done      edit 1 · bash 1 · read 2 · err 2 ·',
    '          denied 1',
  ]) {
    expect(await pane.find({ type: 'Text', text: row })).toBeDefined()
  }
  await pane.unmount()

  // The subagent still running when its turn ended is written into that turn's line once it ends.
  await clock.advance(10_000)
  await $.turn.complete({ ...TURN, turnId: 'sub_2', agentId: 'agent-background', reason: 'error' })
  expect(savedLine(ui)).toMatchObject({ subagents: [{ outcome: 'answer' }, { type: 'general-purpose', outcome: 'error', seconds: 52 }] })
})

test('the recent card lists the skills and MCP tools the session used lately, the most recent first, just above the log', async ($, on) => {
  const ui = paneWorld()
  const clock = noting(on, ui)
  const recentCard = async () => {
    const pane = await $.ui.mount({ plugin: 'pane-mod', surface: 'terminal', component: 'Pane', requestId: 'pane-mod', props: PANE_PROPS, viewport: DOCKING })
    const card = await pane.find({ key: 'card-recent' })

    await pane.unmount()

    return card
  }

  await $.session.start(START)
  await $.turn.start({ text: 'plain work', turnId: 'turn_0' })
  await $.tool.call({ tool: 'Read', file_path: '/w/app/a.ts' } as never)
  await $.turn.complete({ ...TURN, turnId: 'turn_0', reason: 'answer' })
  // Nothing to list: no card.
  expect(await recentCard()).toBeUndefined()

  await $.turn.start({ text: 'first', turnId: 'turn_1' })
  await $.tool.call({ tool: 'Skill', skill: 'review' } as never)
  await $.tool.call({ tool: 'mcp__slack__send_message', text: 'hi' } as never)
  await $.turn.complete({ ...TURN, reason: 'answer' })
  await $.turn.start({ text: 'second', turnId: 'turn_2' })
  await $.tool.call({ tool: 'Skill', skill: 'simplify' } as never)
  await $.tool.call({ tool: 'mcp__linear__create_issue', title: 'x' } as never)
  await $.turn.complete({ ...TURN, turnId: 'turn_2', reason: 'answer' })
  // The turn under way counts too: a skill used again is the most recent.
  await $.turn.start({ text: 'third', turnId: 'turn_3' })
  await $.tool.call({ tool: 'Skill', skill: 'review' } as never)
  await clock.advance(2_000)

  const rows = await paneRows($)

  expect(await recentCard()).toBeDefined()
  expect(rows).toContain('skills review · simplify')
  expect(rows).toContain('mcp linear:create_issue · slack:send_message')
  expect(rows.indexOf('recent')).toBeLessThan(rows.indexOf('log'))
})

test('turned off, the recent card is left out', { options: { showRecent: false } }, async ($, on) => {
  const ui = paneWorld()

  noting(on, ui)
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 'turn_1' })
  await $.tool.call({ tool: 'Skill', skill: 'review' } as never)
  await $.turn.complete({ ...TURN, reason: 'answer' })

  const rows = await paneRows($)

  expect(rows).toContain('log')
  expect(rows).not.toContain('recent')
})

test('the logTurns and logSessions settings say how many turns a session keeps and how many sessions keep theirs', { options: { logTurns: 5, logSessions: 2 } }, async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'old-1', { entries: [] }, NOW - 3 * 60_000)
  keep(ui, 'old-2', { entries: [] }, NOW - 2 * 60_000)
  keep(ui, 'sess-A', { savedAt: NOW, entries: Array.from({ length: 7 }, (_, index) => kept(`task ${index + 1}`, 10 - index)) }, NOW - 60_000)
  working(on, ui)
  await $.session.start(START)

  // Read back, the newest five lines stay.
  expect(await paneRows($)).toContain('1–5 of 5')
  await $.turn.start({ text: 'task 8', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(textsOf(ui, 'sess-A')).toEqual(['task 4', 'task 5', 'task 6', 'task 7', 'task 8'])
  expect(keptNames(ui)).toEqual(['old-2.json', 'sess-A.json'])
})

test('a session that ends while a turn runs keeps the turn as a stopped line timed to the end, and lets go of nothing as it ends', async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'stale', { entries: [] }, NOW - 15 * 86_400_000)
  const clock = working(on, ui)

  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  await $.session.start(START)
  await $.turn.start({ text: 'long task', turnId: 'turn_1' })
  await clock.advance(10_000)
  await $.session.end({ reason: 'other', sessionId: 'sess-A', resume: { id: 'sess-A' } })

  expect(savedOf(ui, 'sess-A')).toMatchObject({ entries: [{ text: 'long task', outcome: 'aborted', seconds: 10 }] })
  // The exit stays quick: the next save lets go of what is past the limits.
  expect(keptNames(ui)).toEqual(['sess-A.json', 'stale.json'])
  expect(ui.ran).toEqual([])

  // An end that comes after all is not kept twice.
  await $.turn.complete({ ...TURN, reason: 'aborted' })
  expect(textsOf(ui, 'sess-A')).toEqual(['long task'])
})

test('the logDays setting says how many days a log is kept after its last save', { options: { logDays: 1 } }, async ($, on) => {
  const ui = paneWorld()

  keep(ui, 'yesterday', { entries: [] }, NOW - 23 * 3_600_000)
  keep(ui, 'two-days', { entries: [] }, NOW - 2 * 86_400_000)
  working(on, ui)
  await $.session.start(START)
  await $.turn.start({ text: 'task', turnId: 'turn_1' })
  await $.turn.complete({ ...TURN, reason: 'answer' })

  expect(keptNames(ui)).toEqual(['sess-A.json', 'yesterday.json'])
})

test('a line kept before its tools, skills, MCP tools, subagents, errors, approvals and denials were reads back with none; a kept part malformed or too long is left out or cut', () => {
  expect(logFrom({ entries: [kept('old', 1)] }, 50)[0]).toEqual({ ...kept('old', 1), files: [], commands: [], tools: {}, skills: [], mcp: [], subagents: [], errors: [], approvals: [], denials: [] })

  const [read] = logFrom(
    {
      entries: [
        {
          ...kept('new', 1),
          junk: 'x',
          tools: { Read: 2, Bash: 'many' },
          skills: ['review', 7, 'x'.repeat(100)],
          subagents: [
            { type: 'Explore', description: 'scan', outcome: 'lost', seconds: 3 },
            { type: 'Plan', description: 'plan it', outcome: 'running', seconds: 5 },
          ],
          errors: 'none',
          approvals: [{ tool: 'Bash', target: null }, { tool: 'Edit' }],
          denials: Array.from({ length: 9 }, () => ({ tool: 'Write', target: 'a.env' })),
        },
      ],
    },
    50,
  )

  expect('junk' in (read ?? {})).toBe(false)
  expect(read).toMatchObject({ tools: { Read: 2 }, subagents: [{ type: 'Plan', outcome: 'running', seconds: 5 }], errors: [], approvals: [{ tool: 'Bash', target: null }] })
  expect(read?.skills).toEqual(['review', `${'x'.repeat(LOG_CAPS.name - 1)}…`])
  expect(read?.denials).toHaveLength(LOG_CAPS.calls)
})

test("the log's Markdown file lists what each turn did: its calls by tool, skills, MCP tools, subagents, failed calls, approvals and denials", () => {
  const [entry] = logFrom(
    {
      entries: [
        {
          ...kept('Ship it', 1),
          tools: { Read: 2, Skill: 1 },
          skills: ['review'],
          mcp: ['slack:send_message'],
          subagents: [{ type: 'Explore', description: 'scan', outcome: 'answer', seconds: 42 }],
          errors: [{ tool: 'Bash', isSubagent: true, text: 'Exit `2`' }],
          approvals: [{ tool: 'Bash', target: 'git push' }],
          denials: [{ tool: 'Write', target: '.env' }],
        },
      ],
    },
    50,
  )
  const text = logMarkdown(entry === undefined ? [] : [entry], { title: null, project: 'app', branch: null, session: 's', savedAt: NOW })

  expect(text).toContain(
    "> Ship it\n\n- tools: Read 2 · Skill 1\n- skills: review\n- mcp: slack:send_message\n- subagents:\n  - Explore · scan · done · 42s\n- errors:\n  - Bash (subagent): `Exit '2'`\n- asked: Bash git push\n- denied: Write .env\n- done: edit 1 · err 1 · denied 1 · 1k out · cache 50%\n",
  )
})

test('the helpers count tools within the cap, keep names once, read errors, MCP names and limit settings', () => {
  const many = Array.from({ length: LOG_CAPS.tools + 2 }, (_, index) => `T${index}`).reduce<Record<string, number>>((tools, tool) => countTool(tools, tool), {})

  expect(Object.keys(many)).toHaveLength(LOG_CAPS.tools + 1)
  expect(many[OTHER_TOOLS]).toBe(2)
  expect(countTool(many, 'T0').T0).toBe(2)
  expect(toolsLine({ Bash: 1, [OTHER_TOOLS]: 4, Read: 3, mcp__slack__send: 1 })).toBe(`Read 3 · Bash 1 · slack:send 1 · ${OTHER_TOOLS} 4`)
  expect(withOnce(['a'], 'a', 3)).toEqual(['a'])
  expect(withOnce(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c'])
  expect(withOnce(['a'], 'b', 3)).toEqual(['a', 'b'])
  expect(errorLine('\n<tool_use_error>\nError:\tno such\u0007file</tool_use_error>\nmore', 100)).toBe('Error: no such file')
  expect(errorLine('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`)
  // A control character would take six bytes of the kept JSON: none is kept.
  expect(promptOf('a\u0007b\tc\nd\u001b[0m', 300)).toBe('a b c\nd [0m')
  expect(mcpNameOf('mcp__claude_ai_Claude_Docs__batch')).toBe('claude_ai_Claude_Docs:batch')
  expect(mcpNameOf('Read')).toBeNull()
  expect(recentOf([{ skills: ['a', 'b'], mcp: ['s:x'] }, { skills: ['c', 'a'], mcp: [] }], { skills: ['d'], mcp: ['s:y'] }, 3)).toEqual({ skills: ['d', 'a', 'c'], mcp: ['s:y', 's:x'] })
  expect(recentOf([], null, 5)).toEqual({ skills: [], mcp: [] })
  expect([limitSetting('12', 50, 5), limitSetting(1_000, 50, 5), limitSetting(2, 50, 5), limitSetting(7.6, 50, 5), limitSetting('', 50, 5), limitSetting(true, 50, 5), limitSetting(0, 50, 5), limitSetting('0', 50, 5)]).toEqual([12, 1_000, 5, 8, 50, 50, 0, 0])
})

test('the helpers read HEAD, count hooks and format time, gauges, memory, servers and states', () => {
  expect(headName('ref: refs/heads/main\n')).toBe('main')
  expect(headName('0123456789abcdef0123456789abcdef01234567\n')).toBe('0123456')
  expect(headName('garbage')).toBeNull()
  expect(gitDirOf('gitdir: ../main/.git/worktrees/wt', '/w/wt')).toBe('/w/wt/../main/.git/worktrees/wt')
  expect(agentCounts(['running', 'idle', 'running', 'done'])).toBe('2 running · 1 idle · 1 done · 4')
  expect(agentCounts([])).toBe('0')
  expect(toolsOf({ tools: 0, tool: null })).toBe('')
  expect(toolsOf({ tools: 3, tool: 'Read' })).toBe(' · 3 tools · Read')
  expect(isWorktreeDir('/w/main/.git/worktrees/wt')).toBe(true)
  expect(isWorktreeDir('/w/main/.git/modules/sub')).toBe(false)
  expect(isWorktreeDir('/w/main/.git')).toBe(false)
  expect(countHooks({ A: [{ hooks: [{}, {}] }, {}], B: 'x' })).toBe(3)
  expect(countHooks(undefined)).toBe(0)
  expect(until(10 * 60_000, 0)).toBe('10m')
  expect(until(3 * 24 * 60 * 60_000, 0)).toBe('3d0h')
  expect(until((4 * 60 + 15) * 60_000, 0)).toBe('4h15m')
  expect(until((6 * 24 + 8) * 60 * 60_000, 0)).toBe('6d8h')
  expect(until(30 * 60 * 60_000, 0)).toBe('1d6h')
  expect(bar(50, 10)).toEqual(['▰▰▰▰▰', '▱▱▱▱▱'])
  expect(bar(0, 10)).toEqual(['', '▱▱▱▱▱▱▱▱▱▱'])
  expect([0, 59, 60, 89, 90, 100].map(tint)).toEqual(['#66bb6a', '#66bb6a', '#fbc02d', '#fbc02d', '#ef5350', '#ef5350'])
  expect(spriteFrames('idle', [{ name: 'b.png', kind: 'file' }, { name: 'a.PNG', kind: 'file' }, { name: 'x.gif', kind: 'file' }, { name: 'c.png', kind: 'dir' }])).toEqual(['idle/a.PNG', 'idle/b.png'])
  expect(framesFor('working', { ...NO_FRAMES, working: ['working/a.png'], idle: ['idle/a.png'] })).toEqual(['working/a.png'])
  expect(framesFor('complete', { ...NO_FRAMES, working: ['working/a.png'], idle: ['idle/a.png'] })).toEqual(['idle/a.png'])
  expect(framesFor('idle', { ...NO_FRAMES, complete: ['complete/a.png'] })).toEqual(['complete/a.png'])
  expect(framesFor('idle', NO_FRAMES)).toEqual([])
  expect(withoutFrame({ ...NO_FRAMES, idle: ['idle/a.png', 'idle/b.png'] }, 'idle/a.png')).toEqual({ ...NO_FRAMES, idle: ['idle/b.png'] })
  expect(frameAt(['idle/a.png', 'idle/b.png'], 99)).toBe('idle/b.png')
  expect(frameAt([], 0)).toBeUndefined()
  expect(nextFrame('idle', 35, 36)).toBe(0)
  expect(nextFrame('complete', 21, 22)).toBe(21)
  expect(nextFrame('working', 4, 0)).toBe(0)
  expect(folderOf('', '/home/me')).toBeNull()
  expect(folderOf(undefined, '/home/me')).toBeNull()
  expect(folderOf('/data/buddy/', '/home/me')).toBe('/data/buddy')
  expect(folderOf('~/buddy', '/home/me')).toBe('/home/me/buddy')
  expect(folderOf('~', '/home/me')).toBe('/home/me')
  expect(folderOf('buddy', '/home/me/')).toBe('/home/me/buddy')
  expect(folderOf('~/buddy', undefined)).toBeNull()
  expect(duration(72)).toBe('1m12s')
  expect(duration(3_900)).toBe('1h05m')
  expect(memoryOf([{ type: 'User' }, { type: 'Project' }, { type: 'Project' }])).toEqual({ total: 3, byType: [{ type: 'Project', count: 2 }, { type: 'User', count: 1 }] })
  expect(mcpServersOf(['mcp__a__x', 'mcp__b__y', 'mcp__b__z', 'Read'])).toBe(2)
  expect(stateOf('killed')).toBe('failed')
  expect(stateOf('waiting')).toBe('waiting')
  expect([840, 12_400, 84_000, 840_000, 1_000_000, 1_500_000].map(tokensShort)).toEqual(['840', '12.4k', '84k', '840k', '1M', '1.5M'])
  expect(targetOf({ file_path: '/w/app/src/Foo.java' })).toBe('Foo.java')
  expect(targetOf({ command: 'git status\n--short' })).toBe('git status')
  expect(targetOf({ pattern: 'TODO' })).toBe('TODO')
  expect(targetOf({})).toBeNull()
  expect(toolKind('MultiEdit')).toBe('edit')
  expect(toolKind('WebFetch')).toBe('read')
  expect(oneLine('<a>x</a>  y\nz', 80)).toBe('x y z')
  expect(minutesToFull([{ at: 0, percent: 40 }, { at: 600_000, percent: 50 }])).toBe(50)
  expect(minutesToFull([{ at: 0, percent: 40 }, { at: 120_000, percent: 50 }])).toBeNull()
  expect(cacheHitOf({ input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 })).toBe(90)
  expect(logFrom({ entries: [{ broken: true }, kept('ok', 1)] }, 50)).toHaveLength(1)
  expect(logFrom({ entries: [kept('ok', 1)] }, 50)[0]).toMatchObject({ files: [], commands: [] })
  expect(promptOf('Fix <b>this</b>\n\n  and   that  \n', 300)).toBe('Fix this\nand that')
  expect(colorSaid('<local-command-stdout>Session color set to: purple</local-command-stdout>')).toBe('purple')
  expect(colorSaid('Session color reset to default')).toBe('default')
  expect(colorSaid('Invalid color "teal". Available colors: red, blue, default')).toBeNull()
  expect(renameSaid('<local-command-stdout>Session renamed to: plugin-test</local-command-stdout>')).toBe('plugin-test')
  expect(renameSaid('Session is named: two words (a newer rename landed first)')).toBe('two words')
  expect(renameSaid('Session renamed to: x. Other sessions may still show the old name: the session registry could not be updated (run with --debug for the cause)')).toBe('x')
  expect(renameSaid('Set effort level to low')).toBeNull()
  expect(cellsOf('가a')).toBe(3)
  expect(wrapCells('one two three\nfour', 7)).toEqual(['one two', 'three', 'four'])
  expect(wrapCells('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  expect(wrapCells('가나다라', 5)).toEqual(['가나', '다라'])
  // A tick over the log's rows (the last 8 of 40, all in the window) moves it while it can; anywhere else, or past its end, the pane scrolls.
  const LOG = { height: 8, offset: 0, total: 23, shown: 5, isReading: false }
  const ALL = { top: 0, bodyRows: 40, contentRows: 40 }
  expect(logWheel({ ...ALL, row: 35, by: 1 }, LOG)).toBe(1)
  expect(logWheel({ ...ALL, row: 35, by: -1 }, LOG)).toBeNull()
  expect(logWheel({ ...ALL, row: 31, by: 1 }, LOG)).toBeNull()
  expect(logWheel({ ...ALL, row: null, by: 1 }, LOG)).toBeNull()
  expect(logWheel({ ...ALL, row: 39, by: 3 }, { ...LOG, offset: 17 })).toBe(18)
  expect(logWheel({ ...ALL, row: 39, by: 1 }, { ...LOG, offset: 18 })).toBeNull()
  // An opened line's detail makes the log 20 rows, past a window of 25 from row 10: down, the pane scrolls to its end first.
  const OPEN = { ...LOG, height: 20, offset: 3 }
  expect(logWheel({ row: 30, top: 10, bodyRows: 25, contentRows: 40, by: 1 }, OPEN)).toBeNull()
  expect(logWheel({ row: 30, top: 15, bodyRows: 25, contentRows: 40, by: 1 }, OPEN)).toBe(4)
  // Up, the pane scrolls until the log's top (row 20) is in the window, then the log moves.
  expect(logWheel({ row: 30, top: 25, bodyRows: 15, contentRows: 40, by: -1 }, OPEN)).toBeNull()
  expect(logWheel({ row: 30, top: 20, bodyRows: 15, contentRows: 40, by: -1 }, OPEN)).toBe(2)
  // While a line shown is open, its detail is read by scrolling the pane: the lines never move, even with the whole log in view.
  expect(logWheel({ ...ALL, row: 35, by: 1 }, { ...LOG, isReading: true })).toBeNull()
  expect(logWheel({ row: 30, top: 15, bodyRows: 25, contentRows: 40, by: 1 }, { ...OPEN, isReading: true })).toBeNull()
  expect(logWheel({ row: 30, top: 20, bodyRows: 15, contentRows: 40, by: -1 }, { ...OPEN, isReading: true })).toBeNull()
  expect(clipCells('가나다라', 5)).toBe('가나…')
  expect(clipCells('abc', 5)).toBe('abc')
  expect(dateOf(NOW)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d$/)
  expect(markReached(85, [80, 90], [])).toEqual({ reached: 80, told: [80] })
  expect(markReached(95, [80, 90], [])).toEqual({ reached: 90, told: [80, 90] })
  expect(markReached(86, [80, 90], [80])).toEqual({ reached: null, told: [80] })
  expect(markReached(30, [80, 90], [80, 90])).toEqual({ reached: null, told: [] })
  expect(
    standing(
      [
        { kind: 'limit', text: 'l', at: 1, until: 100, ref: null },
        { kind: 'approval', text: 'a', at: 2, until: null, ref: 'x' },
        { kind: 'limit', text: 'gone', at: 3, until: 50, ref: null },
      ],
      60,
    ).map(alert => alert.text),
  ).toEqual(['a', 'l'])
  expect(logMarkdown([], { title: 'plugin-test', project: 'app', branch: null, session: 's', savedAt: NOW })).toMatch(/^# plugin-test\n\n- project: app\n- session: s\n- written: .*, 0 turns, newest first\n$/)
  expect(logFrom(undefined, 50)).toEqual([])
  expect(pruneLogs({ a: 10, b: 30, c: 20 }, 40, 2, 14)).toEqual({ kept: { b: 30, c: 20 }, dropped: ['a'] })
  expect(pruneLogs({ a: 10, b: 30, c: 20 }, 40 + 30 * 86_400_000, 0, 0).dropped).toEqual([])
  expect(pruneLogs({ a: 10, b: 30 }, 40 + 30 * 86_400_000, 0, 14).dropped).toEqual(['a', 'b'])
  expect(stampOf(NOW, NOW)).toMatch(/^\d\d:\d\d$/)
  expect(stampOf(NOW - 3 * 86_400_000, NOW)).toMatch(/^\d\d\/\d\d \d\d:\d\d$/)
  expect(soundFiles('working', [{ name: 'b.caf', kind: 'file' }, { name: 'a.wav', kind: 'file' }, { name: 'x.txt', kind: 'file' }, { name: 'd.caf', kind: 'dir' }])).toEqual(['working/a.wav', 'working/b.caf'])
  expect(['a.caf', 'a.WAV', 'a.aif', 'a.aiff', 'a.mp3', 'a.m4a', 'a.aac'].map(audioMime)).toEqual(['audio/x-caf', 'audio/wav', 'audio/aiff', 'audio/aiff', 'audio/mpeg', 'audio/mp4', 'audio/aac'])
  expect(effortGauge('low')).toEqual(['▰', '▱▱▱▱'])
  expect(effortGauge('max')).toEqual(['▰▰▰▰▰', ''])
  expect(effortLevelOf('med')).toBe('medium')
  expect(effortLevelOf('auto')).toBeNull()
  expect(effortSaid('Set effort level to xhigh (saved as your default for new sessions)')).toBe('xhigh')
  expect(effortSaid('Set effort level to auto')).toBe('other')
  expect(effortSaid('Model set to Opus 5.5')).toBeNull()
  expect(effortGuess('claude-opus-5-5[1m]', undefined, SAVED)).toBe('xhigh')
  expect(effortGuess('claude-sonnet-5-5', undefined, SAVED)).toBe('high')
  expect(effortGuess('claude-opus-5-5', 'low', SAVED)).toBe('low')
  expect(
    [
      'claude-opus-5-5',
      'claude-opus-5-5[1m]',
      'claude-fable-5-1',
      'claude-opus-5',
      'claude-opus-4-0',
      'claude-opus-4-1-20250805',
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'us.anthropic.claude-sonnet-5-5',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'claude-opus-4-5@20251101',
      'haiku',
    ].map(modelName),
  ).toEqual(['Opus 5.5', 'Opus 5.5', 'Fable 5.1', 'Opus 5', 'Opus 4', 'Opus 4.1', 'Sonnet 4', 'Sonnet 3.5', 'Opus 3', 'Sonnet 5.5', 'Sonnet 3.5', 'Opus 4.5', 'Haiku'])
  // A model this mod does not know yet is shown as it is.
  expect(['claude-foo-7-0', 'claude-mythos-preview', 'opusplan', 'claude-2', ''].map(modelName)).toEqual(['claude-foo-7-0', 'claude-mythos-preview', 'opusplan', 'claude-2', ''])
})

test('the settings that order the pane, color its cards and draw its gauges are read leniently, an invalid value falling back', () => {
  const ORDER = ['tasks', 'agents', 'context', 'recent', 'log']

  expect(paneOrderOf(undefined)).toEqual(ORDER)
  expect(paneOrderOf('')).toEqual(ORDER)
  expect(paneOrderOf('tasks,agents,context,recent,log')).toEqual(ORDER)
  expect(paneOrderOf('LOG, Tasks  bogus,log')).toEqual(['log', 'tasks', 'agents', 'context', 'recent'])
  expect(paneOrderOf('recent,,context')).toEqual(['recent', 'context', 'tasks', 'agents', 'log'])
  expect(colorOf('claude', 'subtle')).toBe('claude')
  expect(colorOf(' planmode ', 'subtle')).toBe('planMode')
  expect(colorOf('#A1B2C3', 'subtle')).toBe('#a1b2c3')
  expect(['', '#abc', '#12345g', 'red', 'blue_FOR_SUBAGENTS_ONLY', 'auto', 42, undefined].map(value => colorOf(value, null))).toEqual(Array.from({ length: 8 }, () => null))
  expect(barGlyphOf('█', '▰')).toBe('█')
  expect(barGlyphOf(' # ', '▰')).toBe('#')
  expect(['', ' ', '##', '가', 'ｘ', '🙂', '❤️', 'é', '́', '\u0007', '‍', '　', undefined].map(value => barGlyphOf(value, '▰'))).toEqual(Array.from({ length: 13 }, () => '▰'))
  expect(bar(50, 4, { filled: '█', empty: '░' })).toEqual(['██', '░░'])
  expect(effortGauge('medium', { filled: '#', empty: '-' })).toEqual(['##', '---'])
})

test('a search finds a line by every word of it, in any case, in what was asked and in what the turn did', () => {
  const [line] = logFrom(
    {
      entries: [
        {
          ...kept('Fix the bug', 1),
          files: ['Parser.ts'],
          commands: ['npm test'],
          tools: { Grep: 2 },
          skills: ['code-review'],
          mcp: ['linear:get_issue'],
          subagents: [{ type: 'Explore', description: 'find the callers', outcome: 'answer', seconds: 3 }],
          errors: [{ tool: 'Bash', isSubagent: false, text: 'exit code 1' }],
        },
      ],
    },
    50,
  )

  if (line === undefined) throw new Error('no line read')
  expect(['', '  ', 'BUG', 'parser.ts', 'npm', 'grep', 'code-review', 'get_issue', 'explore callers', 'exit code', 'fix   npm']
    .every(query => logMatches(line, query))).toBe(true)
  expect(['bugs', 'fix login', 'Edit'].some(query => logMatches(line, query))).toBe(false)
})

test("a kept file's name says whose log it is and which part; the oldest lines are sealed 200 to a file, the newest file keeping one to 200", () => {
  expect([keptFileOf('4e785f97-aa.json'), keptFileOf('sess-A.3.json'), keptFileOf('sess-A.0.json'), keptFileOf('sess-A.md'), keptFileOf('../x.json')]).toEqual([
    { id: '4e785f97-aa', part: 0 },
    { id: 'sess-A', part: 3 },
    null,
    null,
    null,
  ])
  expect([0, 1, 200, 201, 400, 401].map(lines => sealedOf(lines, 200))).toEqual([0, 0, 0, 1, 1, 2])
  expect(partText(logFrom({ entries: [kept('a', 3), kept('b', 2), kept('c', 1)] }, 50), 2, 2)).toBe(JSON.stringify({ entries: logFrom({ entries: [kept('c', 1)] }, 50) }))

  const file = (name: string, mtimeMs: number, size = 10): { name: string; size: number; mtimeMs: number } => ({ name, size, mtimeMs })

  // A sealed file with no newest one beside it is as old as it was written; this session's own past its sealed count goes.
  expect(sweepOf([file('me.json', 0), file('me.1.json', 0), file('me.2.json', 0), file('a.json', 5), file('b.1.json', 9), file('c.json', 9, 0), file('x.txt', 0)], 'me', 1, 10, 2, 0).map(one => one.name)).toEqual(['me.2.json', 'a.json', 'c.json'])
})
