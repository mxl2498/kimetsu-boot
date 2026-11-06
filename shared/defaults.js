/* ============================================================
   Kimetsu Boot — 默认配置 / 风格模板
   Node 与浏览器共用（UMD），不依赖任何第三方库
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BootDefaults = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 颜色统一用 [r,g,b] 数组，方便 Canvas 与 CSS 同时取用 */
  var THEMES = {
    kimetsu: {
      bg: [8, 11, 13], paper: [190, 180, 160], petal: [268, 312],
      wave: [150, 208, 196], slash: [180, 220, 255],
      water: [64, 186, 240], fire: [240, 96, 22], ichi: [29, 70, 52],
      accent: [46, 213, 150], seal: [208, 57, 43],
      text: [243, 233, 215], subtext: [201, 189, 167]
    },
    ink: {
      bg: [18, 20, 22], paper: [205, 202, 194], petal: [30, 48],
      wave: [176, 186, 184], slash: [235, 238, 242],
      water: [126, 158, 176], fire: [196, 128, 92], ichi: [62, 68, 70],
      accent: [214, 222, 224], seal: [162, 66, 56],
      text: [240, 238, 230], subtext: [186, 184, 176]
    },
    neon: {
      bg: [8, 6, 22], paper: [150, 140, 190], petal: [292, 328],
      wave: [120, 110, 230], slash: [180, 240, 255],
      water: [0, 208, 255], fire: [255, 72, 148], ichi: [42, 20, 86],
      accent: [0, 245, 200], seal: [255, 72, 130],
      text: [238, 240, 255], subtext: [170, 178, 220]
    },
    sunrise: {
      bg: [20, 12, 8], paper: [214, 178, 138], petal: [18, 42],
      wave: [226, 184, 130], slash: [255, 236, 200],
      water: [96, 176, 190], fire: [255, 148, 48], ichi: [92, 48, 30],
      accent: [255, 186, 92], seal: [198, 62, 40],
      text: [255, 240, 216], subtext: [222, 190, 152]
    }
  };

  /* 风格模板：点一下同时替换颜色与文字（之后仍可逐项修改） */
  var PRESETS = {
    kimetsu: {
      label: '鬼灭和风', desc: '紫藤落花 · 水炎双呼吸 · 绿黑市松纹',
      theme: THEMES.kimetsu,
      text: {
        prologue1: '大正時代 悪鬼滅殺', prologue2: '全集中の呼吸',
        slash: '抜刀', water: '水', fire: '炎', breathSub: '呼吸を整えよ',
        title: '全集中 · 常中', titleSub: '心を澄ませ、刃を進めよ',
        sealTop: '集', sealBottom: '中',
        brand: 'WorkBuddy', brandSub: '起動完了 / SYSTEM READY'
      }
    },
    ink: {
      label: '水墨素白', desc: '淡墨留白 · 安静克制 · 适合办公',
      theme: THEMES.ink,
      text: {
        prologue1: '静心 · 然后开始', prologue2: '一息一念',
        slash: '起', water: '水', fire: '火', breathSub: '调整呼吸，专注当下',
        title: '心無旁騖', titleSub: '把重要的事，交给此刻',
        sealTop: '專', sealBottom: '注',
        brand: '', brandSub: '准备就绪 / READY'
      }
    },
    neon: {
      label: '赛博霓虹', desc: '青蓝电光 · 洋红火焰 · 未来感',
      theme: THEMES.neon,
      text: {
        prologue1: 'SYSTEM INITIALIZING', prologue2: 'BOOT SEQUENCE',
        slash: 'LINK', water: '0', fire: '1', breathSub: 'SYNCHRONIZING',
        title: 'ONLINE', titleSub: 'All systems nominal',
        sealTop: 'O', sealBottom: 'K',
        brand: '', brandSub: 'SYSTEM READY'
      }
    },
    sunrise: {
      label: '晨曦金', desc: '暖金晨光 · 柔和治愈 · 适合清晨开机',
      theme: THEMES.sunrise,
      text: {
        prologue1: '新的一天 从此刻开始', prologue2: '慢一点也没关系',
        slash: '启', water: '澄', fire: '暖', breathSub: '深呼吸，然后出发',
        title: '早安', titleSub: '今天也请多多关照',
        sealTop: '今', sealBottom: '日',
        brand: '', brandSub: '准备就绪 / READY'
      }
    }
  };

  var DEFAULT_CONFIG = {
    version: 1,
    preset: 'kimetsu',
    theme: THEMES.kimetsu,
    text: {
      prologue1: '大正時代 悪鬼滅殺', prologue2: '全集中の呼吸',
      slash: '抜刀', water: '水', fire: '炎', breathSub: '呼吸を整えよ',
      title: '全集中 · 常中', titleSub: '心を澄ませ、刃を進めよ',
      sealTop: '集', sealBottom: '中',
      brand: 'WorkBuddy', brandSub: '起動完了 / SYSTEM READY'
    },
    duration: 10,
    sound: true,
    volume: 0.7,
    petals: true,
    petalDensity: 74,
    logo: '',
    /* 自定义视频开场：enabled=true 时优先播放本地视频 */
    video: {
      enabled: false,
      file: '',
      fit: 'cover',
      mute: true,
      volume: 0.8,
      maxSeconds: 0,
      showFinale: true,
      finaleSeconds: 1.8
    },
    launch: {
      path: '',
      args: '',
      windowTitle: 'WorkBuddy',
      processName: '',
      activate: true,
      autoDetect: true
    },
    autostart: false
  };

  var RGB_KEYS = ['bg', 'paper', 'petal', 'wave', 'slash', 'water', 'fire',
    'ichi', 'accent', 'seal', 'text', 'subtext'];
  var TEXT_KEYS = Object.keys(DEFAULT_CONFIG.text);
  var LAUNCH_KEYS = Object.keys(DEFAULT_CONFIG.launch);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, d, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) return d;
    return Math.min(hi, Math.max(lo, v));
  }
  function str(v, d, max) {
    if (typeof v !== 'string') return d;
    return v.length > max ? v.slice(0, max) : v;
  }
  function rgb(v, d) {
    if (!Array.isArray(v) || v.length < 3) return d.slice();
    return [num(v[0], d[0], 0, 255), num(v[1], d[1], 0, 255), num(v[2], d[2], 0, 255)].map(Math.round);
  }

  /* 任何来源的配置都过一遍这里：坏字段不会让动画崩掉 */
  function normalize(raw) {
    var out = clone(DEFAULT_CONFIG);
    if (!raw || typeof raw !== 'object') return out;
    if (typeof raw.preset === 'string' && PRESETS[raw.preset]) out.preset = raw.preset;

    if (raw.theme && typeof raw.theme === 'object') {
      RGB_KEYS.forEach(function (k) { out.theme[k] = rgb(raw.theme[k], DEFAULT_CONFIG.theme[k]); });
    }
    if (raw.text && typeof raw.text === 'object') {
      TEXT_KEYS.forEach(function (k) { out.text[k] = str(raw.text[k], DEFAULT_CONFIG.text[k], 60); });
    }
    if (raw.launch && typeof raw.launch === 'object') {
      LAUNCH_KEYS.forEach(function (k) {
        var v = raw.launch[k], d = DEFAULT_CONFIG.launch[k];
        if (typeof d === 'boolean') out.launch[k] = typeof v === 'boolean' ? v : d;
        else out.launch[k] = str(v, d, k === 'path' ? 1000 : 200);
      });
    }
    out.duration = num(raw.duration, 10, 5, 24);
    out.volume = num(raw.volume, 0.7, 0, 1);
    out.petalDensity = num(raw.petalDensity, 74, 0, 200);
    if (typeof raw.sound === 'boolean') out.sound = raw.sound;
    if (typeof raw.petals === 'boolean') out.petals = raw.petals;
    if (typeof raw.autostart === 'boolean') out.autostart = raw.autostart;
    /* logo 只允许 data URL，避免任意本地文件读取 */
    if (typeof raw.logo === 'string' && /^data:image\//.test(raw.logo) && raw.logo.length < 4000000) {
      out.logo = raw.logo;
    }
    /* 自定义视频 */
    if (raw.video && typeof raw.video === 'object') {
      var v = raw.video;
      out.video.enabled = typeof v.enabled === 'boolean' ? v.enabled : false;
      out.video.file = str(v.file, '', 1000);
      out.video.fit = v.fit === 'contain' ? 'contain' : 'cover';
      if (typeof v.mute === 'boolean') out.video.mute = v.mute;
      out.video.volume = num(v.volume, 0.8, 0, 1);
      out.video.maxSeconds = num(v.maxSeconds, 0, 0, 3600);
      if (typeof v.showFinale === 'boolean') out.video.showFinale = v.showFinale;
      out.video.finaleSeconds = num(v.finaleSeconds, 1.8, 0.5, 10);
    }
    return out;
  }

  return {
    THEMES: THEMES,
    PRESETS: PRESETS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    normalize: normalize,
    clone: clone
  };
});
