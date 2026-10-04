import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBudgetAdvice, formatBudgetAdvice } from './budgetAdvice.js'

const prices = (...values) => values.map((price) => ({ price }))

test('returns no advice when there are no valid offers', () => {
  assert.equal(calculateBudgetAdvice(20000, []), null)
  assert.equal(calculateBudgetAdvice(20000, prices(0, -1, 'bad')), null)
})

test('uses the median for an odd number of offers', () => {
  const advice = calculateBudgetAdvice(20000, prices(40000, 50000, 70000))

  assert.equal(advice.median, 50000)
  assert.equal(advice.raiseAmount, 30000)
  assert.equal(advice.suggestedBudget, 50000)
  assert.match(formatBudgetAdvice(advice), /60% below/)
})

test('averages the middle pair for an even number of offers', () => {
  const advice = calculateBudgetAdvice(20000, prices(30000, 40000, 60000, 80000))

  assert.equal(advice.median, 50000)
})

test('does not warn when budget is within 25 percent of median', () => {
  assert.equal(calculateBudgetAdvice(37500, prices(50000)), null)
})

test('warns when budget is more than 25 percent below the median', () => {
  assert.equal(calculateBudgetAdvice(37000, prices(50000))?.raiseAmount, 13000)
})
