import { createServer } from 'node:http'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId } from 'mongodb'
import { seedArticles } from '../shared/articles.js'

const scrypt = promisify(scryptCallback)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const databaseName = process.env.MONGODB_DATABASE || 'fixdesk'
const port = Number(process.env.API_PORT || 3001)
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
const cookieName = 'fixdesk_session'
const authAttempts = new Map()
const allowedCategories = new Set(['Hardware', 'Network', 'Software', 'Access'])
const allowedPriorities = new Set(['Low', 'Medium', 'High'])
const allowedArticleCategories = new Set(['Hardware & devices', 'Software & apps', 'Network & access', 'Accounts & security'])
const trustProxy = process.env.TRUST_PROXY === 'true'
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 })

let users
let sessions
let tickets
let articles

function send(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie || ''
  const item = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null
}

function isSecureRequest(request) {
  if (request.socket.encrypted) return true
  return trustProxy && String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'
}

function clientAddress(request) {
  if (trustProxy && request.headers['x-forwarded-for']) {
    return String(request.headers['x-forwarded-for']).split(',')[0].trim()
  }
  return request.socket.remoteAddress || 'unknown'
}

function sessionCookie(token, request) {
  const secure = isSecureRequest(request) ? '; Secure' : ''
  return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationMs / 1000}${secure}`
}

function expiredCookie(request) {
  const secure = isSecureRequest(request) ? '; Secure' : ''
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex')
}

function rateLimited(request) {
  const key = clientAddress(request)
  const now = Date.now()
  const current = authAttempts.get(key)
  if (current && current.resetAt > now && current.count >= 10) return true
  if (!current || current.resetAt <= now) authAttempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 })
  else current.count += 1
  return false
}

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role === 'agent' ? 'agent' : 'employee' }
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1024 * 1024) throw Object.assign(new Error('Request body is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
}

async function passwordHash(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
}

async function createSession(user, request, response) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await sessions.insertOne({ tokenHash: tokenDigest(token), userId: user._id, createdAt: now, expiresAt: new Date(now.getTime() + sessionDurationMs) })
  response.setHeader('Set-Cookie', sessionCookie(token, request))
}

async function authenticatedUser(request) {
  const token = cookieValue(request, cookieName)
  if (!token) return null
  const session = await sessions.findOne({ tokenHash: tokenDigest(token), expiresAt: { $gt: new Date() } })
  if (!session) return null
  return users.findOne({ _id: session.userId })
}

function publicTicket(ticket) {
  const updated = ticket.updatedAt instanceof Date
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ticket.updatedAt)
    : 'Just now'
  return { id: ticket.id, title: ticket.title, description: ticket.description, category: ticket.category, status: ticket.status, priority: ticket.priority, resolutionNote: ticket.resolutionNote || '', updated }
}

function publicAgentTicket(ticket) {
  return {
    ...publicTicket(ticket),
    requester: {
      name: ticket.requester?.name || 'Unknown employee',
      email: ticket.requester?.email || '',
    },
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    await mongo.db('admin').command({ ping: 1 })
    return send(response, 200, { status: 'ok', database: 'connected' })
  }

  const modifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  const origin = request.headers.origin
  const requestHost = request.headers['x-forwarded-host'] || request.headers.host
  if (modifying && origin) {
    try {
      if (new URL(origin).host !== requestHost) return send(response, 403, { error: 'Request origin is not allowed.' })
    } catch {
      return send(response, 403, { error: 'Request origin is not allowed.' })
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    if (rateLimited(request)) return send(response, 429, { error: 'Too many account attempts. Try again in a few minutes.' }, { 'Retry-After': '600' })
    const body = await readJson(request)
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (name.length < 2 || name.length > 80) return send(response, 400, { error: 'Enter a name between 2 and 80 characters.' })
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(response, 400, { error: 'Enter a valid email address.' })
    if (password.length < 8 || password.length > 128) return send(response, 400, { error: 'Password must be between 8 and 128 characters.' })
    const salt = randomBytes(16)
    const user = { name, email, role: 'employee', passwordSalt: salt.toString('hex'), passwordHash: (await passwordHash(password, salt)).toString('hex'), createdAt: new Date() }
    try {
      const result = await users.insertOne(user)
      user._id = result.insertedId
    } catch (error) {
      if (error.code === 11000) return send(response, 409, { error: 'An account with this email already exists. Sign in instead.' })
      throw error
    }
    await createSession(user, request, response)
    return send(response, 201, { user: publicUser(user) })
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    if (rateLimited(request)) return send(response, 429, { error: 'Too many sign-in attempts. Try again in a few minutes.' }, { 'Retry-After': '600' })
    const body = await readJson(request)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const user = await users.findOne({ email })
    const salt = user?.passwordSalt ? Buffer.from(user.passwordSalt, 'hex') : Buffer.alloc(16)
    const expected = user?.passwordHash ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64)
    const actual = await passwordHash(password, salt)
    if (!user || !user.passwordHash || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return send(response, 401, { error: 'Email or password is incorrect.' })
    authAttempts.delete(clientAddress(request))
    await createSession(user, request, response)
    return send(response, 200, { user: publicUser(user) })
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = cookieValue(request, cookieName)
    if (token) await sessions.deleteOne({ tokenHash: tokenDigest(token) })
    return send(response, 200, { success: true }, { 'Set-Cookie': expiredCookie(request) })
  }

  const user = await authenticatedUser(request)
  if (!user) return send(response, 401, { error: 'Please sign in to continue.' })

  if (request.method === 'GET' && url.pathname === '/api/auth/me') return send(response, 200, { user: publicUser(user) })

  if (url.pathname === '/api/agent/tickets' || url.pathname.startsWith('/api/agent/tickets/')) {
    if (user.role !== 'agent') return send(response, 403, { error: 'Support agent access is required.' })

    if (request.method === 'GET' && url.pathname === '/api/agent/tickets') {
      const records = await tickets.aggregate([
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'requester' } },
        { $unwind: { path: '$requester', preserveNullAndEmptyArrays: true } },
      ]).toArray()
      return send(response, 200, { tickets: records.map(publicAgentTicket) })
    }

    const ticketRoute = url.pathname.match(/^\/api\/agent\/tickets\/([^/]+)$/)
    if (request.method === 'PATCH' && ticketRoute) {
      const body = await readJson(request)
      const status = String(body.status || '')
      if (!['Open', 'In progress', 'Resolved'].includes(status)) return send(response, 400, { error: 'Choose a valid ticket status.' })
      const resolutionNote = String(body.resolutionNote || '').trim()
      if (status === 'Resolved' && (resolutionNote.length < 10 || resolutionNote.length > 2000)) {
        return send(response, 400, { error: 'Add a resolution note between 10 and 2000 characters before solving this ticket.' })
      }
      const update = { $set: { status, updatedAt: new Date() } }
      if (status === 'Resolved') update.$set.resolutionNote = resolutionNote
      else update.$unset = { resolutionNote: '' }
      const result = await tickets.findOneAndUpdate(
        { id: decodeURIComponent(ticketRoute[1]) },
        update,
        { returnDocument: 'after' },
      )
      if (!result) return send(response, 404, { error: 'Ticket not found.' })
      return send(response, 200, { ticket: publicTicket(result) })
    }

    return send(response, 404, { error: 'Agent API route not found.' })
  }

  if (request.method === 'GET' && url.pathname === '/api/articles') {
    const records = await articles.find({}, { projection: { _id: 0, title: 1, category: 1, views: 1, icon: 1, steps: 1, details: 1 } }).sort({ category: 1, title: 1 }).toArray()
    return send(response, 200, { articles: records })
  }

  if (request.method === 'POST' && url.pathname === '/api/articles') {
    if (user.role !== 'agent') return send(response, 403, { error: 'Support agent access is required to publish Knowledge Base articles.' })
    const body = await readJson(request)
    const title = String(body.title || '').trim()
    const category = String(body.category || '')
    const answer = String(body.answer || '').trim()
    if (title.length < 5 || title.length > 160) return send(response, 400, { error: 'Article title must be between 5 and 160 characters.' })
    if (!allowedArticleCategories.has(category)) return send(response, 400, { error: 'Choose a valid Knowledge Base category.' })
    if (answer.length < 20 || answer.length > 5000) return send(response, 400, { error: 'Article answer must be between 20 and 5000 characters.' })
    const iconByCategory = { 'Hardware & devices': '▦', 'Software & apps': '◈', 'Network & access': '⌁', 'Accounts & security': '◇' }
    const article = { title, category, views: 'New', icon: iconByCategory[category], steps: ['Recommended fix'], details: [answer], createdAt: new Date(), createdBy: user._id }
    try {
      await articles.insertOne(article)
    } catch (error) {
      if (error.code === 11000) return send(response, 409, { error: 'An article with this title already exists.' })
      throw error
    }
    return send(response, 201, { article: { title: article.title, category: article.category, views: article.views, icon: article.icon, steps: article.steps, details: article.details } })
  }

  if (request.method === 'GET' && url.pathname === '/api/tickets') {
    const records = await tickets.find({ userId: user._id }).sort({ createdAt: -1 }).toArray()
    return send(response, 200, { tickets: records.map(publicTicket) })
  }

  if (request.method === 'POST' && url.pathname === '/api/tickets') {
    if (user.role === 'agent') return send(response, 403, { error: 'Support agents cannot create employee support tickets.' })
    const body = await readJson(request)
    const title = String(body.title || '').trim()
    const description = String(body.description || '').trim()
    const category = String(body.category || '')
    const priority = String(body.priority || '')
    if (title.length < 3 || title.length > 160) return send(response, 400, { error: 'Ticket title must be between 3 and 160 characters.' })
    if (description.length < 10 || description.length > 5000) return send(response, 400, { error: 'Description must be between 10 and 5000 characters.' })
    if (!allowedCategories.has(category)) return send(response, 400, { error: 'Choose a valid ticket category.' })
    if (!allowedPriorities.has(priority)) return send(response, 400, { error: 'Choose a valid priority.' })
    const record = { id: `FD-${randomBytes(4).toString('hex').toUpperCase()}`, userId: user._id, title, description, category, status: 'Open', priority, createdAt: new Date(), updatedAt: new Date() }
    await tickets.insertOne(record)
    return send(response, 201, { ticket: publicTicket(record) })
  }

  return send(response, 404, { error: 'API route not found.' })
}

async function serveFrontend(request, response, pathname) {
  const dist = path.join(root, 'frontend', 'dist')
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '')
  const file = path.resolve(dist, requested)
  if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) return send(response, 400, { error: 'Invalid path.' })
  try {
    const content = await readFile(file)
    const extension = path.extname(file)
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
    response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' })
    response.end(content)
  } catch {
    if (path.extname(pathname)) return send(response, 404, { error: 'File not found.' })
    const index = await readFile(path.join(dist, 'index.html'))
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
    response.end(index)
  }
}

async function start() {
  await mongo.connect()
  const database = mongo.db(databaseName)
  users = database.collection('users')
  sessions = database.collection('sessions')
  tickets = database.collection('tickets')
  articles = database.collection('articles')
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    tickets.createIndex({ userId: 1, createdAt: -1 }),
    tickets.createIndex({ id: 1 }, { unique: true }),
    articles.createIndex({ title: 1 }, { unique: true }),
  ])
  if (await articles.estimatedDocumentCount() === 0) {
    await articles.insertMany(seedArticles.map((article) => ({ ...article, createdAt: new Date() })))
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      if (url.pathname.startsWith('/api/')) await handleApi(request, response, url)
      else if (request.method === 'GET' || request.method === 'HEAD') await serveFrontend(request, response, url.pathname)
      else send(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' })
    } catch (error) {
      console.error('FixDesk request failed:', error)
      if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : 'The server could not complete this request.' })
      else response.destroy()
    }
  })

  const host = process.env.API_HOST || '127.0.0.1'
  server.listen(port, host, () => console.log(`FixDesk API listening on http://${host}:${port} (${databaseName})`))
  const shutdown = async () => { server.close(); await mongo.close(); process.exit(0) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start().catch(async (error) => {
  console.error('Could not start FixDesk. Check MongoDB is running and MONGODB_URI is correct.', error.message)
  await mongo.close()
  process.exit(1)
})
