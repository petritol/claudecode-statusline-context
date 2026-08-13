#!/usr/bin/env node
"use strict";

// Claude Code status line for context window usage.
//
// Reads the JSON status payload Claude Code pipes to stdin and prints a single
// colorized line: model | project | context usage. Pure Node standard library
// (no dependencies); Node ships with Claude Code, so nothing extra to install.

const fs = require("fs");

function asFloat(value, fallback = 0.0) {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatTokens(value) {
  const tokens = asFloat(value);
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(Math.trunc(tokens));
}

function clampText(value, limit) {
  if (limit <= 0) return "";
  if (value.length <= limit) return value;
  if (limit === 1) return value.slice(0, 1);
  return `${value.slice(0, limit - 1)}~`;
}

function bar(percentage, width) {
  const pct = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((pct * width) / 100);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

function terminalColumns() {
  return Math.trunc(asFloat(process.env.COLUMNS, 120));
}

// Smooth color gradient keyed on percentage of the context window used, so the
// color always agrees with the `ctx N%` reading beside it and scales to
// whatever window the session has (200k, 1M, ...). Driven purely by the
// red/green channels (blue stays 0):
//   0 -> 50%:   red ramps up while green stays maxed  (green -> yellow)
//   50% -> 80%: green drops while red stays maxed     (yellow -> red)
//   > 80%:      clamped at pure red
// Emitted as 24-bit truecolor; needs a terminal that supports it (most modern
// ones do). On a 200k window the 50 / 80 stops are 100k / 160k tokens; on a 1M
// window, 500k / 800k.
const RESET = "\x1b[0m";
const GRADIENT = [
  [0, [0, 255, 0]], // bright green
  [50, [255, 255, 0]], // yellow
  [80, [255, 0, 0]], // pure red
];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function colorFor(usedPercentage) {
  let [r, g, b] = GRADIENT[GRADIENT.length - 1][1];
  if (usedPercentage <= GRADIENT[0][0]) {
    [r, g, b] = GRADIENT[0][1];
  } else {
    for (let i = 0; i < GRADIENT.length - 1; i++) {
      const [t0, c0] = GRADIENT[i];
      const [t1, c1] = GRADIENT[i + 1];
      if (usedPercentage >= t0 && usedPercentage <= t1) {
        const t = (usedPercentage - t0) / (t1 - t0);
        r = lerp(c0[0], c1[0], t);
        g = lerp(c0[1], c1[1], t);
        b = lerp(c0[2], c1[2], t);
        break;
      }
    }
  }
  return `\x1b[38;2;${r};${g};${b}m`;
}

function colorize(text, color) {
  // Claude Code renders ANSI escapes in the status line even though this
  // command's stdout is not a TTY, so no isatty() guard here.
  if (!text) return text;
  return `${color}${text}${RESET}`;
}

function contextTokens(contextWindow) {
  const total = contextWindow.total_input_tokens;
  if (total !== undefined && total !== null) return total;

  const usage = contextWindow.current_usage;
  if (typeof usage !== "object" || usage === null) return 0;

  return (
    asFloat(usage.input_tokens) +
    asFloat(usage.cache_creation_input_tokens) +
    asFloat(usage.cache_read_input_tokens)
  );
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    raw = "";
  }

  let data = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      process.stdout.write("ctx unavailable\n");
      return 0;
    }
  }

  const model = isObject(data.model) ? data.model : {};
  const workspace = isObject(data.workspace) ? data.workspace : {};
  const contextWindow = isObject(data.context_window) ? data.context_window : {};

  const modelName = String(model.display_name || model.id || "Claude");
  const currentDir = String(workspace.current_dir || data.cwd || "");
  const project = currentDir ? require("path").basename(currentDir) : "";

  const usedPercentage = Math.max(
    0,
    Math.min(100, asFloat(contextWindow.used_percentage))
  );
  const columns = terminalColumns();
  const barWidth = columns >= 100 ? 20 : columns >= 72 ? 12 : 0;

  const contextParts = [`ctx ${usedPercentage.toFixed(0)}%`];
  if (barWidth) {
    contextParts.push(bar(usedPercentage, barWidth));
  }

  const usedTokens = asFloat(contextTokens(contextWindow));
  const contextWindowSize = contextWindow.context_window_size;
  if (contextWindowSize) {
    contextParts.push(
      `${formatTokens(usedTokens)}/${formatTokens(contextWindowSize)}`
    );
  }

  if (data.exceeds_200k_tokens) {
    contextParts.push("200k+");
  }

  const status = contextParts.join(" ");
  const segments = [clampText(modelName, 18), clampText(project, 24), status];
  let line = segments.filter(Boolean).join(" | ");

  if (line.length > columns) {
    const compact = [clampText(modelName, 12), status];
    line = compact.filter(Boolean).join(" | ");
  }
  if (line.length > columns) {
    line = line.slice(0, Math.max(0, columns - 1)) + "~";
  }

  process.stdout.write(colorize(line, colorFor(usedPercentage)) + "\n");
  return 0;
}

process.exit(main());
