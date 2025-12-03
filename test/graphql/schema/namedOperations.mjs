import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GRAPHQL_TEST_DIR = path.resolve(__dirname, '..')

async function collectTestFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await collectTestFiles(fullPath)
      files.push(...nested)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath)
    }
  }
  return files
}

test('GraphQL test operations are named', async () => {
  const files = await collectTestFiles(GRAPHQL_TEST_DIR)
  const offenders = []
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')

    const anonymousPattern = /\b(mutation|query|subscription)\s*\{/g
    let match
    while ((match = anonymousPattern.exec(content))) {
      offenders.push({ file: path.relative(GRAPHQL_TEST_DIR, file), index: match.index, keyword: match[1] })
    }
  }

  const message = offenders
    .map(({ file, index, keyword }) => `${file}:${index} contains anonymous ${keyword}`)
    .join('\n')

  assert.equal(offenders.length, 0, message || 'anonymous operations detected')
})
