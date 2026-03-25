const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  // Настройка сессии для подмены User-Agent во всех запросах
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Рекомендуется false для безопасности
      contextIsolation: true, // Рекомендуется true
      sandbox: false, // Нужно для некоторых функций Firebase в Electron
    },
    icon: path.join(__dirname, 'public/favicon.ico')
  });

  // Устанавливаем User-Agent и для самого окна
  win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  // Разрешаем открытие окон (для Google Auth)
  win.webContents.setWindowOpenHandler(({ url }) => {
    return { 
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          sandbox: false,
          contextIsolation: true,
        }
      }
    };
  });

  // В разработке загружаем с локального сервера Vite
  // В продакшене (после сборки) загружаем index.html из папки dist
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Открываем инструменты разработчика только в режиме разработки
  if (isDev) {
    win.webContents.openDevTools();
  }
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
