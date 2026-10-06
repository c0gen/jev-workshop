import { app, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { Repository } from './repository'
import { CredentialStore } from './credentials'
import { registerIpc } from './ipc'

const here = fileURLToPath(new URL('.', import.meta.url))
protocol.registerSchemesAsPrivileged([
  { scheme: 'jev', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])
app.setName('Jev Playground')
// Tests use an isolated library; production never accepts this override.
if (!app.isPackaged && process.env.JEV_TEST_DATA)
  app.setPath('userData', resolve(process.env.JEV_TEST_DATA))
const locked = app.requestSingleInstanceLock()
if (!locked) app.quit()
else {
  let window: BrowserWindow | undefined
  let repository: Repository | undefined
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })
  app
    .whenReady()
    .then(() => {
      const root = resolve(here, '../renderer')
      protocol.handle('jev', (request) => {
        const url = new URL(request.url)
        if (url.host !== 'app') return new Response('Not found', { status: 404 })
        const path = resolve(
          root,
          `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`
        )
        if (!path.startsWith(`${root}${sep}`)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(path).toString())
      })
      repository = new Repository(join(app.getPath('userData'), 'library.sqlite'))
      const credentials = new CredentialStore(join(app.getPath('userData'), 'credentials.bin'))
      window = new BrowserWindow({
        width: 1520,
        height: 980,
        minWidth: 1050,
        minHeight: 680,
        show: false,
        backgroundColor: '#101413',
        title: 'Jev Playground',
        autoHideMenuBar: true,
        icon: app.isPackaged
          ? join(process.resourcesPath, 'icon.png')
          : join(here, '../../resources/icon.png'),
        webPreferences: {
          preload: join(here, '../preload/index.cjs'),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true
        }
      })
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.webContents.on('will-navigate', (event) => event.preventDefault())
      window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false)
      )
      const cleanup = registerIpc(window, repository, credentials)
      let readyToClose = false
      let closeTimer: ReturnType<typeof setTimeout> | undefined
      window.on('close', (event) => {
        if (!readyToClose && !window!.webContents.isDestroyed()) {
          event.preventDefault()
          window!.webContents.send('jev:closing')
          if (!closeTimer)
            closeTimer = setTimeout(async () => {
              closeTimer = undefined
              if (!window || window.isDestroyed() || readyToClose) return
              const answer = await dialog.showMessageBox(window, {
                type: 'warning',
                title: 'Changes have not finished saving',
                message: 'The app has not confirmed that your latest edits are saved.',
                detail:
                  'Keep the window open to retry saving, or close without saving the remaining edits.',
                buttons: ['Keep open', 'Close without saving'],
                defaultId: 0,
                cancelId: 0
              })
              if (answer.response === 1) {
                readyToClose = true
                window.close()
              }
            }, 5000)
        }
      })
      ipcMain.on('jev:close-ready', (event) => {
        if (
          event.sender === window?.webContents &&
          event.senderFrame === window.webContents.mainFrame
        ) {
          clearTimeout(closeTimer)
          readyToClose = true
          window.close()
        }
      })
      window.on('closed', () => {
        clearTimeout(closeTimer)
        cleanup()
        repository?.close()
        repository = undefined
        app.quit()
      })
      window.once('ready-to-show', () => {
        if (!(process.env.JEV_TEST_DATA && !app.isPackaged)) window!.show()
      })
      window.webContents.on('render-process-gone', () => {
        readyToClose = true
        window?.close()
      })
      if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL)
        void window.loadURL(process.env.ELECTRON_RENDERER_URL)
      else void window.loadURL('jev://app/index.html')
    })
    .catch((error) => {
      dialog.showErrorBox(
        'Jev Playground could not start',
        error instanceof Error ? error.message : 'Unknown startup error'
      )
      app.exit(1)
    })
}
