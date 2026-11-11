#!/bin/sh
# pane-mod's rows for Claude Code's subagent panel (the plugin's subagentStatusLine).
#
# Claude Code runs this on each refresh of the panel with the visible rows as JSON on stdin,
# and CLAUDE_PLUGIN_DATA set to the plugin's data folder. The mod writes the session's rows to
# subagents/<session id>.jsonl in its data folder, one {"id", "content"} line per subagent; this
# prints them as they are. A row it prints nothing for keeps Claude Code's own.
#
# The mod's data folder is the installed plugin's (pane-mod-pane-mod) unless the environment
# Claude Code started in names another of this plugin's, so a --plugin-dir copy, whose folder
# Claude Code names pane-mod-inline, writes there too: that folder is read when the first has none.

input=$(cat)
session=$(printf '%s' "$input" | sed -n 's/.*"session_id":"\([A-Za-z0-9_-]*\)".*/\1/p' | head -n 1)

[ -n "$session" ] || exit 0
for data in "$CLAUDE_PLUGIN_DATA" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/data/pane-mod-pane-mod"; do
  rows="$data/subagents/$session.jsonl"
  if [ -n "$data" ] && [ -f "$rows" ]; then
    cat "$rows"
    exit 0
  fi
done
exit 0
