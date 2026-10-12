/** One rate-limit window as the last API response reported it. */
export type Limit = { kind: string; percentUsed: number; resetsIn: string | null }

/** Where a subagent stands, as the HUD draws it: an ended one is `done` or `failed`. */
export type AgentState = 'pending' | 'running' | 'waiting' | 'idle' | 'done' | 'failed'

/** One row of the subagent list. */
export type AgentRow = {
  id: string
  /** What it was spawned by (`Agent({ name })`) and is addressed by, where it has one. */
  name: string | null
  type: string
  description: string
  state: AgentState
  /** Seconds since it was first seen, up to its end once it has ended, or to when it went idle while it is. */
  seconds: number
  tools: number
  tool: string | null
}

/** What the main thread is doing now: the tool it runs, what on, and for how long. */
export type Activity = { tool: string; target: string | null; seconds: number }

/** How a turn ended, as `turn.complete` says. */
export type Outcome = 'answer' | 'aborted' | 'refusal' | 'error'

/**
 * A subagent a turn spawned, as its log line keeps it: its type, its task (cut
 * short), how its own turn ended (`running` where it had not when last seen),
 * and the seconds from its spawn to that end, or to when it was last seen.
 */
export type LogAgent = { type: string; description: string; outcome: Outcome | 'running'; seconds: number }

/** A tool call of the turn that failed: the tool, whether a subagent made it, and the first line of the error (cut short). */
export type LogError = { tool: string; isSubagent: boolean; text: string }

/** A call an approval was asked for, or that was denied: the tool, and what it worked on in a few words. */
export type LogCall = { tool: string; target: string | null }

/** One finished turn, as the log keeps it: when, how long, how it ended, what was asked and what was done. */
export type LogEntry = {
  /** When the turn ended, in milliseconds since the epoch. */
  endedAt: number
  seconds: number
  outcome: Outcome
  /** What was asked: the prompt, its tags dropped and its lines kept, up to a few hundred characters. */
  text: string
  edits: number
  runs: number
  reads: number
  agents: number
  out: number | null
  cacheHit: number | null
  /** The names of the files the turn edited, the first few; none in a line kept before they were. */
  files: string[]
  /** The first line of each command the turn ran, the first few; none in a line kept before they were. */
  commands: string[]
  /**
   * The main thread's calls by tool, the first few tools by name and the rest
   * under `OTHER_TOOLS`; this and every field below are empty in a line kept
   * before they were.
   */
  tools: Record<string, number>
  /** The skills the Skill tool ran, each once, in the order first run (subagents' included). */
  skills: string[]
  /** The MCP tools called, as `server:tool`, each once, in the order first called (subagents' included). */
  mcp: string[]
  /** The subagents the turn spawned, the first few. */
  subagents: LogAgent[]
  /** The tool calls that failed (not those interrupted), the first few. */
  errors: LogError[]
  /** The calls an approval dialog was raised for, and the calls denied, the first few of each. */
  approvals: LogCall[]
  denials: LogCall[]
}

/** What the line under an approval dialog names: the dialog waiting on the person, and a limit near. */
export type AlertKind = 'approval' | 'limit'

/**
 * One alert as pane-mod tells it: what for, its line, when it was raised, when it
 * goes by itself (null: when what it waits on ends), and the call or dialog it
 * waits on, whose end lets it go.
 */
export type Alert = { kind: AlertKind; text: string; at: number; until: number | null; ref: string | null }

/** One of Claude's tasks (TaskCreate / TaskUpdate, or a TodoWrite list), as the pane lists it. */
export type TaskItem = { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed'; activeForm: string | null }

/** What the session's turns have used so far, summed over every turn's usage (subagents' included). */
export type Totals = { input: number; output: number; cacheRead: number; cacheWrite: number; turns: number }

/** The pane's sections (and the band's rows they share) that the settings turn on or off. */
export type SectionName = 'session' | 'now' | 'tasks' | 'model' | 'usage' | 'totals' | 'context' | 'recent' | 'changes' | 'log'

/** The skills and MCP tools the session used lately, the most recent first. */
export type Recent = { skills: string[]; mcp: string[] }

/**
 * A file the latest turn that changed any changed (Edit, Write), as the pane
 * lists it: its path, the name it is shown by, and the lines added and removed
 * since that turn began; null counts where it was too large to compare.
 */
export type ChangeRow = { path: string; name: string; added: number | null; removed: number | null }

/** The colors `/color` gives a session. */
export type SessionColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'cyan'

/** The memory files the context carries, by where each was loaded from. */
export type Memory = { total: number; byType: { type: string; count: number }[] }

/** The tool surface, split by where each part comes from. */
export type Tools = { builtIn: number; mcp: number; mcpServers: number; skills: number | null; commands: number | null }

/** Everything the HUD draws, gathered at once so that a redraw reads one value. */
export type Snapshot = {
  project: string
  branch: string | null
  /** Whether the working directory is a linked worktree, not the repository's main checkout. */
  isWorktree: boolean
  model: string
  /** The main thread's effort: a level, a token budget, or unknown. */
  effort: string | number | null
  contextPercent: number | null
  /** The tokens the context holds and the window's size, where the engine says. */
  contextTokens: number | null
  contextWindow: number | null
  limits: Limit[]
  usd: number | null
  memory: Memory | null
  hooks: number
  tools: Tools
  mode: string | null
  style: string | null
  /** The name the session was given (`/rename`), and the color `/color` set it; null where none was. */
  title: string | null
  color: SessionColor | null
  turns: number | null
  agents: AgentRow[]
  /** The tool the main thread runs now, and how long the turn has run; null between turns. */
  activity: Activity | null
  turnSeconds: number | null
  /** Minutes until the 5h window fills at the present pace, where that comes before its reset. */
  forecast: number | null
  /** The finished turns, newest last, each with the stamp it is shown by. */
  log: (LogEntry & { at: string })[]
  /** The skills and MCP tools of the turn under way and of the log's lines, the most recent first. */
  recent: Recent
  /** The files the latest turn that changed any changed, in the order first changed. */
  changes: ChangeRow[]
  /** Claude's tasks, and the session's totals. */
  tasks: TaskItem[]
  totals: Totals
}

declare module 'claude-code' {
  interface PluginState {
    'pane-mod': {
      snap: Snapshot | null
      frame: number
      /** How many of the newest log lines the pane's log has paged past. */
      logOffset: number
      /** The log line opened to its detail, by when its turn ended; null with none open. */
      logOpen: number | null
      /** The words the pane's log is searched for; empty shows every line. */
      logQuery: string
      /** The changed file the pane shows the diff of, by its path, and whether whole; null with the cards shown. */
      diffOpen: { path: string; isWhole: boolean } | null
    }
  }
}
