const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
let isDev = process.argv.includes('--dev');

function createWindow() {
    // Get primary display dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        x: width - 420, // Position near right edge
        y: height - 620, // Position near bottom
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: isDev, // Only resizable in dev mode
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Allow loading local files
        }
    });

    // Don't set click-through by default - let user toggle it
    // if (!isDev) {
    //     mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // }

    // Load the index.html
    mainWindow.loadFile('index.html');

    // Open DevTools in dev mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC handlers for avatar control
ipcMain.handle('set-click-through', (event, clickThrough) => {
    if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    }
});

ipcMain.handle('set-always-on-top', (event, alwaysOnTop) => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(alwaysOnTop);
    }
});

ipcMain.handle('move-avatar', (event, x, y) => {
    if (mainWindow) {
        mainWindow.setPosition(x, y);
    }
});

// Avatar control commands (for future MCP integration)
ipcMain.handle('avatar-command', (event, command) => {
    // Forward commands to renderer
    if (mainWindow) {
        mainWindow.webContents.send('avatar-action', command);
    }
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Prevent app from quitting when window is closed
app.on('before-quit', (event) => {
    if (!isDev) {
        event.preventDefault();
        if (mainWindow) {
            mainWindow.hide();
        }
    }
});