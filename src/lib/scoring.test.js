import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreOffers } from './scoring.js'

const requirement = {
  budget: 40000,
  deadlineDays: 5,
  keywords: ['chair', 'steel'],
}

function offer(id, overrides = {}) {
  return {
    id,
    price: 36000,
    deliveryDays: 3,
    description: 'Steel folding chairs, delivery included.',
    ...overrides,
  }
}

test('returns no ranked entries when there are no offers', () => {
  assert.deepEqual(scoreOffers([], requirement), [])
})

test('scores and labels a single offer with all three badges', () => {
  const [result] = scoreOffers([offer('one')], requirement)

  assert.deepEqual(result.scores, { budget: 100, delivery: 82, relevance: 100 })
  assert.equal(result.total, 94.6)
  assert.equal(result.why, 'Rs 4,000 under budget, 2 days early, matches 2 of 2 keywords.')
  assert.deepEqual(result.badges, ['Best match', 'Best value', 'Fastest'])
})

test('gives tied offers the same badges', () => {
  const results = scoreOffers([offer('first'), offer('second')], requirement)

  assert.equal(results.length, 2)
  for (const result of results) {
    assert.deepEqual(result.badges, ['Best match', 'Best value', 'Fastest'])
  }
})

test('scores late delivery using the late-days penalty', () => {
  const [result] = scoreOffers([offer('late', { deliveryDays: 6 })], requirement)

  assert.equal(result.scores.delivery, 45)
  assert.match(result.why, /1 day late/)
})

test('reduces budget score for an over-budget offer', () => {
  const [result] = scoreOffers([offer('over', { price: 45000 })], requirement)

  assert.equal(result.scores.budget, 63)
  assert.match(result.why, /Rs 5,000 over budget/)
})

test('matches simple plurals and uses the default relevance score without keywords', () => {
  const [pluralMatch] = scoreOffers([offer('plural', { description: 'Steel folding chair.' })], requirement)
  const [noKeywords] = scoreOffers([offer('no-keywords')], { ...requirement, keywords: [] })

  assert.equal(pluralMatch.scores.relevance, 100)
  assert.equal(noKeywords.scores.relevance, 70)
  assert.match(noKeywords.why, /no keyword criteria/)
})

test('uses default weights if every supplied weight is zero', () => {
  const [result] = scoreOffers([offer('defaults')], requirement, { budget: 0, delivery: 0, relevance: 0 })

  assert.equal(result.total, 94.6)
})

test('buyer priorities rerank offers immediately', () => {
  const offers = [
    offer('budget', { price: 30000, deliveryDays: 10, description: 'Basic chair available later.' }),
    offer('delivery', { price: 45000, deliveryDays: 2, description: 'Steel chair ready soon.' }),
  ]

  const budgetFirst = scoreOffers(offers, requirement, { budget: 10, delivery: 0, relevance: 0 })
  const deliveryFirst = scoreOffers(offers, requirement, { budget: 0, delivery: 10, relevance: 0 })

  assert.equal(budgetFirst[0].id, 'budget')
  assert.equal(deliveryFirst[0].id, 'delivery')
})
