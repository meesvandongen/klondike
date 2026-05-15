const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { buildMenu } = require('./menu');

let mainWindow = null;

const statsPath = () => path.join(app.getPath('userData'), 'stats.json');

function loadStats() {
  try {
    return JSON.parse(fs.readFileSync(statsPath(), 'utf8'));
  } catch (_) {
    return { gamesPlayed: 0, gamesWon: 0, bestTimeSec: null, bestScore: 0 };
  }
}

function saveStats(stats) {
  try {
    fs.mkdirSync(path.dirname(statsPath()), { recursive: true });
    fs.writeFileSync(statsPath(), JSON.stringify(stats, null, 2));
  } catch (_) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 740,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a5d2a',
    title: 'Klondike',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  buildMenu(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

ipcMain.handle('stats:get', () => loadStats());

ipcMain.handle('stats:update', (_event, result) => {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  if (result.won) {
    stats.gamesWon += 1;
    if (typeof result.timeSec === 'number') {
      if (stats.bestTimeSec === null || result.timeSec < stats.bestTimeSec) {
        stats.bestTimeSec = result.timeSec;
      }
    }
    if (typeof result.score === 'number' && result.score > stats.bestScore) {
      stats.bestScore = result.score;
    }
  }
  saveStats(stats);
  return stats;
});

ipcMain.handle('stats:reset', () => {
  const empty = { gamesPlayed: 0, gamesWon: 0, bestTimeSec: null, bestScore: 0 };
  saveStats(empty);
  return empty;
});

ipcMain.handle('dialog:about', () => {
  return dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Klondike',
    message: 'Klondike',
    detail:
      'Klondike Solitaire\nVersion 1.0.0\n\nA classic single-player card game in the style of the Windows Vista edition.',
    buttons: ['OK']
  });
});
