/* 抓帧自检：按动画内部时钟截取 6 张关键帧到 selftest/ */
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');

const root = path.join(__dirname, '..');
const env = Object.assign({}, process.env, {
  WB_SELFTEST: '1',
  WB_SELFTEST_DIR: process.env.WB_SELFTEST_DIR || path.join(root, 'selftest')
});
delete env.ELECTRON_RUN_AS_NODE;

const args = ['electron/main.js'].concat(process.argv.slice(2));
const child = spawn(electron, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => process.exit(code || 0));
