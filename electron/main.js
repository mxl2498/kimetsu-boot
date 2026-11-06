/* ============================================================
   Kimetsu Boot — Electron 主进程
   · 内置动画 / 自定义视频两种开场
   · 结束后启动任意程序并把窗口置前
   · 可视化设置面板、开机自启、配置文件
   ============================================================ */
'use strict';
const { app, BrowserWindow, ipcMain, screen, Menu, dialog, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { spawn } = require('child_process');
const D = require('../shared/defaults.js');
const C = require('./config.js');

/* 自定义协议：把本地视频安全地喂给渲染进程（支持 Range，便于大文件播放） */
protocol.registerSchemesAsPrivileged([
  { scheme: 'bootmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const t0 = process.uptime();
const argv = process.argv.slice(1);
const SKIP = argv.includes('--skip') || argv.includes('--now');
const WANT_SETTINGS = argv.includes('--settings') || argv.includes('--setup');
const SELFTEST = process.env.WB_SELFTEST === '1';
const VIDEO_SELFTEST = process.env.WB_VIDEO_SELFTEST === '1';
const NO_LAUNCH = process.env.WB_NO_LAUNCH === '1';
const SETTINGS_SELFTEST = process.env.WB_SETTINGS_SELFTEST === '1';
const SELFTEST_DIR = process.env.WB_SELFTEST_DIR || path.join(__dirname, '..', 'selftest');

function argValue(flag) {
  const i = argv.indexOf(flag);
  if (i < 0 || !argv[i + 1] || argv[i + 1].startsWith('--')) return null;
  return argv[i + 1];
}
C.setOverride(argValue('--config'));

let animWin = null, settingsWin = null;
let currentConfig = null;
let activeVideoFile = '';
let mode = 'boot';            // boot | settings | preview | selftest
let done = false;
let logFile = null;

function log(s) {
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'boot.log');
    fs.appendFileSync(logFile, new Date().toISOString() + ' [+' +
      process.uptime().toFixed(2) + 's] ' + s + '\r\n');
  } catch (e) { }
}

/* ---------- 视频文件协议 ---------- */
function mimeOf(f) {
  const e = path.extname(f).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
    '.mov': 'video/quicktime', '.ogv': 'video/ogg', '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo'
  };
  return map[e] || 'application/octet-stream';
}

function setupVideoProtocol() {
  protocol.handle('bootmedia', (request) => {
    const f = activeVideoFile;
    if (!f || !fs.existsSync(f)) return new Response('not found', { status: 404 });
    const size = fs.statSync(f).size;
    const type = mimeOf(f);
    const range = request.headers.get('range');
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        let start, end;
        if (m[1] === '' && m[2] !== '') {
          const suffix = parseInt(m[2], 10);
          start = Math.max(0, size - suffix); end = size - 1;
        } else {
          start = m[1] ? parseInt(m[1], 10) : 0;
          end = m[2] ? parseInt(m[2], 10) : size - 1;
        }
        if (isNaN(start) || start >= size) {
          return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
        }
        end = Math.min(end, size - 1);
        return new Response(Readable.toWeb(fs.createReadStream(f, { start, end })), {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Length': String(end - start + 1),
            'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
            'Accept-Ranges': 'bytes'
          }
        });
      }
    }
    return new Response(Readable.toWeb(fs.createReadStream(f)), {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
    });
  });
}

/* ---------- 启动目标程序 ---------- */
function splitArgs(s) {
  const m = String(s || '').match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return m.map(x => x.replace(/^"|"$/g, ''));
}

function showTarget(cfg) {
  if (NO_LAUNCH) { log('no-launch (selftest)'); return; }
  const exe = C.detectTarget(cfg);
  log('target exe = ' + exe);
  if (exe) {
    try {
      const c = spawn(exe, splitArgs(cfg.launch.args), {
        detached: true, stdio: 'ignore', windowsHide: false
      });
      c.unref();
      log('spawned pid ' + c.pid);
    } catch (e) { log('spawn error ' + e.message); }
  }
  if (cfg.launch.activate) activateWindow(cfg, exe);
}

function activateWindow(cfg, exe) {
  /* 脚本打包在 asar 内，外部 powershell.exe 读不到，先释放到临时目录 */
  const bundled = path.join(__dirname, 'activate-window.ps1');
  try {
    if (!fs.existsSync(bundled)) { log('activate script missing'); return; }
    const tmp = path.join(app.getPath('temp'), 'kimetsu-activate.ps1');
    fs.writeFileSync(tmp, '\uFEFF' + fs.readFileSync(bundled, 'utf8'), 'utf8');
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', tmp];
    if (exe) args.push('-ExePath', exe);
    args.push('-ProcessName', C.processNames(cfg, exe).join(','));
    if (cfg.launch.windowTitle) args.push('-WindowTitle', cfg.launch.windowTitle);
    const ps = spawn('powershell.exe', args, { windowsHide: true, detached: true, stdio: 'ignore' });
    ps.unref();
    log('activate launched names=' + C.processNames(cfg, exe).join(','));
  } catch (e) { log('activate error ' + e.message); }
}

/* ---------- 窗口 ---------- */
function destroyAnim() {
  try { if (animWin && !animWin.isDestroyed()) animWin.destroy(); } catch (e) { }
  animWin = null;
}

function createAnimWindow() {
  destroyAnim();
  const display = screen.getPrimaryDisplay();
  const b = display.bounds;
  const opts = SELFTEST
    ? {
        x: 40, y: 40, width: 1280, height: 720,
        frame: false, backgroundColor: '#080b0d', show: true,
        skipTaskbar: true, hasShadow: false, useContentSize: true,
        alwaysOnTop: false,
        webPreferences: {
          contextIsolation: true, nodeIntegration: false,
          preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false
        }
      }
    : {
        x: b.x, y: b.y, width: b.width, height: b.height,
        frame: false, fullscreen: true, kiosk: false,
        backgroundColor: '#080b0d', alwaysOnTop: true, skipTaskbar: true,
        resizable: false, movable: false, minimizable: false,
        hasShadow: false, show: true,
        webPreferences: {
          contextIsolation: true, nodeIntegration: false,
          preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false
        }
      };
  animWin = new BrowserWindow(opts);
  Menu.setApplicationMenu(null);
  if (!SELFTEST) animWin.setAlwaysOnTop(true, 'screen-saver');
  animWin.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  animWin.webContents.on('did-finish-load', () => log('animation page loaded'));
  animWin.webContents.on('render-process-gone', (e, d) => log('renderer gone ' + JSON.stringify(d)));
  return animWin;
}

function ensureSettingsWin() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show(); settingsWin.focus();
    return settingsWin;
  }
  settingsWin = new BrowserWindow({
    width: 980, height: 760, minWidth: 820, minHeight: 600,
    title: '启动动画设置',
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  Menu.setApplicationMenu(null);
  settingsWin.loadFile(path.join(__dirname, '..', 'app', 'settings.html'));
  settingsWin.once('ready-to-show', () => { settingsWin.show(); settingsWin.focus(); });
  settingsWin.on('closed', () => { settingsWin = null; app.quit(); });
  return settingsWin;
}

/* ---------- 动画结束 ---------- */
function finishBoot() {
  if (done) return;
  done = true;
  log('animation finished mode=' + mode + (SELFTEST ? ' (selftest)' : ''));
  if (SELFTEST) { setTimeout(() => app.exit(0), 250); return; }
  try { if (animWin && !animWin.isDestroyed()) { animWin.setAlwaysOnTop(false); animWin.hide(); } } catch (e) { }

  if (mode === 'boot') {
    showTarget(currentConfig);
    setTimeout(() => { destroyAnim(); app.exit(0); }, 900);
  } else {
    /* 预览 / 从动画按 S 进设置：回到设置窗口，不启动目标程序 */
    setTimeout(() => {
      destroyAnim();
      if (mode === 'preview' || mode === 'settings') {
        ensureSettingsWin();
        mode = 'settings';
      }
    }, 260);
  }
}

function openSettingsFromAnim() {
  if (mode === 'preview') return;
  if (mode === 'boot') mode = 'settings';
  try { if (animWin && !animWin.isDestroyed()) animWin.hide(); } catch (e) { }
  ensureSettingsWin();
  finishBoot();
}

function startPreview(raw) {
  currentConfig = D.normalize(raw);
  mode = 'preview';
  done = false;
  try { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide(); } catch (e) { }
  createAnimWindow();
  log('preview started');
}

function syncAutostart(on) {
  if (!app.isPackaged) return { ok: false, reason: 'dev' };
  try {
    app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath, args: [] });
    return { ok: true, state: app.getLoginItemSettings().openAtLogin };
  } catch (e) { return { ok: false, reason: e.message }; }
}

/* ---------- IPC ---------- */
function payload() {
  const v = currentConfig.video;
  const available = !!(v.enabled && v.file && fs.existsSync(v.file));
  activeVideoFile = available ? v.file : '';
  return Object.assign({}, currentConfig, {
    videoUrl: available ? 'bootmedia://media/video?v=' + Date.now() : '',
    videoAvailable: available,
    configPath: C.getPath(app),
    isPackaged: app.isPackaged
  });
}

ipcMain.on('boot:done', () => finishBoot());
ipcMain.on('boot:log', (e, msg) => log('renderer: ' + msg));
ipcMain.on('boot:open-settings', () => openSettingsFromAnim());

ipcMain.handle('config:get', () => payload());
ipcMain.handle('config:save', (e, raw) => {
  const r = C.save(app, raw);
  currentConfig = r.config;
  syncAutostart(currentConfig.autostart);
  log('config saved ' + r.path);
  return { ok: true, path: r.path };
});
ipcMain.handle('config:reset', () => {
  const r = C.reset(app);
  currentConfig = r.config;
  return payload();
});
ipcMain.handle('config:preview', (e, raw) => { startPreview(raw); return { ok: true }; });
ipcMain.handle('config:autostart', (e, on) => syncAutostart(on));
ipcMain.handle('config:autostart-state', () => ({ on: app.getLoginItemSettings().openAtLogin }));
ipcMain.handle('config:open-folder', () => {
  shell.showItemInFolder(C.getPath(app));
  return { ok: true };
});
ipcMain.handle('config:quit', () => { app.exit(0); return { ok: true }; });

ipcMain.handle('file:pick', async (e, kind) => {
  const opts = { properties: ['openFile'] };
  if (kind === 'video') {
    opts.title = '选择开场视频';
    opts.filters = [{ name: '视频文件', extensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv', 'avi'] }];
  } else if (kind === 'exe') {
    opts.title = '选择动画结束后要打开的软件';
    opts.filters = [{ name: '可执行程序', extensions: ['exe', 'bat', 'cmd'] }, { name: '所有文件', extensions: ['*'] }];
  } else if (kind === 'logo') {
    opts.title = '选择结尾显示的图标';
    opts.filters = [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp'] }];
  }
  const r = await dialog.showOpenDialog(settingsWin || animWin, opts);
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { path: '' };
  const p = r.filePaths[0];
  if (kind === 'logo') {
    try {
      if (fs.statSync(p).size > 2 * 1024 * 1024) return { path: '', error: '图片请小于 2MB' };
      const ext = path.extname(p).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      return { path: p, dataUrl: 'data:' + mime + ';base64,' + fs.readFileSync(p).toString('base64') };
    } catch (err) { return { path: '', error: err.message }; }
  }
  return { path: p };
});

/* ---------- 自检：视频模式抓帧 ---------- */
async function runVideoSelfTest() {
  try { fs.mkdirSync(SELFTEST_DIR, { recursive: true }); } catch (e) { }
  const shots = [
    { t: 1200, name: 'video-01.png' },
    { t: 2600, name: 'video-02.png' },
    { t: 4200, name: 'video-03.png' }
  ];
  const t0 = Date.now();
  for (const s of shots) {
    const wait = s.t - (Date.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    try {
      const img = await animWin.webContents.capturePage();
      fs.writeFileSync(path.join(SELFTEST_DIR, s.name), img.toPNG());
      const state = await animWin.webContents.executeJavaScript(`(function(){
        var v=document.getElementById('bootVideo');
        return {videoMode:document.body.classList.contains('video-mode'),
          src:v.currentSrc,readyState:v.readyState,time:v.currentTime,paused:v.paused,
          videoW:v.videoWidth,videoH:v.videoHeight,
          opLogo:getComputedStyle(document.getElementById('logoWrap')).opacity,
          opStage:getComputedStyle(document.getElementById('stage')).opacity};})()`);
      fs.appendFileSync(path.join(SELFTEST_DIR, 'video-geom.txt'), s.name + ' ' + JSON.stringify(state) + '\r\n');
      log('video shot ' + s.name + ' ' + JSON.stringify(state));
    } catch (e) { log('video shot fail ' + e.message); }
  }
}

/* ---------- 自检：按动画时钟抓帧 ---------- */
async function runSelfTest() {
  try { fs.mkdirSync(SELFTEST_DIR, { recursive: true }); } catch (e) { }
  const s = currentConfig.duration / 10;
  const shots = [
    { t: 1.55 * s, name: '01-prologue.png' },
    { t: 2.65 * s, name: '02-ichimatsu.png' },
    { t: 3.42 * s, name: '03-slash.png' },
    { t: 4.90 * s, name: '04-breath.png' },
    { t: 7.20 * s, name: '05-zenschu.png' },
    { t: 8.80 * s, name: '06-finale.png' }
  ];
  for (const shot of shots) {
    for (let i = 0; i < 300; i++) {
      let cur = 0;
      try { cur = await animWin.webContents.executeJavaScript('window.__animT || 0'); } catch (e) { }
      if (cur >= shot.t) break;
      await new Promise(r => setTimeout(r, 50));
    }
    try {
      const img = await animWin.webContents.capturePage();
      fs.writeFileSync(path.join(SELFTEST_DIR, shot.name + '_v2.png'), img.toPNG());
      const geom = await animWin.webContents.executeJavaScript(`(function(){
        function r(s){var e=document.querySelector(s);if(!e)return null;var b=e.getBoundingClientRect();
          return {t:Math.round(b.top),b:Math.round(b.bottom),l:Math.round(b.left),r:Math.round(b.right)};}
        return {vh:innerHeight,scrollH:document.documentElement.scrollHeight,
          box:r('.finale-box'),logo:r('#logoWrap'),brand:r('#brandName'),sub:r('.brand-sub'),
          bar:r('.loadbar'),pro1:r('#pro1'),videoMode:document.body.classList.contains('video-mode'),
          animT:window.__animT,
          opLogo:getComputedStyle(document.getElementById('logoWrap')).opacity,
          opBrand:getComputedStyle(document.getElementById('brandName')).opacity,
          opSub:getComputedStyle(document.querySelector('.brand-sub')).opacity,
          opStage:getComputedStyle(document.getElementById('stage')).opacity,
          logoHTML:document.getElementById('logoWrap').innerHTML.slice(0,80)};})()`);
      fs.appendFileSync(path.join(SELFTEST_DIR, 'geom.txt'), shot.name + ' ' + JSON.stringify(geom) + '\r\n');
      log('shot ' + shot.name);
    } catch (e) { log('shot fail ' + shot.name + ' ' + e.message); }
  }
}

/* ---------- 启动 ---------- */
app.whenReady().then(() => {
  setupVideoProtocol();
  currentConfig = C.load(app);
  log('--- start --- mode=' + (SELFTEST ? 'selftest' : WANT_SETTINGS ? 'settings' : SKIP ? 'skip' : 'boot') +
      ' packaged=' + app.isPackaged + ' moduleReady=+' + t0.toFixed(2) + 's');

  if (SKIP) {
    showTarget(currentConfig);
    setTimeout(() => app.exit(0), 700);
    return;
  }
  if (WANT_SETTINGS) {
    mode = 'settings';
    ensureSettingsWin();
    if (SETTINGS_SELFTEST) {
      setTimeout(async () => {
        try {
          const img = await settingsWin.webContents.capturePage();
          fs.mkdirSync(SELFTEST_DIR, { recursive: true });
          fs.writeFileSync(path.join(SELFTEST_DIR, 'settings-ui.png'), img.toPNG());
          log('settings ui captured');
        } catch (e) { log('settings ui fail ' + e.message); }
        app.exit(0);
      }, 1800);
    }
    return;
  }
  if (SELFTEST) mode = 'selftest';
  createAnimWindow();
  if (SELFTEST) runSelfTest();
  if (VIDEO_SELFTEST) runVideoSelfTest();
  /* 兜底：任何异常下也能结束，不把用户卡在全屏里 */
  const limit = Math.max(15000, currentConfig.duration * 1000 + 8000);
  setTimeout(() => { if (!done) { log('timeout fallback'); finishBoot(); } }, limit);
});
