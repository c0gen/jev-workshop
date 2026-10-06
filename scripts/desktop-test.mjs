import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

await mkdir('.test-data', { recursive: true })
const profile = await mkdtemp(resolve('.test-data/profile-'))
let app
const errors = []
async function launch() {
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, JEV_TEST_DATA: profile },
    timeout: 30_000
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(12_000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: 'Run experiment', exact: false }).waitFor()
  return page
}
try {
  let page = await launch()
  await page.screenshot({ path: '.test-data/builder-light.png' })
  await app.evaluate(() => {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/v1/models'))
        return new Response(
          JSON.stringify({
            models: [{ name: 'jev-latest', description: 'Test model', release_date: '2026-09-15' }]
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      if (String(url).endsWith('/v1/systemone')) {
        const request = JSON.parse(options.body),
          answers = {}
        if (globalThis.__jevDelay)
          await new Promise((resolve) => setTimeout(resolve, globalThis.__jevDelay))
        for (const [key, question] of Object.entries(request.questions)) {
          if (question.type === 'noul') answers[key] = { type: 'noul', noul: 0.97 }
          else if (question.type === 'choice') {
            const keys = Object.keys(question.criteria)
            answers[key] = {
              type: 'choice',
              choice: keys[0],
              confidence: 0.85,
              probabilities: Object.fromEntries(
                keys.map((key, i) => [key, i === 0 ? 0.9 : 0.1 / (keys.length - 1)])
              )
            }
          } else {
            const n = question.criteria.length
            answers[key] = {
              type: 'score',
              score: n - 1 - 0.3,
              confidence: 0.8,
              probabilities: Object.fromEntries(
                question.criteria.map((_, i) => [i, i === n - 1 ? 0.7 : i === n - 2 ? 0.3 : 0])
              ),
              legend: Object.fromEntries(question.criteria.map((value, i) => [i, value]))
            }
          }
        }
        return new Response(
          JSON.stringify({
            model: 'jev-test-version',
            answers,
            usage: { input_tokens: 210, output_tokens: 16 }
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      }
      throw new Error('Unmocked network request blocked by desktop test')
    }
  })
  await app.evaluate(({ clipboard }) => {
    clipboard.writeText = (text) => {
      globalThis.__jevClipboard = text
    }
  })
  await page.getByRole('button', { name: 'Settings', exact: false }).first().click()
  await page.getByLabel('API key', { exact: true }).fill('jev-fake-desktop-test-key')
  await page.getByRole('button', { name: 'Save & test connection' }).click()
  await page.getByText('Connected to TypeSafe.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Run experiment', exact: false }).click()
  await page.getByText('Evaluation complete', { exact: true }).waitFor()
  await page.getByLabel('Experiment name').fill('My routing experiment')
  await page.getByLabel('Input content', { exact: true }).fill('A second input for comparison.')
  await page.getByRole('button', { name: 'Run experiment', exact: false }).click()
  await page.getByRole('tab', { name: 'History', exact: false }).click()
  await page.getByText('Run 2', { exact: false }).first().waitFor()
  await page.getByRole('tab', { name: 'Compare', exact: false }).click()
  await page.getByLabel('Baseline run').waitFor()
  await page.screenshot({ path: '.test-data/compare-dark.png' })
  await page.getByRole('tab', { name: 'Results', exact: false }).click()
  await page.locator('.thresholds summary').first().click()
  await page.getByLabel('Confidence threshold').first().fill('0.95')
  await page.screenshot({ path: '.test-data/results-dark.png' })
  await page.getByRole('button', { name: 'Get code', exact: false }).click()
  assert.match(await page.locator('.code-export').innerText(), /TYPESAFE_API_KEY/)
  assert.doesNotMatch(await page.locator('.code-export').innerText(), /jev-fake-desktop-test-key/)
  await page.getByRole('button', { name: 'Copy code', exact: true }).click()
  await page.getByRole('button', { name: 'Copied', exact: true }).waitFor()
  assert.match(await app.evaluate(() => globalThis.__jevClipboard), /TYPESAFE_API_KEY/)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  console.log('Connection, evaluations, comparison, thresholds, and clipboard passed.')
  await app.evaluate(() => {
    globalThis.__jevDelay = 2000
  })
  await page.getByRole('button', { name: 'Run experiment', exact: false }).click()
  await page.getByText('Jev is evaluating…', { exact: true }).waitFor()
  await page
    .getByLabel('Input content', { exact: true })
    .fill('Edited while the previous snapshot was running.')
  await page.getByRole('button', { name: 'Run experiment', exact: false }).waitFor()
  await page.getByText('Saved locally', { exact: true }).waitFor()
  const inFlightState = await page.evaluate(() => window.jev.load())
  assert.equal(inFlightState.value.runs[0].request.state, 'A second input for comparison.')
  assert.equal(
    inFlightState.value.experiments[0].request.state,
    'Edited while the previous snapshot was running.'
  )
  console.log('In-flight edits stay separate from immutable run snapshots.')
  await page.getByRole('button', { name: 'JSON', exact: true }).first().click()
  await page.getByRole('textbox', { name: 'Request JSON' }).fill('{ unfinished JSON draft')
  await page.getByText('Fix the draft before running').waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Run experiment', exact: false }).isDisabled(),
    true
  )
  await page.getByText('Saved locally', { exact: true }).waitFor()
  const state = await page.evaluate(async () => window.jev.load())
  assert.equal(state.ok, true)
  assert.equal(state.value.runs.length, 3)
  assert.equal(state.value.preferences.theme, 'dark')
  assert.equal(state.value.experiments[0].draft, '{ unfinished JSON draft')
  assert.equal(JSON.stringify(state).includes('jev-fake-desktop-test-key'), false)
  const encrypted = await readFile(resolve(profile, 'credentials.bin'))
  assert.equal(encrypted.includes('jev-fake-desktop-test-key'), false)
  await app.close()
  app = undefined
  page = await launch()
  console.log('Restarted isolated profile.')
  await page.getByText('Fix the draft before running').waitFor()
  assert.equal(await page.getByLabel('Experiment name').inputValue(), 'My routing experiment')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.getByRole('button', { name: 'Revert to last valid request' }).click()
  await page.getByRole('button', { name: 'Builder', exact: true }).click()
  await page.getByRole('button', { name: 'New experiment' }).click()
  await page.getByRole('button', { name: 'Spam detection', exact: false }).click()
  assert.equal(await page.getByLabel('Experiment name').inputValue(), 'Spam detection')
  await page.getByRole('button', { name: 'Favorite experiment', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate experiment', exact: true }).click()
  assert.equal(await page.getByLabel('Experiment name').inputValue(), 'Spam detection (copy)')
  await page.getByLabel('Search experiments').fill('routing')
  await page.getByRole('button', { name: 'My routing experiment', exact: false }).first().click()
  await page.getByLabel('Search experiments').fill('')
  assert.equal(
    await page.getByRole('region', { name: 'Experiment editor', exact: true }).count(),
    1
  )
  assert.equal(
    await page.getByRole('region', { name: 'Results and history', exact: true }).count(),
    1
  )
  // Exercise structured form editing, using the canonical raw request underneath.
  await page.getByTitle('Edit Input content as JSON').click()
  await page
    .getByRole('textbox', { name: 'Structured field JSON' })
    .fill('{"message":"Structured input", "flags":[true,null]}')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'JSON', exact: true }).first().click()
  assert.match(
    await page.getByRole('textbox', { name: 'Request JSON' }).innerText(),
    /Structured input/
  )
  await page.getByRole('button', { name: 'Builder', exact: true }).click()
  console.log('Structured field round-trip passed.')
  // Native dialogs are stubbed to isolated test paths, never the user's files.
  const backupPath = resolve(profile, 'backup.json')
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, backupPath)
  await page.getByRole('button', { name: 'Backup', exact: true }).click()
  await page.getByText('Backup exported.', { exact: false }).waitFor()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  assert.equal(backup.schemaVersion, 1)
  assert.equal(JSON.stringify(backup).includes('jev-fake-desktop-test-key'), false)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page
    .getByText(`Imported ${backup.experiments.length} experiments`, { exact: false })
    .waitFor()
  console.log('Native backup and import workflow passed.')
  // Check the compact window and keyboard-operated panel resizing at high DPI.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1100, 760)
  })
  await page.getByRole('separator', { name: 'Resize experiment library' }).focus()
  await page.keyboard.press('ArrowLeft')
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false
  )
  await page.screenshot({ path: '.test-data/compact-dark.png' })
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1520, 980)
  })
  await page.screenshot({ path: '.test-data/restored-dark.png' })
  assert.deepEqual(errors, [])
  console.log(
    'Desktop acceptance passed: onboarding, encrypted key, model discovery, mocked evaluations, in-flight editing, thresholds, history, comparison, export code, invalid draft recovery, theme/session restore, templates, favorites, duplication, search, structured editing, backup/import, and compact layout.'
  )
  console.log(`Isolated test profile: ${profile}`)
} catch (error) {
  console.error(error)
  try {
    await app?.windows()[0]?.screenshot({ path: '.test-data/failure.png' })
  } catch {}
  process.exitCode = 1
} finally {
  if (app) {
    const ownProcess = app.process()
    const timer = setTimeout(() => ownProcess.kill(), 8000)
    try {
      await app.close()
    } catch {
    } finally {
      clearTimeout(timer)
    }
  }
}
