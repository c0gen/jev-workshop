# Jev Workshop

A personal Windows desktop workspace for experimenting with TypeSafe Jev. Build requests with forms or JSON, inspect probabilities, compare saved runs, and try local acceptance thresholds.

## Using the app

Install **Jev Workshop Setup 1.0.0.exe** from `release/`, then open **Jev Workshop** from the Start menu. The installer is per-user and bundles its runtime; Node.js is not needed to use the installed application.

1. Start with **Message routing**, or select **New experiment** for four editable examples.
2. Open **Settings**, paste your TypeSafe API key, and choose **Save & test connection**. Connection testing lists models and does not evaluate your input.
3. Edit the input and questions in **Builder**, or switch to **JSON**. Structured instructions, criteria, and state can also be edited with the small **JSON** buttons beside individual fields.
4. Select **Run experiment** or press **Ctrl+Enter**. Inspect the result cards, token usage, duration, and actual model version.
5. Change your experiment and run it again. **History** opens earlier snapshots; **Compare** shows two runs side by side. Expand **Threshold sandbox** to try acceptance rules locally without another API request.

Changes save automatically after a short pause. **Ctrl+S** flushes outstanding edits. Invalid JSON drafts are also saved; fix or revert the draft before running or returning to the form builder. Closing the app normally flushes pending edits. A run interrupted by an app crash is marked interrupted when the app reopens and is never automatically resubmitted.

Use **Get code** to copy Python or TypeScript HTTP examples. These use the `TYPESAFE_API_KEY` environment variable and never contain the key saved in the app. The Python example uses only the standard library; the TypeScript example uses Node.js native `fetch`.

## Local data and backups

- Experiments, preferences, and history live in `library.sqlite` under `%APPDATA%\Jev Playground`. Jev Workshop keeps the original data directory so existing libraries and saved keys remain available after the rename.
- The key is stored separately in `credentials.bin`, protected by Windows DPAPI through Electron `safeStorage`. Settings can replace or remove it. Windows protection is tied to your Windows account; it does not isolate the key from other programs running as that same user.
- **Backup** exports the whole library. The experiment toolbar's export button exports just that experiment and its history. Neither export includes saved credentials.
- **Import** adds new copies with new IDs, leaving existing experiments intact. Backups are versioned JSON with a 50 MB import limit.
- Editing and browsing history work offline. Clicking **Run** sends the current request snapshot to TypeSafe. There is no telemetry, cloud synchronization, or external automation.
- Reinstalling/updating the app preserves its data. Database upgrades create a backup before migrations; a database from a newer app version is never downgraded automatically.

## Result semantics

Choice returns one option and its probability distribution. Score returns a probability-weighted score, which may be fractional, along with the rubric. Both include TypeSafe's separate confidence measure. Yes/No (Noul) returns only the probability of yes.

Threshold defaults are illustrative: Choice/Score use confidence `>= 0.8`; Yes/No uses `<= 0.2` for No, `>= 0.8` for Yes, and Review between them. Adjusting these previews does not change the model output or perform downstream actions. Numeric comparison deltas are hidden when question types or criteria differ.

Requests have a 30-second overall deadline. Explicit rate limits and server failures may be retried up to twice. Connection failures and timeouts require a manual retry. Cancel stops local waiting and retrying; the provider may still have processed the request.

## Development

Use Node.js 24 and npm 11 on Windows x64. Dependencies and the lockfile are pinned.

```powershell
npm ci
npm run dev
```

```powershell
npm run typecheck
npm run format:check
npm test
npm run test:desktop
npm run pack
npm run dist
```

`pack` creates the self-contained application directory. `dist` creates the per-user NSIS installer under `release/`. Builds are unsigned personal builds; no code-signing service or automatic updater is configured.

The installer keeps the original `local.jev.playground` app ID so Jev Workshop updates existing installations.

The pinned `better-sqlite3` 13 package includes a Node-API Windows binary. Native rebuilding is intentionally disabled; the binary is unpacked beside the Electron archive. A C++ toolchain is not required for this configuration.

## Architecture

| Module                        | Responsibility                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/shared`                  | Runtime schemas, canonical requests, result interpretation, comparison, templates, and code export  |
| `src/main`                    | SQLite repository, encrypted credentials, TypeSafe SDK adapter, validated IPC, and window lifecycle |
| `src/preload`                 | Narrow typed bridge; no generic IPC, filesystem, or shell access exposed to the renderer            |
| `src/renderer/src/features`   | Library, experiment editing, results, comparison, setup, settings, and exports                      |
| `src/renderer/src/components` | Reusable JSON editor, dialogs, resize dividers, and probability bars                                |

The renderer is sandboxed with context isolation and no Node integration. The installed interface uses a local `jev://app` origin and denies navigation/new windows. Input and imported material are always rendered as data, never executed.

## Verification

Unit/integration tests cover canonical requests, structured fields, response validation, fractional scores, threshold boundaries, comparison compatibility, safe code generation, SDK transport behavior, real SQLite recovery, imports, and migrations. The Python snippet round-trip test requires Python 3 in the development environment.

The desktop test launches Electron with a separate `.test-data` profile and mocks all TypeSafe calls in the main process. It checks setup, encrypted credentials, mocked evaluations, editing during an active request, history/comparison, threshold controls, code export, invalid JSON recovery, theme restoration, templates, favorites, duplication, search, structured-field editing, native backup/import, and compact-window layout. Screenshots are written to `.test-data`. Tests never use a real API key or incur provider charges.

Live service verification is intentionally opt-in: supply your key in Settings and run an example. No real TypeSafe call is made during the automated test suite.

Future work is deliberately separate: batch dataset evaluation, reusable input variables, and workflow branching or additional providers.
