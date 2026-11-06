/* ============================================================
   Kimetsu Boot — 设置面板逻辑
   只做三件事：把配置填进表单 / 把表单读回配置 / 保存与试播
   ============================================================ */
(function () {
  'use strict';
  var D = window.BootDefaults;
  var api = window.bootAPI;
  var $ = function (id) { return document.getElementById(id); };
  var CFG = D.normalize(null);
  var META = {};

  var COLOR_LABELS = {
    bg: '背景', paper: '纸张底纹', petal: '落花颜色', wave: '海浪线',
    slash: '刀光', water: '水', fire: '火', ichi: '方格纹',
    accent: '主色', seal: '红印章', text: '大字', subtext: '小字'
  };
  var COLOR_KEYS = Object.keys(COLOR_LABELS);

  function say(msg, type) {
    var s = $('status');
    s.textContent = msg;
    s.className = 'status' + (type ? ' ' + type : '');
  }
  function dirty() { say('有改动还没保存', ''); }

  /* ---------- 颜色工具 ---------- */
  function hex2rgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(c) {
    return '#' + c.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
    if (s === 0) { var v = l * 255; return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
  }
  function rgb2hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return h;
  }
  function colorToHex(key, c) {
    if (key === 'petal') return rgb2hex(hsl2rgb((c[0] + c[1]) / 2, 42, 68));
    return rgb2hex(c);
  }
  function hexToColor(key, hex) {
    if (key === 'petal') {
      var h = rgb2hsl(hex2rgb(hex));
      return [Math.round(h - 22), Math.round(h + 22)];
    }
    return hex2rgb(hex);
  }

  /* ---------- 路径显示 ---------- */
  function shortName(p) {
    if (!p) return '';
    var s = String(p).replace(/\\/g, '/');
    return s.slice(s.lastIndexOf('/') + 1);
  }
  function videoFileLine() {
    var f = CFG.video.file;
    if (!f) return '还没选视频';
    try {
      /* 主进程会把可用性放进 payload；这里只能做轻量检查提示 */
      return shortName(f) + (CFG.video.enabled && META.videoAvailable === false
        ? '（⚠ 上次检查时文件不可用）' : '');
    } catch (e) { return shortName(f); }
  }

  /* ---------- 建立预设 / 颜色控件 ---------- */
  function buildPresets() {
    var row = $('presetRow');
    row.innerHTML = '';
    Object.keys(D.PRESETS).forEach(function (key) {
      var p = D.PRESETS[key], b = document.createElement('button');
      b.className = 'preset'; b.dataset.preset = key;
      var sw = document.createElement('div'); sw.className = 'swatches';
      [p.theme.bg, p.theme.water, p.theme.fire, p.theme.accent].forEach(function (c) {
        var i = document.createElement('i');
        i.style.background = rgb2hex(c);
        sw.appendChild(i);
      });
      var txt = document.createElement('div');
      var n = document.createElement('div'); n.className = 'preset-name'; n.textContent = p.label;
      var d = document.createElement('div'); d.className = 'preset-desc'; d.textContent = p.desc;
      txt.appendChild(n); txt.appendChild(d);
      b.appendChild(sw); b.appendChild(txt);
      b.addEventListener('click', function () {
        CFG.preset = key;
        CFG.theme = D.clone(p.theme);
        CFG.text = D.clone(p.text);
        fill();
        say('已换成「' + p.label + '」的文字和配色，记得保存', 'ok');
      });
      row.appendChild(b);
    });
  }

  function buildColors() {
    var grid = $('colorGrid');
    grid.innerHTML = '';
    COLOR_KEYS.forEach(function (key) {
      var lab = document.createElement('label'); lab.className = 'color-item';
      var inp = document.createElement('input');
      inp.type = 'color'; inp.dataset.color = key;
      inp.addEventListener('input', function () {
        CFG.theme[key] = hexToColor(key, inp.value);
        CFG.preset = 'custom';
        syncPresetHighlight();
        dirty();
      });
      var span = document.createElement('span'); span.textContent = COLOR_LABELS[key];
      lab.appendChild(inp); lab.appendChild(span);
      grid.appendChild(lab);
    });
  }

  function syncPresetHighlight() {
    Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (b) {
      b.classList.toggle('selected', b.dataset.preset === CFG.preset);
    });
  }

  /* ---------- 填表 / 收集 ---------- */
  function get(obj, k) { return k.split('.').reduce(function (o, x) { return o ? o[x] : ''; }, obj); }
  function set(obj, k, v) {
    var parts = k.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }

  function fill() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (inp) {
      inp.value = get(CFG, inp.dataset.k) || '';
    });

    /* 开场方式 */
    var isVideo = !!CFG.video.enabled;
    $('modeAnim').classList.toggle('selected', !isVideo);
    $('modeVideo').classList.toggle('selected', isVideo);
    $('videoBox').classList.toggle('show', isVideo);
    $('headBadge').textContent = isVideo ? '自定义视频' : '内置动画';
    $('videoName').textContent = videoFileLine();

    $('fitSeg').querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.v === CFG.video.fit);
    });
    var cut = CFG.video.maxSeconds > 0;
    Array.prototype.forEach.call(document.querySelectorAll('input[name=vlen]'), function (r) {
      r.checked = cut ? r.value === 'cut' : r.value === '0';
    });
    $('maxSeconds').value = cut ? CFG.video.maxSeconds : 8;
    $('maxSeconds').disabled = !cut;
    $('videoMute').checked = !!CFG.video.mute;
    $('videoVolume').value = Math.round(CFG.video.volume * 100);
    $('videoVolume').disabled = !!CFG.video.mute;
    $('showFinale').checked = !!CFG.video.showFinale;
    $('finaleSeconds').value = CFG.video.finaleSeconds;

    /* 基础项 */
    $('duration').value = CFG.duration;
    $('durationVal').textContent = CFG.duration + ' 秒';
    $('sound').checked = !!CFG.sound;
    $('volume').value = Math.round(CFG.volume * 100);
    $('petals').checked = !!CFG.petals;
    $('petalDensity').value = CFG.petalDensity;
    $('autoDetect').checked = !!CFG.launch.autoDetect;
    $('activate').checked = !!CFG.launch.activate;

    /* 图标 */
    var img = $('logoPreview');
    if (CFG.logo) { img.src = CFG.logo; img.classList.add('show'); }
    else { img.removeAttribute('src'); img.classList.remove('show'); }

    /* 颜色 */
    COLOR_KEYS.forEach(function (key) {
      var inp = document.querySelector('[data-color="' + key + '"]');
      if (inp) inp.value = colorToHex(key, CFG.theme[key]);
    });
    syncPresetHighlight();
  }

  function collect() {
    var c = D.clone(CFG);
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (inp) {
      set(c, inp.dataset.k, inp.value);
    });
    c.video.enabled = $('modeVideo').classList.contains('selected');
    var fitBtn = $('fitSeg').querySelector('.seg-btn.selected');
    c.video.fit = fitBtn ? fitBtn.dataset.v : 'cover';
    c.video.maxSeconds = document.querySelector('input[name=vlen]:checked').value === 'cut'
      ? Math.max(1, Number($('maxSeconds').value) || 8) : 0;
    c.video.mute = $('videoMute').checked;
    c.video.volume = Number($('videoVolume').value) / 100;
    c.video.showFinale = $('showFinale').checked;
    c.video.finaleSeconds = Number($('finaleSeconds').value) || 1.8;

    c.duration = Number($('duration').value);
    c.sound = $('sound').checked;
    c.volume = Number($('volume').value) / 100;
    c.petals = $('petals').checked;
    c.petalDensity = Number($('petalDensity').value);
    c.launch.autoDetect = $('autoDetect').checked;
    c.launch.activate = $('activate').checked;
    c.autostart = $('autostart').checked;
    return D.normalize(c);
  }

  /* ---------- 动作 ---------- */
  async function save() {
    try {
      var c = collect();
      var r = await api.save(c);
      CFG = c;
      say('✓ 已保存，下次启动就按新设置播放', 'ok');
      return r;
    } catch (e) { say('保存失败：' + e.message, 'err'); }
  }

  async function preview() {
    var r = await save();
    if (!r) return;
    await api.preview(collect());
    say('正在试播… 播完会自动回到这个窗口', 'ok');
  }

  function bind() {
    /* 左侧导航 */
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        $(b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* 开场方式 */
    $('modeAnim').addEventListener('click', function () {
      $('modeAnim').classList.add('selected'); $('modeVideo').classList.remove('selected');
      $('videoBox').classList.remove('show'); $('headBadge').textContent = '内置动画'; dirty();
    });
    $('modeVideo').addEventListener('click', function () {
      $('modeVideo').classList.add('selected'); $('modeAnim').classList.remove('selected');
      $('videoBox').classList.add('show'); $('headBadge').textContent = '自定义视频'; dirty();
    });

    $('pickVideo').addEventListener('click', async function () {
      var r = await api.pick('video');
      if (!r.path) return;
      CFG.video.file = r.path; CFG.video.enabled = true;
      META.videoAvailable = true;
      fill();
      $('modeVideo').classList.add('selected'); $('modeAnim').classList.remove('selected');
      $('videoBox').classList.add('show'); $('headBadge').textContent = '自定义视频';
      say('已选好视频，点「保存并试播」看看效果', 'ok');
    });
    $('clearVideo').addEventListener('click', function () {
      CFG.video.file = ''; $('videoName').textContent = '还没选视频'; dirty();
    });
    $('pickExe').addEventListener('click', async function () {
      var r = await api.pick('exe');
      if (!r.path) return;
      document.querySelector('[data-k="launch.path"]').value = r.path;
      $('autoDetect').checked = false;
      dirty();
    });
    $('pickLogo').addEventListener('click', async function () {
      var r = await api.pick('logo');
      if (r.error) { say('图片没换成：' + r.error, 'err'); return; }
      if (!r.dataUrl) return;
      CFG.logo = r.dataUrl;
      $('logoPreview').src = r.dataUrl; $('logoPreview').classList.add('show');
      dirty();
    });
    $('clearLogo').addEventListener('click', function () {
      CFG.logo = ''; $('logoPreview').removeAttribute('src'); $('logoPreview').classList.remove('show');
      dirty();
    });

    /* 视频细节 */
    $('fitSeg').querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $('fitSeg').querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected'); dirty();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name=vlen]'), function (r) {
      r.addEventListener('change', function () {
        $('maxSeconds').disabled = r.value !== 'cut' || !r.checked;
        dirty();
      });
    });
    $('videoMute').addEventListener('change', function () {
      $('videoVolume').disabled = $('videoMute').checked; dirty();
    });
    $('duration').addEventListener('input', function () {
      $('durationVal').textContent = $('duration').value + ' 秒'; dirty();
    });

    /* 开机自启 */
    $('autostart').addEventListener('change', async function () {
      var r = await api.setAutostart($('autostart').checked);
      if (r && r.ok === false && r.reason !== 'dev') { say('开机自启没设置成功：' + r.reason, 'err'); return; }
      say($('autostart').checked ? '✓ 已开启开机自动播放' : '✓ 已关闭开机自动播放', 'ok');
    });

    /* 底栏 */
    $('btnSave').addEventListener('click', save);
    $('btnPreview').addEventListener('click', preview);
    $('btnReset').addEventListener('click', async function () {
      if (!confirm('把所有设置恢复成刚装好的样子？\n（视频文件不会删，只是取消选中）')) return;
      var p = await api.reset();
      CFG = D.normalize(p); META = p; fill();
      try { var st = await api.autostartState(); $('autostart').checked = !!st.on; } catch (e) { }
      say('✓ 已恢复默认，记得保存', 'ok');
    });
    $('openFolder').addEventListener('click', function () { api.openFolder(); });

    /* 任何输入都标记未保存 */
    Array.prototype.forEach.call(document.querySelectorAll('input, select'), function (i) {
      if (i.id === 'autostart') return;
      i.addEventListener('input', dirty);
      i.addEventListener('change', dirty);
    });
  }

  /* ---------- 启动 ---------- */
  (async function init() {
    buildPresets(); buildColors();
    try {
      var p = await api.load();
      META = p; CFG = D.normalize(p);
    } catch (e) { say('读取设置失败，先用默认值：' + e.message, 'err'); }
    fill();
    bind();
    if (META.configPath) $('configPath').textContent = shortName(META.configPath) + '（和启动器放在一起）';
    try {
      var st = await api.autostartState();
      $('autostart').checked = !!st.on;
    } catch (e) { }
    say('设置已读好，改完记得保存', '');
  })();
})();
