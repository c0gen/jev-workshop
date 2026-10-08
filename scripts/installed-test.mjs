import { _electron as electron } from 'playwright'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

const executablePath = process.argv[2]
if (!executablePath) throw new Error('Pass the absolute path to the installed Jev Workshop.exe')
const app = await electron.launch({
  executablePath: resolve(executablePath),
  args: [],
  timeout: 30_000
})
const errors = []
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(15_000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'New experiment', exact: true }).waitFor()
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true)
  const state = await page.evaluate(() => window.jev.load())
  assert.equal(state.ok, true)
  assert.ok(state.value.experiments.length > 0)
  assert.equal(
    await page.getByRole('region', { name: 'Experiment editor', exact: true }).count(),
    1
  )
  await page.getByRole('button', { name: 'Settings', exact: false }).first().click()
  await page.getByText('TYPESAFE CONNECTION', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.screenshot({ path: '.test-data/installed-app.png' })
  assert.deepEqual(errors, [])
  console.log(
    'Installed Windows application passed: bundled runtime, ASAR assets, preload bridge, native SQLite, starter workspace, and Settings. No live API call was made.'
  )
} finally {
  const ownProcess = app.process()
  const timer = setTimeout(() => ownProcess.kill(), 8000)
  try {
    await app.close()
  } finally {
    clearTimeout(timer)
  }
}
