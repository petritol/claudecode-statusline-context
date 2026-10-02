import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const measured = atom({ plugin: 'context-statusline', key: 'measured' } as const, 0)

type Rgb = [number, number, number]

const GREEN: Rgb = [0, 255, 0]
const YELLOW: Rgb = [255, 255, 0]
const RED: Rgb = [255, 0, 0]

const DEFAULT_CONTEXT_BUDGET = '200k'
const YELLOW_SHARE = 0.75

const UNITS: Record<string, number> = { '': 1, k: 1_000, m: 1_000_000 }

function parseThreshold(value: string, window: number): number | undefined {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(k|m|%)?\s*$/i.exec(value)
  if (!match) return undefined
  const amount = Number(match[1])
  const unit = (match[2] ?? '').toLowerCase()
  return unit === '%' ? (amount / 100) * window : amount * UNITS[unit]!
}

export function budgetTokens(contextBudget: string, window: number): number {
  return parseThreshold(contextBudget, window) || parseThreshold(DEFAULT_CONTEXT_BUDGET, window)!
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.trunc(tokens))
}

function clampText(value: string, limit: number): string {
  if (limit <= 0) return ''
  if (value.length <= limit) return value
  if (limit === 1) return value.slice(0, 1)
  return `${value.slice(0, limit - 1)}~`
}

function bar(percentage: number, width: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percentage)) * width) / 100)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`
}

export function colorFor(usedTokens: number, budget: number): string {
  const gradient: [number, Rgb][] = [
    [0, GREEN],
    [budget * YELLOW_SHARE, YELLOW],
    [budget, RED],
  ]
  let rgb = RED
  for (let i = 0; i < gradient.length - 1; i++) {
    const [t0, c0] = gradient[i]!
    const [t1, c1] = gradient[i + 1]!
    if (usedTokens <= t1) {
      const t = Math.max(0, (usedTokens - t0) / (t1 - t0))
      rgb = c0.map((c, j) => Math.round(c + (c1[j]! - c) * t)) as Rgb
      break
    }
  }
  return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`
}

export function modelDisplayName(id: string): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(id)
  if (!match) return id
  const [, family, major, minor, longContext] = match
  const name = `${family![0]!.toUpperCase()}${family!.slice(1)} ${major}${minor ? `.${minor}` : ''}`
  return longContext ? `${name} (1M context)` : name
}

export function statusLine(args: {
  model: string
  project: string
  tokens: number
  window: number
  percent: number
  columns: number
}): string {
  const { model, project, tokens, window, percent, columns } = args
  const barWidth = columns >= 100 ? 20 : columns >= 72 ? 12 : 0

  const parts = [`ctx ${percent.toFixed(0)}%`]
  if (barWidth) parts.push(bar(percent, barWidth))
  if (window) parts.push(`${formatTokens(tokens)}/${formatTokens(window)}`)
  if (tokens > 200_000) parts.push('200k+')

  const status = parts.join(' ')
  let line = [clampText(model, 18), clampText(project, 24), status].filter(Boolean).join(' | ')
  if (line.length > columns) line = [clampText(model, 12), status].filter(Boolean).join(' | ')
  if (line.length > columns) line = `${line.slice(0, Math.max(0, columns - 1))}~`
  return line
}

export const register: Register = (on, options) => {
  const contextBudget = String(options.contextBudget ?? DEFAULT_CONTEXT_BUDGET)

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await update($, measured, n => n + 1)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    await read($, measured)

    const [{ context }, model, root] = await Promise.all([
      $.session.usage(),
      $.session.model(),
      $.session.root(),
    ])
    const tokens = context.tokens ?? 0
    const line = statusLine({
      model: modelDisplayName(model),
      project: root.split(/[\\/]/).filter(Boolean).pop() ?? '',
      tokens,
      window: context.window,
      percent: Math.max(0, Math.min(100, context.percent ?? 0)),
      columns: e.props.bodyColumns,
    })

    const { Text } = $.ui.resolve(e)
    return (
      <Text color={colorFor(tokens, budgetTokens(contextBudget, context.window))} wrap="truncate">
        {line}
      </Text>
    )
  })
}
