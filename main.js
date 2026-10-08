const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

// Los datos de partida se guardan junto al perfil del usuario, no en el repo.
const saveDir = app.getPath('userData');
const savePath = path.join(saveDir, 'savegame.json');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0d17',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

ipcMain.handle('save:write', (_event, data) => {
  try {
    fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save:read', () => {
  try {
    if (!fs.existsSync(savePath)) return { ok: true, data: null };
    return { ok: true, data: JSON.parse(fs.readFileSync(savePath, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:quit', () => app.quit());

/* ------------------------------------------------------------------ */
/* Enlaces externos                                                    */
/* ------------------------------------------------------------------ */

// La dirección vive AQUÍ, no en la pantalla que pulsa el botón: así el canal
// abre un único sitio conocido y no cualquier URL que le pasen. Y va al
// navegador del sistema con `shell.openExternal`, nunca dentro de la app: una
// web cargada en la propia ventana se quedaría con el marco del juego.
const ARENA_URL = 'https://aeternumtcgchile.fun';

ipcMain.handle('arena:abrir', async () => {
  try {
    await shell.openExternal(ARENA_URL);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
