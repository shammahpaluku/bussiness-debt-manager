const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Database = require('./services/database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'VinLedger - Wine Debtors Manager'
  });

  const devUrl = 'http://localhost:3001';
  if (!app.isPackaged) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
  // Diagnostics
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Renderer] did-fail-load:', errorCode, errorDescription, validatedURL);
    // Fallback to local file if dev URL fails
    if (!app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Renderer] did-finish-load');
    mainWindow.webContents.executeJavaScript('console.log("HAS_WINDOW_REQUIRE", typeof window.require)');
  });

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  db = new Database();
  
  createWindow();

  // Auto-update in production
  if (app.isPackaged) {
    try {
      autoUpdater.on('error', (err) => console.error('[Updater] error', err));
      autoUpdater.on('update-available', (info) => console.log('[Updater] update-available', info.version));
      autoUpdater.on('update-not-available', () => console.log('[Updater] update-not-available'));
      autoUpdater.on('download-progress', (p) => {
        if (mainWindow) {
          mainWindow.webContents.send('update:progress', Math.round(p.percent));
        }
      });
      autoUpdater.on('update-available', (info) => {
        if (mainWindow) {
          mainWindow.webContents.send('update:available', info.version);
        }
      });
      autoUpdater.on('update-downloaded', async () => {
        if (mainWindow) {
          mainWindow.webContents.send('update:downloaded');
        }
        const res = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update ready',
          message: 'An update was downloaded. Restart to install now?'
        });
        if (res.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.error('[Updater] failed to start updater', e);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for database operations
ipcMain.handle('db:getCustomers', async () => {
  return await db.getCustomers();
});

ipcMain.handle('db:addCustomer', async (event, customer) => {
  return await db.addCustomer(customer);
});

ipcMain.handle('db:updateCustomer', async (event, id, customer) => {
  return await db.updateCustomer(id, customer);
});

ipcMain.handle('db:deleteCustomer', async (event, id) => {
  return await db.deleteCustomer(id);
});

ipcMain.handle('db:getDebts', async (event, branchId) => {
  return await db.getDebts(branchId);
});

ipcMain.handle('db:addDebt', async (event, debt) => {
  return await db.addDebt(debt);
});

ipcMain.handle('db:updateDebt', async (event, id, debt) => {
  return await db.updateDebt(id, debt);
});

ipcMain.handle('db:deleteDebt', async (event, id) => {
  return await db.deleteDebt(id);
});

ipcMain.handle('db:getPayments', async (event, branchId) => {
  return await db.getPayments(branchId);
});

ipcMain.handle('db:addPayment', async (event, payment) => {
  return await db.addPayment(payment);
});

ipcMain.handle('db:getDashboardData', async (event, branchId) => {
  return await db.getDashboardData(branchId);
});

ipcMain.handle('db:getSettings', async () => {
  return await db.getSettings();
});

ipcMain.handle('db:updateSettings', async (event, settings) => {
  return await db.updateSettings(settings);
});

// Branches
ipcMain.handle('db:getBranches', async () => {
  return await db.getBranches();
});

ipcMain.handle('db:getAllBranches', async () => {
  return await db.getAllBranches();
});

ipcMain.handle('db:addBranch', async (event, name) => {
  return await db.addBranch(name);
});

ipcMain.handle('db:updateBranch', async (event, id, updates) => {
  return await db.updateBranch(id, updates);
});

ipcMain.handle('db:backup', async () => {
  return await db.createBackup();
});

ipcMain.handle('db:restore', async (event, backupPath) => {
  return await db.restoreBackup(backupPath);
});

ipcMain.handle('db:exportCSV', async (event, type) => {
  return await db.exportCSV(type);
});

// Manual update check
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { started: false };
  try {
    await autoUpdater.checkForUpdates();
    return { started: true };
  } catch (e) {
    return { started: false, error: String(e) };
  }
});

// File dialog handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'VinLedger Backup', extensions: ['vinledgerbak'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'VinLedger Backup', extensions: ['vinledgerbak'] },
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  });
  return result;
});
