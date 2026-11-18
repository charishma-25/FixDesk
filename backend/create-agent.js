import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { MongoClient } from 'mongodb'

const scrypt = promisify(scryptCallback)
const mongo = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 })
const databaseName = process.env.MONGODB_DATABASE || 'fixdesk'

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Run `npm run create-agent` from an interactive terminal so the password can be entered privately.'))
      return
    }

    let value = ''
    const finish = (error = null) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') return finish(new Error('Cancelled.'))
        if (character === '\r' || character === '\n') return finish()
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ') value += character
      }
    }

    stdout.write(prompt)
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout })
  let name
  let email
  try {
    name = (await terminal.question('Support agent name: ')).trim()
    email = (await terminal.question('Support agent email: ')).trim().toLowerCase()
  } finally {
    terminal.close()
  }

  if (name.length < 2 || name.length > 80) throw new Error('Name must be between 2 and 80 characters.')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')

  const password = await readHidden('Password (8-128 characters): ')
  if (password.length < 8 || password.length > 128) throw new Error('Password must be between 8 and 128 characters.')
  const confirmation = await readHidden('Confirm password: ')
  const left = Buffer.from(password)
  const right = Buffer.from(confirmation)
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('The passwords do not match.')

  await mongo.connect()
  const users = mongo.db(databaseName).collection('users')
  await users.createIndex({ email: 1 }, { unique: true })
  const salt = randomBytes(16)
  await users.insertOne({
    name,
    email,
    role: 'agent',
    passwordSalt: salt.toString('hex'),
    passwordHash: (await hashPassword(password, salt)).toString('hex'),
    createdAt: new Date(),
  })
  console.log(`Support agent account created for ${email}. Sign in through the FixDesk login page.`)
}

main().catch((error) => {
  if (error.code === 11000) console.error('An account with that email already exists. No account was changed.')
  else console.error(error.message)
  process.exitCode = 1
}).finally(() => mongo.close())
