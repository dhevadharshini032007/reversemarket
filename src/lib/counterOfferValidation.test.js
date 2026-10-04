import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCounterOffer } from './counterOfferValidation.js'

test('accepts a positive counter price within the configured bound', () => {
  assert.equal(validateCounterOffer('32000'), '')
})

test('rejects empty, non-positive, and out-of-range counter prices', () => {
  assert.match(validateCounterOffer(''), /greater than Rs 0/)
  assert.match(validateCounterOffer('0'), /greater than Rs 0/)
  assert.match(validateCounterOffer('1000000001'), /greater than Rs 0/)
})
