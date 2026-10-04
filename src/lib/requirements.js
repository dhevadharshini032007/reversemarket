import { create, get, getSessionUser, list, update, watch } from './db.js'
import { parseKeywords } from './requirementValidation.js'

const DAY_MS = 24 * 60 * 60 * 1000
const asSnapshot = (row) => ({ exists: () => Boolean(row), data: () => row })
const asQuerySnapshot = (rows) => ({ docs: rows.map((row) => ({ id: row.id, data: () => row })) })

function requirementFields(values) {
  return { title: values.title.trim(), details: (values.details || '').trim(), category: values.category, budget: Number(values.budget), deadlineDays: Number(values.deadlineDays), keywords: parseKeywords(values.keywords) }
}

export async function createRequirement(buyerId, values) {
  const user = await getSessionUser()
  if (!user || user.uid !== buyerId || user.role !== 'buyer') throw new Error('REQUIREMENT_NOT_OWNED')
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await create('requirements', { id, buyerId, ...requirementFields(values), seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, offersCount: 0, createdAt: Date.now(), expiresAt: Date.now() + Number(values.deadlineDays) * DAY_MS })
  return id
}

export async function updateRequirement(requirementId, values) {
  const [user, requirement] = await Promise.all([getSessionUser(), get('requirements', requirementId)])
  if (!user || user.role !== 'buyer' || requirement?.buyerId !== user.uid || requirement.status !== 'open' || requirement.expiresAt <= Date.now()) throw new Error('REQUIREMENT_NOT_OWNED')
  await update('requirements', requirementId, { ...requirementFields(values), expiresAt: Date.now() + Number(values.deadlineDays) * DAY_MS })
}

export async function cancelRequirement(requirementId) {
  const [user, requirement] = await Promise.all([getSessionUser(), get('requirements', requirementId)])
  if (!user || user.role !== 'buyer' || requirement?.buyerId !== user.uid || requirement.status !== 'open' || requirement.expiresAt <= Date.now()) throw new Error('REQUIREMENT_NOT_OWNED')
  await update('requirements', requirementId, { status: 'cancelled' })
}
export async function expireRequirement(requirementId) {
  const requirement = await get('requirements', requirementId)
  if (requirement?.status === 'open' && requirement.expiresAt <= Date.now()) await update('requirements', requirementId, { status: 'expired' })
}

export function watchBuyerRequirements(buyerId, onNext, onError) {
  return watch('requirements', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.buyerId === buyerId))), onError)
}
export function watchBuyerRequirement(requirementId, onNext, onError) {
  return watch('requirements', (rows) => onNext(asSnapshot(rows.find((row) => row.id === requirementId) || null)), onError)
}
export function watchRequirementOffers(requirementId, onNext, onError) {
  return watch('offers', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.requirementId === requirementId && row.status === 'active'))), onError)
}
export async function getRequirementOfferCount(requirementId) {
  return (await list('offers', (row) => row.requirementId === requirementId && row.status === 'active')).length
}

export async function getUnreadRequirementOfferCount(requirementId) {
  const [requirement, offers] = await Promise.all([
    get('requirements', requirementId),
    list('offers', (row) => row.requirementId === requirementId && row.status === 'active'),
  ])
  const seen = new Set(requirement?.seenOfferIds || [])
  return offers.filter((offer) => !seen.has(offer.id)).length
}
