import { app, BrowserWindow, ipcMain, dialog, utilityProcess } from "electron";
import path from "path";
import fs from "fs";

let electronWindow = null;
let startTimestamp = null;
let backendProcess = null;

function ensureBackendRunning() {
    fetch('http://localhost:3000/')
        .then(() => {
            console.log('Backend server already active on port 3000');
        })
        .catch(() => {
            console.log('Starting background backend server...');
            const serverScript = path.join(import.meta.dirname, '../backend/server.js');
            const dataDir = path.join(app.getPath('userData'), 'data');
            try {
                backendProcess = utilityProcess.fork(serverScript, [], {
                    env: {
                        ...process.env,
                        ATHENA_DATA_DIR: dataDir
                    }
                });
            } catch (err) {
                console.error('Failed to spawn backend process:', err);
            }
        });
}

function createWindow() {
    electronWindow = new BrowserWindow({
        height: 1000,
        width: 1000,
        webPreferences: {
            devTools: !app.isPackaged,
            preload: path.join(import.meta.dirname, 'preload.js')
        }
    });

    if (app.isPackaged) {
        electronWindow.loadFile(path.join(import.meta.dirname, '../dist/index.html'));
    } else {
        electronWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
            .catch(() => {
                electronWindow.loadFile(path.join(import.meta.dirname, '../dist/index.html'));
            });
    }
}

ipcMain.handle('start-timer', (event) => {
    startTimestamp = Date.now();

    // Send Timer Tick every 1s
    setInterval(() => {
        if (electronWindow && !electronWindow.isDestroyed()) {
            electronWindow.webContents.send('timer', (Date.now() - startTimestamp) / 1000);
        }
    }, 1000);

    // Capture user's camera snap every 5s
    setInterval(() => {
        if (electronWindow && !electronWindow.isDestroyed()) {
            electronWindow.webContents.send('camera-shot');
        }
    }, 5000);
});

ipcMain.handle('store-camera-snap-image-on-disk', (_event, data) => {
    const snapDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'user-camera-snap')
        : path.join(import.meta.dirname, 'user-camera-snap');

    if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
    }

    const filePath = path.join(snapDir, `${Date.now()}.jpg`);
    fs.writeFileSync(filePath, Buffer.from(data));
});

ipcMain.on("show-rules", () => {
    dialog.showMessageBox({
        type: "error",
        title: "Athena Exam Rules",
        message: "Exam Rules",
        detail:
            "1. Stay on the exam screen.\n" +
            "2. Camera must remain enabled.\n" +
            "3. Do not leave the exam.\n" +
            "4. Do not use external assistance.\n" +
            "5. Click Exit Exam when finished."
    });
});

app.on('before-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

app.whenReady().then(() => {
    ensureBackendRunning();
    createWindow();
});