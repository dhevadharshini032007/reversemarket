import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeTopTradeOff } from './tradeOffSummary.js'

test('returns no summary when fewer than two offers exist', () => {
  assert.equal(summarizeTopTradeOff([]), '')
  assert.equal(summarizeTopTradeOff([{ total: 80, price: 40000, deliveryDays: 3 }]), '')
})

test('summarizes score lead, lower price, and faster delivery between the top two', () => {
  const summary = summarizeTopTradeOff([
    { total: 87.4, price: 50000, deliveryDays: 5 },
    { total: 82, price: 40000, deliveryDays: 3 },
  ])

  assert.equal(summary, 'Offer 1 leads by 5.4 points; Offer 2 costs Rs 10,000 less; Offer 2 arrives 2 days sooner.')
})

test('describes tied scores and identical terms', () => {
  const summary = summarizeTopTradeOff([
    { total: 80, price: 40000, deliveryDays: 4 },
    { total: 80, price: 40000, deliveryDays: 4 },
  ])

  assert.equal(summary, 'Offers 1 and 2 are tied at 80 points; both offers have the same price; both offers have the same delivery time.')
})
