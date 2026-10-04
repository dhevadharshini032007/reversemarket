import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRequirementSentence } from './requirementParser.js'

test('parses under-40k budget, day deadline, category, title, and keywords', () => {
  const parsed = parseRequirementSentence('Need steel folding chairs for campus event under 40k within 5 days')

  assert.equal(parsed.budget, 40000)
  assert.equal(parsed.deadlineDays, 5)
  assert.equal(parsed.category, 'Event supplies')
  assert.equal(parsed.title, 'Need steel folding chairs for campus event')
  assert.ok(parsed.keywords.includes('steel'))
  assert.ok(!parsed.title.includes('40k'))
})

test('parses an Rs-formatted budget and a week deadline', () => {
  const parsed = parseRequirementSentence('Books for a course, Rs 40,000, in a week')

  assert.equal(parsed.budget, 40000)
  assert.equal(parsed.deadlineDays, 7)
  assert.equal(parsed.category, 'Books')
})

test('parses a plain standalone budget amount', () => {
  const parsed = parseRequirementSentence('Laptop for design class 40000')

  assert.equal(parsed.budget, 40000)
  assert.equal(parsed.category, 'Electronics')
  assert.equal(parsed.title, 'Laptop for design class')
})

test('calculates by-weekday deadline relative to a fixed date', () => {
  const parsed = parseRequirementSentence('Need a table by Friday', new Date(2025, 0, 1))

  assert.equal(parsed.deadlineDays, 2)
})

test('uses safe defaults when no budget or deadline is stated', () => {
  const parsed = parseRequirementSentence('Need a repair service')

  assert.equal(parsed.budget, '')
  assert.equal(parsed.deadlineDays, 7)
  assert.equal(parsed.category, 'Services')
  assert.equal(parsed.title, 'Need a repair service')
})
