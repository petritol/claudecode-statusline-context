# claudecode-statusline-context

![Sample status line states](docs/states.svg)

A [Claude Code mod](https://claude.com/blog/claude-code-mods) that shows
**context-window usage** at a glance — a colorized percentage, a Unicode
progress bar, and a `used / total` token count — in a band just above the
prompt.

The color runs green → yellow → red on absolute tokens used (yellow at 150k,
red at 200k), independent of the window size. The bar and project name drop
out as the terminal narrows.

## Requirements

- **Claude Code with mod support** (function-hook plugins). Tested on v2.1.287.
- A **UTF-8 terminal** (for the `█` / `░` bar glyphs) with **truecolor** support
  for the gradient (virtually all modern terminals qualify).

The band draws in the terminal and in the desktop app's Code tab.

## Installation

Install it as a plugin from this repository:

```
/plugin marketplace add petritol/claudecode-statusline-context
/plugin install context-statusline@claudecode-statusline-context
```

The band appears above the prompt and updates after each turn.

### From a local clone

```sh
git clone https://github.com/petritol/claudecode-statusline-context
claude --plugin-dir /path/to/claudecode-statusline-context
```

To load it in every session without the flag, add the folder to the `env`
block of `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claudecode-statusline-context"
  }
}
```

### Upgrading from the status line script

Earlier versions were a `statusLine` command script. Remove the `statusLine`
block from `~/.claude/settings.json` and delete
`~/.claude/statusline-context.js`, or the usage shows twice.

## Development

```sh
claude plugin validate .
claude plugin test .
```

## License

[The Unlicense](LICENSE) — public domain. Do whatever you want with it.
