const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./server.cjs');

let mainWindow = null;
let localServer = null;

const resolvePicDbDir = () => {
  const packagedDir = path.join(path.dirname(process.execPath), 'pic_db');
  if (app.isPackaged && fs.existsSync(packagedDir)) {
    return packagedDir;
  }

  return path.resolve(__dirname, '..', 'pic_db');
};

const resolveDistDir = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'dist');
  }

  return path.resolve(__dirname, '..', 'dist');
};

const startLocalServer = () => new Promise((resolve, reject) => {
  const distDir = resolveDistDir();
  const picDbDir = resolvePicDbDir();
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

  localServer = createServer({ distDir, picDbDir, baseDir });
  localServer.once('error', reject);
  localServer.listen(37654, '127.0.0.1', () => {
    const address = localServer.address();
    resolve(`http://127.0.0.1:${address.port}`);
  });
});

const createMainWindow = async () => {
  const appUrl = await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: '智绘阅读',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  await mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox('智绘阅读启动失败', error?.message || String(error));
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (localServer) {
    localServer.close();
    localServer = null;
  }
});
