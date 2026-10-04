import { get, getSessionUser, list, create, update, watch } from './db.js'

const offerDocumentId = (requirementId, sellerId) => `${requirementId}_${sellerId}`
const asQuerySnapshot = (rows) => ({ docs: rows.map((row) => ({ id: row.id, data: () => row })) })
const openRequirement = (requirement) => requirement?.status === 'open' && requirement.expiresAt > Date.now()

export function watchOpenRequirements(onNext) {
  return watch('requirements', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.status === 'open'))))
}
export function watchSellerOffers(sellerId, onNext) {
  return watch('offers', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.sellerId === sellerId))))
}
export function watchBuyerCounterOffers(requirementId, buyerId, onNext) {
  return watch('counterOffers', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.requirementId === requirementId && row.buyerId === buyerId))))
}
export function watchSellerCounterOffers(sellerId, onNext) {
  return watch('counterOffers', (rows) => onNext(asQuerySnapshot(rows.filter((row) => row.sellerId === sellerId))))
}

export async function markRequirementResponsesSeen(requirementId, buyerId) {
  const requirement = await get('requirements', requirementId)
  if (!requirement || requirement.buyerId !== buyerId) return
  const activeOffers = await list('offers', (offer) => offer.requirementId === requirementId && offer.status === 'active')
  const seen = new Set(requirement.seenOfferIds || [])
  const nextSeen = activeOffers.reduce((ids, offer) => ids.add(offer.id), new Set(seen))
  if (nextSeen.size !== seen.size) await update('requirements', requirementId, { seenOfferIds: [...nextSeen] })
}

export async function createSellerOffer(requirement, values) {
  const sellerId = (await getSessionUser())?.uid
  if (!sellerId) throw new Error('SIGN_IN_REQUIRED')
  const latestRequirement = await get('requirements', requirement.id)
  const profile = await get('sellerProfiles', sellerId)
  if (!openRequirement(latestRequirement)) throw new Error('REQUIREMENT_CLOSED')
  if (!profile || profile.status !== 'approved') throw new Error('SELLER_NOT_APPROVED')
  if (!profile.categories.includes(latestRequirement.category)) throw new Error('CATEGORY_NOT_ALLOWED')
  const id = offerDocumentId(requirement.id, sellerId)
  if (await get('offers', id)) throw new Error('OFFER_EXISTS')
  await create('offers', { id, requirementId: requirement.id, requirementTitle: latestRequirement.title, requirementCategory: latestRequirement.category, sellerId, price: Number(values.price), deliveryDays: Number(values.deliveryDays), description: values.description.trim(), shortlisted: false, pendingCounterOfferId: null, status: 'active', createdAt: Date.now() })
  await update('requirements', requirement.id, { offersCount: Number(latestRequirement.offersCount || 0) + 1 })
}

export async function setOfferShortlisted(offerId, shortlisted) {
  const user = await getSessionUser()
  const offer = await get('offers', offerId)
  const requirement = offer && await get('requirements', offer.requirementId)
  if (!user || user.role !== 'buyer' || requirement?.buyerId !== user.uid || !offer || offer.status !== 'active' || !openRequirement(requirement)) throw new Error('OFFER_UNAVAILABLE')
  await update('offers', offerId, { shortlisted: Boolean(shortlisted) })
}

export async function createCounterOffer(offerId, proposedPrice) {
  const buyer = await getSessionUser()
  const buyerId = buyer?.uid
  if (buyer?.role !== 'buyer') throw new Error('REQUIREMENT_NOT_OWNED')
  const offer = await get('offers', offerId)
  if (!offer || offer.status !== 'active') throw new Error('OFFER_UNAVAILABLE')
  const requirement = await get('requirements', offer.requirementId)
  if (!offer.shortlisted) throw new Error('OFFER_NOT_SHORTLISTED')
  if (offer.pendingCounterOfferId) throw new Error('COUNTER_ALREADY_PENDING')
  if (!requirement || requirement.buyerId !== buyerId) throw new Error('REQUIREMENT_NOT_OWNED')
  if (!openRequirement(requirement)) throw new Error('REQUIREMENT_CLOSED')
  const profile = await get('sellerProfiles', offer.sellerId)
  if (profile?.status !== 'approved') throw new Error('SELLER_NOT_APPROVED')
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await create('counterOffers', { id, offerId, requirementId: offer.requirementId, requirementTitle: offer.requirementTitle, buyerId, sellerId: offer.sellerId, proposedPrice: Number(proposedPrice), status: 'pending', createdAt: Date.now(), respondedAt: null })
  await update('offers', offerId, { pendingCounterOfferId: id })
}

export async function respondToCounterOffer(counterOfferId, decision) {
  const user = await getSessionUser()
  if (!['accepted', 'declined'].includes(decision)) throw new Error('INVALID_COUNTER_DECISION')
  const counter = await get('counterOffers', counterOfferId)
  if (!counter || counter.status !== 'pending') throw new Error('COUNTER_UNAVAILABLE')
  const offer = await get('offers', counter.offerId)
  const requirement = await get('requirements', counter.requirementId)
  const profile = await get('sellerProfiles', counter.sellerId)
  if (!user || user.uid !== counter.sellerId || user.role !== 'seller' || !offer || offer.pendingCounterOfferId !== counterOfferId || !profile || profile.status !== 'approved') throw new Error('COUNTER_UNAVAILABLE')
  if (!openRequirement(requirement)) throw new Error('REQUIREMENT_CLOSED')
  await update('counterOffers', counterOfferId, { status: decision, respondedAt: Date.now() })
  await update('offers', counter.offerId, { ...(decision === 'accepted' ? { price: counter.proposedPrice } : {}), pendingCounterOfferId: null })
}

export async function acceptRequirementOffer(requirementId, offerId) {
  const buyer = await getSessionUser()
  const buyerId = buyer?.uid
  if (buyer?.role !== 'buyer') throw new Error('REQUIREMENT_NOT_OWNED')
  const requirement = await get('requirements', requirementId)
  const allOffers = await list('offers', (row) => row.requirementId === requirementId)
  if (!requirement || requirement.buyerId !== buyerId) throw new Error('REQUIREMENT_NOT_OWNED')
  if (!openRequirement(requirement)) throw new Error('REQUIREMENT_CLOSED')
  if (Number(requirement.offersCount ?? allOffers.length) !== allOffers.length) throw new Error('OFFERS_CHANGED')
  const selectedOffer = allOffers.find((row) => row.id === offerId)
  if (!selectedOffer || selectedOffer.status !== 'active') throw new Error('OFFER_UNAVAILABLE')
  if (selectedOffer.pendingCounterOfferId) throw new Error('COUNTER_OFFER_PENDING')
  await update('requirements', requirementId, { status: 'closed', acceptedOfferId: offerId, acceptedSellerId: selectedOffer.sellerId })
  await Promise.all(allOffers.map((offer) => {
    if (offer.id === offerId && offer.status === 'active') return update('offers', offer.id, { status: 'accepted', buyerId })
    if (['active', 'withdrawn'].includes(offer.status)) return update('offers', offer.id, { status: 'notChosen' })
    return Promise.resolve()
  }))
  return offerId
}

export async function updateSellerOffer(offerId, values) {
  const user = await getSessionUser()
  const offer = await get('offers', offerId)
  if (!user || user.role !== 'seller' || user.uid !== offer?.sellerId || !offer || offer.status !== 'active' || offer.pendingCounterOfferId) throw new Error('OFFER_UNAVAILABLE')
  if ((await get('sellerProfiles', user.uid))?.status !== 'approved') throw new Error('SELLER_NOT_APPROVED')
  if (!openRequirement(await get('requirements', offer.requirementId))) throw new Error('REQUIREMENT_CLOSED')
  await update('offers', offerId, { price: Number(values.price), deliveryDays: Number(values.deliveryDays), description: values.description.trim() })
}
export async function withdrawSellerOffer(offerId) {
  const user = await getSessionUser()
  const offer = await get('offers', offerId)
  if (!user || user.role !== 'seller' || user.uid !== offer?.sellerId || !offer || offer.status !== 'active' || !openRequirement(await get('requirements', offer.requirementId))) throw new Error('OFFER_UNAVAILABLE')
  if ((await get('sellerProfiles', user.uid))?.status !== 'approved') throw new Error('SELLER_NOT_APPROVED')
  await update('offers', offerId, { status: 'withdrawn' })
}
