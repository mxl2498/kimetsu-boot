/* ============================================================
   Kimetsu Boot — 可配置启动动画
   纯 Canvas 2D + Web Audio 合成，无外部素材、无网络依赖
   所有文案 / 颜色 / 时长 / 音效 / 图标均来自 config.json
   ============================================================ */
(function () {
  'use strict';

  var D = window.BootDefaults;
  var $ = function (id) { return document.getElementById(id); };
  var WHT = [255, 255, 255], BLK = [0, 0, 0];

  /* ---------- 取配置（Electron 走 IPC，浏览器预览用默认值） ---------- */
  function loadConfig(cb) {
    function extra(raw) {
      return {
        videoUrl: raw && raw.videoUrl ? String(raw.videoUrl) : '',
        videoAvailable: !!(raw && raw.videoAvailable)
      };
    }
    if (window.bootAPI && window.bootAPI.getConfig) {
      window.bootAPI.getConfig()
        .then(function (raw) { cb(D.normalize(raw), extra(raw)); })
        .catch(function () { cb(D.normalize(null), extra(null)); });
    } else {
      cb(D.normalize(null), extra(null));
    }
  }

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function cssRgb(name, c) {
    document.documentElement.style.setProperty('--' + name + '-rgb',
      Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]));
  }

  loadConfig(boot);

  /* ============================================================
     启动
     ============================================================ */
  function boot(CFG, EXTRA) {
    var TH = CFG.theme;
    var SCALE = CFG.duration / 10;
    function S(v) { return v * SCALE; }

    /* 把主题色注入 CSS 变量 */
    cssRgb('bg', TH.bg); cssRgb('text', TH.text); cssRgb('subtext', TH.subtext);
    cssRgb('water', TH.water); cssRgb('fire', TH.fire); cssRgb('ichi', TH.ichi);
    cssRgb('accent', TH.accent); cssRgb('seal', TH.seal); cssRgb('slash', TH.slash);

    var cv = $('fx');
    var ctx = cv.getContext('2d', { alpha: false });
    var W = 0, H = 0, DPR = 1;

    var el = {
      stage: $('stage'), ichi: $('ichimatsu'), white: $('whiteflash'),
      pro1: $('pro1'), pro2: $('pro2'), slashK: $('slashKanji'),
      wWater: $('wordWater'), wFire: $('wordFire'), bSub: $('breathSub'),
      zenMain: $('zenMain'), zenSub: $('zenSub'), seal: $('seal'),
      sealTop: $('sealTop'), sealBottom: $('sealBottom'),
      logo: $('logoWrap'), logoDefault: $('logoDefault'), logoImg: $('wbLogo'),
      brand: $('brandName'), brandSub: $('brandSub'),
      bar: document.querySelector('.loadbar'), barFill: $('loadFill'),
      hint: $('hint'), muted: $('muted'),
      videoLayer: $('videoLayer'), video: $('bootVideo')
    };

    /* ---------- 文案注入 ---------- */
    var TX = CFG.text;
    function lengthOf(s) { return Array.from(String(s || '')).length; }
    function isLatin(s) { return /[A-Za-z0-9]/.test(String(s || '')); }

    /* 竖排文字：遇到英文或过长文案自动改横排，避免溢出屏幕 */
    function vertical(node, s, baseVw) {
      s = String(s || '');
      node.textContent = s;
      var n = lengthOf(s);
      if (isLatin(s) || n > 11) {
        node.style.writingMode = 'horizontal-tb';
        node.style.whiteSpace = 'normal';
        node.style.maxWidth = 'min(74vw, 1000px)';
        node.style.textAlign = 'right';
        node.style.letterSpacing = isLatin(s) ? '.12em' : '.18em';
        node.style.fontSize = 'clamp(15px,' + (baseVw * 0.72).toFixed(2) + 'vw,' + Math.round(baseVw * 14) + 'px)';
        if (isLatin(s)) node.style.fontFamily = '"GSans","Noto Sans SC",sans-serif';
      } else if (n > 8) {
        node.style.fontSize = 'clamp(18px,' + (baseVw * 0.82).toFixed(2) + 'vw,' + Math.round(baseVw * 16) + 'px)';
      }
    }

    /* 横排大字：按字数收缩字号，保证一行放得下 */
    function horizontal(node, s, baseVw, maxPx) {
      s = String(s || '');
      node.textContent = s;
      var n = Math.max(1, lengthOf(s));
      if (n > 7) {
        var vw = Math.min(baseVw, 84 / n);
        node.style.fontSize = 'clamp(20px,' + vw.toFixed(2) + 'vw,' + Math.round(Math.min(maxPx, maxPx * 9 / n)) + 'px)';
        node.style.letterSpacing = n > 14 ? '.06em' : '.12em';
      }
      if (isLatin(s)) node.style.fontFamily = '"GSans","Noto Sans SC",sans-serif';
    }

    vertical(el.pro1, TX.prologue1, 2.0);
    vertical(el.pro2, TX.prologue2, 1.15);
    horizontal(el.slashK, TX.slash, 10, 190);
    horizontal(el.wWater, TX.water, 17, 320);
    horizontal(el.wFire, TX.fire, 17, 320);
    vertical(el.bSub, TX.breathSub, 2.0);
    horizontal(el.zenMain, TX.title, 6.2, 118);
    horizontal(el.zenSub, TX.titleSub, 1.15, 22);
    el.sealTop.textContent = TX.sealTop || '';
    el.sealBottom.textContent = TX.sealBottom || '';
    if (!TX.sealTop && !TX.sealBottom) el.seal.style.display = 'none';

    horizontal(el.brand, TX.brand, 4.1, 78);
    if (!TX.brand) el.brand.style.display = 'none';
    /* 副标题按 / 拆开上色，全程 textContent 防止注入 */
    el.brandSub.textContent = '';
    String(TX.brandSub || '').split('/').forEach(function (part, i) {
      if (i) {
        var sep = document.createElement('span');
        sep.className = 'sep'; sep.textContent = '/';
        el.brandSub.appendChild(sep);
      }
      el.brandSub.appendChild(document.createTextNode(part));
    });

    if (CFG.logo) {
      el.logoImg.src = CFG.logo;
      el.logoImg.style.display = 'block';
      el.logoDefault.style.display = 'none';
    }

    if (!window.bootAPI) {
      el.hint.textContent = '预览模式 · 点击跳过动画';
    }

    /* ---------- 时间轴（按总时长等比缩放） ---------- */
    var T = {
      prologue: S(0.15), ichimatsu: S(1.75), slash: S(3.25), breath: S(3.95),
      zen: S(6.30), finale: S(7.95), fade: S(9.55), end: S(9.95)
    };

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
    function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    function win(t, a, b, f) {
      f = f || S(0.35);
      if (t < a || t > b) return 0;
      return Math.min(smooth((t - a) / f), smooth((b - t) / f));
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    /* ---------- 尺寸 ---------- */
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.6);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      document.documentElement.style.setProperty('--cell', Math.round(Math.min(W, H) * 0.105) + 'px');
      buildPaper();
    }
    window.addEventListener('resize', resize);

    /* ---------- 和纸底纹（离屏生成一次） ---------- */
    var paper = null;
    function buildPaper() {
      var pw = 480, ph = Math.round(480 * H / Math.max(W, 1));
      var c = document.createElement('canvas'); c.width = pw; c.height = ph;
      var g = c.getContext('2d');
      var im = g.createImageData(pw, ph), d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = 0.62 + Math.random() * 0.40;
        d[i] = TH.paper[0] * n;
        d[i + 1] = TH.paper[1] * n * 0.96;
        d[i + 2] = TH.paper[2] * n * 0.86;
        d[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      g.globalAlpha = 0.10; g.strokeStyle = '#fff'; g.lineWidth = 0.6;
      for (var k = 0; k < 110; k++) {
        var x = Math.random() * pw, y = Math.random() * ph;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y + rnd(8, 34)); g.stroke();
      }
      paper = c;
    }

    /* ---------- 粒子池 ---------- */
    var petals = [], sparks = [], drops = [], embers = [];
    function seedPetals(n) {
      petals.length = 0;
      for (var i = 0; i < n; i++) {
        petals.push({
          x: rnd(-0.1, 1.1) * W, y: rnd(-0.35, 1.05) * H,
          vy: rnd(18, 48), vx: rnd(-16, 10), r: rnd(3.2, 8.2),
          rot: rnd(0, 6.28), vr: rnd(-1.4, 1.4), ph: rnd(0, 6.28),
          hue: rnd(TH.petal[0], TH.petal[1]), a: rnd(0.28, 0.78)
        });
      }
    }
    function addSpark(x, y, opt) {
      opt = opt || {};
      sparks.push({
        x: x, y: y,
        vx: opt.vx !== undefined ? opt.vx : rnd(-320, 320),
        vy: opt.vy !== undefined ? opt.vy : rnd(-300, 160),
        life: 0, max: rnd(0.35, 1.0),
        size: rnd(1, 2.8), warm: opt.warm !== false
      });
    }
    function addDrop(x, y) {
      drops.push({ x: x, y: y, vx: rnd(90, 320), vy: rnd(-170, 60), life: 0, max: rnd(0.5, 1.3), size: rnd(1, 3.4) });
    }
    function addEmber(x, y) {
      embers.push({ x: x, y: y, vx: rnd(-48, 48), vy: rnd(-190, -55), life: 0, max: rnd(0.6, 1.7), size: rnd(1.2, 4.2) });
    }

    /* ============================================================
       绘制
       ============================================================ */
    function drawBackground(t) {
      ctx.fillStyle = rgba(TH.bg, 1);
      ctx.fillRect(0, 0, W, H);
      if (paper) {
        ctx.globalAlpha = 0.085;
        ctx.drawImage(paper, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      var glow = 0.10 + 0.30 * win(t, T.ichimatsu, T.zen, S(0.7)) + 0.22 * win(t, T.finale, T.end, S(0.5));
      var warm = mix(TH.paper, TH.bg, 0.45);
      var rg = ctx.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, Math.max(W, H) * 0.62);
      rg.addColorStop(0, rgba(warm, glow * 0.55));
      rg.addColorStop(0.6, rgba(mix(warm, BLK, 0.6), glow * 0.20));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }

    function drawPetals(t, dt) {
      if (!CFG.petals || petals.length === 0) return;
      var density = 0.55 + 0.45 * win(t, 0, T.slash, S(0.6)) + 0.5 * win(t, T.zen, T.end, S(0.6));
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.y += p.vy * dt * density;
        p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 22) * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40) {
          p.y = -rnd(10, H * 0.35); p.x = rnd(-0.05, 1.05) * W;
        }
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.a * (0.55 + 0.45 * win(t, 0, T.end, S(0.8)));
        ctx.fillStyle = 'hsl(' + p.hue.toFixed(0) + ',42%,' + (68 + Math.sin(p.ph) * 8).toFixed(0) + '%)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 0.62, p.r, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    /* 青海波（浮世绘海浪） */
    function drawSeigaiha(t) {
      var k = win(t, T.ichimatsu, T.zen, S(0.7));
      if (k <= 0.001) return;
      var r = Math.min(W, H) * 0.048;
      ctx.save();
      ctx.globalAlpha = 0.30 * k;
      ctx.lineWidth = 1.4;
      for (var row = 0; row < 7; row++) {
        var y = H - r * 0.5 - row * r * 0.62;
        var off = (row % 2) * r + Math.sin(t * 0.55 + row) * 7;
        for (var x = -r; x < W + r; x += r * 2) {
          for (var s = 1; s <= 3; s++) {
            ctx.strokeStyle = rgba(TH.wave, (0.9 - s * 0.22).toFixed(2));
            ctx.beginPath();
            ctx.arc(x + off, y, r * s / 3, Math.PI, 0);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    /* 抜刀：斜向刀光 + 火花 */
    function drawSlash(t, dt) {
      var a = T.slash, b = T.slash + S(0.62);
      if (t < a || t > b + S(0.5)) return;
      var p = clamp((t - a) / (b - a), 0, 1);
      var ep = easeOut(p);
      var x0 = -W * 0.12, y0 = H * 1.10, x1 = W * 1.12, y1 = -H * 0.10;
      var hx = lerp(x0, x1, ep), hy = lerp(y0, y1, ep);
      var tail = 0.22;
      var tx = lerp(x0, x1, clamp(ep - tail, 0, 1)), ty = lerp(y0, y1, clamp(ep - tail, 0, 1));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, rgba(TH.slash, 0));
      g.addColorStop(0.65, rgba(mix(TH.slash, WHT, 0.3), .55));
      g.addColorStop(1, 'rgba(255,255,255,.98)');
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = Math.min(W, H) * 0.048;
      ctx.shadowColor = rgba(mix(TH.slash, WHT, 0.2), .95); ctx.shadowBlur = 60;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.min(W, H) * 0.006;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.restore();

      if (t < b) {
        for (var i = 0; i < 7; i++) {
          addSpark(hx + rnd(-16, 16), hy + rnd(-16, 16), { warm: Math.random() > 0.45 });
        }
      }
    }

    /* 水之呼吸：左侧流动水带 */
    function drawWater(t, dt) {
      var k = win(t, T.breath, T.zen, S(0.65));
      if (k <= 0.001) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var baseX = W * 0.30, baseY = H * 0.52;
      var deep = mix(TH.water, BLK, 0.55), lite = mix(TH.water, WHT, 0.62), soft = mix(TH.water, WHT, 0.28);
      for (var i = 0; i < 9; i++) {
        var ph = i * 0.72;
        var spread = (i - 4) * H * 0.052;
        var alpha = (0.10 + 0.18 * Math.abs(Math.sin(t * 1.6 + ph))) * k;
        var g = ctx.createLinearGradient(-W * 0.1, 0, W * 0.62, 0);
        g.addColorStop(0, rgba(deep, 0));
        g.addColorStop(0.42, rgba(TH.water, alpha.toFixed(3)));
        g.addColorStop(0.82, rgba(lite, (alpha * 1.5).toFixed(3)));
        g.addColorStop(1, rgba(soft, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = lerp(2, 13, Math.abs(Math.sin(t * 1.1 + ph)));
        ctx.beginPath();
        var y = baseY + spread;
        ctx.moveTo(-W * 0.1, y + Math.sin(t * 2 + ph) * 40);
        ctx.bezierCurveTo(
          W * 0.12, y - 120 + Math.sin(t * 1.7 + ph) * 90,
          W * 0.32, y + 150 + Math.cos(t * 1.9 + ph) * 90,
          W * 0.62, y + Math.sin(t * 2.3 + ph) * 55
        );
        ctx.stroke();
      }
      for (var j = 0; j < 3; j++) {
        if (Math.random() < k * 0.9) addDrop(rnd(W * 0.05, W * 0.55), baseY + rnd(-H * 0.20, H * 0.20));
      }
      ctx.restore();
    }

    /* 炎之呼吸：右侧火焰（径向光团 + 火舌，避免硬边） */
    function drawFire(t, dt) {
      var k = win(t, T.breath, T.zen, S(0.65));
      if (k <= 0.001) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var cx = W * 0.72, cy = H * 0.70;
      var hot = mix(TH.fire, WHT, 0.45), mid = mix(TH.fire, BLK, 0.08), edgeC = mix(TH.fire, BLK, 0.35);

      for (var b = 0; b < 4; b++) {
        var bx = cx + Math.sin(t * 1.7 + b * 1.9) * W * 0.07;
        var by2 = cy + H * 0.10 + Math.cos(t * 1.3 + b) * H * 0.04;
        var rad = H * (0.42 + b * 0.07);
        var rg = ctx.createRadialGradient(bx, by2, 0, bx, by2, rad);
        rg.addColorStop(0, rgba(hot, 0.15 * k));
        rg.addColorStop(0.38, rgba(mid, 0.085 * k));
        rg.addColorStop(1, rgba(edgeC, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, by2, rad, 0, 6.283); ctx.fill();
      }

      for (var i = 0; i < 15; i++) {
        var x = cx + (i - 7) * W * 0.038 + Math.sin(t * 2.1 + i) * 12;
        var h = (H * 0.22 + Math.sin(t * 3.1 + i * 1.3) * H * 0.11 + H * 0.05 * ((i * 7) % 5)) * k;
        var w = W * 0.034;
        var by3 = H * 0.90 - h * 0.42;
        var edge = smooth(Math.min(1, (i + 0.5) / 3.2)) * smooth(Math.min(1, (14.5 - i) / 3.2));
        var rg2 = ctx.createRadialGradient(x, by3, 0, x, by3, Math.max(w, h * 0.58));
        rg2.addColorStop(0, rgba(hot, 0.15 * k * edge));
        rg2.addColorStop(0.45, rgba(mid, 0.095 * k * edge));
        rg2.addColorStop(1, rgba(edgeC, 0));
        ctx.save();
        ctx.translate(x, by3);
        ctx.scale(0.52, 1.25);
        ctx.translate(-x, -by3);
        ctx.fillStyle = rg2;
        ctx.beginPath(); ctx.arc(x, by3, Math.max(w, h * 0.58), 0, 6.283); ctx.fill();
        ctx.restore();
      }
      for (var j = 3; j < 6; j++) {
        if (Math.random() < k) addEmber(rnd(W * 0.52, W * 0.94), rnd(H * 0.48, H * 0.94));
      }
      ctx.restore();
    }

    function drawParticles(t, dt) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var i, p;
      for (i = sparks.length - 1; i >= 0; i--) {
        p = sparks[i]; p.life += dt;
        if (p.life >= p.max) { sparks.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.985;
        var a = 1 - p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = rgba(p.warm ? mix(TH.fire, WHT, 0.62) : mix(TH.slash, WHT, 0.35), 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.4, 0, 6.283); ctx.fill();
      }
      for (i = drops.length - 1; i >= 0; i--) {
        p = drops[i]; p.life += dt;
        if (p.life >= p.max) { drops.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
        var ad = 1 - p.life / p.max;
        ctx.globalAlpha = ad * 0.8;
        ctx.fillStyle = rgba(mix(TH.water, WHT, 0.45), 1);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.7, p.size * 1.5, 0, 0, 6.283); ctx.fill();
      }
      for (i = embers.length - 1; i >= 0; i--) {
        p = embers[i]; p.life += dt;
        if (p.life >= p.max) { embers.splice(i, 1); continue; }
        p.x += (p.vx + Math.sin(t * 5 + p.x * 0.01) * 24) * dt; p.y += p.vy * dt;
        var ae = 1 - p.life / p.max;
        ctx.globalAlpha = ae * 0.9;
        ctx.fillStyle = rgba(mix(TH.fire, WHT, ae > 0.5 ? 0.6 : 0.15), 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * ae + 0.5, 0, 6.283); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }

    /* ============================================================
       音频（Web Audio 实时合成，无音频文件）
       ============================================================ */
    var actx = null, master = null, noiseBuf = null, muted = !CFG.sound, windNode = null;
    var MASTER_VOL = 0.42 * CFG.volume;
    function initAudio() {
      if (!CFG.sound) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        master = actx.createGain(); master.gain.value = muted ? 0 : MASTER_VOL;
        master.connect(actx.destination);
        var len = actx.sampleRate * 2;
        noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        startWind();
        if (actx.state === 'suspended') actx.resume();
      } catch (e) { actx = null; }
    }
    function startWind() {
      if (!actx || !noiseBuf) return;
      var s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      var f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      var g = actx.createGain(); g.gain.value = 0.045;
      var lfo = actx.createOscillator(); lfo.frequency.value = 0.18;
      var lg = actx.createGain(); lg.gain.value = 0.028;
      lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(); lfo.start();
      windNode = { g: g };
    }
    function noiseHit(dur, type, freq, q, vol) {
      if (!actx) return;
      var s = actx.createBufferSource(); s.buffer = noiseBuf;
      var f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      var g = actx.createGain();
      var n = actx.currentTime;
      g.gain.setValueAtTime(0.0001, n);
      g.gain.exponentialRampToValueAtTime(vol, n + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(n); s.stop(n + dur + 0.02);
      return f;
    }
    function taiko(vol) {
      if (!actx) return;
      var n = actx.currentTime;
      var o = actx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, n);
      o.frequency.exponentialRampToValueAtTime(42, n + 0.42);
      var g = actx.createGain();
      g.gain.setValueAtTime(vol || 0.55, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.62);
      o.connect(g); g.connect(master); o.start(n); o.stop(n + 0.65);
      noiseHit(0.16, 'lowpass', 600, 1, 0.22);
    }
    function shing() {
      if (!actx) return;
      var n = actx.currentTime;
      var o = actx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(3200, n);
      o.frequency.exponentialRampToValueAtTime(760, n + 0.55);
      var g = actx.createGain();
      g.gain.setValueAtTime(0.0001, n);
      g.gain.exponentialRampToValueAtTime(0.16, n + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.62);
      o.connect(g); g.connect(master); o.start(n); o.stop(n + 0.65);
      var f = noiseHit(0.45, 'bandpass', 2600, 1.2, 0.28);
      if (f) f.frequency.exponentialRampToValueAtTime(700, n + 0.45);
    }
    function swish() {
      var f = noiseHit(0.5, 'bandpass', 500, 0.8, 0.16);
      if (f && actx) { var n = actx.currentTime; f.frequency.setValueAtTime(420, n); f.frequency.exponentialRampToValueAtTime(3000, n + 0.42); }
    }
    function chime() {
      if (!actx) return;
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (fq, i) {
        var n = actx.currentTime + i * 0.13;
        var o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = fq;
        var g = actx.createGain();
        g.gain.setValueAtTime(0.0001, n);
        g.gain.exponentialRampToValueAtTime(0.12 / (1 + i * 0.3), n + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, n + 1.5);
        o.connect(g); g.connect(master); o.start(n); o.stop(n + 1.55);
      });
    }
    function toggleMute() {
      if (!CFG.sound) return;
      muted = !muted;
      if (master && actx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, actx.currentTime, 0.05);
      el.muted.style.opacity = muted ? '1' : '0';
    }

    /* ============================================================
       DOM 演出调度
       ============================================================ */
    function reveal(node, dur, from) {
      if (!node) return;
      var a = from === 'left' ? 'inset(0 100% 0 0)' : 'inset(0 0 100% 0)';
      node.style.transition = 'none';
      node.style.clipPath = a;
      node.style.opacity = '1';
      void node.offsetWidth;
      node.style.transition = 'clip-path ' + dur + 's cubic-bezier(.22,.68,.2,1)';
      node.style.clipPath = 'inset(0 0 0 0)';
    }
    function fade(node, to, dur, extra) {
      if (!node) return;
      node.style.transition = (extra || 'opacity') + ' ' + dur + 's ease';
      node.style.opacity = String(to);
    }
    function flash(strength, dur) {
      el.white.style.transition = 'none';
      el.white.style.opacity = String(strength);
      void el.white.offsetWidth;
      el.white.style.transition = 'opacity ' + dur + 's ease-out';
      el.white.style.opacity = '0';
    }

    var events = [
      { t: S(0.20), fn: function () { el.hint.style.opacity = '1'; taiko(0.38); } },
      { t: T.prologue, fn: function () { reveal(el.pro1, S(1.15)); } },
      { t: S(0.85), fn: function () { reveal(el.pro2, S(1.0)); } },
      { t: T.ichimatsu, fn: function () {
          el.ichi.style.opacity = '0.62';
          el.ichi.style.transition = 'clip-path ' + S(1.15) + 's cubic-bezier(.3,.7,.2,1), opacity .7s ease';
          el.ichi.style.clipPath = 'inset(0 0 0 0)';
          swish();
        } },
      { t: S(2.85), fn: function () { fade(el.ichi, 0, S(0.55)); fade(el.pro1, 0, S(0.5)); fade(el.pro2, 0, S(0.5)); } },
      { t: T.slash, fn: function () {
          shing(); taiko(0.6); flash(0.86, S(0.48));
          reveal(el.slashK, S(0.30), 'left');
          setTimeout(function () { fade(el.slashK, 0, S(0.30)); }, 520 * SCALE);
        } },
      { t: T.breath, fn: function () {
          fade(el.wWater, 1, S(0.65)); fade(el.wFire, 1, S(0.65));
          el.wWater.animate([{ transform: 'translateY(-50%) scale(1.35)', filter: 'blur(14px)' }, { transform: 'translateY(-50%) scale(1)', filter: 'blur(0)' }], { duration: 900 * SCALE, easing: 'cubic-bezier(.2,.8,.2,1)' });
          el.wFire.animate([{ transform: 'translateY(-50%) scale(1.35)', filter: 'blur(14px)' }, { transform: 'translateY(-50%) scale(1)', filter: 'blur(0)' }], { duration: 900 * SCALE, delay: 130 * SCALE, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
          reveal(el.bSub, S(0.9), 'left');
          taiko(0.34);
        } },
      { t: S(5.75), fn: function () {
          fade(el.wWater, 0, S(0.5)); fade(el.wFire, 0, S(0.5)); fade(el.bSub, 0, S(0.5));
        } },
      { t: T.zen, fn: function () {
          reveal(el.zenMain, S(0.95), 'left');
          taiko(0.7);
          flash(0.24, S(0.5));
          setTimeout(function () {
            reveal(el.zenSub, S(0.9), 'left');
            el.seal.style.transition = 'opacity .18s steps(2), transform .28s cubic-bezier(.2,1.6,.4,1)';
            el.seal.style.opacity = '1';
            el.seal.style.transform = 'rotate(-8deg) scale(1)';
          }, 620 * SCALE);
        } },
      { t: S(7.55), fn: function () {
          fade(el.zenMain, 0, S(0.45)); fade(el.zenSub, 0, S(0.45)); fade(el.seal, 0, S(0.45));
        } },
      { t: T.finale, fn: function () {
          chime();
          el.logo.style.transition = 'opacity .7s ease, transform .9s cubic-bezier(.2,1.2,.3,1)';
          el.logo.style.transform = 'scale(1.18)';
          el.logo.style.opacity = '1';
          requestAnimationFrame(function () { el.logo.style.transform = 'scale(1)'; });
          setTimeout(function () { fade(el.brand, 1, S(0.65)); reveal(el.brandSub, S(0.8), 'left'); }, 300 * SCALE);
          setTimeout(function () {
            el.bar.style.opacity = '1';
            el.barFill.style.transition = 'width ' + S(1.05) + 's cubic-bezier(.3,.7,.2,1)';
            el.barFill.style.width = '100%';
          }, 590 * SCALE);
        } },
      { t: T.fade, fn: function () {
          el.stage.style.transition = 'opacity .42s ease';
          el.stage.style.opacity = '0';
        } },
      { t: T.end, fn: function () { finish(); } }
    ];
    var evIdx = 0;

    /* ---------- 结束 / 跳过 ---------- */
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      try { if (windNode && actx) windNode.g.gain.setTargetAtTime(0, actx.currentTime, 0.12); } catch (e) { }
      try { el.video.pause(); } catch (e) { }
      if (window.bootAPI && window.bootAPI.done) window.bootAPI.done();
      else {
        /* 浏览器预览：停在终章 */
        el.stage.style.transition = 'opacity .8s ease';
        el.stage.style.opacity = '1';
        el.hint.textContent = '预览模式 · 动画已结束';
        el.hint.style.opacity = '1';
      }
    }
    function skip() {
      if (finished) return;
      el.stage.style.transition = 'opacity .35s ease';
      el.stage.style.opacity = '0';
      setTimeout(finish, 380);
    }
    var keysBound = false, currentMute = toggleMute;
    function bindKeys(muteHandler) {
      currentMute = muteHandler || toggleMute;
      if (keysBound) return;
      keysBound = true;
      document.addEventListener('click', skip);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'm' || e.key === 'M') { currentMute(); return; }
        if (e.key === 's' || e.key === 'S') {
          if (window.bootAPI && window.bootAPI.openSettings) window.bootAPI.openSettings();
          return;
        }
        skip();
      });
    }

    /* ---------- 主循环 ---------- */
    var start = 0, last = 0;
    function frame(ts) {
      if (!start) { start = ts; last = ts; }
      var t = (ts - start) / 1000;
      var dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      window.__animT = t;   /* 供自检按动画时钟抓帧 */

      if (!finished) {
        while (evIdx < events.length && t >= events[evIdx].t) {
          try { events[evIdx].fn(); } catch (e) { }
          evIdx++;
        }
        drawBackground(t);
        drawSeigaiha(t);
        drawPetals(t, dt);
        drawSlash(t, dt);
        drawWater(t, dt);
        drawFire(t, dt);
        drawParticles(t, dt);
        if (t > T.end + 3) finish();
      }
      requestAnimationFrame(frame);
    }

    /* ---------- 内置动画启动 ---------- */
    function startBuiltin() {
      bindKeys(toggleMute);
      resize();
      seedPetals(CFG.petals ? CFG.petalDensity : 0);
      initAudio();
      if (muted) el.muted.style.opacity = '1';
      requestAnimationFrame(frame);
    }

    /* ---------- 自定义视频开场 ---------- */
    function showFinaleCard(seconds) {
      el.logo.style.transition = 'opacity .5s ease, transform .7s cubic-bezier(.2,1.2,.3,1)';
      el.logo.style.opacity = '1';
      el.logo.style.transform = 'scale(1)';
      el.brand.style.transition = 'opacity .55s ease'; el.brand.style.opacity = '1';
      el.brandSub.style.transition = 'opacity .55s ease'; el.brandSub.style.opacity = '1';
      el.bar.style.opacity = '1';
      el.barFill.style.transition = 'width ' + Math.max(0.4, seconds * 0.75) + 's linear';
      requestAnimationFrame(function () { el.barFill.style.width = '100%'; });
    }

    function videoBoot(fallback) {
      var v = el.video, V = CFG.video, fellBack = false;
      function bail(reason) {
        if (fellBack) return;
        fellBack = true;
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { }
        try { document.body.classList.remove('video-mode'); } catch (e) { }
        el.hint.textContent = '点击或按任意键跳过　·　M 静音　·　S 设置';
        if (window.bootAPI && window.bootAPI.log) window.bootAPI.log('video fallback: ' + reason);
        fallback();
      }

      document.body.classList.add('video-mode');
      el.videoLayer.style.display = 'block';
      v.style.objectFit = V.fit;
      v.muted = !!V.mute;
      v.volume = V.volume;
      v.src = EXTRA.videoUrl;
      el.hint.textContent = '点击或按任意键跳过　·　M 静音　·　S 设置';
      el.hint.style.opacity = '1';

      var ended = false;
      function videoDone() {
        if (ended || finished) return;
        ended = true;
        try { v.pause(); } catch (e) { }
        if (!V.showFinale) { skip(); return; }
        showFinaleCard(V.finaleSeconds);
        setTimeout(function () { if (!finished) skip(); }, V.finaleSeconds * 1000);
      }
      v.addEventListener('ended', videoDone);
      v.addEventListener('timeupdate', function () {
        if (V.maxSeconds > 0 && v.currentTime >= V.maxSeconds) videoDone();
      });
      v.addEventListener('error', function () { bail('load error'); });
      var p = v.play();
      if (p && p.catch) p.catch(function (e) { bail('play rejected: ' + (e && e.message)); });
      var guard = setTimeout(function () {
        if (v.readyState < 2 && !fellBack) bail('timeout');
      }, 8000);
      v.addEventListener('playing', function () { clearTimeout(guard); });

      bindKeys(function () {
        v.muted = !v.muted;
        el.muted.textContent = v.muted ? '静音中' : '原声';
        el.muted.style.opacity = v.muted ? '1' : '0';
      });
    }

    /* ---------- 入口 ---------- */
    if (CFG.video.enabled && EXTRA.videoAvailable && EXTRA.videoUrl) {
      videoBoot(startBuiltin);
    } else {
      startBuiltin();
    }
  }
})();
