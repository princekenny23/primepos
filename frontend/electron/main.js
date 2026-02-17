const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')
const isDev = require('electron-is-dev')
const { spawn } = require('child_process')

let mainWindow
let backendProcess

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`

  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startBackend() {
  if (isDev) {
    // Start Python backend in development
    const pythonPath = process.env.PYTHON_PATH || 'python'
    const backendDir = path.join(__dirname, '../../backend')
    
    backendProcess = spawn(pythonPath, ['manage.py', 'runserver'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: true,
    })

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err)
    })

    backendProcess.on('exit', (code) => {
      console.log('Backend process exited with code:', code)
    })
  }
}

app.on('ready', () => {
  startBackend()
  
  // Wait a bit for backend to start before creating window
  setTimeout(() => {
    createWindow()
  }, 2000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})

// Create menu
const template = [
  {
    label: 'File',
    submenu: [{ label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
    ],
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
