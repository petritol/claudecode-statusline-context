# claudecode-statusline-context

![Sample status line states](docs/states.svg)

A custom [Claude Code](https://claude.com/claude-code) status line that shows
**context-window usage** at a glance — a colorized percentage, a Unicode
progress bar, and a `used / total` token count.

## Requirements

- **Claude Code v2.1.153 or later** — provides the
  [status line](https://code.claude.com/docs/en/statusline) feature along with
  the current-context token counts and terminal-width info this script relies
  on. (Earlier versions reported cumulative session tokens and didn't expose
  terminal width.)
- **Node.js** — no extra install needed: Node ships with Claude Code, so if you
  can run Claude Code you can run this. Works on macOS, Linux, and Windows.
- A **UTF-8 terminal** (for the `█` / `░` bar glyphs) with **truecolor** support
  for the gradient (virtually all modern terminals qualify).

The script is a single file with zero third-party dependencies.

## Installation

1. **Copy the script** somewhere stable. The conventional spot is your Claude
   config directory:

   ```sh
   cp statusline-context.js ~/.claude/statusline-context.js
   chmod +x ~/.claude/statusline-context.js
   ```

2. **Register it** in your Claude Code settings. Edit `~/.claude/settings.json`
   (create it if it doesn't exist) and add a `statusLine` block pointing at the
   **absolute path** from step 1:

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "/home/you/.claude/statusline-context.js",
       "padding": 1
     }
   }
   ```

   > Replace `/home/you/` with your real home directory — `statusLine.command`
   > does not expand `~`.
   >
   > The script is marked executable and carries a `#!/usr/bin/env node`
   > shebang, so the bare path works. If your environment doesn't honor
   > shebangs, prefix the interpreter explicitly, e.g.
   > `"command": "node /home/you/.claude/statusline-context.js"`.

3. **Reload.** Start a new Claude Code session (or trigger a status-line
   refresh) and the colorized bar appears.

## License

[The Unlicense](LICENSE) — public domain. Do whatever you want with it.
