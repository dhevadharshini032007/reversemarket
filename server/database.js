import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const defaultPath = resolve(serverDirectory, 'data', 'reversemarket.sqlite')
const databasePath = process.env.DATABASE_PATH || defaultPath
mkdirSync(dirname(databasePath), { recursive: true })

export const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    phone TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL,
    passwordSalt TEXT NOT NULL,
    passwordHash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seller_profiles (
    uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    businessName TEXT NOT NULL,
    sellerType TEXT NOT NULL,
    categories TEXT NOT NULL,
    productTags TEXT NOT NULL DEFAULT '[]',
    location TEXT NOT NULL,
    idType TEXT NOT NULL,
    idNumber TEXT NOT NULL COLLATE NOCASE UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    rejectionReason TEXT NOT NULL DEFAULT '',
    reapplicationPending INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    buyerId TEXT NOT NULL REFERENCES users(uid),
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    budget REAL NOT NULL,
    deadlineDays INTEGER NOT NULL,
    keywords TEXT NOT NULL,
    seenOfferIds TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'cancelled', 'expired')),
    acceptedOfferId TEXT,
    acceptedSellerId TEXT,
    offersCount INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    requirementId TEXT NOT NULL REFERENCES requirements(id),
    requirementTitle TEXT NOT NULL,
    requirementCategory TEXT NOT NULL,
    sellerId TEXT NOT NULL REFERENCES users(uid),
    price REAL NOT NULL,
    deliveryDays INTEGER NOT NULL,
    description TEXT NOT NULL,
    shortlisted INTEGER NOT NULL DEFAULT 0,
    pendingCounterOfferId TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn', 'accepted', 'notChosen')),
    createdAt INTEGER NOT NULL,
    buyerId TEXT,
    UNIQUE(requirementId, sellerId)
  );
  CREATE TABLE IF NOT EXISTS counter_offers (
    id TEXT PRIMARY KEY,
    offerId TEXT NOT NULL REFERENCES offers(id),
    requirementId TEXT NOT NULL REFERENCES requirements(id),
    requirementTitle TEXT NOT NULL,
    buyerId TEXT NOT NULL REFERENCES users(uid),
    sellerId TEXT NOT NULL REFERENCES users(uid),
    proposedPrice REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
    createdAt INTEGER NOT NULL,
    respondedAt INTEGER
  );
  CREATE INDEX IF NOT EXISTS requirements_buyer_idx ON requirements(buyerId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS offers_requirement_idx ON offers(requirementId, status);
  CREATE INDEX IF NOT EXISTS offers_seller_idx ON offers(sellerId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS counter_offers_seller_idx ON counter_offers(sellerId, createdAt DESC);
`)

function json(value) { return JSON.stringify(value) }
function daysFromNow(days) { return Date.now() + days * 86400000 }
function seedStatements() {
  const addUser = database.prepare('INSERT INTO users (uid, role, name, email, phone, createdAt, passwordSalt, passwordHash) VALUES (@uid, @role, @name, @email, @phone, @createdAt, @passwordSalt, @passwordHash)')
  const addProfile = database.prepare('INSERT INTO seller_profiles (uid, businessName, sellerType, categories, productTags, location, idType, idNumber, description, status, rejectionReason) VALUES (@uid, @businessName, @sellerType, @categories, @productTags, @location, @idType, @idNumber, @description, @status, @rejectionReason)')
  const addRequirement = database.prepare('INSERT INTO requirements (id, buyerId, title, details, category, budget, deadlineDays, keywords, seenOfferIds, status, acceptedOfferId, acceptedSellerId, offersCount, createdAt, expiresAt) VALUES (@id, @buyerId, @title, @details, @category, @budget, @deadlineDays, @keywords, @seenOfferIds, @status, @acceptedOfferId, @acceptedSellerId, @offersCount, @createdAt, @expiresAt)')
  const addOffer = database.prepare('INSERT INTO offers (id, requirementId, requirementTitle, requirementCategory, sellerId, price, deliveryDays, description, shortlisted, pendingCounterOfferId, status, createdAt) VALUES (@id, @requirementId, @requirementTitle, @requirementCategory, @sellerId, @price, @deliveryDays, @description, @shortlisted, @pendingCounterOfferId, @status, @createdAt)')

  const userRows = [
    ['admin-demo', 'admin', 'ReverseMarket Admin', 'admin@demo.com', '', 'Admin2026'],
    ['buyer-demo-1', 'buyer', 'Ananya Rao', 'ananya@demo.com', '9876500001', 'Demo2026'],
    ['buyer-demo-2', 'buyer', 'Karthik Iyer', 'karthik@demo.com', '9876500002', 'Demo2026'],
    ['seller-demo-1', 'seller', 'Meera Nair', 'meera@demo.com', '9876500003', 'Demo2026'],
    ['seller-demo-2', 'seller', 'Arjun Kumar', 'arjun@demo.com', '9876500004', 'Demo2026'],
    ['seller-demo-3', 'seller', 'Priya Shah', 'priya@demo.com', '9876500005', 'Demo2026'],
    ['seller-demo-4', 'seller', 'Ravi Stores', 'ravi@demo.com', '9876500006', 'Demo2026'],
  ]
  userRows.forEach(([uid, role, name, email, phone, password]) => {
    const passwordSalt = bcrypt.genSaltSync(10)
    addUser.run({ uid, role, name, email, phone, createdAt: Date.now(), passwordSalt, passwordHash: bcrypt.hashSync(password, passwordSalt) })
  })

  const profiles = [
    { uid: 'seller-demo-1', businessName: 'Meera Tech & Books', sellerType: 'shop', categories: ['Electronics', 'Books', 'Event supplies', 'Furniture'], productTags: ['laptop', 'textbooks', 'chairs'], location: 'Chennai', idType: 'Student ID', idNumber: 'CAMPUS-S-001', description: 'Campus electronics and course materials', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-2', businessName: 'Arjun Campus Supply', sellerType: 'individual', categories: ['Electronics', 'Event supplies', 'Furniture'], productTags: ['laptop', 'banners', 'folding chairs'], location: 'Chennai', idType: 'Shop licence', idNumber: 'CAMPUS-S-002', description: 'Reliable supplies for student groups', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-3', businessName: 'Priya Print Studio', sellerType: 'company', categories: ['Services', 'Books', 'Event supplies'], productTags: ['textbooks', 'printing', 'banners', 'badges'], location: 'Chennai', idType: 'Student ID', idNumber: 'CAMPUS-S-003', description: 'Printing, binding, and event services', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-4', businessName: 'Ravi Campus Mart', sellerType: 'shop', categories: ['Electronics', 'Furniture', 'Other'], productTags: ['laptop', 'desks', 'chargers'], location: 'Chennai', idType: 'Shop licence', idNumber: 'CAMPUS-S-004', description: 'Everyday campus essentials', status: 'pending', rejectionReason: '' },
  ]
  profiles.forEach((profile) => addProfile.run({ ...profile, categories: json(profile.categories), productTags: json(profile.productTags) }))

  const requirementRows = [
    { id: 'req-campus-laptop', buyerId: 'buyer-demo-1', title: 'Laptop for engineering lab work', details: 'Laptop required for CAD and coding classes', category: 'Electronics', budget: 65000, deadlineDays: 14, keywords: ['16GB RAM', 'SSD', 'engineering'], offersCount: 3 },
    { id: 'req-campus-books', buyerId: 'buyer-demo-1', title: 'Second-year engineering textbooks', details: 'New or clean used editions for the semester', category: 'Books', budget: 9000, deadlineDays: 10, keywords: ['engineering', 'textbooks', 'used'], offersCount: 2 },
    { id: 'req-fest-printing', buyerId: 'buyer-demo-2', title: 'College fest banners and badges', details: 'Need colourful print work for our annual campus festival', category: 'Event supplies', budget: 18000, deadlineDays: 21, keywords: ['printing', 'banners', 'badges'], offersCount: 3 },
    { id: 'req-seminar-chairs', buyerId: 'buyer-demo-2', title: 'Folding chairs for department seminar', details: 'Delivery to the seminar hall before the department event', category: 'Furniture', budget: 30000, deadlineDays: 30, keywords: ['folding', 'chairs', 'seminar'], offersCount: 2 },
  ].map((row) => ({ ...row, seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, createdAt: Date.now(), expiresAt: daysFromNow(row.deadlineDays) }))
  requirementRows.forEach((row) => addRequirement.run({ ...row, keywords: json(row.keywords), seenOfferIds: json(row.seenOfferIds) }))

  const offers = [
    ['req-campus-laptop', 'seller-demo-1', 61900, 5, 'Configured for lab assignments with 16GB RAM and SSD storage.'],
    ['req-campus-laptop', 'seller-demo-2', 63500, 3, 'New laptop with campus delivery and setup support.'],
    ['req-campus-laptop', 'seller-demo-3', 59900, 8, 'Refurbished business model, tested and warranty included.'],
    ['req-campus-books', 'seller-demo-1', 7200, 2, 'Complete textbook set with clean second-hand copies.'],
    ['req-campus-books', 'seller-demo-3', 8400, 4, 'New editions, bundled and ready for collection.'],
    ['req-fest-printing', 'seller-demo-2', 15800, 6, 'Weather-safe banners and 200 name badges.'],
    ['req-fest-printing', 'seller-demo-3', 14900, 8, 'Full-colour print package with proof review.'],
    ['req-fest-printing', 'seller-demo-1', 17200, 5, 'Premium fabric banners and laminated badges.'],
    ['req-seminar-chairs', 'seller-demo-2', 26400, 10, 'Twenty sturdy folding chairs delivered to campus.'],
    ['req-seminar-chairs', 'seller-demo-1', 28800, 7, 'Metal-frame chairs with floor protectors.'],
  ]
  offers.forEach(([requirementId, sellerId, price, deliveryDays, description], index) => {
    const requirement = requirementRows.find((row) => row.id === requirementId)
    const id = `${requirementId}_${sellerId}`
    addOffer.run({ id, requirementId, requirementTitle: requirement.title, requirementCategory: requirement.category, sellerId, price, deliveryDays, description, shortlisted: index === 1 ? 1 : 0, pendingCounterOfferId: null, status: 'active', createdAt: Date.now() - index * 1000 })
  })
}

export function seedDemoData({ reset = false } = {}) {
  const seed = database.transaction(() => {
    if (reset) {
      database.exec('DELETE FROM counter_offers; DELETE FROM offers; DELETE FROM requirements; DELETE FROM seller_profiles; DELETE FROM users;')
    } else if (database.prepare('SELECT 1 FROM users LIMIT 1').get()) {
      return
    }
    seedStatements()
  })
  seed()
}

export function decodeUser(row) {
  return row ? { ...row } : null
}

export function decodeProfile(row) {
  if (!row) return null
  return { ...row, categories: JSON.parse(row.categories), productTags: JSON.parse(row.productTags), reapplicationPending: Boolean(row.reapplicationPending) }
}

export function decodeRequirement(row) {
  if (!row) return null
  return { ...row, keywords: JSON.parse(row.keywords), seenOfferIds: JSON.parse(row.seenOfferIds) }
}

export function decodeOffer(row) {
  return row ? { ...row, shortlisted: Boolean(row.shortlisted) } : null
}

export function decodeCounterOffer(row) {
  return row ? { ...row } : null
}

export function publicUser(row) {
  if (!row) return null
  const user = { ...row }
  delete user.passwordSalt
  delete user.passwordHash
  return user
}
