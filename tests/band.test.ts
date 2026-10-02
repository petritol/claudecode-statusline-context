import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'

import { barCells, budgetTokens, colorFor, lineText, modelDisplayName, statusLine, trackColorFor } from '../hooks/register'

const childrenOf = (node: RenderElement): readonly unknown[] => ('children' in node ? node.children ?? [] : [])

const shownText = (node: unknown): string =>
  typeof node === 'string' ? node : childrenOf(node as RenderElement).map(shownText).join('')

test('should format the line and degrade with width', async () => {
  const base = { model: 'Opus 5.5', project: 'Projects', tokens: 50_000, window: 1_000_000, percent: 5, budget: 200_000 }
  const at = (overrides: Partial<typeof base> & { columns: number }) => lineText(statusLine({ ...base, ...overrides }))

  expect(at({ columns: 120 })).toBe('Opus 5.5 | Projects | ctx 5% [█░░░│░░░░░░░░░░░░░░░] 50k/1M')
  expect(at({ columns: 80 })).toBe('Opus 5.5 | Projects | ctx 5% [█░│░░░░░░░░░] 50k/1M')
  expect(at({ columns: 40 })).toBe('Opus 5.5 | Projects | ctx 5% 50k/1M')
  expect(at({ tokens: 250_000, percent: 25, columns: 30 })).toBe('Opus 5.5 | ctx 25% 250k/1M')
  expect(at({ columns: 20 })).toBe('Opus 5.5 | ctx 5% 5~')
})

test('should mark the context budget on the bar', async () => {
  const cells = barCells({ percent: 35, width: 20, tokens: 350_000, window: 1_000_000, budget: 800_000 })
  const fill = colorFor(350_000, 800_000)

  expect(cells.map(cell => cell.glyph).join('')).toBe('███████░░░░░░░░░│░░░')
  expect(cells[0]).toEqual({ glyph: '█', color: fill })
  expect(cells[7]).toEqual({ glyph: '░', color: trackColorFor(375_000, 800_000) })
  expect(cells[16]).toEqual({ glyph: '│', color: fill })
  expect(cells[19]).toEqual({ glyph: '░', color: '#660000' })
})

test('should keep the budget marker visible inside the fill', async () => {
  const cells = barCells({ percent: 85, width: 20, tokens: 850_000, window: 1_000_000, budget: 800_000 })

  expect(cells.map(cell => cell.glyph).join('')).toBe('████████████████┃░░░')
  expect(cells[16]).toEqual({ glyph: '┃', color: '#ff0000' })
})

test('should leave the marker out when the budget is the whole window', async () => {
  const cells = barCells({ percent: 50, width: 12, tokens: 100_000, window: 200_000, budget: 200_000 })

  expect(cells.map(cell => cell.glyph).join('')).toBe('██████░░░░░░')
})

test('should turn model ids into display names', async () => {
  expect(modelDisplayName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelDisplayName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelDisplayName('claude-opus-4-20250514')).toBe('Opus 4')
  expect(modelDisplayName('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 (1M context)')
  expect(modelDisplayName('us.anthropic.claude-opus-5-5-v1:0')).toBe('us.anthropic.claude-opus-5-5-v1:0')
})

test('should darken the track to the gradient color at each point', async () => {
  expect(trackColorFor(0, 200_000)).toBe('#006600')
  expect(trackColorFor(150_000, 200_000)).toBe('#666600')
  expect(trackColorFor(500_000, 200_000)).toBe('#660000')
})

test('should run the gradient green to yellow to red', async () => {
  expect(colorFor(0, 200_000)).toBe('#00ff00')
  expect(colorFor(150_000, 200_000)).toBe('#ffff00')
  expect(colorFor(175_000, 200_000)).toBe('#ff8000')
  expect(colorFor(500_000, 200_000)).toBe('#ff0000')
})

test('should read the context budget as tokens or as a share of the window', async () => {
  expect(budgetTokens('200k', 1_000_000)).toBe(200_000)
  expect(budgetTokens('80%', 1_000_000)).toBe(800_000)
  expect(budgetTokens('1.5M', 2_000_000)).toBe(1_500_000)
  expect(budgetTokens('120000', 1_000_000)).toBe(120_000)
})

test('should fall back to 200k when the context budget is unreadable', async () => {
  expect(budgetTokens('lots', 1_000_000)).toBe(200_000)
  expect(budgetTokens('0%', 1_000_000)).toBe(200_000)
})

test('should draw the band from the session usage', async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 160_000, window: 1_000_000, percent: 16 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.root', () => ({ value: '/Users/me/Projects/app' }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'context-statusline',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 9 }, view: {} },
    })

    const drawn = await ui.drawn()
    expect(drawn).toMatchObject({ type: 'Text', props: { color: '#ffcc00', backgroundColor: '#000000', wrap: 'truncate' } })
    expect(shownText(drawn)).toBe('Opus 5.5 | app | ctx 16% [███░│░░░░░░░░░░░░░░░] 160k/1M')
    expect(childrenOf(drawn)[5]).toEqual({ type: 'Text', props: { color: '#ffcc00' }, children: ['│'] })
    await ui.unmount()
  }
})

test('should key the color on a configured share of the window', { options: { contextBudget: '80%' } }, async ($, on) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 160_000, window: 1_000_000, percent: 16 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.root', () => ({ value: '/Users/me/Projects/app' }))

  const ui = await $.ui.mount({
    plugin: 'context-statusline',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })

  const drawn = await ui.drawn()
  expect(drawn).toMatchObject({ type: 'Text', props: { color: '#44ff00', backgroundColor: '#000000', wrap: 'truncate' } })
  expect(shownText(drawn)).toBe('Opus 5.5 | app | ctx 16% [███░░░░░░░░░░░░░│░░░] 160k/1M')
})
