import { atom, read, update } from 'claude-code'
import type { AgentInfo, AudioClip, Elements, EngineInterface, FsEntry, ImageSource, Register, RenderElement, RenderSurface, Timer } from 'claude-code'

import type { AgentRow, AgentState, Alert, AlertKind, ChangeRow, LogAgent, LogCall, LogEntry, LogError, Outcome, SectionName, SessionColor, Snapshot, TaskItem, Totals } from '../types'

import { addUsage, agentCounts, agentLine, audioMime, bar, BAR_GLYPHS, barGlyphOf, baseName, cacheHitOf, callsLine, cellsOf, cleanOf, clip, clipStart, clockOf, colorOf, colorSaid, countHooks, countTool, dateOf, diffCounts, diffOf, doneOf, duration, effortGauge, effortGuess, effortLevelOf, effortSaid, effortTint, elapsed, errorLine, errorText, folderOf, frameAt, framesFor, gitDirOf, headName, hintTail, isEnded, isOwnData, isWorktreeDir, limitOf, limitSetting, lineDiff, linesOf, LOG_CAPS, logFrom, logMarkdown, logMatches, logWheel, markReached, mcpNameOf, mcpServersOf, memoryOf, minutesToFull, modelBase, modelName, nextFrame, NO_FRAMES, NO_TOTALS, oneLine, OUTCOME_WORDS, PANE_CARDS, paneOrderOf, parentOf, partText, pathIn, promptOf, recentOf, renameSaid, sealedOf, sessionColorOf, soundFiles, spriteFrames, stampOf, standing, STATE_ORDER, stateOf, sweepOf, targetOf, tasksFrom, tasksInOrder, tasksOfTodos, tint, tokensShort, toolKind, toolsLine, toolsOf, totalsFrom, updateTask, withOnce, withoutFrame, wrapCells } from './format'
import type { BarGlyphs, EffortLevel, Frames, Motion, PaneCard } from './format'

/** The GIF's own pace: 25 frames every 2 seconds. */
const FRAME_MS = 80
/** Figures that move while one works: usage, turns, subagents. */
const FAST_MS = 2_000
/** Figures that seldom do: branch, memory files, hooks, tools. */
const SLOW_MS = 15_000
/** How long an ended subagent stays in the list. */
const LINGER_MS = 30_000
/** The sprite's box in cells: 10 by 5 keeps the square 686x680 crop square in a 1:2 cell. */
const SPRITE = { columns: 10, rows: 5 } as const
/**
 * Cells kept free on each side of the sprite: before it at the band's left edge,
 * and between it and the figures. Every frame fills the same box, so the widest
 * one is the box's width, and its tail reaches that box's edge.
 */
const SPRITE_MARGIN = 2
/** The sprite's whole slot: a margin, the widest frame, and a margin after it. */
const SPRITE_SLOT = SPRITE_MARGIN + SPRITE.columns + SPRITE_MARGIN
/** Every gauge is this many cells, so that the three line up as one scale. */
const GAUGE = 10
/** How long the cheer stands after a finished turn before the sprite rests. */
const COMPLETE_MS = 3_000
/** Whether an answered turn is cheered with the `complete` motion before idle; off for now, its frames kept. */
const IS_CHEERING: boolean = false
/** Below this many columns the sprite gives its room to the text. */
const SPRITE_MIN_COLUMNS = 72
const SPRITE_KEY = 'sprite'
/** The mod's own frames (`<motion>/*.png`) and clips (`<state>/*`), under the plugin's folder, where no setting names others. */
const OWN_FRAMES = 'assets'
const OWN_SOUNDS = 'assets/sounds'
/** Turns the log keeps per session unless the `logTurns` setting says otherwise (0 there: every turn), and the fewest it may say. */
const LOG_KEPT = 50
const LOG_KEPT_MIN = 5
/** Lines the pane's log shows at a time: the wheel over them moves it a line a tick, older and newer a page. */
const LOG_ROWS = 5
/** How many skills, and how many MCP tools, the pane's recent card lists. */
const RECENT_ROWS = 5
/** The changed files the pane's changes card lists before it counts the rest, and the most it follows at once. */
const CHANGE_ROWS = 8
const CHANGES_KEPT = 50
/** A changed file's text past this many characters is not kept: the file is listed, but not compared. */
const CHANGE_TEXT_MAX = 512 * 1024
/** What one diff draws at most: `Code` draws 100000 characters in one drawing, and the cards around it take some. */
const DIFF_CHARS = 80_000
/** The changes card, and the card over a diff, which the pane scrolls to. */
const CHANGES_KEY = 'card-changes'
const DIFF_KEY = 'card-diff'
/**
 * The kept logs: files under the plugin's data folder, `<id>.json` per session
 * with its newest lines (LOG_PART at most) and what else is kept for it. A log
 * past LOG_PART lines seals its oldest in files of LOG_PART each, `<id>.1.json`
 * the oldest, which a save does not write again while they stay as they are.
 * LOG_PART lines of the largest LOG_CAPS allows are about 3.2 MiB, under the
 * 4 MiB a file may be read or written at.
 */
const KEPT_FOLDER = 'sessions'
const LOG_PART = 200
/** Sessions whose logs are kept, and days a log is kept after its last save, unless the `logSessions` and `logDays` settings say otherwise (0 there: no limit). */
const LOG_SESSIONS_KEPT = 30
const LOG_DAYS_KEPT = 14
/** What removes the kept files let go of, and how many it is given at a time. */
const REMOVER = '/bin/rm'
const REMOVE_BATCH = 100
/** Subagents still running when their turn's line was kept, whose end is written into it later: the newest this many. */
const PENDING_AGENTS = 30
/** What a log line keeps for its detail: the prompt's characters, the files edited, the commands run. */
const LOG_TEXT_KEPT = 300
const LOG_FILES_KEPT = 8
const LOG_COMMANDS_KEPT = 5
const LOG_COMMAND_CHARS = 80
/** The open line's detail, which the pane scrolls into view. */
const LOG_DETAIL_KEY = 'log-detail'
/** The log's search field, which the key s focuses. */
const LOG_FIND_KEY = 'log-find'
/**
 * Where the logs are kept (KEPT_FOLDER) and written to be read (`logs`): the
 * plugins' data folder as Claude Code names this plugin's
 * (`<plugin>-<marketplace>`), which an uninstall clears. `CLAUDE_PLUGIN_DATA`
 * names it where it names a folder of this plugin's (`isOwnData`); another
 * plugin's is passed over.
 */
const DATA_FOLDER = 'plugins/data/pane-mod-pane-mod'
/** What opens a written file with the app the system picks: macOS's, then the freedesktop one. */
const OPENERS = ['/usr/bin/open', 'xdg-open'] as const
/** The percents of the context and of the 5h window an alert is raised at, each once until it falls back under. */
const ALERT_MARKS = [80, 90] as const
/** How long an alert that goes by itself (a limit near) stands. */
const ALERT_LINGER_MS = 60_000
/** The pace alert is told again no sooner than this. */
const PACE_RETELL_MS = 30 * 60_000
/** Each alert's mark, where the line under an approval dialog names the others standing. */
const ALERT_MARK: Record<AlertKind, string> = { approval: '⚠', limit: '▲' }
const PACE_MINUTES = 60
/** The side pane: its id, the width it asks for, and the sprite it draws beside its first card. */
const PANE = 'pane-mod'
const PANE_COLUMNS = 56
const PANE_SPRITE = { columns: 12, rows: 6 } as const
/** A card's border and padding on each side, which its rows are drawn inside of. */
const CARD_INSET = 4
/** The cells between the sprite and the rows beside it in the first card. */
const PANE_SPRITE_GAP = 2
/** The narrowest the rows beside the sprite may be: below it the pane draws no sprite. */
const TEXT_MIN = 24
const PANE_SPRITE_MIN = CARD_INSET + PANE_SPRITE.columns + PANE_SPRITE_GAP + TEXT_MIN
/** What stands between the parts of a row. */
const SEP = ' · '
const ACCENT = '#F7D02C'
/** The text on a yellow badge. */
const BADGE_TEXT = '#1b1b1b'
/**
 * Theme colors: a gauge's unlit steps and a plain card's border (the theme's
 * own gray), and the model card's (Claude's orange). The two borders are the
 * defaults of the `cardColor` and `modelColor` settings.
 */
const UNLIT = 'subtle'
const CARD = 'subtle'
const MODEL_CARD = 'claude'
/** The branch's color, and the mark after it in a linked worktree. */
const BRANCH = '#ba68c8'
const WORKTREE_MARK = '⎇'
/** Directories walked up from the working directory looking for `.git`. */
const GIT_DEPTH = 32

const snap = atom({ plugin: 'pane-mod', key: 'snap' } as const, null)
const frame = atom({ plugin: 'pane-mod', key: 'frame' } as const, 0)
const logOffset = atom({ plugin: 'pane-mod', key: 'logOffset' } as const, 0)
const logOpen = atom({ plugin: 'pane-mod', key: 'logOpen' } as const, null)
const logQuery = atom({ plugin: 'pane-mod', key: 'logQuery' } as const, '')
const diffOpen = atom({ plugin: 'pane-mod', key: 'diffOpen' } as const, null)

type Engine = EngineInterface
type Slow = Pick<Snapshot, 'project' | 'branch' | 'isWorktree' | 'memory' | 'hooks' | 'tools'>
type Fast = Omit<Snapshot, keyof Slow | 'mode' | 'style' | 'title' | 'color'>
/** What the HUD has seen of one subagent beyond what `$.agent.list()` says. */
type Seen = { startedAt: number; endedAt: number | null; idleAt: number | null; tools: number; tool: string | null }

const STATE_MARK: Record<AgentState, { mark: string; color?: string }> = {
  running: { mark: '●', color: ACCENT },
  waiting: { mark: '◐', color: '#4fc3f7' },
  idle: { mark: '○' },
  pending: { mark: '·' },
  done: { mark: '✓', color: '#66bb6a' },
  failed: { mark: '✗', color: '#ef5350' },
}
/** The lines a diff adds, and those it removes, as the changes card counts them. */
const ADDED = '#66bb6a'
const REMOVED = '#ef5350'
/** How the subagents are shown under the rows: one row each, one row of counts, or not at all. */
type AgentsShown = 'list' | 'summary' | 'off'
type Layout = 'auto' | 'band' | 'pane' | 'hint'
const LAYOUTS: readonly Layout[] = ['auto', 'band', 'pane', 'hint']
/** The two element constructors the HUD's rows are built from. */
type Kit = Pick<Elements['terminal'], 'Box' | 'Text'>
const MODE_COLOR: Readonly<Record<string, string>> = { bypassPermissions: '#ef5350', acceptEdits: '#ffb74d', plan: '#81c784', auto: '#4fc3f7' }

// The module's own variables start over on a reload; `snap` and `frame` are the host's and stay.
let isAnimated = true
let isSoundOn = true
let isSpriteWanted = true
let agentsShown: AgentsShown = 'summary'
/** Where the HUD draws: the side pane where the screen docks one (`auto`), the band alone, or the pane always. */
let layout: Layout = 'auto'
/** Whether the pane is open, and where the surface seated it once it drew it. */
let paneState: 'closed' | 'open' = 'closed'
let panePlacement: 'dock' | 'inline' | null = null
/** Set once the person closes the pane: it opens again only when asked, with `/pane-mod`. */
let isPaneDismissed = false
/** What the band draws while the pane is shown: nothing (the pane holds it all), or one summary row. */
let bandWithPane: 'line' | 'off' = 'off'
/** A subagent spawned in a main turn, with when it was spawned: its log line's part, which its own turn's end completes. */
type HeldAgent = { agent: LogAgent; startedAt: number }
/**
 * The main turn under way: when it began, what was asked, and what its tool
 * calls have done: the counts, the main thread's calls by tool, the skills and
 * MCP tools used, the subagents spawned, the calls that failed, the approvals
 * asked for and the calls denied.
 */
type Tally = {
  startedAt: number
  text: string
  edited: Set<string>
  commands: string[]
  runs: number
  reads: number
  agents: number
  tools: Record<string, number>
  skills: string[]
  mcp: string[]
  subagents: Map<string, HeldAgent>
  errors: LogError[]
  approvals: LogCall[]
  denials: LogCall[]
}
let tally: Tally | null = null
/** The subagents still running when their turn's line was kept, by id: their end is written into that line. */
const pendingAgents = new Map<string, HeldAgent>()
/** How many turns the log keeps per session, how many sessions' logs are kept, and for how many days: the `logTurns`, `logSessions` and `logDays` settings (0: no limit). */
let logTurns = LOG_KEPT
let logSessions = LOG_SESSIONS_KEPT
let logDays = LOG_DAYS_KEPT
/** What each sealed file of the session's log holds as last written or read, by its number: one that would be written the same is not. */
const sealedTexts = new Map<number, string>()
/** The main thread's tool call in flight. */
let current: { tool: string; target: string | null; since: number } | null = null
/** The finished turns, newest last; past `logTurns` the oldest goes. */
const workLog: LogEntry[] = []
/** The session the log in memory belongs to: `--resume` and `-c` keep the id, a new session or `--fork-session` brings another. */
let logSession: string | undefined
/** The 5h window's readings while it rises, for the pace it fills at. */
let paceReadings: { at: number; percent: number }[] = []
/** Whether the screen docks a pane beside the transcript, as the band last measured it. */
let isFullscreen = false
/** The site the sprite moves in: the pane's id, the band's request id, or none. */
let spriteAt: string | undefined
let mode: string | null = null
/** The name the session was given, as the settings hooks' input and `/rename`'s row say it. */
let sessionTitle: string | null = null
/** The color `/color` set the session, kept with its log: no hook's input carries it. */
let sessionColor: SessionColor | null = null
/** The main thread's effort as the engine last said it (a request, or `/effort`'s reply), for the model it was said for. */
let effortSeen: { model: string; value: EffortLevel | number } | undefined
/** What a level is guessed from before anything says it: the settings and the environment variable, as last read. */
let effortSources: { settings: Readonly<Record<string, unknown>>; env: string | undefined } = { settings: {}, env: undefined }
let style: string | null = null
let slow: Slow | null = null
let slowAt = 0
let refresher: Timer | undefined
let player: Timer | undefined
let rester: Timer | undefined
let motion: Motion = 'idle'
/** The model turns under way, by id: the sprite focuses while there is one. */
const liveTurns = new Set<string>()
/** Set once the engine says this terminal cannot show the picture at all: the sprite's slot is given to the text. */
let isSpriteBlocked = false
let shown = 0
/** How a frame reaches the terminal: `auto` picks by the terminal, `file` names the PNG, `bytes` sends it. */
let spriteSource: 'auto' | 'file' | 'bytes' = 'auto'
/** Whether frames go as bytes, once `auto` has looked at the terminal. */
let isBytes: boolean | undefined
/** Each frame's PNG as base64, read once: a frame sent as bytes is not read again. */
const pngs = new Map<string, string>()
const seen = new Map<string, Seen>()
/** The `spriteDir` and `soundDir` settings as given: folders of the person's own, or empty for the mod's. */
let spriteSetting: unknown
let soundSetting: unknown
/** The folders the frames and the clips are read from, once the session has started. */
let spriteRoot = ''
let soundRoot = ''
/** Whether the clips are the mod's own, played by their path in the plugin; others are sent as their bytes. */
let isOwnSounds = true
/** Each motion's frames as found when the session started: none until then, and none where a folder holds no PNG. */
let frames: Frames = NO_FRAMES
/** Each state's clips, listed once from its folder. */
const sounds = new Map<Motion, string[]>()
/** Each clip of the person's own as base64, read once. */
const clipBytes = new Map<string, string>()
/** Whether a line goes under approval dialogs: the `alerts` setting. */
let isAlerting = true
/** The alerts raised and not yet let go, newest last. */
let alerts: Alert[] = []
/** The marks of the context and of the 5h window told already, and when the pace was last told. */
let toldContext: number[] = []
let toldFive: number[] = []
let paceToldAt = Number.NEGATIVE_INFINITY
/** Claude's tasks as the task tools and TodoWrite last left them, and what the session's turns have used: kept with its log. */
let tasks: TaskItem[] = []
let totals: Totals = NO_TOTALS
/** The sections the settings show (the pane's, and the band's rows they share). */
let sections: Readonly<Record<SectionName, boolean>> = { session: true, now: true, tasks: true, model: true, usage: true, totals: true, context: false, recent: true, changes: true, log: true }
/** The pane's cards under its first two, in the order the `paneOrder` setting puts them. */
let paneOrder: readonly PaneCard[] = PANE_CARDS
/**
 * The borders the settings color: the first card's (null follows `/color`),
 * the model card's, and every other card's.
 */
let sessionBorder: string | null = null
let modelBorder: string = MODEL_CARD
let cardBorder: string = CARD
/** The characters every gauge's lit and unlit steps are drawn with. */
let barGlyphs: BarGlyphs = BAR_GLYPHS
/**
 * Where the pane's window stood when it last drew or moved, and how many rows at
 * the end of its tree the log takes: a wheel tick over those rows moves the log.
 */
let paneOffset = 0
let logHeight = 0
/**
 * A file the latest turn that changed any changed: its path, the name it is
 * shown by, its text before that turn changed it and as it was last written
 * (null where it was too large to keep), the lines added and removed between
 * them, and which change of the session was its last.
 */
type Change = { path: string; name: string; before: string | null; after: string | null; added: number | null; removed: number | null; version: number }
/** The changed files by path, in the order first changed; the turn they belong to (none before any); and the changes so far. */
const changes = new Map<string, Change>()
let changesOf: Tally | null = null
let changeCount = 0
/** The diff last drawn, kept so that a redraw does not work it out again. */
let diffDrawn: { key: string; diff: ReturnType<typeof diffOf> } | null = null
/** The tool calls under way by id, with their tool and loop, so an approval asked can be told which call it holds. */
const inFlight = new Map<string, { tool: string; agentId: string | undefined }>()

/**
 * The branch of the repository `cwd` is in, and whether `cwd` is in a linked
 * worktree; a worktree's `.git` file is followed to its own HEAD.
 */
const branchOf = async ($: Engine, cwd: string): Promise<{ branch: string | null; isWorktree: boolean }> => {
  const none = { branch: null, isWorktree: false }
  let dir = cwd

  for (let depth = 0; depth < GIT_DEPTH && dir !== ''; depth += 1) {
    const dot = `${dir === '/' ? '' : dir}/.git`
    const stat = await $.fs.stat(dot).catch(() => undefined)

    if (stat !== undefined) {
      const gitDir = stat.kind === 'dir' ? dot : gitDirOf(await $.fs.read(dot), dir)

      return gitDir === null ? none : { branch: headName(await $.fs.read(`${gitDir}/HEAD`)), isWorktree: isWorktreeDir(gitDir) }
    }
    if (dir === '/') return none
    dir = parentOf(dir)
  }

  return none
}

const gatherSlow = async ($: Engine): Promise<Slow> => {
  const [usage, cwd, settings, tools, env] = await Promise.all([
    $.session.usage({ breakdown: 'summary' }).catch(() => undefined),
    $.session.cwd().catch(() => ''),
    $.settings.read().catch(() => ({}) as Record<string, unknown>),
    $.tool.list().catch(() => []),
    $.env.get('CLAUDE_CODE_EFFORT_LEVEL').catch(() => undefined),
  ])

  effortSources = { settings, env }
  const breakdown = usage?.context.breakdown
  const mcp = tools.filter(tool => tool.mcp)

  const git = cwd === '' ? { branch: null, isWorktree: false } : await branchOf($, cwd).catch(() => ({ branch: null, isWorktree: false }))

  return {
    project: baseName(cwd),
    branch: git.branch,
    isWorktree: git.isWorktree,
    memory: breakdown === undefined ? null : memoryOf(breakdown.memoryFiles),
    hooks: countHooks(settings.hooks),
    tools: {
      builtIn: tools.length - mcp.length,
      mcp: mcp.length,
      mcpServers: mcpServersOf(mcp.map(tool => tool.name)),
      skills: breakdown?.skills?.totalSkills ?? null,
      commands: breakdown?.slashCommands?.totalCommands ?? null,
    },
  }
}

/** The list's rows: those at work first, then those that ended within the linger, each oldest first. */
const agentRows = (agents: readonly AgentInfo[], now: number): AgentRow[] => {
  const rows: (AgentRow & { startedAt: number })[] = []

  for (const id of seen.keys()) if (!agents.some(agent => agent.id === id)) seen.delete(id)
  for (const agent of agents) {
    const state = stateOf(agent.status)
    const entry = seen.get(agent.id) ?? { startedAt: now, endedAt: null, idleAt: null, tools: 0, tool: null }

    entry.endedAt = isEnded(state) ? (entry.endedAt ?? now) : null
    // A teammate done with its work waits for a message: its clock stops while it is idle, and runs on if it is woken.
    entry.idleAt = state === 'idle' ? (entry.idleAt ?? now) : null
    seen.set(agent.id, entry)
    if (entry.endedAt !== null && now - entry.endedAt > LINGER_MS) continue
    rows.push({
      id: agent.id,
      name: agent.name ?? null,
      type: agent.type,
      description: agent.description,
      state,
      seconds: Math.floor(((entry.endedAt ?? entry.idleAt ?? now) - entry.startedAt) / 1000),
      tools: entry.tools,
      tool: isEnded(state) || state === 'idle' ? null : entry.tool,
      startedAt: entry.startedAt,
    })
  }

  return rows
    .sort((a, b) => Number(isEnded(a.state)) - Number(isEnded(b.state)) || a.startedAt - b.startedAt)
    .map(({ startedAt: _startedAt, ...row }) => row)
}

const gatherFast = async ($: Engine): Promise<Fast> => {
  const [model, usage, turns, agents, now] = await Promise.all([
    $.session.model().catch(() => ''),
    $.session.usage().catch(() => undefined),
    $.session.turns().catch(() => null),
    agentsShown === 'off' ? [] : $.agent.list().catch(() => []),
    $.clock.now(),
  ])

  // What the engine said holds for the model it was said for; before that, or after a switch of model, the settings tell.
  const isSeen = effortSeen !== undefined && modelBase(effortSeen.model) === modelBase(model)

  const five = usage?.rateLimits.find(limit => limit.kind === 'five_hour')
  const fiveResetsAt = five?.resetsAt === undefined ? Number.NaN : Date.parse(five.resetsAt)
  const toFull = five === undefined ? null : notePace(now, five.percentUsed)
  const toReset = Number.isNaN(fiveResetsAt) ? null : (fiveResetsAt - now) / 60_000

  return {
    activity: current === null ? null : { tool: current.tool, target: current.target, seconds: Math.floor((now - current.since) / 1000) },
    turnSeconds: tally === null ? null : Math.floor((now - tally.startedAt) / 1000),
    forecast: toFull !== null && (toReset === null || toFull < toReset) ? toFull : null,
    log: workLog.map(entry => ({ ...entry, at: stampOf(entry.endedAt, now) })),
    recent: recentOf(workLog, tally, RECENT_ROWS),
    changes: [...changes.values()].map(({ path, name, added, removed }): ChangeRow => ({ path, name, added, removed })),
    tasks: tasksInOrder(tasks),
    totals,
    model,
    effort: isSeen && effortSeen !== undefined ? effortSeen.value : effortGuess(model, effortSources.env, effortSources.settings),
    contextPercent: usage?.context.percent ?? null,
    contextTokens: usage?.context.tokens ?? null,
    contextWindow: usage?.context.window ?? null,
    limits: (usage?.rateLimits ?? []).map(limit => limitOf(limit, now)),
    usd: usage?.cost?.usd ?? null,
    turns,
    agents: agentRows(agents, now),
  }
}

/** Keeps the 5h readings of the last hour (a fall is a new window: it starts them over) and tells the minutes to full. */
const notePace = (now: number, percent: number): number | null => {
  const last = paceReadings[paceReadings.length - 1]

  if (last !== undefined && percent < last.percent) paceReadings = []
  const newest = paceReadings[paceReadings.length - 1]

  if (newest === undefined || percent !== newest.percent) paceReadings.push({ at: now, percent })
  paceReadings = paceReadings.filter((reading, index) => index === paceReadings.length - 1 || now - reading.at <= PACE_MINUTES * 60_000)

  return minutesToFull([...paceReadings, { at: now, percent }])
}

/** A main turn's tally as it starts: what was asked, and nothing done yet. */
const newTally = (startedAt: number, text: string): Tally => ({
  startedAt,
  text,
  edited: new Set(),
  commands: [],
  runs: 0,
  reads: 0,
  agents: 0,
  tools: {},
  skills: [],
  mcp: [],
  subagents: new Map(),
  errors: [],
  approvals: [],
  denials: [],
})

/** Counts a main-thread tool call against the turn under way. */
const noteMainTool = (tool: string, args: Readonly<Record<string, unknown>>, target: string | null): void => {
  if (tally === null) return
  const kind = toolKind(tool)
  const path = [args.file_path, args.notebook_path].find(value => typeof value === 'string')

  tally.tools = countTool(tally.tools, tool)
  if (kind === 'edit') tally.edited.add(typeof path === 'string' ? path : (target ?? tool))
  else if (kind === 'run') {
    tally.runs += 1
    const command = typeof args.command === 'string' ? clip(args.command.split('\n')[0]?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() ?? '', LOG_COMMAND_CHARS) : ''

    if (command !== '' && tally.commands.length < LOG_COMMANDS_KEPT && !tally.commands.includes(command)) tally.commands.push(command)
  } else if (kind === 'read') tally.reads += 1
  else if (kind === 'agent') tally.agents += 1
}

/** Notes a skill the Skill tool runs, or an MCP tool called, against the turn under way, whichever loop calls it. */
const noteUse = (tool: string, args: Readonly<Record<string, unknown>>): void => {
  if (tally === null) return
  const mcp = mcpNameOf(tool)

  if (tool === 'Skill' && typeof args.skill === 'string') tally.skills = withOnce(tally.skills, cleanOf(args.skill.replace(/^\//, ''), LOG_CAPS.name), LOG_CAPS.skills)
  else if (mcp !== null) tally.mcp = withOnce(tally.mcp, cleanOf(mcp, LOG_CAPS.name), LOG_CAPS.mcp)
}

/** Notes a subagent spawned while a main turn is under way, the first few, against that turn. */
const noteTurnAgent = (agentId: string, type: string, description: string, now: number): void => {
  if (tally === null || tally.subagents.has(agentId) || tally.subagents.size >= LOG_CAPS.subagents) return
  tally.subagents.set(agentId, { agent: { type: cleanOf(type, LOG_CAPS.name), description: cleanOf(description, LOG_CAPS.task), outcome: 'running', seconds: 0 }, startedAt: now })
}

/**
 * Notes how a subagent's own turn ended, in the turn under way or in the kept
 * line it was spawned in; true where that line was kept already, so that the
 * log is saved again.
 */
const noteAgentEnd = (agentId: string, outcome: Outcome, now: number): boolean => {
  const held = tally?.subagents.get(agentId) ?? pendingAgents.get(agentId)

  if (held === undefined) return false
  held.agent.outcome = outcome
  held.agent.seconds = Math.max(0, Math.round((now - held.startedAt) / 1000))

  return pendingAgents.delete(agentId)
}

/** Notes a tool call that failed against the turn under way, the first few; one the person interrupted is no failure. */
const noteFailure = (tool: string, isSubagent: boolean, error: string, isInterrupt: boolean): void => {
  if (tally === null || isInterrupt || tally.errors.length >= LOG_CAPS.errors) return
  tally.errors.push({ tool: cleanOf(tool, LOG_CAPS.name), isSubagent, text: errorLine(error, LOG_CAPS.error) })
}

/** Notes a call an approval was asked for, or one denied, in the turn under way's list of them, the first few. */
const noteCall = (calls: LogCall[] | undefined, tool: string, input: unknown): void => {
  if (calls === undefined || calls.length >= LOG_CAPS.calls) return
  const target = targetOf(typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {})

  calls.push({ tool: cleanOf(tool, LOG_CAPS.name), target: target === null ? null : cleanOf(target, LOG_CAPS.target) })
}

/**
 * Follows a file an Edit or a Write changed, whichever loop made the call: its
 * text before the latest turn that changed any (the first call's
 * `originalFile`, empty for a file the Write created) and as it stands after
 * the call, read back, so that a file changed many times makes one diff. A
 * turn's first change starts the list over; a file changed back to how it was
 * leaves it. True where the list changed.
 */
const noteChange = async ($: Engine, tool: string, args: Readonly<Record<string, unknown>>, called: unknown): Promise<boolean> => {
  const path = args.file_path
  const { result, isError, deny } = (typeof called === 'object' && called !== null ? called : {}) as { result?: unknown; isError?: boolean; deny?: string }
  const record = (typeof result === 'object' && result !== null ? result : {}) as Readonly<Record<string, unknown>>

  // A tool's own record says what the file held before; a call refused, failed or answered by a hook has none.
  if ((tool !== 'Edit' && tool !== 'Write') || typeof path !== 'string' || deny !== undefined || isError === true || !('originalFile' in record)) return false
  const owner = tally ?? changesOf

  if (owner !== changesOf) {
    changes.clear()
    changesOf = owner
  }
  const known = changes.get(path)

  if (known === undefined && changes.size >= CHANGES_KEPT) return false
  const original = record.originalFile
  const kept = (text: string | null): string | null => (text !== null && text.length <= CHANGE_TEXT_MAX ? text : null)
  const before = known !== undefined ? known.before : kept(tool === 'Write' && record.type === 'create' ? '' : typeof original === 'string' ? original : null)
  const [after, cwd] = await Promise.all([$.fs.read(path).then(text => kept(String(text)), () => null), $.session.cwd().catch(() => '')])
  const counts = before === null || after === null ? null : diffCounts(lineDiff(linesOf(before), linesOf(after)))

  if (counts !== null && counts.added === 0 && counts.removed === 0) return changes.delete(path)
  changeCount += 1
  changes.set(path, { path, name: pathIn(path, cwd), before, after, added: counts?.added ?? null, removed: counts?.removed ?? null, version: changeCount })

  return true
}

/** The diff a changed file is drawn with, worked out once for each version of it and each way of showing it; null where it was too large to compare. */
const diffShown = (change: Change, isWhole: boolean): ReturnType<typeof diffOf> | null => {
  if (change.before === null || change.after === null) return null
  const key = `${change.version}:${isWhole}`

  if (diffDrawn?.key === key) return diffDrawn.diff
  const diff = diffOf(change.before, change.after, isWhole, DIFF_CHARS)

  diffDrawn = { key, diff }

  return diff
}

type Usage4 = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

/**
 * Closes the turn under way into one line of the log. A subagent of it still
 * running ends as the subagent list last saw it, or, where that has not seen it
 * end, stays `running` until its own turn ends and is written into the line then.
 */
const closeTally = (seconds: number, outcome: LogEntry['outcome'], usage: Usage4 | undefined, at: number, rows: readonly AgentRow[]): void => {
  if (tally === null) return
  for (const [id, held] of tally.subagents) {
    if (held.agent.outcome !== 'running') continue
    const row = rows.find(one => one.id === id)

    if (row !== undefined && isEnded(row.state)) {
      held.agent.outcome = row.state === 'done' ? 'answer' : 'error'
      held.agent.seconds = row.seconds
      continue
    }
    held.agent.seconds = Math.max(0, Math.round((at - held.startedAt) / 1000))
    pendingAgents.set(id, held)
  }
  // The oldest waited on go first.
  for (const id of pendingAgents.keys()) if (pendingAgents.size > PENDING_AGENTS) pendingAgents.delete(id)
  workLog.push({
    endedAt: at,
    seconds,
    outcome,
    text: tally.text,
    edits: tally.edited.size,
    runs: tally.runs,
    reads: tally.reads,
    agents: tally.agents,
    out: usage?.output_tokens ?? null,
    cacheHit: usage === undefined ? null : cacheHitOf(usage),
    files: [...tally.edited].slice(0, LOG_FILES_KEPT).map(path => cleanOf(baseName(path), LOG_CAPS.file)),
    commands: [...tally.commands],
    tools: tally.tools,
    skills: tally.skills,
    mcp: tally.mcp,
    subagents: [...tally.subagents.values()].map(held => held.agent),
    errors: tally.errors,
    approvals: tally.approvals,
    denials: tally.denials,
  })
  if (logTurns > 0 && workLog.length > logTurns) workLog.splice(0, workLog.length - logTurns)
  tally = null
  current = null
}

/**
 * Takes up what is kept for the session in view (its log, color, tasks and totals)
 * whenever its id is not the one the log in memory belongs to: its newest file,
 * then its sealed ones, newest first, as far as `logTurns` reaches.
 */
const syncLog = async ($: Engine): Promise<void> => {
  const id = await $.session.id()

  if (id === logSession) return
  logSession = id
  sealedTexts.clear()
  // Another session in view (`/clear`, one taken up) has changed nothing yet.
  changes.clear()
  changesOf = null
  const folder = await keptFolder($)
  const head = folder === null ? undefined : await readKept($, `${folder}/${id}.json`)
  const record = (typeof head === 'object' && head !== null ? head : {}) as { color?: unknown; tasks?: unknown; totals?: unknown; sealed?: unknown }
  const sealed = typeof record.sealed === 'number' && Number.isInteger(record.sealed) && record.sealed > 0 ? record.sealed : 0
  const newest = logFrom(head, Infinity)
  const parts: { part: number; entries: LogEntry[] }[] = []
  let lines = newest.length

  for (let part = sealed; part >= 1 && folder !== null && (logTurns === 0 || lines < logTurns); part -= 1) {
    const entries = logFrom(await readKept($, `${folder}/${id}.${part}.json`), Infinity)

    parts.unshift({ part, entries })
    lines += entries.length
  }
  workLog.splice(0, workLog.length, ...logFrom({ entries: [...parts.flatMap(one => one.entries), ...newest] }, logTurns === 0 ? Infinity : logTurns))
  // A sealed file read back as it would be written is not written again.
  for (const { part, entries } of parts) {
    const text = partText(workLog, part, LOG_PART)

    if (text === JSON.stringify({ entries })) sealedTexts.set(part, text)
  }
  // A subagent still running is written into the line of the session it was spawned in, not of this one.
  pendingAgents.clear()
  sessionColor = sessionColorOf(record.color)
  tasks = tasksFrom(record.tasks)
  totals = totalsFrom(record.totals)
}

/**
 * Keeps the session's log, color, tasks and totals in its files (the sealed
 * ones that changed, then its newest), and lets go of the files of sessions
 * past the newest `logSessions` or saved over `logDays` ago, and of its own
 * sealed ones it has no longer. A file that cannot be written stays as it was,
 * the log in memory whole; nothing throws. Saved as the session ends, it lets
 * go of nothing: that is left to the next save, so the exit stays quick.
 */
const saveLog = async ($: Engine, isSweeping = true): Promise<void> => {
  if (logSession === undefined) return
  const session = logSession
  const folder = await keptFolder($)

  if (folder === null) return
  const now = await $.clock.now()
  const sealed = sealedOf(workLog.length, LOG_PART)

  for (let part = 1; part <= sealed; part += 1) {
    const text = partText(workLog, part, LOG_PART)

    if (sealedTexts.get(part) === text) continue
    if (await $.fs.write(`${folder}/${session}.${part}.json`, text).then(() => true, () => false)) sealedTexts.set(part, text)
  }
  for (const part of sealedTexts.keys()) if (part > sealed) sealedTexts.delete(part)
  await $.fs.write(`${folder}/${session}.json`, JSON.stringify({ savedAt: now, color: sessionColor, tasks, totals, sealed, entries: workLog.slice(sealed * LOG_PART) })).catch(() => undefined)
  if (!isSweeping) return
  const listed = await $.fs.list(folder).catch((): FsEntry[] => [])

  await removeKept($, folder, sweepOf(listed, session, sealed, now, logSessions, logDays))
}

/** A kept file's JSON, or undefined where it is missing, empty or not JSON. */
const readKept = async ($: Engine, path: string): Promise<unknown> =>
  $.fs
    .read(path)
    .then(text => JSON.parse(String(text)) as unknown)
    .catch(() => undefined)

/**
 * Removes kept files of `folder`, REMOVE_BATCH at a time. Where they cannot be
 * removed (no rm, or no process at all, as in the desktop app), each is emptied
 * instead: what it held is gone, and a later save finds it again to remove.
 */
const removeKept = async ($: Engine, folder: string, files: readonly Pick<FsEntry, 'name' | 'size'>[]): Promise<void> => {
  for (let at = 0; at < files.length; at += REMOVE_BATCH) {
    const batch = files.slice(at, at + REMOVE_BATCH)
    const ran = await $.process.run([REMOVER, '-f', '--', ...batch.map(file => `${folder}/${file.name}`)], { timeoutMs: 10_000 }).catch(() => ({ exitCode: -1 }))

    if (ran.exitCode === 0) continue
    for (const file of batch) if (file.size > 0) await $.fs.write(`${folder}/${file.name}`, '').catch(() => undefined)
  }
}

/** Pages the pane's log by `delta` lines, kept within the lines there are. */
const pageLog = async ($: Engine, delta: number, total: number): Promise<void> => {
  const last = Math.max(0, total - LOG_ROWS)

  await update($, logOffset, at => Math.min(last, Math.max(0, at + delta)))
}

/** The words the log is searched for, and the lines it shows: every one with none, else those that have them all. */
const foundLog = async <Entry extends LogEntry>($: Engine, log: readonly Entry[]): Promise<{ query: string; found: readonly Entry[] }> => {
  const query = await read($, logQuery)

  return { query, found: query.trim() === '' ? log : log.filter(entry => logMatches(entry, query)) }
}

/** Searches the log for other words, from the newest line found; empty words show every line again. */
const findLog = async ($: Engine, query: string): Promise<void> => {
  if ((await read($, logQuery)) === query) return
  await update($, logQuery, () => query)
  await update($, logOffset, () => 0)
}

/**
 * Opens a log line to its detail, or closes it when it is the one open, and
 * scrolls the pane so the detail shows; where the engine has not drawn it yet,
 * the line itself goes to the top, its detail under it.
 */
const toggleLog = async ($: Engine, endedAt: number, rowKey: string): Promise<void> => {
  const isOpening = (await read($, logOpen)) !== endedAt

  await update($, logOpen, () => (isOpening ? endedAt : null))
  if (!isOpening) return
  const moved = await $.ui.scroll({ in: PANE, to: { key: LOG_DETAIL_KEY } }).catch((error: unknown) => ({ deny: String(error) }))

  if (moved.deny !== undefined) await $.ui.scroll({ in: PANE, to: { key: rowKey }, block: 'start' }).catch(() => undefined)
}

/** Puts a log line's prompt on the clipboard of the surface pressed on. */
const copyPrompt = async ($: Engine, text: string, surface: RenderSurface): Promise<void> => {
  await $.ui.copy({ text, surface })
}

/** Shows a changed file's diff over the whole pane, its changes alone or its whole text, from the top. */
const openDiff = async ($: Engine, path: string, isWhole: boolean): Promise<void> => {
  await update($, diffOpen, () => ({ path, isWhole }))
  await $.ui.scroll({ in: PANE, to: 'start' }).catch(() => undefined)
}

/** Goes back from a diff to the cards, the changes card in view. */
const closeDiff = async ($: Engine): Promise<void> => {
  await update($, diffOpen, () => null)
  await $.ui.scroll({ in: PANE, to: { key: CHANGES_KEY } }).catch(() => undefined)
}

/** The plugin's data folder, which the logs are kept in and written to, or null where no variable says where home is. */
const dataFolder = async ($: Engine): Promise<string | null> => {
  const [data, config, home] = await Promise.all([
    $.env.get('CLAUDE_PLUGIN_DATA').catch(() => undefined),
    $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined),
    $.env.get('HOME').catch(() => undefined),
  ])

  if (data !== undefined && isOwnData(data)) return data
  const base = (config ?? '') !== '' ? config : (home ?? '') !== '' ? `${home}/.claude` : null

  return base === null || base === undefined ? null : `${base}/${DATA_FOLDER}`
}

/** The folder the logs are kept in, or null with no data folder. */
const keptFolder = async ($: Engine): Promise<string | null> => {
  const data = await dataFolder($)

  return data === null ? null : `${data}/${KEPT_FOLDER}`
}

/**
 * Writes the session's log as a Markdown file and opens it with the system's
 * app for it: the one program the mod runs, and only on this press.
 */
const openLogFile = async ($: Engine): Promise<void> => {
  await syncLog($).catch(() => undefined)
  const data = await dataFolder($)

  if (logSession === undefined || data === null) return
  const path = `${data}/logs/${logSession}.md`
  const text = logMarkdown(workLog, { title: sessionTitle, project: slow?.project ?? '', branch: slow?.branch ?? null, session: logSession, savedAt: await $.clock.now() })
  const isWritten = await $.fs.write(path, text).then(
    () => true,
    () => false,
  )

  if (!isWritten) return
  // The first opener that runs opens it; where none does, the file is written all the same.
  for (const opener of OPENERS) {
    const ran = await $.process.run([opener, path], { timeoutMs: 10_000 }).catch(() => ({ exitCode: -1 }))

    if (ran.exitCode === 0) return
  }
}

/**
 * Follows Claude's tasks through a tool call that went through: a TodoWrite
 * list replaces them all, a TaskUpdate changes one (or takes it off), and a
 * TaskCreate gives the task its event made its active form.
 */
const noteTaskCall = (tool: string, args: Readonly<Record<string, unknown>>): boolean => {
  const before = tasks

  if (tool === 'TodoWrite') tasks = tasksOfTodos(args.todos) ?? tasks
  else if (tool === 'TaskUpdate') tasks = updateTask(tasks, args)
  else if (tool === 'TaskCreate' && typeof args.activeForm === 'string') {
    const made = [...tasks].reverse().find(task => task.subject === args.subject && task.activeForm === null)

    if (made !== undefined) tasks = updateTask(tasks, { taskId: made.id, activeForm: args.activeForm })
  }

  return tasks !== before
}

/** Takes what a command's row says of the session: the name `/rename` gave it, the color `/color` set. */
const noteCommandRow = async ($: Engine, text: string): Promise<boolean> => {
  const name = renameSaid(text)
  const color = colorSaid(text)

  if (name !== null) sessionTitle = name
  if (color !== null) {
    // Taken up first, so that a session the log has not met yet does not bring its kept color over this one.
    await syncLog($).catch(() => undefined)
    sessionColor = color === 'default' ? null : color
    await saveLog($).catch(() => undefined)
  }

  return name !== null || color !== null
}

/**
 * Raises an alert in place of any of its kind, shown only in the line under an
 * open approval dialog. Nothing calls the person away from the screen (no toast,
 * no sound): the engine's dialogs and warnings, and a terminal's own
 * notifications, already do. Nothing while the `alerts` setting is off.
 */
const raiseAlert = ($: Engine, alert: Alert): void => {
  if (!isAlerting) return
  alerts = [...alerts.filter(one => one.kind !== alert.kind), alert]
  // Another alert raised while a dialog is up shows under it too.
  if (alert.kind !== 'approval') noteDialog($, alert.at)
}

/**
 * The line pane-mod puts under an open approval dialog, which the dialog itself
 * does not say: since when the call has waited, and the other alerts standing.
 */
const noticeFor = (approval: Alert, now: number): string =>
  [`pane-mod · waiting since ${clockOf(approval.at)}`, ...standing(alerts, now).filter(alert => alert !== approval).map(alert => `${ALERT_MARK[alert.kind]} ${alert.text}`)].join(' · ')

/**
 * Puts that line under the approval dialog open for the call an approval alert
 * waits on. The engine refuses it for a call with no dialog open and takes it
 * off when the call resolves; a refusal says nothing back, so callers simply
 * call again at the next moment the dialog is surely up.
 */
const noteDialog = ($: Engine, now: number): void => {
  const approval = alerts.find(alert => alert.kind === 'approval' && alert.ref !== null)

  if (approval?.ref === null || approval === undefined) return
  try {
    $.ui.notice(approval.ref, noticeFor(approval, now))
  } catch {
    // No dialog open for it: nothing to add to.
  }
}

/** Lets go of the alerts that match. */
const dropAlerts = (isGone: (alert: Alert) => boolean): void => {
  alerts = alerts.filter(alert => !isGone(alert))
}

/** Lets go of the alerts of these kinds. */
const clearAlerts = ($: Engine, ...kinds: AlertKind[]): void => dropAlerts(alert => kinds.includes(alert.kind))

/** Lets go of the alerts waiting on this call or dialog: it has run, or ended. */
const settleAlerts = ($: Engine, ref: string): void => dropAlerts(alert => alert.ref === ref)

/**
 * Raises a limit alert where the context or the 5h window reaches one of the
 * marks (told once until it falls back under), or where at the present pace the
 * 5h window fills before it resets (told again no sooner than half an hour).
 * It is named in the line under an approval dialog while it stands.
 */
const noteLimits = ($: Engine, fast: Fast, now: number): void => {
  const five = fast.limits.find(limit => limit.kind === 'five_hour')
  const context = markReached(fast.contextPercent, ALERT_MARKS, toldContext)
  const window = markReached(five?.percentUsed ?? null, ALERT_MARKS, toldFive)
  const linger = { at: now, until: now + ALERT_LINGER_MS, ref: null }

  toldContext = context.told
  toldFive = window.told
  if (context.reached !== null) raiseAlert($, { kind: 'limit', text: `context ${fast.contextPercent}%`, ...linger })
  else if (window.reached !== null) {
    raiseAlert($, { kind: 'limit', text: `5h ${five?.percentUsed}%${five?.resetsIn === null || five?.resetsIn === undefined ? '' : ` · resets in ${five.resetsIn}`}`, ...linger })
  } else if (fast.forecast !== null && now - paceToldAt >= PACE_RETELL_MS) {
    paceToldAt = now
    raiseAlert($, { kind: 'limit', text: `5h limit in ~${elapsed(fast.forecast)} at this pace`, ...linger })
  }
}

/** Reads the fast figures every time and the slow ones when they are due or `isFull` asks. */
const refresh = async ($: Engine, isFull = false): Promise<void> => {
  const now = await $.clock.now()

  await syncLog($).catch(() => undefined)

  if (slow === null || isFull || now - slowAt >= SLOW_MS) {
    slow = await gatherSlow($)
    slowAt = now
  }
  const fast = await gatherFast($)

  noteLimits($, fast, now)
  dropAlerts(alert => alert.until !== null && alert.until <= now)
  const next: Snapshot = { ...slow, ...fast, mode, style, title: sessionTitle, color: sessionColor }

  if (JSON.stringify(next) !== JSON.stringify(await read($, snap))) await update($, snap, () => next)
}

/**
 * Whether frames go as bytes. A terminal that reads this machine's files itself
 * (Ghostty, kitty) is handed the path, and the pixels never cross `$`. Any other
 * is sent the PNG: a terminal drawn inside an app may show a picture sent to it
 * to it but cannot open a path, and the engine then draws the `alt` instead.
 */
const sendsBytes = async ($: Engine): Promise<boolean> => {
  if (spriteSource !== 'auto') return spriteSource === 'bytes'
  if (isBytes !== undefined) return isBytes
  const [program, ghostty, kitty] = await Promise.all([
    $.env.get('TERM_PROGRAM').catch(() => undefined),
    $.env.get('GHOSTTY_RESOURCES_DIR').catch(() => undefined),
    $.env.get('KITTY_WINDOW_ID').catch(() => undefined),
  ])
  const readsFiles = program === 'ghostty' || program === 'kitty' || (ghostty ?? '') !== '' || (kitty ?? '') !== ''

  isBytes = !readsFiles

  return isBytes
}

/**
 * Finds the folders the settings name, or the mod's own `assets/`, and the
 * frames each motion's folder holds. A folder that is missing or holds no PNG
 * gives none: a motion with none borrows another's, and with none anywhere the
 * sprite is left out. The clips are listed when a state first plays one.
 */
const findAssets = async ($: Engine): Promise<void> => {
  const home = await $.env.get('HOME').catch(() => undefined)
  const spriteFolder = folderOf(spriteSetting, home)
  const soundFolder = folderOf(soundSetting, home)

  spriteRoot = spriteFolder ?? `${$.plugin.root}/${OWN_FRAMES}`
  soundRoot = soundFolder ?? `${$.plugin.root}/${OWN_SOUNDS}`
  isOwnSounds = soundFolder === null
  sounds.clear()
  const [working, idle, complete] = await Promise.all([
    $.fs.list(`${spriteRoot}/working`).catch(() => []),
    $.fs.list(`${spriteRoot}/idle`).catch(() => []),
    $.fs.list(`${spriteRoot}/complete`).catch(() => []),
  ])

  frames = { working: spriteFrames('working', working), idle: spriteFrames('idle', idle), complete: spriteFrames('complete', complete) }
}

/**
 * The source of a motion's frame: its path, or its PNG read once and kept;
 * none where no frame is left. A frame that cannot be read is left out from
 * then on, and the next one is tried in its place.
 */
const sourceOf = async ($: Engine, at: Motion, index: number): Promise<ImageSource | undefined> => {
  const file = frameAt(framesFor(at, frames), index)

  if (file === undefined) return undefined
  const path = `${spriteRoot}/${file}`

  if (!(await sendsBytes($))) return { file: path, format: 'png' }
  const kept = pngs.get(path) ?? (await $.fs.read(path, { as: 'bytes' }).catch(() => undefined))?.base64

  if (kept === undefined) {
    frames = withoutFrame(frames, file)

    return sourceOf($, at, index)
  }
  pngs.set(path, kept)

  return { png: kept }
}

/** A blit refused because the terminal cannot open the frame's path. */
const UNREADABLE = /cannot read/i
/** A blit refused because the terminal draws no pictures where text flows (no Unicode placeholders), or draws the `alt`. */
const NO_PICTURE = /placeholder|\balt\b/i

/** Shows frame `index` of the current motion: swapped in place where the band holds the sprite, redrawn where it cannot be. */
const showFrame = async ($: Engine, index: number): Promise<void> => {
  shown = index
  const site = spriteAt

  if (site === undefined) return
  const source = await sourceOf($, motion, shown)

  // No frame is left to show: the next drawing leaves the sprite and its margins out.
  if (source === undefined) {
    $.ui.invalidate('ui.render')

    return
  }
  const swapped = await $.ui.blit({ requestId: site, key: SPRITE_KEY, source }).catch((error: unknown) => ({ deny: String(error) }))

  if (swapped.deny === undefined) return
  // The engine drew the `alt` in the picture's place. A path the terminal cannot read is
  // sent as data from now on; a terminal with no placeholder images (Orca's xterm.js)
  // cannot show it either way, so the sprite and its margins leave the band.
  if (UNREADABLE.test(swapped.deny) && spriteSource === 'auto' && isBytes !== true) isBytes = true
  else if (UNREADABLE.test(swapped.deny) || NO_PICTURE.test(swapped.deny)) isSpriteBlocked = true
  await update($, frame, () => shown)
}

/** Switches the motion from its first frame; the cheer gives way to idle once it has stood its time. */
const setMotion = ($: Engine, next: Motion): void => {
  if (motion === next) return
  motion = next
  rester?.cancel()
  rester = next === 'complete' ? $.clock.after(COMPLETE_MS, () => setMotion($, 'idle')) : undefined
  void showFrame($, 0).catch(() => undefined)
  void playFor($, next).catch(() => undefined)
}

/** The clips of a state: the audio files in its folder under the sound folder, listed once; none where the folder is missing. */
const soundsOf = async ($: Engine, at: Motion): Promise<string[]> => {
  const kept = sounds.get(at)

  if (kept !== undefined) return kept
  const found = soundFiles(at, await $.fs.list(`${soundRoot}/${at}`).catch(() => []))

  sounds.set(at, found)

  return found
}

/** A clip as the engine plays it: one of the mod's own by its path in the plugin, any other read once and sent as its bytes. */
const clipOf = async ($: Engine, file: string): Promise<AudioClip> => {
  if (isOwnSounds) return { asset: `${OWN_SOUNDS}/${file}` }
  const path = `${soundRoot}/${file}`
  const kept = clipBytes.get(path) ?? (await $.fs.read(path, { as: 'bytes' })).base64

  clipBytes.set(path, kept)

  return { base64: kept, mime: audioMime(file) }
}

/** Leaves a clip that could not be read or played out of its state's clips: it is not picked again. */
const dropClip = (at: Motion, file: string): void => {
  sounds.set(at, (sounds.get(at) ?? []).filter(one => one !== file))
}

/** Stops the clip playing now. */
let playing: AbortController | undefined

/**
 * Plays one of a state's clips, picked at random, as the sprite enters that
 * state: one at a time, since the engine plays clips together rather than one
 * after another, so a new clip stops the one still playing.
 */
const playFor = async ($: Engine, at: Motion): Promise<void> => {
  if (!isSoundOn) return
  const clips = await soundsOf($, at)
  const file = clips[Math.floor(Math.random() * clips.length)]

  // A state with no clip plays nothing.
  if (file === undefined) return
  const clip = await clipOf($, file).catch(() => undefined)

  if (clip === undefined) return dropClip(at, file)
  const stop = new AbortController()

  playing?.abort()
  playing = stop
  await $.audio.play(clip, { signal: stop.signal }).catch(() => dropClip(at, file))
}

/** The sprite always moves: one beat steps whichever motion it is in (held still only where `animate` is off). */
const startPlayer = ($: Engine): void => {
  player ??= $.clock.every(FRAME_MS, () => {
    if (isAnimated) void showFrame($, nextFrame(motion, shown, framesFor(motion, frames).length)).catch(() => undefined)
  })
}

/** A row's text blocks, joined. */
const textOf = (content: readonly { type: string; text?: string }[]): string =>
  content.map(block => (block.type === 'text' ? (block.text ?? '') : '')).join('\n')

/** Notes a subagent's tool call against its row. */
const noteTool = async ($: Engine, agentId: string, tool: string): Promise<void> => {
  const entry = seen.get(agentId) ?? { startedAt: await $.clock.now(), endedAt: null, idleAt: null, tools: 0, tool: null }

  seen.set(agentId, { ...entry, tools: entry.tools + 1, tool })
}

/** Notes when a subagent started, from its spawn rather than from the first list that shows it. */
const noteSpawn = async ($: Engine, agentId: string): Promise<void> => {
  if (!seen.has(agentId)) seen.set(agentId, { startedAt: await $.clock.now(), endedAt: null, idleAt: null, tools: 0, tool: null })
}

/** Whether the HUD wants the side pane now. */
const wantsPane = (): boolean => !isPaneDismissed && (layout === 'pane' || (layout === 'auto' && isFullscreen))

const openPane = async ($: Engine): Promise<void> => {
  paneState = 'open'
  await $.ui.open({ id: PANE, title: PANE, closeOnEscape: true, columns: PANE_COLUMNS })
}

const closePane = async ($: Engine): Promise<void> => {
  paneState = 'closed'
  panePlacement = null
  if (spriteAt === PANE) spriteAt = undefined
  await $.ui.close({ id: PANE })
}

/** Whether the pane is seated and is the one shown: it holds the HUD, so the band draws one row or none. */
const isPaneShown = async ($: Engine): Promise<boolean> =>
  paneState === 'open' && panePlacement !== null && (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced && pane.isShown)

/** Applies a layout chosen with `/pane-mod`: the pane opens or closes to suit it at once. */
const applyLayout = async ($: Engine, next: Layout): Promise<string> => {
  layout = next
  isPaneDismissed = false
  if (wantsPane() && paneState === 'closed') await openPane($)
  else if (!wantsPane() && paneState === 'open') await closePane($)
  $.ui.invalidate('ui.render')

  if (next === 'auto') return 'auto: the side pane where the screen docks one, the band elsewhere.'

  return next === 'hint' ? 'hint: the HUD in one line after the hint under the prompt; /pane-mod opens the pane.' : `${next} only.`
}

export const register: Register = (on, options) => {
  isAnimated = options.animate !== false
  isAlerting = options.alerts !== false
  isSpriteWanted = options.sprite !== false
  isSoundOn = options.sound !== false
  layout = LAYOUTS.find(one => one === options.layout) ?? 'auto'
  bandWithPane = options.bandWithPane === 'line' ? 'line' : 'off'
  spriteSource = options.spriteSource === 'file' || options.spriteSource === 'bytes' ? options.spriteSource : 'auto'
  spriteSetting = options.spriteDir
  soundSetting = options.soundDir
  agentsShown = options.agents === 'list' || options.agents === 'off' ? options.agents : 'summary'
  logTurns = limitSetting(options.logTurns, LOG_KEPT, LOG_KEPT_MIN)
  logSessions = limitSetting(options.logSessions, LOG_SESSIONS_KEPT, 1)
  logDays = limitSetting(options.logDays, LOG_DAYS_KEPT, 1)
  // Each section is on unless its setting turns it off; the context's is off unless turned on.
  sections = {
    session: options.showSession !== false,
    now: options.showNow !== false,
    tasks: options.showTasks !== false,
    model: options.showModel !== false,
    usage: options.showUsage !== false,
    totals: options.showTotals !== false,
    context: options.showContext === true,
    recent: options.showRecent !== false,
    changes: options.showChanges !== false,
    log: options.showLog !== false,
  }
  // A mistyped order, color or step falls back to its default, so no setting can get a drawing refused.
  paneOrder = paneOrderOf(options.paneOrder)
  sessionBorder = colorOf(options.sessionColor, null)
  modelBorder = colorOf(options.modelColor, MODEL_CARD)
  cardBorder = colorOf(options.cardColor, CARD)
  barGlyphs = { filled: barGlyphOf(options.barFilled, BAR_GLYPHS.filled), empty: barGlyphOf(options.barEmpty, BAR_GLYPHS.empty) }

  on('session.start', async ($, e, next) => {
    await findAssets($).catch(() => undefined)
    refresher?.cancel()
    refresher = $.clock.every(FAST_MS, () => void refresh($).catch(() => undefined))
    startPlayer($)
    await refresh($, true).catch(() => undefined)
    await $.command.register({ name: 'pane-mod', description: 'Open the side pane, or set the layout (auto, band, pane, hint)', argumentHint: '[auto|band|pane|hint]', immediate: true }).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // The output style is what the system prompt is composed with.
  on('prompt.compose', async ($, e, next) => {
    style = e.outputStyle?.name ?? null

    return next(e)
  }).catch(($, e, next) => next(e))

  // The permission mode reaches plugins on the settings hooks' own input, and so does the name the session was given
  // (`/rename`'s, never the title the engine writes for it).
  on('classic.UserPromptSubmit', async ($, e, next) => {
    mode = e.permission_mode ?? mode
    sessionTitle = e.session_title?.trim() || null

    return next(e)
  }).catch(($, e, next) => next(e))

  // An approval dialog opens for a call no settings hook decided: the call it holds is the newest of its tool under way,
  // in its loop where that is known, and the alert waits on it. The turn's log line notes it, alerts on or off.
  on('classic.PermissionRequest', async ($, e, next) => {
    const answered = await next(e)
    const isDecided = (answered as { hookSpecificOutput?: { decision?: unknown } } | undefined)?.hookSpecificOutput?.decision !== undefined

    if (!isDecided) {
      noteCall(tally?.approvals, e.tool_name, e.tool_input)
      const calls = [...inFlight].reverse().filter(([, call]) => call.tool === e.tool_name)
      const ref = (calls.find(([, call]) => call.agentId === e.agent_id) ?? calls[0])?.[0] ?? null
      const target = targetOf(typeof e.tool_input === 'object' && e.tool_input !== null ? (e.tool_input as Record<string, unknown>) : {})

      raiseAlert($, {
        kind: 'approval',
        text: `approval needed · ${e.tool_name}${target === null ? '' : ` ${target}`}${e.agent_id === undefined ? '' : ' · subagent'}`,
        at: await $.clock.now(),
        until: null,
       
        ref,
      })
      noteDialog($, await $.clock.now())
    }

    return answered
  }).catch(($, e, next) => next(e))

  // The engine's own notice of an approval still open after a few seconds (taken here only where no dialog was seen
  // opening).
  on('classic.Notification', async ($, e, next) => {
    const now = await $.clock.now()

    if (e.notification_type === 'permission_prompt' && !alerts.some(alert => alert.kind === 'approval')) {
      raiseAlert($, { kind: 'approval', text: oneLine(e.message, 120), at: now, until: null, ref: null })
    }
    // A few seconds into an open approval the dialog is surely drawn: the line under it goes again.
    if (e.notification_type === 'permission_prompt') noteDialog($, now)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A call that ran, failed or was refused no longer waits on an approval. One that failed, or was denied, is noted in
  // the turn's log line.
  on('classic.PostToolUse', async ($, e, next) => {
    settleAlerts($, e.tool_use_id)

    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.PostToolUseFailure', async ($, e, next) => {
    settleAlerts($, e.tool_use_id)
    noteFailure(e.tool_name, e.agent_id !== undefined, e.error, e.is_interrupt === true)

    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.PermissionDenied', async ($, e, next) => {
    settleAlerts($, e.tool_use_id)
    noteCall(tally?.denials, e.tool_name, e.tool_input)

    return next(e)
  }).catch(($, e, next) => next(e))

  // Claude's task tools say when a task is made (its id is the event's alone) and when one is done.
  on('classic.TaskCreated', async ($, e, next) => {
    if (!tasks.some(task => task.id === e.task_id)) tasks = [...tasks, { id: e.task_id, subject: e.task_subject, status: 'pending', activeForm: null }]
    void refresh($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.TaskCompleted', async ($, e, next) => {
    tasks = updateTask(tasks, { taskId: e.task_id, status: 'completed' })
    void refresh($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A long command's "run in background" hint shows once it runs: an approval it waited on was given.
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    settleAlerts($, e.props.tool_use_id)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A session started, taken up again (-c, --resume) or cleared says its name before any prompt does.
  on('classic.SessionStart', async ($, e, next) => {
    sessionTitle = e.session_title?.trim() || null
    void refresh($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // The sprite focuses on a model turn: a typed prompt's, a skill's or a continuation's. A slash command that starts
  // none (/effort, /reload-plugins) never reaches here, so it leaves the sprite idle.
  on('turn.start', async ($, e, next) => {
    const started = await next(e)

    liveTurns.add(started.turnId)
    // The first turn to start while none is tallied is the main one; what it was asked heads its log line.
    if (tally === null) tally = newTally(await $.clock.now(), promptOf(e.text, LOG_TEXT_KEPT) || '(continued)')
    setMotion($, 'working')

    return started
  }).catch(($, e, next) => next(e))

  // A subagent spawned while a main turn runs is noted in that turn's log line, whichever loop spawned it.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)

    if (started.agentId !== undefined) {
      noteTurnAgent(started.agentId, e.subagentType, e.description, await $.clock.now())
      await noteSpawn($, started.agentId).catch(() => undefined)
      await refresh($).catch(() => undefined)
    }

    return started
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    // Every call under way is known by id while it runs, so that an approval it waits on can be told; its end lets go
    // of what waited on it.
    inFlight.set(e.tool_use_id, { tool: e.tool, agentId: e.agentId })
    const args = e as unknown as Readonly<Record<string, unknown>>

    // A skill run or an MCP tool called counts for the turn under way, whichever loop calls it.
    noteUse(e.tool, args)
    // A task call that went through moves the task list, and a file changed joins the changed files, whichever loop
    // made it.
    const done = async <T,>(result: T): Promise<T> => {
      const isChanged = await noteChange($, e.tool, args, result).catch(() => false)

      if (noteTaskCall(e.tool, args) || isChanged) void refresh($).catch(() => undefined)

      return result
    }

    try {
      if (e.agentId !== undefined) {
        await noteTool($, e.agentId, e.tool).catch(() => undefined)

        return await done(await next(e))
      }
      // The main thread's call: shown as what it is doing now, and counted against the turn.
      const call = { tool: e.tool, target: targetOf(args), since: await $.clock.now() }

      current = call
      noteMainTool(e.tool, args, call.target)
      try {
        return await done(await next(e))
      } finally {
        if (current === call) current = null
      }
    } finally {
      inFlight.delete(e.tool_use_id)
      settleAlerts($, e.tool_use_id)
    }
  }).catch(($, e, next) => next(e))

  // Every request of the main thread says the level it goes out with: the engine's own word, over any guess.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && e.effort !== undefined) effortSeen = { model: e.model, value: e.effort }

    return yield* next(e)
  })

  // `/effort` prints the level it set as a row of the transcript (its command result carries no text when picked from
  // the menu). `max` is saved nowhere, so that row is the only word on it until the next request; a word that is no
  // level (a reset to the default) hands the level back to the settings. `/rename` and `/color` print theirs the same
  // way: the name shows at once, and the color, which no hook's input carries, is kept with the session's log.
  on('session.append', { door: 'command' }, async ($, e, next) => {
    const appended = await next(e)

    if (e.agentId !== undefined || appended.deny !== undefined) return appended
    const text = textOf(e.message.content)
    const said = effortSaid(text)

    if (said !== null) effortSeen = said === 'other' ? undefined : { model: await $.session.model().catch(() => ''), value: said }
    if ((await noteCommandRow($, text)) || said !== null) void refresh($, true).catch(() => undefined)

    return appended
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    // While the cheer is off every turn ends idle; with it on, only an answered one is cheered first.
    liveTurns.delete(e.turnId)
    // Every turn's usage, a subagent's too, counts toward the session's totals.
    if (e.usage !== undefined) totals = addUsage(totals, e.usage)
    // A subagent's end completes the log line it was spawned in; a line kept already is saved again.
    if (e.agentId !== undefined && noteAgentEnd(e.agentId, e.reason, await $.clock.now())) await saveLog($).catch(() => undefined)
    if (e.agentId === undefined) {
      const now = await $.clock.now()

      // The main turn is over: no approval it held waits on the person any longer.
      clearAlerts($, 'approval')
      if (tally !== null) {
        await syncLog($).catch(() => undefined)
        closeTally(Math.round(e.durationMs / 1000), e.reason, e.usage, now, (await read($, snap))?.agents ?? [])
        await saveLog($).catch(() => undefined)
      }
    }
    if (e.agentId === undefined && liveTurns.size === 0) setMotion($, IS_CHEERING && e.reason === 'answer' ? 'complete' : 'idle')
    await refresh($, e.agentId === undefined).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A session that ends while a main turn runs (its terminal closed, its process signalled) may see no
  // `turn.complete`: the turn is kept as a stopped line, timed to the end. One whose end came is kept already.
  on('session.end', async ($, e, next) => {
    if (tally !== null) {
      const { startedAt } = tally
      const now = await $.clock.now()

      await syncLog($).catch(() => undefined)
      closeTally(Math.max(0, Math.round((now - startedAt) / 1000)), 'aborted', undefined, now, (await read($, snap))?.agents ?? [])
      await saveLog($, false).catch(() => undefined)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'pane-mod' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase()
    const chosen = LAYOUTS.find(one => one === asked)

    if (chosen !== undefined) return { text: await applyLayout($, chosen) }
    if (asked !== '') return { text: `Unknown layout "${asked}". Use auto, band, pane or hint.` }
    // Asked by the person, the pane is seated at any width; one they closed opens again.
    isPaneDismissed = false
    await openPane($)

    return { text: 'Opened the side pane.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    paneState = 'closed'
    panePlacement = null
    if (spriteAt === PANE) spriteAt = undefined
    if (e.origin.kind === 'person') isPaneDismissed = true

    return next(e)
  }).catch(($, e, next) => next(e))

  // In hint, the HUD is one dim line after the engine's hint under the prompt, while the pane does not hold it.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (layout !== 'hint' || e.surface !== 'terminal') return next(e)
    const shot = await read($, snap)

    if (shot === null || (await isPaneShown($).catch(() => false))) return next(e)

    return next({ ...e, props: { ...e.props, tail: `${SEP}${hintTail(shot)}` } })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    const shot = await read($, snap)

    if (shot === null) return next(e)
    startPlayer($)
    // A working motion no turn holds (one whose end never came) goes back to idle once the band says nothing is at work.
    if (!e.props.isWorking && motion === 'working' && liveTurns.size === 0) setMotion($, 'idle')

    // The pane follows the screen: opened where it docks, closed where it would only sit above the prompt.
    isFullscreen = e.viewport?.isFullscreen === true
    if (wantsPane() && paneState === 'closed') void openPane($).catch(() => undefined)
    else if (!wantsPane() && paneState === 'open' && layout === 'auto') void closePane($).catch(() => undefined)
    // In hint the band draws nothing, so it holds no sprite to swap.
    if (layout === 'hint') {
      if (spriteAt === e.requestId) spriteAt = undefined

      return next(e)
    }
    // Read so that a frame the band could not swap in place redraws it.
    await read($, frame)

    const kit = $.ui.resolve(e)
    const { Box, Image, Text } = kit
    const columns = e.props.bodyColumns

    // The pane holds the HUD while it is shown: the band keeps one row of it, or gives its place back.
    if (await isPaneShown($).catch(() => false)) return bandWithPane === 'off' ? next(e) : compactRow(kit, shot, e.props.isWorking, columns)

    const hasRoom = isSpriteWanted && !isSpriteBlocked && columns >= SPRITE_MIN_COLUMNS && e.props.maxRows >= SPRITE.rows + 1
    // With no frame to draw (none found, or none readable) the sprite and its margins are left out.
    const sprite = hasRoom ? await sourceOf($, motion, shown).catch(() => undefined) : undefined
    const isSprite = sprite !== undefined
    const left = isSprite ? columns - SPRITE_SLOT : columns
    // A list takes the rows the band has left under the rule and the five rows; past them, a count.
    const rows = [sections.session, sections.model, sections.usage, sections.context, sections.now].filter(Boolean).length
    const room = Math.max(1, e.props.maxRows - 1 - rows)

    if (isSprite) spriteAt = e.requestId
    else if (spriteAt === e.requestId) spriteAt = undefined

    return (
      <Box flexDirection="column">
        <Text color={ACCENT}>{'━'.repeat(columns)}</Text>
        <Box flexDirection="row" gap={isSprite ? SPRITE_MARGIN : 0} paddingLeft={isSprite ? SPRITE_MARGIN : 0} width={columns}>
          {sprite !== undefined && <Image key={SPRITE_KEY} source={sprite} columns={SPRITE.columns} rows={SPRITE.rows} alt=" " />}
          <Box flexDirection="column" width={left}>
            {sections.session && placeRow(kit, shot)}
            {sections.model && modelRow(kit, shot)}
            {sections.usage && usageRow(kit, shot)}
            {sections.context && contextRow(kit, shot)}
            {sections.now && statusRow(kit, shot, e.props.isWorking)}
            {agentList(kit, shot, agentsShown === 'list' ? room : 0)}
          </Box>
        </Box>
      </Box>
    )
  })

  // The pane's log scrolls by itself: the person's wheel over its rows moves it a line a tick, while it can move that
  // way, and leaves the pane where it is; any other move scrolls the pane. Only the pane's last card is known by its
  // rows: with the log ordered elsewhere (logHeight 0), every move scrolls the pane, and its buttons page it.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    const shot = await read($, snap)
    const { found: log } = await foundLog($, shot?.log ?? [])
    const offset = await read($, logOffset)
    const open = await read($, logOpen)
    const from = logFirst(log.length, offset)
    // A line open among those shown is read by scrolling the pane: the lines do not move under it.
    const isReading = open !== null && [...log].reverse().slice(from, from + LOG_ROWS).some(entry => entry.endedAt === open)
    const to =
      e.origin.kind === 'person'
        ? logWheel(
            { row: e.pointer === undefined ? null : paneOffset + e.pointer.row, top: paneOffset, bodyRows: e.bodyRows, contentRows: e.contentRows, by: e.by },
            { height: logHeight, offset, total: log.length, shown: LOG_ROWS, isReading },
          )
        : null

    if (to !== null) {
      await update($, logOffset, () => to)

      return {}
    }
    const moved = await next(e)

    if (moved.deny === undefined) paneOffset = e.offset

    return moved
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    paneState = 'open'
    panePlacement = e.props.placement
    const kit = $.ui.resolve(e)
    const { Box, Text } = kit

    // In auto, a pane seated above the prompt would only stand on the band: it closes, and the band draws.
    if (e.props.placement === 'inline' && layout === 'auto') {
      void closePane($).catch(() => undefined)

      return <Text dimColor>pane-mod: the band draws the HUD here.</Text>
    }
    const shot = await read($, snap)

    await read($, frame)
    startPlayer($)
    if (shot === null) return <Text dimColor>pane-mod: reading the session…</Text>
    const columns = e.props.bodyColumns
    const viewed = await read($, diffOpen)
    const change = viewed === null || !sections.changes ? undefined : changes.get(viewed.path)

    // A changed file's diff takes the whole pane, and the wheel scrolls it; one no longer changed shows the cards again.
    if (viewed !== null && change === undefined) void update($, diffOpen, () => null).catch(() => undefined)
    if (viewed !== null && change !== undefined) {
      const paths = [...changes.keys()]
      const at = paths.indexOf(change.path)
      const goTo = (path: string | undefined, isWhole: boolean) => () => {
        if (path !== undefined) void openDiff($, path, isWhole).catch(() => undefined)
      }

      paneOffset = e.props.scroll.offset
      logHeight = 0
      if (spriteAt === PANE) spriteAt = undefined

      return diffView(kit, kit.Code, kit.Button, change, diffShown(change, viewed.isWhole), viewed.isWhole, { at, total: paths.length }, columns, {
        onBack: () => void closeDiff($).catch(() => undefined),
        onWhole: goTo(change.path, !viewed.isWhole),
        onPrev: goTo(paths[at - 1], viewed.isWhole),
        onNext: goTo(paths[at + 1], viewed.isWhole),
      })
    }
    const hasRoom = e.surface === 'terminal' && 'Image' in kit && isSpriteWanted && !isSpriteBlocked && columns >= PANE_SPRITE_MIN
    const offset = await read($, logOffset)
    const open = await read($, logOpen)
    const { query, found } = await foundLog($, shot.log)
    // The search field shows where a surface draws one, once the log has more lines than a page, or while it is searched.
    const Input = 'Input' in kit && (query !== '' || shot.log.length > LOG_ROWS) ? kit.Input : undefined

    // Where the log is the tree's last card, its rows, counted here as it draws them, are the tree's last rows, and the
    // wheel over them moves it; ordered anywhere else its rows are not known, and the wheel scrolls the pane.
    paneOffset = e.props.scroll.offset
    logHeight = sections.log && shot.log.length > 0 && paneOrder.at(-1) === 'log' ? logRowsOf(found, offset, open, columns, Input !== undefined) : 0
    // With no frame to draw (none found, or none readable) the sprite and its row are left out.
    const sprite = hasRoom ? await sourceOf($, motion, shown).catch(() => undefined) : undefined
    const Image = 'Image' in kit ? kit.Image : undefined
    const isSprite = sprite !== undefined && Image !== undefined

    if (isSprite) spriteAt = PANE
    else if (spriteAt === PANE) spriteAt = undefined
    // The cards under the first two, each drawn where `paneOrder` puts it; none where it has nothing or its section is off.
    const lower: Record<PaneCard, RenderElement | null> = {
      tasks: sections.tasks ? tasksCard(kit, shot, columns) : null,
      agents: agentsCard(kit, shot, columns, Math.max(1, e.props.scroll.bodyRows)),
      context: sections.context ? contextCard(kit, shot, columns) : null,
      recent: sections.recent ? recentCard(kit, shot, columns) : null,
      changes: sections.changes ? changesCard(kit, kit.Button, shot, columns, path => void openDiff($, path, false).catch(() => undefined)) : null,
      log:
        sections.log && shot.log.length > 0
          ? logSection(kit, kit.Button, found, offset, open, columns, { query, total: shot.log.length, Input }, {
              onOlder: () => void pageLog($, LOG_ROWS, found.length).catch(() => undefined),
              onNewer: () => void pageLog($, -LOG_ROWS, found.length).catch(() => undefined),
              onFind: value => void findLog($, value).catch(() => undefined),
              onFocusFind: () => void $.ui.focus({ requestId: PANE, key: LOG_FIND_KEY }).catch(() => undefined),
              onToggle: (endedAt, rowKey) => void toggleLog($, endedAt, rowKey).catch(() => undefined),
              onCopy: (text, surface) => void copyPrompt($, text, surface).catch(() => undefined),
              onOpenFile: () => void openLogFile($).catch(() => undefined),
            })
          : null,
    }

    return (
      <Box flexDirection="column" width={columns}>
        {identityCard(
          kit,
          shot,
          motion === 'working',
          columns,
          sprite !== undefined && Image !== undefined ? <Image key={SPRITE_KEY} source={sprite} columns={PANE_SPRITE.columns} rows={PANE_SPRITE.rows} alt=" " /> : null,
        )}
        {modelCard(kit, shot, columns)}
        {paneOrder.map(card => lower[card])}
      </Box>
    )
  })
}

// ---- rows the band and the pane share

/** Row 1: the project with its branch. */
const placeRow = ({ Text }: Kit, shot: Snapshot) => (
  <Text wrap="truncate-end">
    <Text bold color={ACCENT}>{shot.project}</Text>
    {shot.branch !== null && <Text color={BRANCH}>{`(${branchText(shot)})`}</Text>}
  </Text>
)

/** The branch, marked where the session works in a linked worktree (its folder is the project's name). */
const branchText = (shot: Snapshot): string => (shot.isWorktree ? `${shot.branch} ${WORKTREE_MARK}` : (shot.branch ?? ''))

/** A gauge in two colors, its lit steps in the figure's tint and its unlit ones in the theme's gray, then the percent; `--` where it is not known. */
const gauge = ({ Text }: Kit, percent: number | null) => {
  if (percent === null) return <Text dimColor>--</Text>
  const [lit, unlit] = bar(percent, GAUGE, barGlyphs)

  return (
    <Text>
      <Text color={tint(percent)}>{lit}</Text>
      <Text color={UNLIT}>{unlit}</Text>
      <Text color={tint(percent)}>{` ${percent}%`}</Text>
    </Text>
  )
}

/** The effort as five steps and its level, warming from gray to red; a token budget, or `effort --` where it is not known. */
const effortMark = ({ Text }: Kit, effort: Snapshot['effort']) => {
  const level = effortLevelOf(effort)

  if (level === null) return <Text dimColor>{typeof effort === 'number' ? `${effort} tokens` : 'effort --'}</Text>
  const [lit, unlit] = effortGauge(level, barGlyphs)

  return (
    <Text>
      <Text color={effortTint(level)}>{lit}</Text>
      <Text color={UNLIT}>{unlit}</Text>
      <Text color={effortTint(level)} bold={level === 'max'}>{` ${level}`}</Text>
    </Text>
  )
}

/** Whether a turn runs: a yellow badge and how long the turn has run, or a dim word between turns. */
const statusMark = ({ Text }: Kit, shot: Snapshot, isWorking: boolean) =>
  isWorking ? (
    <Text>
      <Text bold color={BADGE_TEXT} backgroundColor={ACCENT}>{' ● WORKING '}</Text>
      {shot.turnSeconds !== null && <Text color={ACCENT}>{` ${duration(shot.turnSeconds)}`}</Text>}
    </Text>
  ) : (
    <Text dimColor>○ idle</Text>
  )

/** Row 2: the model on a badge, its effort as a gauge of five steps, and the session's cost. */
const modelRow = (kit: Kit, shot: Snapshot) => {
  const { Text } = kit

  return (
    <Text wrap="truncate-end">
      <Text bold inverse>{` ${modelName(shot.model)} `}</Text>
      <Text> </Text>
      {effortMark(kit, shot.effort)}
      {shot.usd !== null && <Text dimColor>{SEP}</Text>}
      {shot.usd !== null && <Text>{`$${shot.usd.toFixed(2)}`}</Text>}
    </Text>
  )
}

/** Row 3 of the band: the context and both windows on one row. */
const usageRow = (kit: Kit, shot: Snapshot) => {
  const { Text } = kit
  const five = shot.limits.find(limit => limit.kind === 'five_hour')
  const week = shot.limits.find(limit => limit.kind === 'seven_day')

  return (
    <Text wrap="truncate-end">
      <Text dimColor>{'ctx '}</Text>
      {gauge(kit, shot.contextPercent)}
      <Text dimColor>{`${SEP}5h `}</Text>
      {gauge(kit, five?.percentUsed ?? null)}
      <Text dimColor>{` ↻${five?.resetsIn ?? '--'}`}</Text>
      <Text dimColor>{`${SEP}7d `}</Text>
      {gauge(kit, week?.percentUsed ?? null)}
      <Text dimColor>{` ↻${week?.resetsIn ?? '--'}`}</Text>
    </Text>
  )
}

/** Row 4: the memory files by source, the hooks, and the tools by where they come from. */
const contextRow = ({ Text }: Kit, shot: Snapshot) => {
  const { memory, tools } = shot

  return (
    <Text wrap="truncate-end">
      <Text dimColor>{'context '}</Text>
      {memory === null ? <Text dimColor>--</Text> : <Text>{`${memory.total} md`}</Text>}
      {memory !== null && memory.byType.length > 0 && <Text dimColor>{` (${memory.byType.map(part => `${part.type} ${part.count}`).join(' · ')})`}</Text>}
      <Text dimColor>{`${SEP}hooks `}</Text>
      <Text>{String(shot.hooks)}</Text>
      <Text dimColor>{`${SEP}tools `}</Text>
      <Text>{String(tools.builtIn)}</Text>
      <Text dimColor>{' · MCP '}</Text>
      <Text>{String(tools.mcp)}</Text>
      {tools.mcpServers > 0 && <Text dimColor>{`/${tools.mcpServers}srv`}</Text>}
      {tools.skills !== null && <Text dimColor>{' · skills '}</Text>}
      {tools.skills !== null && <Text>{String(tools.skills)}</Text>}
      {tools.commands !== null && <Text dimColor>{' · cmds '}</Text>}
      {tools.commands !== null && <Text>{String(tools.commands)}</Text>}
    </Text>
  )
}

/** Row 5: the permission mode, whether a turn runs (a badge while it does) and on what, the turns so far and the output style. */
const statusRow = (kit: Kit, shot: Snapshot, isWorking: boolean) => {
  const { Text } = kit

  return (
    <Text wrap="truncate-end">
      {shot.mode === null ? <Text dimColor>mode --</Text> : <Text color={MODE_COLOR[shot.mode]} dimColor={MODE_COLOR[shot.mode] === undefined}>{`mode ${shot.mode}`}</Text>}
      <Text dimColor>{SEP}</Text>
      {statusMark(kit, shot, isWorking)}
      {isWorking && shot.activity !== null && <Text>{`  ▶ ${shot.activity.tool}${shot.activity.target === null ? '' : ` ${shot.activity.target}`}`}</Text>}
      {shot.turns !== null && <Text dimColor>{`${SEP}turns ${shot.turns}`}</Text>}
      {shot.style !== null && <Text dimColor>{`${SEP}style ${shot.style}`}</Text>}
    </Text>
  )
}

/**
 * The subagents: one row each within `room` rows (a count past it), or, with no
 * room for a list, one row of counts by state. Nothing while there are none or
 * the setting is off.
 */
const agentList = ({ Box, Text }: Kit, shot: Snapshot, room: number, wrap: 'wrap' | 'truncate-end' = 'truncate-end') => {
  if (agentsShown === 'off' || shot.agents.length === 0) return null
  if (room > 0) {
    const listed = shot.agents.length > room ? shot.agents.slice(0, room - 1) : shot.agents
    const unlisted = shot.agents.length - listed.length

    return (
      <Box flexDirection="column">
        {listed.map(agent => (
          <Text key={agent.id} wrap={wrap}>
            <Text dimColor>{'↳ '}</Text>
            <Text color={STATE_MARK[agent.state].color} dimColor={STATE_MARK[agent.state].color === undefined}>
              {STATE_MARK[agent.state].mark}
            </Text>
            <Text bold>{` ${agent.name ?? agent.type}`}</Text>
            {agent.name !== null && <Text dimColor>{` ${agent.type}`}</Text>}
            <Text>{`  ${agent.description}`}</Text>
            <Text dimColor>{`  · ${duration(agent.seconds)}${toolsOf(agent)}`}</Text>
          </Text>
        ))}
        {unlisted > 0 && <Text dimColor>{`↳ +${unlisted} more`}</Text>}
      </Box>
    )
  }
  const counted = STATE_ORDER.map(state => ({ state, count: shot.agents.filter(agent => agent.state === state).length })).filter(part => part.count > 0)

  return (
    <Text wrap="truncate-end">
      <Text dimColor>{`↳ subagents ${shot.agents.length}`}</Text>
      {counted.map(part => (
        <Text key={part.state} color={STATE_MARK[part.state].color} dimColor={STATE_MARK[part.state].color === undefined}>
          {`  ${STATE_MARK[part.state].mark} ${part.state} ${part.count}`}
        </Text>
      ))}
    </Text>
  )
}

/** The width of a label in the pane's rows, so the values line up. */
const LABEL = 10

/** The color `/color` gives a session, as the theme names it: the prompt box's own, in every theme. */
const themeColorOf = (color: SessionColor): string => `${color}_FOR_SUBAGENTS_ONLY`

/** A card's first row: its name, and a word at the right. */
const cardTitle = ({ Box, Text }: Kit, name: string, aside: string | null, width: number) => (
  <Box flexDirection="row" justifyContent="space-between" width={width}>
    <Text bold dimColor>
      {name}
    </Text>
    {aside !== null && <Text dimColor>{aside}</Text>}
  </Box>
)

/**
 * The pane's first card, the pane's whole width with the sprite at its right:
 * the name the session was given (in the color `/color` set it, or the one
 * the `sessionColor` setting fixes, which the border takes too), where it
 * is, its mode, turns and style, and whether a turn runs and on what, with
 * how long the session has run at the bottom
 * left. With its sections off and no name it holds the sprite alone; none
 * where there is no sprite either.
 */
const identityCard = (kit: Kit, shot: Snapshot, isWorking: boolean, columns: number, picture: RenderElement | null) => {
  const { Box } = kit
  const color = sessionBorder ?? (shot.color === null ? undefined : themeColorOf(shot.color))
  const hasRows = shot.title !== null || sections.session || sections.now
  const width = columns - CARD_INSET - (picture === null ? 0 : PANE_SPRITE.columns + PANE_SPRITE_GAP)

  if (!hasRows && picture === null) return null

  return (
    <Box key="card-session" flexDirection="row" alignItems="flex-start" gap={PANE_SPRITE_GAP} borderStyle="round" borderColor={color ?? ACCENT} borderDimColor={color === undefined} paddingX={1} width={columns}>
      {hasRows && identityRows(kit, shot, isWorking, width, color, picture === null ? undefined : PANE_SPRITE.rows)}
      {picture}
    </Box>
  )
}

/**
 * The first card's rows left of the sprite, `width` wide and as tall as the
 * sprite (`height`): from the top the name, where the session is, its mode and
 * turns, its status and the tool. The tool's row keeps its place while no tool
 * runs, so a call that starts or ends moves no row of the card, nor its height.
 */
const identityRows = (kit: Kit, shot: Snapshot, isWorking: boolean, width: number, color: string | undefined, height: number | undefined) => {
  const { Box, Text } = kit

  return (
    <Box key="card-session-rows" flexDirection="column" width={width} height={height}>
      <Box key="card-session-top" flexDirection="column" width={width}>
        {shot.title !== null && (
          <Text bold color={color} wrap="truncate-end">
            {shot.title}
          </Text>
        )}
        {sections.session && (
          <Text wrap="truncate-end">
            <Text bold color={ACCENT}>
              {shot.project}
            </Text>
            {shot.branch !== null && <Text color={BRANCH}>{` (${branchText(shot)})`}</Text>}
          </Text>
        )}
        {sections.session && (
          <Text wrap="truncate-end">
            {shot.mode === null ? (
              <Text dimColor>mode --</Text>
            ) : (
              <Text color={MODE_COLOR[shot.mode]} dimColor={MODE_COLOR[shot.mode] === undefined}>
                {shot.mode}
              </Text>
            )}
            {shot.turns !== null && <Text dimColor>{`${SEP}${shot.turns} turns`}</Text>}
            {shot.style !== null && <Text dimColor>{`${SEP}${shot.style}`}</Text>}
          </Text>
        )}
        {sections.now && statusMark(kit, shot, isWorking)}
        {sections.now &&
          (shot.activity === null ? (
            <Text> </Text>
          ) : (
            <Text wrap="truncate-end">
              <Text>{`▶ ${shot.activity.tool}`}</Text>
              <Text dimColor>{`${shot.activity.target === null ? '' : ` ${shot.activity.target}`} · ${duration(shot.activity.seconds)}`}</Text>
            </Text>
          ))}
      </Box>
    </Box>
  )
}

/** One of the model card's gauges: its label, the gauge, and what follows it dim. */
const gaugeLine = (kit: Kit, label: string, percent: number | null, after: string | null) => {
  const { Text } = kit

  return (
    <Text wrap="truncate-end">
      <Text dimColor>{label.padEnd(4)}</Text>
      {gauge(kit, percent)}
      {after !== null && <Text dimColor>{`  ${after}`}</Text>}
    </Text>
  )
}

/**
 * The model's card: the model and its effort; the context and the two windows
 * as gauges, the 5h one with its last hour and when it would fill at the
 * present pace; and what the session has cost (each turn's too) and used. Each
 * part shows as its section's setting says, the cost beside the model while
 * the totals are off; none where all three are off.
 */
const modelCard = (kit: Kit, shot: Snapshot, columns: number) => {
  const { Box, Text } = kit

  if (!sections.model && !sections.usage && !sections.totals) return null
  const five = shot.limits.find(limit => limit.kind === 'five_hour')
  const week = shot.limits.find(limit => limit.kind === 'seven_day')
  const { totals } = shot
  const input = totals.input + totals.cacheRead + totals.cacheWrite
  const context = shot.contextTokens === null || shot.contextWindow === null ? null : `${tokensShort(shot.contextTokens)}/${tokensShort(shot.contextWindow)}`

  return (
    <Box key="card-model" flexDirection="column" borderStyle="round" borderColor={modelBorder} paddingX={1} width={columns}>
      {sections.model && (
        <Box flexDirection="row" justifyContent="space-between" width={columns - CARD_INSET}>
          <Text wrap="truncate-end">
            <Text bold>{modelName(shot.model)}</Text>
            {!sections.totals && shot.usd !== null && <Text dimColor>{`${SEP}$${shot.usd.toFixed(2)}`}</Text>}
          </Text>
          {effortMark(kit, shot.effort)}
        </Box>
      )}
      {sections.usage && gaugeLine(kit, 'ctx', shot.contextPercent, context)}
      {sections.usage && gaugeLine(kit, '5h', five?.percentUsed ?? null, five?.resetsIn == null ? null : `↻ ${five.resetsIn}`)}
      {sections.usage && shot.forecast !== null && <Text wrap="wrap" color={tint(85)}>{`    ≈ ${elapsed(shot.forecast)} to the 5h limit`}</Text>}
      {sections.usage && gaugeLine(kit, '7d', week?.percentUsed ?? null, week?.resetsIn == null ? null : `↻ ${week.resetsIn}`)}
      {sections.totals && (
        <Text wrap="truncate-end">{shot.usd === null ? <Text dimColor>$--</Text> : <Text bold>{`$${shot.usd.toFixed(2)}`}</Text>}</Text>
      )}
      {sections.totals && (
        <Text wrap="truncate-end" dimColor>
          {totals.turns === 0
            ? 'no tokens yet'
            : `${tokensShort(input)} in · ${tokensShort(totals.output)} out${input > 0 ? ` · cache ${Math.round((totals.cacheRead / input) * 100)}%` : ''}`}
        </Text>
      )}
    </Box>
  )
}

/** How many of the tasks the card lists before it counts the rest. */
const TASK_ROWS = 8

/** How a task shows by where it stands: under way in the HUD's yellow, waiting plain, done dim and green. */
const TASK_MARK: Record<TaskItem['status'], { mark: string; color?: string; isDim: boolean }> = {
  in_progress: { mark: '▶', color: ACCENT, isDim: false },
  pending: { mark: '○', isDim: false },
  completed: { mark: '✓', color: '#66bb6a', isDim: true },
}

/**
 * Claude's tasks in a card that counts the done ones: those under way first
 * (by what they are doing), then those waiting, then those done, the first
 * TASK_ROWS of them and a count of the rest. None while there are none.
 */
const tasksCard = (kit: Kit, shot: Snapshot, columns: number) => {
  const { Box, Text } = kit

  if (shot.tasks.length === 0) return null
  const done = shot.tasks.filter(task => task.status === 'completed').length
  const listed = shot.tasks.slice(0, TASK_ROWS)

  return (
    <Box key="card-tasks" flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'tasks', `${done}/${shot.tasks.length}`, columns - CARD_INSET)}
      {listed.map(task => {
        const style = TASK_MARK[task.status]

        return (
          <Text key={`task-${task.id}`} wrap="wrap" color={style.color} dimColor={style.isDim}>
            {`${style.mark} ${task.status === 'in_progress' ? (task.activeForm ?? task.subject) : task.subject}`}
          </Text>
        )
      })}
      {shot.tasks.length > listed.length && <Text dimColor>{`+${shot.tasks.length - listed.length} more`}</Text>}
    </Box>
  )
}

/** The subagents in a card, one row each within `room` rows; none while there are none or the setting is off. */
const agentsCard = (kit: Kit, shot: Snapshot, columns: number, room: number) => {
  const { Box } = kit

  if (agentsShown === 'off' || shot.agents.length === 0) return null

  return (
    <Box key="card-agents" flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'subagents', agentCounts(shot.agents.map(agent => agent.state)), columns - CARD_INSET)}
      {agentList(kit, shot, room, 'wrap')}
    </Box>
  )
}

/** The memory files by source, the hooks, and the tools by where they come from, in a card of two rows. */
const contextCard = (kit: Kit, shot: Snapshot, columns: number) => {
  const { Box, Text } = kit
  const { memory, tools } = shot

  return (
    <Box key="card-context" flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'context', null, columns - CARD_INSET)}
      <Text wrap="wrap">
        <Text dimColor>{'md '}</Text>
        {memory === null ? <Text dimColor>--</Text> : <Text>{String(memory.total)}</Text>}
        {memory !== null && memory.byType.length > 0 && <Text dimColor>{` (${memory.byType.map(part => `${part.type} ${part.count}`).join(' · ')})`}</Text>}
        <Text dimColor>{`${SEP}hooks `}</Text>
        <Text>{String(shot.hooks)}</Text>
        <Text dimColor>{`${SEP}tools `}</Text>
        <Text>{String(tools.builtIn)}</Text>
      </Text>
      <Text wrap="wrap">
        <Text dimColor>{'MCP '}</Text>
        <Text>{String(tools.mcp)}</Text>
        <Text dimColor>{tools.mcpServers > 0 ? ` tools / ${tools.mcpServers} servers` : ' tools'}</Text>
        {tools.skills !== null && <Text dimColor>{`${SEP}skills `}</Text>}
        {tools.skills !== null && <Text>{String(tools.skills)}</Text>}
        {tools.commands !== null && <Text dimColor>{`${SEP}commands `}</Text>}
        {tools.commands !== null && <Text>{String(tools.commands)}</Text>}
      </Text>
    </Box>
  )
}

/**
 * The skills and MCP tools the session used lately, the most recent first: the
 * turn under way's, then those of the log's lines, newest first; RECENT_ROWS of
 * each, on a row of their own that wraps. None while there is nothing to list.
 */
const recentCard = (kit: Kit, shot: Snapshot, columns: number) => {
  const { Box, Text } = kit
  const { skills, mcp } = shot.recent

  if (skills.length === 0 && mcp.length === 0) return null

  return (
    <Box key="card-recent" flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'recent', null, columns - CARD_INSET)}
      {skills.length > 0 && (
        <Text key="recent-skills" wrap="wrap">
          <Text dimColor>{'skills '}</Text>
          <Text>{skills.join(SEP)}</Text>
        </Text>
      )}
      {mcp.length > 0 && (
        <Text key="recent-mcp" wrap="wrap">
          <Text dimColor>{'mcp '}</Text>
          <Text>{mcp.join(SEP)}</Text>
        </Text>
      )}
    </Box>
  )
}

/** A changed file's lines added and removed as the changes card and the diff name them; `?` where it was too large to compare. */
const countsText = (change: Pick<ChangeRow, 'added' | 'removed'>): string =>
  change.added === null || change.removed === null ? '?' : [change.added > 0 ? `+${change.added}` : '', change.removed > 0 ? `-${change.removed}` : ''].filter(part => part !== '').join(' ')

/** The same, the lines added in green and those removed in red. */
const countsMark = ({ Text }: Kit, change: Pick<ChangeRow, 'added' | 'removed'>) =>
  change.added === null || change.removed === null ? (
    <Text dimColor>?</Text>
  ) : (
    <Text>
      {change.added > 0 && <Text color={ADDED}>{`+${change.added}`}</Text>}
      {change.added > 0 && change.removed > 0 && <Text> </Text>}
      {change.removed > 0 && <Text color={REMOVED}>{`-${change.removed}`}</Text>}
    </Text>
  )

/**
 * The files the latest turn that changed any changed, in the order first
 * changed, the first CHANGE_ROWS and a count of the rest: each a row that opens
 * its diff over the pane (the first nine also by their number while the pane
 * holds the keyboard), with its lines added and removed. None while there are none.
 */
const changesCard = (kit: Kit, Button: Elements['terminal']['Button'], shot: Snapshot, columns: number, onOpen: (path: string) => void) => {
  const { Box, Text } = kit
  const inner = columns - CARD_INSET
  const listed = shot.changes.slice(0, CHANGE_ROWS)

  if (listed.length === 0) return null

  return (
    <Box key={CHANGES_KEY} flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'changes', `${shot.changes.length} ${shot.changes.length === 1 ? 'file' : 'files'}`, inner)}
      {listed.map((change, index) => {
        const hotkey = index < 9 ? { hotkey: String(index + 1) } : {}
        // The key's digit and its colon stand before the name, and a cell between the name and the counts.
        const room = inner - cellsOf(countsText(change)) - (index < 9 ? 4 : 1)

        return (
          <Box key={`change-${index}`} flexDirection="row" justifyContent="space-between" width={inner}>
            <Button key={`change-${index}-open`} label={clipStart(change.name, room)} plain {...hotkey} onPress={() => onOpen(change.path)} />
            {countsMark(kit, change)}
          </Box>
        )
      })}
      {shot.changes.length > listed.length && <Text dimColor>{`+${shot.changes.length - listed.length} more`}</Text>}
    </Box>
  )
}

/**
 * A changed file's diff over the whole pane: a card that names the file with
 * its lines added and removed and which of the changed files it is, and
 * buttons (and keys) back to the cards (b), to its whole text or its changes
 * alone (w), and to the changed file before or after it (p, n); under the
 * card the diff, which `Code` draws with its line numbers, marks and colors.
 */
const diffView = (
  kit: Kit,
  Code: Elements['terminal']['Code'],
  Button: Elements['terminal']['Button'],
  change: Change,
  diff: ReturnType<typeof diffOf> | null,
  isWhole: boolean,
  place: { at: number; total: number },
  columns: number,
  on: { onBack: () => void; onWhole: () => void; onPrev: () => void; onNext: () => void },
) => {
  const { Box, Text } = kit
  const inner = columns - CARD_INSET
  const which = `${place.at + 1}/${place.total}`

  return (
    <Box key="diff-view" flexDirection="column" width={columns}>
      <Box key={DIFF_KEY} flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
        <Box flexDirection="row" justifyContent="space-between" width={inner}>
          <Text bold>{clipStart(change.name, inner - cellsOf(countsText(change)) - 1)}</Text>
          {countsMark(kit, change)}
        </Box>
        <Box flexDirection="row" justifyContent="space-between" width={inner}>
          <Box flexDirection="row" gap={2}>
            <Button key="diff-back" label="◀ back" hotkey="b" plain onPress={on.onBack} />
            {diff !== null && <Button key="diff-whole" label={isWhole ? 'changes only' : 'whole file'} hotkey="w" plain onPress={on.onWhole} />}
            {place.at > 0 && <Button key="diff-prev" label="prev" hotkey="p" plain onPress={on.onPrev} />}
            {place.at < place.total - 1 && <Button key="diff-next" label="next" hotkey="n" plain onPress={on.onNext} />}
          </Box>
          <Text dimColor>{which}</Text>
        </Box>
      </Box>
      {diff === null && (
        <Text key="diff-none" dimColor wrap="wrap">
          too large to compare here
        </Text>
      )}
      {diff !== null && isWhole && !diff.isWhole && (
        <Text key="diff-whole-note" dimColor wrap="wrap">
          the whole file is too long to draw: its changes are shown
        </Text>
      )}
      {diff !== null && <Code key="diff-code" source={diff.text} format="diff" path={change.path} />}
      {diff?.isCut === true && (
        <Text key="diff-cut" dimColor wrap="wrap">
          {`cut at ${DIFF_CHARS.toLocaleString('en-US')} characters`}
        </Text>
      )}
    </Box>
  )
}

/** How a turn ended, as the log marks it. */
const OUTCOME_MARK: Record<LogEntry['outcome'], { mark: string; color?: string }> = {
  answer: { mark: '✓', color: '#66bb6a' },
  aborted: { mark: '⏹' },
  refusal: { mark: '⊘', color: '#ffb74d' },
  error: { mark: '✗', color: '#ef5350' },
}

/** The log's rows and detail are drawn with a Button beside the shared two. */
type LogKit = Kit & { Button: Elements['terminal']['Button'] }

/**
 * One finished turn on one row: a mark to open it by, then when, how it ended,
 * how long, what was asked (its first words) and what was done.
 */
const logRow = ({ Box, Text, Button }: LogKit, entry: LogEntry & { at: string }, key: string, isOpen: boolean, columns: number, onToggle: () => void) => {
  const mark = OUTCOME_MARK[entry.outcome]
  const done = doneOf(entry)

  return (
    <Box key={`${key}-row`} flexDirection="row" gap={1} width={columns}>
      <Button key={`${key}-open`} label={isOpen ? '▾' : '▸'} plain dimColor={!isOpen} onPress={onToggle} />
      <Box width={Math.max(1, columns - 2)}>
        <Text wrap="truncate-end">
          <Text dimColor>{`${entry.at} `}</Text>
          <Text color={mark.color} dimColor={mark.color === undefined}>{mark.mark}</Text>
          <Text dimColor>{` ${duration(entry.seconds).padStart(6)}  `}</Text>
          <Text bold={isOpen}>{oneLine(entry.text, LOG_TEXT_KEPT)}</Text>
          {done.length > 0 && <Text dimColor>{` · ${done.join(' · ')}`}</Text>}
        </Text>
      </Box>
    </Box>
  )
}

/** One row of a line's detail: a label (blank on a wrapped value's later rows) and its text. */
type DetailLine = { key: string; label: string; text: string }

/** A labelled value broken into rows of the detail's width, the later rows under the value rather than the label. */
const fieldLines = (key: string, label: string, value: string, width: number): DetailLine[] =>
  wrapCells(value, width - LABEL).map((text, index) => ({ key: `${key}-${index}`, label: index === 0 ? label.padEnd(LABEL) : ' '.repeat(LABEL), text }))

/**
 * The rows of a line's detail under its header: the prompt's lines, the files
 * it edited, the commands it ran, the main thread's calls by tool, the skills
 * and MCP tools used, the subagents spawned (one each), the calls that failed
 * (one each), the approvals asked for, the calls denied, and its counts.
 */
const detailLines = (entry: LogEntry, width: number): DetailLine[] => {
  const done = doneOf(entry)
  const unnamed = entry.edits - entry.files.length

  return [
    ...wrapCells(entry.text, width).map((text, index) => ({ key: `prompt-${index}`, label: '', text })),
    ...(entry.files.length > 0 ? fieldLines('edited', 'edited', `${entry.files.join(', ')}${unnamed > 0 ? ` +${unnamed}` : ''}`, width) : []),
    ...entry.commands.flatMap((command, index) => fieldLines(`bash-${index}`, index === 0 ? 'bash' : '', command, width)),
    ...(Object.keys(entry.tools).length > 0 ? fieldLines('tools', 'tools', toolsLine(entry.tools), width) : []),
    ...(entry.skills.length > 0 ? fieldLines('skills', 'skills', entry.skills.join(', '), width) : []),
    ...(entry.mcp.length > 0 ? fieldLines('mcp', 'mcp', entry.mcp.join(', '), width) : []),
    ...entry.subagents.flatMap((agent, index) => fieldLines(`subagent-${index}`, index === 0 ? 'subagents' : '', agentLine(agent), width)),
    ...entry.errors.flatMap((error, index) => fieldLines(`error-${index}`, index === 0 ? 'errors' : '', errorText(error), width)),
    ...(entry.approvals.length > 0 ? fieldLines('asked', 'asked', callsLine(entry.approvals), width) : []),
    ...(entry.denials.length > 0 ? fieldLines('denied', 'denied', callsLine(entry.denials), width) : []),
    ...(done.length > 0 ? fieldLines('done', 'done', done.join(' · '), width) : []),
  ]
}

/** The detail's indent under the line it opens. */
const DETAIL_INDENT = 2

/**
 * An open line's detail under it, one row per line so its height is known:
 * when it ended in full and how, then the rows `detailLines` gives (the prompt
 * with its lines, what the turn did, its counts), and a button (the key c
 * while the pane holds the keyboard) that copies the prompt.
 */
const logDetail = (kit: LogKit, entry: LogEntry, columns: number, onCopy: (surface: RenderSurface) => void) => {
  const { Box, Text, Button } = kit
  const mark = OUTCOME_MARK[entry.outcome]

  return (
    <Box key={LOG_DETAIL_KEY} flexDirection="column" paddingLeft={DETAIL_INDENT} width={columns}>
      <Text wrap="truncate-end">
        <Text dimColor>{`${dateOf(entry.endedAt)} · `}</Text>
        <Text color={mark.color} dimColor={mark.color === undefined}>{OUTCOME_WORDS[entry.outcome]}</Text>
        <Text dimColor>{` · ${duration(entry.seconds)}`}</Text>
      </Text>
      {detailLines(entry, columns - DETAIL_INDENT).map(line => (
        <Text key={line.key} wrap="truncate-end">
          {line.label !== '' && <Text dimColor>{line.label}</Text>}
          <Text>{line.text}</Text>
        </Text>
      ))}
      <Button key="log-copy" label="copy prompt" hotkey="c" plain onPress={press => onCopy(press.surface)} />
    </Box>
  )
}

/** The first of the newest-first lines the log shows, its offset kept within the lines there are. */
const logFirst = (total: number, offset: number): number => Math.min(offset, Math.max(0, total - LOG_ROWS))

/**
 * The rows the log's card takes as it draws: its border above and below, its
 * title, its search field where it has one, the lines shown (or the one row
 * that says none was found), the open line's detail (its header, its lines,
 * its button) where that line is among them, and the row of buttons under them.
 */
const logRowsOf = (log: readonly LogEntry[], offset: number, open: number | null, columns: number, hasFind: boolean): number => {
  const from = logFirst(log.length, offset)
  const shown = [...log].reverse().slice(from, from + LOG_ROWS)
  const opened = shown.find(entry => entry.endedAt === open)

  return 2 + 1 + (hasFind ? 1 : 0) + Math.max(1, shown.length) + (opened === undefined ? 0 : 2 + detailLines(opened, columns - CARD_INSET - DETAIL_INDENT).length) + 1
}

/**
 * The pane's log in a card: LOG_ROWS lines at a time, newest first, under a
 * title that says which of how many. The wheel over it moves it a line a tick (the
 * `ui.scroll` hook) while it is the pane's last card; buttons (and the keys o and n while the pane holds the
 * keyboard) page to older and newer lines. A line's mark opens
 * its detail under it, one line at a time; the key f writes the whole log to
 * a file and opens it. Given a search field, the log shows the lines that have
 * every word typed in it (the key s goes to it), and the key x shows all again.
 */
const logSection = (
  kit: Kit,
  Button: Elements['terminal']['Button'],
  log: readonly (LogEntry & { at: string })[],
  offset: number,
  open: number | null,
  columns: number,
  find: { query: string; total: number; Input: Elements['terminal']['Input'] | undefined },
  on: {
    onOlder: () => void
    onNewer: () => void
    onFind: (query: string) => void
    onFocusFind: () => void
    onToggle: (endedAt: number, rowKey: string) => void
    onCopy: (text: string, surface: RenderSurface) => void
    onOpenFile: () => void
  },
) => {
  const { Box, Text } = kit
  const { Input } = find
  const logKit: LogKit = { ...kit, Button }
  const newestFirst = [...log].reverse()
  const from = logFirst(log.length, offset)
  const shown = newestFirst.slice(from, from + LOG_ROWS)
  const isOlder = from + LOG_ROWS < log.length
  const isNewer = from > 0
  const isFound = find.query.trim() !== ''
  const inner = columns - CARD_INSET
  const which = shown.length === 0 ? 'none found' : `${from + 1}–${from + shown.length} of ${log.length}${isFound ? ' found' : ''}`

  return (
    <Box key="card-log" flexDirection="column" borderStyle="round" borderColor={cardBorder} paddingX={1} width={columns}>
      {cardTitle(kit, 'log', which, inner)}
      {Input !== undefined && (
        <Box key="log-find-row" width={inner}>
          <Input key={LOG_FIND_KEY} label="find " placeholder="words of prompts, files, commands" value={find.query} submitLabel="find" onInput={on.onFind} onSubmit={on.onFind} />
        </Box>
      )}
      {shown.length === 0 && (
        <Text key="log-none" dimColor wrap="truncate-end">
          {`no line has "${oneLine(find.query, inner)}" (${find.total} kept)`}
        </Text>
      )}
      {shown.map((entry, index) => {
        const key = `log-${log.length - from - index}`
        const isOpen = entry.endedAt === open

        return (
          <Box key={key} flexDirection="column" width={inner}>
            {logRow(logKit, entry, key, isOpen, inner, () => on.onToggle(entry.endedAt, `${key}-open`))}
            {isOpen && logDetail(logKit, entry, inner, surface => on.onCopy(entry.text, surface))}
          </Box>
        )
      })}
      <Box flexDirection="row" gap={2}>
        {isOlder && <Button key="log-older" label="▲ older" hotkey="o" plain onPress={on.onOlder} />}
        {isNewer && <Button key="log-newer" label="▼ newer" hotkey="n" plain onPress={on.onNewer} />}
        <Button key="log-file" label="open file" hotkey="f" plain onPress={on.onOpenFile} />
        {Input !== undefined && !isFound && <Button key="log-find-focus" label="find" hotkey="s" plain onPress={on.onFocusFind} />}
        {isFound && <Button key="log-clear" label="clear" hotkey="x" plain onPress={() => on.onFind('')} />}
      </Box>
    </Box>
  )
}

/** The band while the pane is shown: one row of what matters at a glance, the model and the turn under way on badges. */
const compactRow = (kit: Kit, shot: Snapshot, isWorking: boolean, columns: number) => {
  const { Text } = kit
  const five = shot.limits.find(limit => limit.kind === 'five_hour')
  const running = shot.agents.filter(agent => !isEnded(agent.state)).length

  return (
    <Text wrap="truncate-end">
      <Text color={ACCENT}>{'━━ '}</Text>
      <Text bold inverse>{` ${modelName(shot.model)} `}</Text>
      <Text> </Text>
      {effortMark(kit, shot.effort)}
      <Text dimColor>{`${SEP}ctx `}</Text>
      {shot.contextPercent === null ? <Text dimColor>--</Text> : <Text color={tint(shot.contextPercent)}>{`${shot.contextPercent}%`}</Text>}
      <Text dimColor>{`${SEP}5h `}</Text>
      {five === undefined ? <Text dimColor>--</Text> : <Text color={tint(five.percentUsed)}>{`${five.percentUsed}%`}</Text>}
      <Text dimColor>{SEP}</Text>
      {statusMark(kit, shot, isWorking)}
      {running > 0 && <Text dimColor>{`${SEP}subagents ${running}`}</Text>}
      <Text dimColor>{` ${'─'.repeat(Math.max(0, columns))}`}</Text>
    </Text>
  )
}
