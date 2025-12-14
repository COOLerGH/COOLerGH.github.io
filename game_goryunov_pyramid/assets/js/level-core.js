(function(){
  const cvs = document.getElementById('canvas');
  const ctx = cvs.getContext('2d');

  const timerElement = document.getElementById('timer');
  const collectedElement = document.getElementById('collected');

  function normalizeMode(m) {
    const s = String(m || '').trim().toLowerCase();
    if (s === 'drag' || s === 'two' || s === 'normal') return s;
    return 'normal';
  }

  function resolveMode() {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    const lsMode = (() => {
      try { return localStorage.getItem('mode'); } catch (_) { return null; }
    })();
    const m = normalizeMode(urlMode || lsMode || 'normal');
    try { localStorage.setItem('mode', m); } catch (_) {}
    return m;
  }

  let mode = resolveMode(); // normal | two | drag

  const BASE_DPR = window.devicePixelRatio || 1;
  const BASE_HEIGHT = 600; // эталонная высота для расчёта скорости

  let rings = [];
  let collected = [0, 0];

  let w = 0;
  let h = 0;
  let speedScale = 1; // коэффициент масштабирования скорости

  let rodX = [0, 0];
  const rodWidth = 20;
  const baseHeight = 50;

  let rodColor = ['#8B4513', '#8B4513'];
  let rodTargetRgb = [null, null];

  let startTime = 0;
  let timerId = null;
  let locked = false;

  let draggingId = null;
  let dragOffset = { x: 0, y: 0 };

  let selectedCollectedId = null;
  let leftShiftDown = false;

  // overlay (для важных сообщений, чтобы не пропадали из-за перерисовки gameLoop)
  let overlayText = null;

  // небольшие подсказки (toast) без затемнения экрана
  let toast = null;
  function showToast(text, ms = 900) {
    toast = { text: String(text || ''), until: Date.now() + ms };
  }

  // Анимация завершения
  // phases: jump -> rodDown -> ringsReturn -> done
  let completion = null;
  let animRodOffsetY = 0;
  let animRingsOffsetY = 0;

  // LOL
  const CHEAT_SEQ = ['KeyL', 'KeyO', 'KeyL'];
  let cheatPos = 0;
  let cheatLastTs = 0;

  // SC
  const CHEAT_SC = ['KeyS', 'KeyC'];
  let scPos = 0;
  let scLastTs = 0;
  let showRgbLabels = false;

  function triggerSkipLevel() {
    if (completion || locked) return;
    const target = (window.LEVEL_SETTINGS && window.LEVEL_SETTINGS.targetSize) ? window.LEVEL_SETTINGS.targetSize : 0;
    if (!target) return;

    const towers = (mode === 'two') ? 2 : 1;


    for (let t = 0; t < towers; t++) {
      for (let i = 0; i < target; i++) {
        const ring = rings.find(r => r.tower === t && r.order === i);
        if (ring) {
          ring.collected = true;
          ring.dragging = false;
          if (mode === 'drag') ring.color = rodColor[0];
        }
      }
      collected[t] = target;
    }

    draggingId = null;
    updateCollectedDisplay();
    levelComplete();
  }

  function handleCheatKeydown(e) {

    if (e.repeat) return;

    const now = Date.now();

    //LOL
    if (now - cheatLastTs > 2000) cheatPos = 0; 
    cheatLastTs = now;

    const code = e.code;
    if (code === CHEAT_SEQ[cheatPos]) {
      cheatPos += 1;
    } else {
      cheatPos = (code === CHEAT_SEQ[0]) ? 1 : 0;
    }

    if (cheatPos >= CHEAT_SEQ.length) {
      cheatPos = 0;
      triggerSkipLevel();
      return;
    }

    // SC
    if (mode !== 'drag') return;
    // чуть больше окно по времени для SC
    if (now - scLastTs > 2000) scPos = 0;
    scLastTs = now;

    if (code === CHEAT_SC[scPos]) {
      scPos += 1;
    } else {
      scPos = (code === CHEAT_SC[0]) ? 1 : 0;
    }

    if (scPos >= CHEAT_SC.length) {
      scPos = 0;
      showRgbLabels = !showRgbLabels;
      // Небольшая подсказка (на 700 мс), чтобы было видно, что комбинация сработала
      if (!completion) {
        overlayText = showRgbLabels ? 'RGB: Вкл' : 'RGB: Выкл';
        setTimeout(() => {
          // не затираем другие сообщения (например, "Время вышло!")
          if (overlayText === 'RGB: Вкл' || overlayText === 'RGB: Выкл') overlayText = null;
        }, 700);
      }
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }
  function easeOutCubic(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutCubic(t) {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutBack(t) {
    t = clamp01(t);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function clamp255(v) {
    v = Math.round(v);
    return Math.max(0, Math.min(255, v));
  }

  function parseColorToRgb(str) {
    if (!str || typeof str !== 'string') return { r: 120, g: 120, b: 120 };
    const s = str.trim().toLowerCase();

    // rgb/rgba
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const parts = m[1].split(',').map(x => x.trim());
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
    }

    // hsl/hsla
    m = s.match(/^hsla?\(([^)]+)\)$/);
    if (m) {
      const parts = m[1].split(',').map(x => x.trim());
      const h = parseFloat(parts[0]);
      const ss = parseFloat(parts[1]);
      const ll = parseFloat(parts[2]);
      return hslToRgb(h, ss, ll);
    }

    try {
      const tmp = document.createElement('span');
      tmp.style.color = s;
      document.body.appendChild(tmp);
      const rgb = getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
      return parseColorToRgb(rgb);
    } catch (_) {
      return { r: 120, g: 120, b: 120 };
    }
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let rp = 0, gp = 0, bp = 0;
    if (h < 60) { rp = c; gp = x; bp = 0; }
    else if (h < 120) { rp = x; gp = c; bp = 0; }
    else if (h < 180) { rp = 0; gp = c; bp = x; }
    else if (h < 240) { rp = 0; gp = x; bp = c; }
    else if (h < 300) { rp = x; gp = 0; bp = c; }
    else { rp = c; gp = 0; bp = x; }

    return {
      r: clamp255((rp + m) * 255),
      g: clamp255((gp + m) * 255),
      b: clamp255((bp + m) * 255)
    };
  }

  function rgbToCss(rgb) {
    return `rgb(${clamp255(rgb.r)}, ${clamp255(rgb.g)}, ${clamp255(rgb.b)})`;
  }

  function adjustSelectedChannel(channel, delta) {
    if (mode !== 'drag') return;
    if (!selectedCollectedId || completion) return;

    const ring = rings.find(r => r.id === selectedCollectedId);
    if (!ring || !ring.collected) return;

    const rgb = parseColorToRgb(ring.color);
    if (channel === 'r') rgb.r = clamp255(rgb.r + delta);
    if (channel === 'g') rgb.g = clamp255(rgb.g + delta);
    if (channel === 'b') rgb.b = clamp255(rgb.b + delta);

    ring.color = rgbToCss(rgb);

    if (isLevelDone()) levelComplete();
  }

  function getBrowserZoomFactor() {
    const dpr = window.devicePixelRatio || 1;
    return dpr / BASE_DPR;
  }

  function getZoomCompensation() {
    const z = getBrowserZoomFactor();
    return z > 0 ? (1 / z) : 1;
  }

  let lastHudComp = null;
  let hudBase = null;

  function captureHudBase() {
    const wrap = document.querySelector('.wrap');
    const hrs = document.querySelectorAll('hr');
    if (!wrap) return null;

    const blocks = Array.from(wrap.querySelectorAll('.block'));
    const btn = wrap.querySelector('.block .button');

    const wrapCS = getComputedStyle(wrap);
    const hrCS = hrs[0] ? getComputedStyle(hrs[0]) : null;
    const blockCS = blocks[0] ? getComputedStyle(blocks[0]) : null;
    const btnCS = btn ? getComputedStyle(btn) : null;

    return {
      wrap,
      hrs,
      blocks,
      btn,
      wrapHeight: parseFloat(wrapCS.height) || 70,
      hrHeight: hrCS ? (parseFloat(hrCS.height) || 3) : 3,
      blockFont: blockCS ? (parseFloat(blockCS.fontSize) || 16) : 16,
      btnFont: btnCS ? (parseFloat(btnCS.fontSize) || 12) : 12,
      btnPadY: btnCS ? (parseFloat(btnCS.paddingTop) || 6) : 6,
      btnPadX: btnCS ? (parseFloat(btnCS.paddingLeft) || 12) : 12,
      btnMinW: btnCS ? (parseFloat(btnCS.minWidth) || 100) : 100,
      borderW: blockCS ? (parseFloat(blockCS.borderRightWidth) || 3) : 3,
    };
  }

  function updateHudScale(force = false) {
    if (!hudBase) hudBase = captureHudBase();
    if (!hudBase) return;

    const comp = getZoomCompensation();
    if (!force && lastHudComp != null && Math.abs(comp - lastHudComp) < 0.01) return;
    lastHudComp = comp;

    const { wrap, hrs, blocks, btn } = hudBase;

    wrap.style.zoom = '';
    wrap.style.transform = '';

    const maxHudH = Math.max(60, Math.floor(window.innerHeight * 0.40));
    const nextH = Math.min(maxHudH, hudBase.wrapHeight * comp);
    wrap.style.height = `${nextH}px`;

    hrs.forEach(hr => {
      hr.style.zoom = '';
      hr.style.transform = '';
      hr.style.height = `${hudBase.hrHeight * comp}px`;
    });

    blocks.forEach(b => {
      b.style.fontSize = `${hudBase.blockFont * comp}px`;
      b.style.borderRightWidth = `${hudBase.borderW * comp}px`;
    });

    if (btn) {
      btn.style.fontSize = `${hudBase.btnFont * comp}px`;
      btn.style.padding = `${hudBase.btnPadY * comp}px ${hudBase.btnPadX * comp}px`;
      btn.style.minWidth = `${hudBase.btnMinW * comp}px`;
    }
  }

  function setCanvasSize() {
    updateHudScale(false);

    const rect = cvs.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    updateRods();
    updateSpeedScale();
  }

  function updateSpeedScale() {
    const heightScale = h / BASE_HEIGHT;
    const comp = getZoomCompensation();
    speedScale = heightScale * comp;
  }

  function updateRods() {
    if (mode === 'two') {
      rodX[0] = Math.round(w * 0.33);
      rodX[1] = Math.round(w * 0.67);
      return;
    }

    const left = Math.round(w * 0.18);
    rodX[0] = Math.max(80, left);
    rodX[1] = rodX[0];
  }

  window.addEventListener('resize', setCanvasSize);
  window.addEventListener('blur', () => { leftShiftDown = false; });

  setInterval(() => {
    const prev = lastHudComp;
    updateHudScale(false);
    if (prev != null && lastHudComp != null && Math.abs(prev - lastHudComp) >= 0.01) {
      setCanvasSize();
    }
  }, 250);

  function formatMs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function withMode(url) {
    try {
      const u = new URL(url, window.location.href);
      if (!u.searchParams.get('mode')) u.searchParams.set('mode', mode);
      return u.href;
    } catch (_) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}mode=${encodeURIComponent(mode)}`;
    }
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function getPointerPos(e) {
    const rect = cvs.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function findTopRingAt(x, y) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      if (r.collected) continue;
      const dx = x - r.x;
      const dy = y - r.y;
      if (Math.sqrt(dx*dx + dy*dy) <= r.size) return r;
    }
    return null;
  }

  function findCollectedRingAt(x, y) {
    const towerIndex = 0;
    const maxOrder = collected[towerIndex] - 1;
    if (maxOrder < 0) return null;

    const ringHeight = 20;
    const ringSpacing = 5;
    const baseY = h - baseHeight + (animRingsOffsetY || 0);

    for (let i = maxOrder; i >= 0; i--) {
      const ring = rings.find(r => r.tower === towerIndex && r.order === i && r.collected);
      if (!ring) continue;
      if (ring.returning) continue;

      const centerX = rodX[towerIndex];
      const centerY = baseY - i * (ringHeight + ringSpacing) - ringHeight / 2;
      const rx = ring.size;
      const ry = ringHeight / 2;

      const nx = (x - centerX) / rx;
      const ny = (y - centerY) / ry;
      if (nx * nx + ny * ny <= 1) return ring;
    }

    return null;
  }

  function resetCollectedRings() {
    if (completion) return;
    rings.forEach(r => { r.collected = false; r.dragging = false; });
    draggingId = null;
    collected = [0, 0];
    updateCollectedDisplay();
  }

  function updateCollectedDisplay() {
    if (!collectedElement) return;
    const target = window.LEVEL_SETTINGS.targetSize;

    if (mode === 'two') {
      collectedElement.textContent = `Л: ${collected[0]}/${target}   П: ${collected[1]}/${target}`;
      return;
    }

    if (mode === 'drag') {
      const c = rodColor[0] || '#8B4513';
      collectedElement.textContent = `${collected[0]}/${target}  •  Цвет стержня: ${c}`;
      return;
    }

    collectedElement.textContent = `${collected[0]}/${target}`;
  }

  function isOverRod(x, y, towerIndex) {
    const rx = rodX[towerIndex];
    const rodTop = h / 3;
    const rodBottom = h - baseHeight;
    const zoneX = 90;
    return x >= rx - zoneX && x <= rx + zoneX && y >= rodTop && y <= rodBottom;
  }

  function colorsClose(a, b, tol = 60) {
    return Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
  }

  function allCollectedMatchRod() {
    if (mode !== 'drag') return true;
    const target = window.LEVEL_SETTINGS.targetSize;
    if (collected[0] !== target) return false;

    const rodRgb = rodTargetRgb[0] || parseColorToRgb(rodColor[0]);
    rodTargetRgb[0] = rodRgb;

    for (let i = 0; i < target; i++) {
      const ring = rings.find(r => r.tower === 0 && r.order === i && r.collected);
      if (!ring) return false;
      const ringRgb = parseColorToRgb(ring.color);
      if (!colorsClose(ringRgb, rodRgb, 60)) return false;
    }
    return true;
  }

  function isLevelDone() {
    const target = window.LEVEL_SETTINGS.targetSize;
    if (mode === 'two') return collected[0] === target && collected[1] === target;
    if (mode === 'drag') return collected[0] === target && allCollectedMatchRod();
    return collected[0] === target;
  }

  function tryCollectRing(ring) {
    if (completion) return false;

    const t = ring.tower;
    if (ring.order === collected[t]) {
      // запоминаем место, где кольцо было «в мире» (до сборки на стержень)
      // чтобы при завершении уровня вернуть его обратно именно туда, а не в стартовую точку над экраном.
      // ограничим верх, чтобы кольца не улетали слишком высоко (в отрицательные Y за пределами экрана)
      ring.originX = ring.x;
      ring.originY = Math.max(-ring.size, ring.y);

      ring.collected = true;
      ring.dragging = false;
      collected[t] += 1;
      updateCollectedDisplay();
      if (isLevelDone()) levelComplete();
      return true;
    }

    resetCollectedRings();
    return false;
  }

  function startTimer() {
    clearInterval(timerId);
    startTime = Date.now();
    timerId = setInterval(updateTimer, 100);
    updateTimer();
  }

  function updateTimer() {
    if (completion) return;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, window.LEVEL_SETTINGS.timeLimit - elapsed);
    if (timerElement) timerElement.textContent = formatMs(remaining);
    if (remaining <= 0) timeExpired();
  }

  function showMessage(text) {
    locked = true;
    overlayText = text;
  }

  function drawOverlay() {
    if (!overlayText) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Century Gothic';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlayText, w / 2, h / 2);
    ctx.restore();
  }

  function drawToast() {
    if (!toast || overlayText) return;
    if (Date.now() > toast.until) { toast = null; return; }

    const text = toast.text;
    if (!text) return;

    ctx.save();
    ctx.font = 'bold 16px Century Gothic';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const padX = 12;
    const padY = 8;
    const x = 12;
    const y = 12;
    const metrics = ctx.measureText(text);
    const boxW = Math.ceil(metrics.width) + padX * 2;
    const boxH = 16 + padY * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, boxW, boxH);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(text, x + padX, y + padY);
    ctx.restore();
  }

  function timeExpired() {
    if (completion) return;
    clearInterval(timerId);

    const attemptKey = window.LEVEL_META.attemptKey;
    const prev = parseInt(localStorage.getItem(attemptKey) || '0', 10);
    localStorage.setItem(attemptKey, String(prev + 1));

    showMessage('Время вышло!');
    setTimeout(() => {
      document.location.href = withMode(window.LEVEL_META.reloadUrl);
    }, 2000);
  }

  function getStackPos(towerIndex, order, extraOffsetY) {
    const ringHeight = 20;
    const ringSpacing = 5;
    const baseY = h - baseHeight + (extraOffsetY || 0);
    const centerX = rodX[towerIndex];
    const centerY = baseY - order * (ringHeight + ringSpacing) - ringHeight / 2;
    return { x: centerX, y: centerY };
  }

  function startCompletionAnimation() {
    const now = performance.now();
    locked = true;
    overlayText = null;

    draggingId = null;
    rings.forEach(r => { r.dragging = false; });

    const towers = (mode === 'two') ? 2 : 1;
    const target = window.LEVEL_SETTINGS.targetSize;

    completion = {
      phase: 'jump',
      phaseStart: now,
      towers,
      target,
      // очередь возврата колец снизу вверх (с большого к маленькому): сначала самое нижнее
      returnQueue: Array.from({ length: towers }, () => Array.from({ length: target }, (_, i) => i)),
      activeId: Array.from({ length: towers }, () => null),
      redirectPlanned: false
    };

    animRodOffsetY = 0;
    animRingsOffsetY = 0;

    // очистка флагов
    rings.forEach(r => {
      r.returning = false;
      r.returned = false;
      r.returnStart = 0;
      r.returnDur = 0;
      r.returnFrom = null;
      r.returnTo = null;
    });
  }

  function updateCompletionAnimation(now) {
    if (!completion) {
      animRodOffsetY = 0;
      animRingsOffsetY = 0;
      return;
    }

    if (completion.phase === 'jump') {
      const dur = 650;
      const p = clamp01((now - completion.phaseStart) / dur);

      const peak = -70;
      const hover = -24;
      let y;
      if (p < 0.62) {
        const pp = p / 0.62;
        y = lerp(0, peak, easeOutCubic(pp));
      } else {
        const pp = (p - 0.62) / 0.38;
        y = lerp(peak, hover, easeInOutCubic(pp));
      }

      animRodOffsetY = y;
      animRingsOffsetY = y;

      if (p >= 1) {
        completion.phase = 'rodDown';
        completion.phaseStart = now;
      }
      return;
    }

    if (completion.phase === 'rodDown') {
      const dur = 420;
      const p = clamp01((now - completion.phaseStart) / dur);

      const hover = -24;
      animRingsOffsetY = hover;
      animRodOffsetY = lerp(hover, 0, easeOutBack(p));

      if (p >= 1) {
        animRodOffsetY = 0;
        completion.phase = 'ringsReturn';
        completion.phaseStart = now;
      }
      return;
    }

    if (completion.phase === 'ringsReturn') {
      animRodOffsetY = 0;
      animRingsOffsetY = -24;

      for (const r of rings) {
        if (!r.returning) continue;
        const p = clamp01((now - r.returnStart) / r.returnDur);
        if (p >= 1) {
          r.returning = false;
          r.returned = true;
        }
      }

      for (let t = 0; t < completion.towers; t++) {
        if (completion.activeId[t]) {
          const active = rings.find(r => r.id === completion.activeId[t]);
          if (!active || active.returned) completion.activeId[t] = null;
        }

        if (!completion.activeId[t]) {
          const nextOrder = completion.returnQueue[t].shift();
          if (nextOrder != null) {
            const ring = rings.find(r => r.tower === t && r.order === nextOrder);
            if (ring) {
              const from = getStackPos(t, nextOrder, animRingsOffsetY);
              ring.returning = true;
              ring.returned = false;
              ring.returnStart = now;
              ring.returnDur = 220;
              ring.returnFrom = { x: from.x, y: from.y };
              const to = getStackPos(t, nextOrder, 0);
              ring.returnTo = { x: to.x, y: to.y };
              completion.activeId[t] = ring.id;
            }
          }
        }
      }

      // проверка окончания
      let done = true;
      for (let t = 0; t < completion.towers; t++) {
        if (completion.activeId[t]) done = false;
        if (completion.returnQueue[t].length) done = false;
      }

      if (done) {
        completion.phase = 'done';
        completion.phaseStart = now;
      }
      return;
    }

    if (completion.phase === 'done') {
      animRodOffsetY = 0;
      animRingsOffsetY = 0;

      if (!completion.redirectPlanned) {
        completion.redirectPlanned = true;
        showMessage('Уровень пройден!');
        setTimeout(() => {
          document.location.href = withMode(window.LEVEL_META.nextUrl);
        }, 1200);
      }
    }
  }

  function levelComplete() {
    if (completion) return;
    clearInterval(timerId);

    const score = Math.max(100, Math.round(300 - (Date.now() - startTime) / 100));
    localStorage.setItem(window.LEVEL_META.scoreKey, String(score));

    startCompletionAnimation();
  }

  function initRings() {
    const S = window.LEVEL_SETTINGS;
    const towers = (mode === 'two') ? 2 : 1;

    rings = [];
    collected = [0, 0];

    overlayText = null;
    completion = null;
    animRodOffsetY = 0;
    animRingsOffsetY = 0;

    selectedCollectedId = null;
    leftShiftDown = false;
    showRgbLabels = false;
    scPos = 0;
    scLastTs = 0;

    rodColor = ['#8B4513', '#8B4513'];
    rodTargetRgb = [null, null];

    if (mode === 'drag') {
      const rgb = {
        r: Math.floor(rand(30, 226)),
        g: Math.floor(rand(30, 226)),
        b: Math.floor(rand(30, 226))
      };
      rodColor[0] = rgbToCss(rgb);
      rodTargetRgb[0] = rgb;
    }

    updateCollectedDisplay();

    for (let t = 0; t < towers; t++) {
      for (let i = 0; i < S.ringCount; i++) {
        const step = 20;
        const base = 60;
        const size = base + (S.ringCount - 1 - i) * step; 

        // В режиме "Две Башни" кольца обоих наборов падают вперемешку по всей ширине
        const minX = 0;
        const maxX = w;

        const x = rand(minX + size, maxX - size);
        const y = -size - i * 110 - t * 80;
        const hueBase = (t === 0 ? 210 : 20);
        const hue = (hueBase + i * (300 / Math.max(1, S.ringCount - 1))) % 360;

        const minSize = base;
        const maxSize = base + (S.ringCount - 1) * step;
        const norm = (size - minSize) / Math.max(1, (maxSize - minSize)); // 0..1
        const speedMul = 0.8 + (1 - norm) * 0.5; // biggest ~0.8x, smallest ~1.3x
        const fallSpeed = S.ringSpeed * speedMul * rand(0.95, 1.05);

        // Цвета колец:
        // - левая башня/обычные режимы: цветной градиент
        // - правая башня в режиме "Две Башни": монохром (от чёрного к белому)
        let ringColor;
        if (mode === 'two' && t === 1) {
          const denom = Math.max(1, (S.ringCount - 1));
          const lightness = Math.round((i / denom) * 100); // 0..100
          ringColor = `hsl(0, 0%, ${lightness}%)`;
        } else {
          ringColor = `hsl(${hue}, 70%, 60%)`;
        }

        rings.push({
          id: `${t}-${i}`,
          tower: t,
          order: i,
          x,
          y,
          // home — стартовые позиции при инициализации (могут быть выше экрана)
          homeX: x,
          homeY: y,
          // origin — актуальные позиции для «возврата назад» (обновим при сборе)
          originX: x,
          originY: y,
          size,
          color: ringColor,
          speed: fallSpeed,
          collected: false,
          dragging: false,
          returning: false,
          returned: false,
          returnStart: 0,
          returnDur: 0,
          returnFrom: null,
          returnTo: null
        });
      }
    }
  }

  function drawRod(towerIndex) {
    const offsetY = animRodOffsetY || 0;


    if (mode === 'drag') {
      ctx.fillStyle = rodColor[towerIndex] || '#8B4513';
    } else {
      const isRightInTwo = (mode === 'two' && towerIndex === 1);
      ctx.fillStyle = isRightInTwo ? '#7a7a7a' : '#8B4513';
    }

    ctx.fillRect(rodX[towerIndex] - rodWidth / 2, h / 3 + offsetY, rodWidth, h * 2/3 - baseHeight);
    ctx.fillRect(rodX[towerIndex] - 60, h - baseHeight + offsetY, 120, baseHeight);

    if (mode === 'drag' && draggingId && !locked && !completion) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      const themeHref = (document.getElementById('theme') && document.getElementById('theme').href) ? document.getElementById('theme').href : '';
      const isDark = themeHref.includes('dark.css');
      ctx.fillStyle = isDark ? '#f0f4ef' : '#56548c';
      ctx.fillRect(rodX[towerIndex] - 90, h / 3 + offsetY, 180, h * 2/3);
      ctx.restore();
    }
  }

  function drawCollectedRings(towerIndex) {
    const ringHeight = 20;
    const ringSpacing = 5;

    for (let i = 0; i < collected[towerIndex]; i++) {
      const ring = rings.find(r => r.tower === towerIndex && r.order === i && r.collected);
      if (!ring) continue;

      if (ring.returning) continue;

      const offsetY = ring.returned ? 0 : (animRingsOffsetY || 0);
      const baseY = h - baseHeight + offsetY;

      const centerX = rodX[towerIndex];
      const centerY = baseY - i * (ringHeight + ringSpacing) - ringHeight / 2;
      const radiusX = ring.size;
      const radiusY = ringHeight / 2;

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();

 
      if (mode === 'drag' && selectedCollectedId && ring.id === selectedCollectedId) {
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.95)';
        ctx.stroke();
        ctx.restore();
      }

      if (mode === 'drag' && showRgbLabels) {
        const rgb = parseColorToRgb(ring.color);
        const label = `R:${rgb.r} G:${rgb.g} B:${rgb.b}`;
        ctx.save();
        ctx.font = 'bold 12px Century Gothic';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(label, centerX, centerY);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(label, centerX, centerY);
        ctx.restore();
      }
    }
  }

  function drawReturningRings(now) {
    // Рисуем возвращающиеся кольца в том же виде, что и собранные (сбоку): залитый эллипс
    const ringHeight = 20;
    const radiusY = ringHeight / 2;

    for (const ring of rings) {
      if (!ring.collected) continue;
      if (!ring.returning && !ring.returned) continue;

      let x, y;
      if (ring.returning && ring.returnFrom && ring.returnTo) {
        const p = clamp01((now - ring.returnStart) / ring.returnDur);
        const tt = easeInOutCubic(p);
        x = lerp(ring.returnFrom.x, ring.returnTo.x, tt);
        y = lerp(ring.returnFrom.y, ring.returnTo.y, tt);
      } else {
        // если вдруг не записали траекторию — ставим кольцо на стержень
        const to = getStackPos(ring.tower, ring.order, 0);
        x = to.x;
        y = to.y;
      }

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, ring.size, radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();

      // лёгкая обводка для читаемости на ярком фоне
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      if (mode === 'drag' && selectedCollectedId && ring.id === selectedCollectedId) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.95)';
        ctx.stroke();
      }

      if (mode === 'drag' && showRgbLabels) {
        const rgb = parseColorToRgb(ring.color);
        const label = `R:${rgb.r} G:${rgb.g} B:${rgb.b}`;
        ctx.globalAlpha = 1;
        ctx.font = 'bold 12px Century Gothic';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(label, x, y);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(label, x, y);
      }

      ctx.restore();
    }
  }

  function drawFallingRings() {
    if (completion) return;

    updateSpeedScale();

    for (const ring of rings) {
      if (ring.collected) continue;

      if (!ring.dragging) {
        ring.y += ring.speed * speedScale;
        if (ring.y > h + ring.size) {
          // В режиме "Две Башни" кольца обоих наборов респавнятся по всей ширине (вперемешку)
          const minX = 0;
          const maxX = w;

          ring.y = -ring.size;
          ring.x = rand(minX + ring.size, maxX - ring.size);
          // актуализируем базовую «точку мира» для возможного возврата
          ring.originX = ring.x;
          ring.originY = ring.y;
        }
      }

      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.size, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.closePath();
    }
  }

  function gameLoop() {
    const now = performance.now();

    // фон из CSS темы
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (completion) updateCompletionAnimation(now);

    const towers = (mode === 'two') ? 2 : 1;
    for (let t = 0; t < towers; t++) {
      drawRod(t);
      drawCollectedRings(t);
    }

    // во время анимации завершения рисуем «улетающие» кольца поверх
    if (completion) {
      drawReturningRings(now);
    } else {
      drawFallingRings();
    }

    drawOverlay();

    requestAnimationFrame(gameLoop);
  }

  // ===== Input =====
  function setupInput() {
    if (mode === 'drag') {
      cvs.addEventListener('pointerdown', (e) => {
        if (locked || completion) return;
        const p = getPointerPos(e);

        const collectedRing = findCollectedRingAt(p.x, p.y);
        if (collectedRing) {
          selectedCollectedId = collectedRing.id;
          e.preventDefault();
          return;
        }

        const ring = findTopRingAt(p.x, p.y);
        if (!ring) {
          selectedCollectedId = null;
          return;
        }

        selectedCollectedId = null;

        e.preventDefault();
        cvs.setPointerCapture(e.pointerId);
        draggingId = ring.id;
        ring.dragging = true;
        dragOffset.x = p.x - ring.x;
        dragOffset.y = p.y - ring.y;
      }, { passive: false });

      cvs.addEventListener('pointermove', (e) => {
        if (!draggingId) return;
        const ring = rings.find(r => r.id === draggingId);
        if (!ring || ring.collected) return;

        const p = getPointerPos(e);
        ring.x = p.x - dragOffset.x;
        ring.y = p.y - dragOffset.y;
      });

      function endDrag(e) {
        if (!draggingId) return;
        const ring = rings.find(r => r.id === draggingId);

        try { cvs.releasePointerCapture(e.pointerId); } catch (_) {}

        if (!ring || ring.collected) {
          draggingId = null;
          return;
        }

        const p = getPointerPos(e);
        ring.dragging = false;
        draggingId = null;

        if (isOverRod(p.x, p.y, 0)) {
          tryCollectRing(ring);
        }
      }

      cvs.addEventListener('pointerup', endDrag);
      cvs.addEventListener('pointercancel', endDrag);

      document.addEventListener('keydown', (e) => {
        if (e.code === 'ShiftLeft') leftShiftDown = true;
        if (e.key === 'Escape') document.location.href = 'index.html';

        // R/G/B
        // LEFT
        const step = leftShiftDown ? -10 : 10;
        if (e.code === 'KeyR') adjustSelectedChannel('r', step);
        if (e.code === 'KeyG') adjustSelectedChannel('g', step);
        if (e.code === 'KeyB') adjustSelectedChannel('b', step);
      });

      document.addEventListener('keyup', (e) => {
        if (e.code === 'ShiftLeft') leftShiftDown = false;
      });

    } else {
      // В режиме «Две Башни» отключаем контекстное меню по ПКМ на canvas,
      // иначе правый клик будет мешать сбору колец.
      if (mode === 'two') {
        cvs.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      cvs.addEventListener('pointerdown', (e) => {
        if (locked || completion) return;

        const p = getPointerPos(e);
        const ring = findTopRingAt(p.x, p.y);
        if (!ring) return;

        const btn = (e.button == null ? 0 : e.button); // 0=ЛКМ, 2=ПКМ
        const isMouse = (e.pointerType === 'mouse');

        if (mode === 'two' && isMouse) {
          // Левая башня (tower=0) собирается ЛКМ, правая (tower=1) — ПКМ.
          if ((ring.tower === 0 && btn !== 0) || (ring.tower === 1 && btn !== 2)) return;
          if (btn === 2) e.preventDefault();
        } else {
          // Обычные режимы: только ЛКМ/тап
          if (btn !== 0) return;
        }

        tryCollectRing(ring);
      }, { passive: false });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.location.href = 'index.html';
      });
    }
  }

  // Public API: runLevel
  window.runLevel = function(settings, meta) {
    // На всякий случай резолвим режим ещё раз на старте уровня (после полной загрузки страницы)
    // Это устраняет случаи, когда mode по какой-то причине не подхватился при инициализации файла.
    mode = resolveMode();

    // В режиме перетаскивания даём +2 минуты ко времени уровня
    const adjustedSettings = Object.assign({}, settings);
    if (mode === 'drag') {
      adjustedSettings.timeLimit = (parseInt(settings.timeLimit, 10) || 0) + 120000;
    }

    window.LEVEL_SETTINGS = adjustedSettings;
    window.LEVEL_META = meta;

    // (чтобы не мигало значение из HTML)
    if (timerElement) timerElement.textContent = formatMs(adjustedSettings.timeLimit);

    // Короткая подсказка, чтобы было видно что режим корректно определился (и бонус времени применился)
    if (mode === 'drag') {
      overlayText = 'Перетаскивание: +2:00';
      setTimeout(() => {
        if (overlayText === 'Перетаскивание: +2:00') overlayText = null;
      }, 700);
    }

    hudBase = null;
    updateHudScale(true);

    setCanvasSize();
    initRings();
    setupInput();

    //L O L
    document.addEventListener('keydown', handleCheatKeydown);

    startTimer();
    gameLoop();

    document.addEventListener('themeChanged', () => {
      hudBase = null;
      updateHudScale(true);
      setCanvasSize();
      updateCollectedDisplay();
    });
  };
})();
