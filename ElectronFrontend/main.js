const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // Enable Menu Bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // win.setMenu(null); // Allow default menu (View -> Developer Tools)

  win.loadFile('index.html');

  // SPAWN PYTHON: Point this to your venv's python.exe
  /*
  const pythonPath = path.join(__dirname, '../venv/Scripts/python.exe');
  const scriptPath = path.join(__dirname, '../PythonServer/main.py');
  const serverDir = path.join(__dirname, '../PythonServer');

  pythonProcess = spawn(pythonPath, [scriptPath], { cwd: serverDir });

  pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));
  */
}

// IPC Handler for Folder Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return;
  } else {
    return filePaths[0];
  }
});

app.whenReady().then(createWindow);

// Kill Python when the app closes
app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});