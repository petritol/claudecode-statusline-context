import { expect, test } from 'claude-code/testing'

import { colorFor, modelDisplayName, budgetTokens, statusLine } from '../hooks/register'

test('should format the line and degrade with width', async () => {
  const base = { model: 'Opus 5.5', project: 'Projects', tokens: 50_000, window: 1_000_000, percent: 5 }

  expect(statusLine({ ...base, columns: 120 })).toBe(
    'Opus 5.5 | Projects | ctx 5% [█░░░░░░░░░░░░░░░░░░░] 50k/1M',
  )
  expect(statusLine({ ...base, columns: 80 })).toBe('Opus 5.5 | Projects | ctx 5% [█░░░░░░░░░░░] 50k/1M')
  expect(statusLine({ ...base, columns: 40 })).toBe('Opus 5.5 | Projects | ctx 5% 50k/1M')
  expect(statusLine({ ...base, tokens: 250_000, percent: 25, columns: 40 })).toBe('Opus 5.5 | ctx 25% 250k/1M 200k+')
})

test('should turn model ids into display names', async () => {
  expect(modelDisplayName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelDisplayName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelDisplayName('claude-opus-4-20250514')).toBe('Opus 4')
  expect(modelDisplayName('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 (1M context)')
  expect(modelDisplayName('us.anthropic.claude-opus-5-5-v1:0')).toBe('us.anthropic.claude-opus-5-5-v1:0')
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

  const ui = await $.ui.mount({
    plugin: 'context-statusline',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })

  expect(await ui.drawn()).toEqual({
    type: 'Text',
    props: { color: '#ffcc00', wrap: 'truncate' },
    children: ['Opus 5.5 | app | ctx 16% [███░░░░░░░░░░░░░░░░░] 160k/1M'],
  })
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

  expect(await ui.drawn()).toEqual({
    type: 'Text',
    props: { color: '#44ff00', wrap: 'truncate' },
    children: ['Opus 5.5 | app | ctx 16% [███░░░░░░░░░░░░░░░░░] 160k/1M'],
  })
})
