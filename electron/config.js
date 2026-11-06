/* ============================================================
   Kimetsu Boot — 配置读写（主进程侧）
   配置文件与 exe 同目录，找不到可写位置时回退到用户数据目录
   ============================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const D = require('../shared/defaults.js');

const FILE_NAME = 'kimetsu-boot.config.json';

let configPath = null;
let overridePath = null;

function setOverride(p) { overridePath = p || null; }

function resolvePath(app) {
  if (overridePath) return path.resolve(overridePath);
  if (app.isPackaged) {
    const dir = path.dirname(app.getPath('exe'));
    const p = path.join(dir, FILE_NAME);
    /* 便携版放在只读目录时，退回用户数据目录 */
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return p;
    } catch (e) { return path.join(app.getPath('userData'), FILE_NAME); }
  }
  return path.join(__dirname, '..', FILE_NAME);
}

function getPath(app) {
  if (!configPath) configPath = resolvePath(app);
  return configPath;
}

function load(app) {
  const p = getPath(app);
  try {
    if (fs.existsSync(p)) {
      return D.normalize(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  } catch (e) {
    /* 配置坏了就备份一份，不要让程序打不开 */
    try { fs.copyFileSync(p, p + '.broken'); } catch (_) { }
  }
  /* 首次运行：把默认配置写出来，方便直接手改 JSON */
  const cfg = D.normalize(null);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) { /* 只读目录：用内存里的默认配置即可 */ }
  return cfg;
}

function save(app, cfg) {
  const p = getPath(app);
  const clean = D.normalize(cfg);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(clean, null, 2), 'utf8');
  return { path: p, config: clean };
}

function reset(app) {
  const p = getPath(app);
  try { if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak'); } catch (e) { }
  return save(app, D.normalize(null));
}

/* 自动探测 WorkBuddy；开源版保持通用：找不到就只播动画 */
const DETECT_CANDIDATES = [
  process.env.KIMETSU_TARGET,
  process.env.WB_EXE,
  'D:\\WorkBuddy-Intl\\WorkBuddyAI\\WorkBuddy.exe',
  'C:\\Program Files\\WorkBuddyAI\\WorkBuddy.exe',
  'C:\\Program Files\\WorkBuddy\\WorkBuddy.exe'
];

function detectTarget(cfg) {
  const l = cfg.launch || {};
  if (l.path) {
    try { if (fs.existsSync(l.path)) return l.path; } catch (e) { }
    return null;
  }
  if (!l.autoDetect) return null;
  /* 环境变量 + 常见安装位置 */
  for (const p of DETECT_CANDIDATES) {
    if (!p) continue;
    try { if (fs.existsSync(p)) return p; } catch (e) { }
  }
  /* 用户目录 AppData\Local\Programs 下扫描一层 */
  try {
    const base = path.join(process.env.LOCALAPPDATA || '', 'Programs');
    for (const name of fs.readdirSync(base)) {
      const p = path.join(base, name, 'WorkBuddy.exe');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { }
  return null;
}

/* 置前脚本按进程名 / 窗口标题找窗口 */
function processNames(cfg, exePath) {
  const names = [];
  if (cfg.launch && cfg.launch.processName) {
    cfg.launch.processName.split(/[,，\s]+/).filter(Boolean).forEach(n => names.push(n));
  }
  if (exePath) names.push(path.basename(exePath, path.extname(exePath)));
  if (names.length === 0) names.push('WorkBuddy', 'WorkBuddyAI');
  return Array.from(new Set(names));
}

module.exports = {
  FILE_NAME,
  setOverride, getPath, load, save, reset,
  detectTarget, processNames
};
