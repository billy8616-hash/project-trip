import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const usersJsonPath = join(__dirname, 'data', 'users.json')

async function main() {
  const raw = await readFile(usersJsonPath, 'utf8').catch(() => '[]')
  const users = JSON.parse(raw)

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        birthdate: user.birthdate,
        gender: user.gender ?? null,
        phone: user.phone ?? null,
        passwordHash: user.passwordHash,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        birthdate: user.birthdate,
        gender: user.gender ?? null,
        phone: user.phone ?? null,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      },
    })
  }

  console.log(`Migrated ${users.length} users to SQLite.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
