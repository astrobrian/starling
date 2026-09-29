
const skyBandEdge = (i, x, W, H) => (i <= 0 ? 0 : i >= 4 ? H : Math.round(((i / 4) ** 0.8) * H + (((x / W) * 2 - 1) ** 2) * H * 0.07));
function skyBandAt(x, y, W, H) { let i = 0; while (i < 3 && y >= skyBandEdge(i + 1, x, W, H)) i++; return i; }
function drawSkyBands(g, W, H, colors) {
  for (let x = 0; x < W; x++) for (let i = 0; i < 4; i++) {
    g.fillStyle = colors[i];
    g.fillRect(x, skyBandEdge(i, x, W, H), 1, skyBandEdge(i + 1, x, W, H) - skyBandEdge(i, x, W, H));
  }
}
const nightBands = () => [PALETTE.nightIndigo, PALETTE.night1, PALETTE.night2, PALETTE.night3];
const nightBandsLighter = () => [PALETTE.night1, PALETTE.night2, PALETTE.night3, mix(PALETTE.night3, PALETTE.starFaint, 0.5)];

function nightBird(src) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  Daylight.apply(g, 0, 0, c.width, c.height, false, "night");
  g.globalCompositeOperation = "destination-in";
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-over";
  const orig = src.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const snow = RAMPS.snow.map((h) => h.toLowerCase()), ink = RAMPS.ink.map((h) => h.toLowerCase()), cream = PALETTE.cream.toLowerCase();
  const moon = [PALETTE.starBand, PALETTE.starFaint, PALETTE.night3, PALETTE.night2];
  for (let i = 0; i < d.length; i += 4) {
    if (!orig[i + 3]) continue;
    const hex = rgbToHex([orig[i], orig[i + 1], orig[i + 2]]).toLowerCase();
    const band = snow.indexOf(hex), k = ink.indexOf(hex);
    const to = band >= 0 ? RAMPS.starBright[band] : k >= 0 ? moon[k] : hex === cream ? PALETTE.cream : null;
    if (to) { const [r, gg, b] = hexToRgb(to); d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function moonlit(c, side = null, rimColor = PALETTE.starBand, opts = {}) {
  const g = c.getContext("2d"), img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 0;
  const dx = side === "right" ? 1 : side === "left" ? -1 : 0;
  const rim = hexToRgb(rimColor), lit = [];
  const maxY = opts.maxY !== undefined ? opts.maxY : c.height * 0.6;
  for (let y = 0; y < maxY; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (!solid(x, y) || d[i] + d[i + 1] + d[i + 2] > 330) continue;          // only the dark feathers
    if (opts.upLeft && !solid(x, y - 1)) continue;                            // (never the outline itself)
    const top = solid(x, y - 1) && !solid(x, y - 2) && (!opts.upLeft || !solid(x - 1, y - 2));
    const beside = dx && solid(x + dx, y) && !solid(x + 2 * dx, y);
    if (top || beside) lit.push(i);
  }
  const on = new Set(lit), keep = opts.upLeft ? lit.filter((i) => [-4, 4, -4 * c.width, 4 * c.width, -4 * c.width - 4, -4 * c.width + 4, 4 * c.width - 4, 4 * c.width + 4].some((o) => on.has(i + o))) : lit;
  for (const i of keep) { d[i] = rim[0]; d[i + 1] = rim[1]; d[i + 2] = rim[2]; }
  g.putImageData(img, 0, 0);
  return c;
}

function fillWhat(el, stars, friends, most = 6, faceSize = 40) {
  el.innerHTML = "";
  const dpr = window.devicePixelRatio || 1;
  const star = iconFromGrid(ICONS.star).toCanvas(), k = Math.max(1, Math.round((26 * dpr) / star.width));
  star.style.width = (star.width * k) / dpr + "px";
  const n = document.createElement("span");
  n.textContent = stars;
  el.append(star, n);
  for (const f of (friends || []).slice(0, most)) {
    const face = renderPortrait(f, "happy");
    if (!face) continue;
    const c = document.createElement("canvas");
    c.width = face.width; c.height = face.height;
    c.getContext("2d").drawImage(face, 0, 0);
    c.style.width = (face.width * Math.max(1, Math.round((faceSize * dpr) / face.width))) / dpr + "px";
    el.append(c);
  }
}

function makeTitleScene(W, H, opts = {}) {
  const morning = !!opts.morning;
  const riverY = (x) => H * 0.78 - x * (H * 0.72 / W);

  const bandColors = morning ? [PALETTE.daySky0, PALETTE.daySky1, PALETTE.daySky2, PALETTE.daySky3] : nightBands();
  const bandAt = (x, y) => skyBandAt(x, y, W, H);
  const lighter = nightBandsLighter();
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = W; skyCanvas.height = H;
  {
    const g = skyCanvas.getContext("2d");
    drawSkyBands(g, W, H, bandColors);
    for (let x = 0; x < W; x++) {
      if (morning) continue;
      const c = riverY(x), w = H * 0.075 + Math.sin(x / 23) * 2 + (fractalNoise(x / 30, 0.7, 41) - 0.5) * 6;
      const rift = c + 1 + Math.round(Math.sin(x / 37) * 3);
      for (let y = Math.max(0, Math.round(c - w)); y <= Math.min(H * 0.86, c + w); y++) {
        const i = bandAt(x, y);
        g.fillStyle = y === rift || y === rift + 1 ? bandColors[i] : lighter[i];
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  const faint = [];
  const n = Math.round(W * H / 380);
  for (let i = 0; i < n; i++) faint.push({ x: Math.floor(hash2(i, 1, 301) * W), y: Math.floor(hash2(i, 2, 302) * H * 0.85), rate: 0.5 + hash2(i, 3, 303), phase: hash2(i, 4, 304) * 6.28 });
  const river = [];
  const m = Math.round(W * H / 80);
  for (let i = 0; i < m; i++) {
    const x = hash2(i, 5, 305) * W;
    const core = i % 3 === 0;                                // a third of them crowd the middle of the river
    const across = (hash2(i, 6, 306) + hash2(i, 7, 307) + hash2(i, 8, 308) - 1.5) * H * (core ? 0.07 : 0.2);
    const y = Math.round(riverY(x) + across);
    if (y < 0 || y > H * 0.86) continue;
    const k = hash2(i, 9, 309);
    river.push({ x: Math.floor(x), y, color: Math.abs(across) < H * 0.05 && k < 0.5 ? PALETTE.starBright : k < 0.55 ? PALETTE.starBand : PALETTE.starFaint });
  }

  function nightOf(src) {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    if (morning) {
      g.globalCompositeOperation = "multiply"; g.fillStyle = "#FFF0D6"; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = "screen"; g.globalAlpha = 0.12; g.fillStyle = "#FFD68A"; g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
    } else Daylight.apply(g, 0, 0, c.width, c.height, false, "night");
    g.globalCompositeOperation = "destination-in";
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-over";
    return c;
  }

  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  const g = base.getContext("2d");
  const ground = H - 13;
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, ground, W, H - ground);
  for (let i = 0; i < W / 3; i++) {                        // tufts of grass
    const x = Math.floor(hash2(i, 1, 311) * W), y = ground + 2 + Math.floor(hash2(i, 2, 312) * (H - ground - 3));
    g.fillStyle = RAMPS.grass[hash2(i, 3, 313) < 0.5 ? 2 : 0];
    g.fillRect(x, y, 1, 2);
    g.fillRect(x + 1, y - 1, 1, 2);
  }
  const house = prop("house", typeof houseVariant === "function" ? houseVariant() : 0);
  const fx = Math.round(W - Math.min(78, W * 0.2)), fy = H - 3;
  const hx = fx - house.ax, hy = fy - house.ay;
  g.fillStyle = RAMPS.path[1];
  g.fillRect(fx - 7, fy - 1, 14, H - fy + 1);
  const [bx0, by0, bx1, by1] = house.base;                 // its shadow, along the bottom and right of the base
  g.fillStyle = RAMPS.grass[2];
  g.fillRect(hx + bx0 + 1, hy + by1 + 1, bx1 - bx0 + 2, 2);
  g.fillRect(hx + bx1 + 1, hy + by0 + 2, 2, by1 - by0 + 1);
  g.drawImage(house.canvas, hx, hy);
  const lights = (house.lights || []).map(([x, y, w, h, r]) => ({ x: hx + x + w / 2, y: hy + y + h / 2, r: r || 14 }));

  const woods = document.createElement("canvas");
  woods.width = W; woods.height = H;
  const l = woods.getContext("2d");
  const woodColors = morning ? [RAMPS.leaf[2], RAMPS.leaf[3]] : [PALETTE.night3, PALETTE.nightTrees];
  for (const [row, color, lift, seed] of [[0, woodColors[0], 9, 321], [1, woodColors[1], 0, 322]]) {
    l.fillStyle = color;
    for (let x0 = -6, i = 0; x0 < W; i++) {
      const tw = 10 + Math.floor(hash2(i, 1, seed) * 12), top = 8 + hash2(i, 2, seed) * (row ? 11 : 9);
      for (let x = x0; x < x0 + tw; x++) {
        const within = (x - x0 + 0.5) / tw;
        const hgt = top * Math.sqrt(Math.max(0, 1 - (within * 2 - 1) ** 2)) + 4 + lift;
        l.fillRect(x, Math.round(ground - hgt), 1, Math.ceil(hgt) + 1);
      }
      x0 += tw - 2;
    }
  }
  const land = document.createElement("canvas");
  land.width = W; land.height = H;
  land.getContext("2d").drawImage(morning ? nightOf(woods) : woods, 0, 0);
  land.getContext("2d").drawImage(nightOf(base), 0, 0);

  const ridgeTop = (c, x) => {
    const d = c.getContext("2d").getImageData(x, 0, 1, c.height).data;
    for (let y = 0; y < c.height; y++) if (d[y * 4 + 3] > 0) return y;
    return 0;
  };
  const pose = (blink) => {
    const s = renderBird(BIRDS.magpie, "stand", blink);
    return { canvas: moonlit(nightBird(flipCanvas(s.canvas)), "right"), footX: s.canvas.width - s.footX, footY: s.footY };
  };
  const rx = Math.round(house.canvas.width * 0.36);
  const bird = { open: pose(false), shut: pose(true), x: hx + rx, y: hy + ridgeTop(house.canvas, rx) + 1 };

  const heart = iconFromGrid(ICONS.heart).toCanvas();

  const flies = [];
  const fxMax = opts.fireflyMaxX || W * 0.62 + 20;        // (opts.fireflyMaxX keeps them to the left)
  for (let i = 0; i < 7; i++) flies.push({ x: 20 + hash2(i, 1, 331) * (fxMax - 20), y: ground - 4 - hash2(i, 2, 332) * 16, phase: hash2(i, 3, 333) * 6.28, speed: 0.5 + hash2(i, 4, 334) * 0.6 });

  function bigStar(ctx, x, y, time, phase, bright = false) {
    const tw = 0.75 + 0.25 * Math.sin(time * 1.3 + phase), arm = bright ? 3 : 2;
    Daylight.drawLight(ctx, x, y, bright ? 11 : 6, "starBright", bright ? tw + 0.25 : tw * 0.85);
    ctx.fillStyle = bright ? PALETTE.starBright : PALETTE.starlight;
    ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
    ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
    if (bright) { ctx.fillRect(x - 1, y - 1, 3, 3); }
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(x, y, 1, 1);
  }

  const night = typeof Moon !== "undefined" ? Moon.forDay(opts.day === undefined ? 1 : opts.day) : null;
  function moon(ctx, cx, cy) {
    if (night) { if (night.up) Moon.draw(ctx, cx, cy, 8, night); return; }
    const r = 8;
    Daylight.drawLight(ctx, cx + 3, cy, 16, "starBright", 0.5);
    for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
      const dx = x + 0.5, dy = y + 0.5;
      if (dx * dx + dy * dy > r * r) continue;
      ctx.fillStyle = dx < 0 ? PALETTE.night3 : dx > r * 0.55 && dy < 0 ? PALETTE.cream : dx < 1.5 ? RAMPS.starlight[2] : PALETTE.starlight;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
    ctx.fillStyle = RAMPS.starlight[2];                     // a few soft craters
    for (const [x, y] of [[3, -3], [5, 2], [2, 4]]) ctx.fillRect(cx + x, cy + y, 1, 1);
  }

  function draw(ctx, time, shooting = null, hopAt = -9) {
    ctx.drawImage(skyCanvas, 0, 0);
    if (morning) { drawMorning(ctx, time); return; }
    for (const s of river) { ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, 1, 1); }
    for (const s of faint) {
      ctx.fillStyle = Math.sin(time * s.rate + s.phase) > 0.75 ? PALETTE.starBright : PALETTE.starFaint;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    const vx = Math.round(W * 0.84), ax = Math.round(W * 0.56);
    bigStar(ctx, vx, Math.round(riverY(vx) + H * 0.075), time, 0, true);
    bigStar(ctx, ax, Math.round(riverY(ax) - H * 0.1), time, 2);
    moon(ctx, Math.round(opts.moonX ? W * opts.moonX : W - Math.min(44, W * 0.1)), Math.round(H * 0.17));
    if (shooting) {
      const k = (time - shooting.at) / 0.9;
      if (k >= 0 && k < 1) {
        const x = shooting.x + shooting.dx * k, y = shooting.y + shooting.dy * k;
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = i < 2 ? PALETTE.cream : i < 5 ? PALETTE.starBright : PALETTE.starBand;
          ctx.fillRect(Math.round(x - shooting.dx * 0.03 * i), Math.round(y - shooting.dy * 0.03 * i), 1, 1);
        }
      }
    }
    ctx.drawImage(land, 0, 0);
    ctx.drawImage(house.glow, hx, hy);
    for (const lt of lights) Daylight.drawLight(ctx, lt.x, lt.y, lt.r, "butter", 0.8);
    if (opts.magpie !== false) {
      const b = (time % 4.3) < 0.14 ? bird.shut : bird.open;
      const k = (time - hopAt) / 0.45, lift = k >= 0 && k < 1 ? Math.round(Math.sin(k * Math.PI) * 5) : 0;
      ctx.drawImage(b.canvas, bird.x - b.footX, bird.y - b.footY - lift);
      const h = (time - hopAt) / 1.1;
      if (h >= 0 && h < 1) ctx.drawImage(heart, bird.x - Math.floor(heart.width / 2), Math.round(bird.y - 22 - h * 8));
    }
    for (const f of flies) {
      const glow = (Math.sin(time * 1.4 * f.speed + f.phase) + 1) / 2;
      if (glow < 0.2) continue;
      Fireflies.drawOne(ctx, f.x + Math.sin(time * 0.5 * f.speed + f.phase) * 10, f.y + Math.sin(time * 0.37 * f.speed + f.phase * 2) * 4, glow);
    }
  }

  function drawMorning(ctx, time) {
    const sx = Math.round(W * 0.16), sy = Math.round(H - 34 - Math.min(10, time * 4));
    Daylight.drawLight(ctx, sx, sy, 24, "butter", 1.1);
    ctx.fillStyle = PALETTE.butter;
    for (let y = -8; y < 8; y++) for (let x = -8; x < 8; x++) if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= 64) ctx.fillRect(sx + x, sy + y, 1, 1);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(sx - 4, sy - 5, 3, 2);
    ctx.drawImage(land, 0, 0);
    const [cx, cy] = house.smoke || [67, 2];
    for (let i = 0; i < 3; i++) {
      const age = (time + i * 1.1) % 3.3;
      const d = Math.round(age < 2.4 ? 2 + age * 2.3 : 2 + 2.4 * 2.3 - (age - 2.4) * 10);
      if (d >= 2 && typeof puff === "function") puff(ctx, Math.round(hx + cx + age * 7 - d / 2), Math.round(hy + cy - age * 4 - d / 2), d);
    }
  }

  return { draw, house: { x: hx, y: hy, canvas: house.canvas }, ground, magpie: { x: bird.x, y: bird.y - 8 } };
}

const Title = !document.getElementById("title-sky") ? null : (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $("title-sky"), ctx = canvas.getContext("2d");
  const SKY_H = 200;                      // about this many game pixels tall, whatever the screen
  let scene = null, W = 0, H = 0, open = false, clock = 0, last = 0;
  let shooting = null, nextShooting = 2.5, hopAt = -9;
  let callbacks = {}, unlocked = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
    const scale = Math.max(1, Math.round(vh / SKY_H));
    W = Math.ceil(vw / scale);
    H = Math.ceil(vh / scale);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = (W * scale) / dpr + "px";
    canvas.style.height = (H * scale) / dpr + "px";
    ctx.imageSmoothingEnabled = false;
    scene = makeTitleScene(W, H, { day: callbacks.day ? callbacks.day() : 1 });      // (the moon of her day)
  }

  const CARDS = ["confirm", "settings", "credits", "backup-card", "backup-offer", "diary", "fullscreen-card"];
  function loop(now) {
    if (!open) return;
    clock += Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (clock > nextShooting) {
      const i = Math.floor(clock);
      shooting = { at: clock, x: W * (0.15 + hash2(i, 1, 351) * 0.5), y: H * (0.05 + hash2(i, 2, 352) * 0.2), dx: W * 0.16, dy: H * 0.1 };
      nextShooting = clock + 6 + hash2(i, 3, 353) * 6;
    }
    scene.draw(ctx, clock, shooting, hopAt);
    $("title").classList.toggle("under-card", CARDS.some((id) => { const e = $(id); return !!e && !e.classList.contains("hidden"); }));
    requestAnimationFrame(loop);
  }

  const fill = (el, text) => { el.textContent = text; };

  function unlock(startsGame) {
    if (unlocked) return;
    unlocked = true;
    callbacks.onUnlock();
    if (!startsGame) callbacks.onTitleMusic();
  }

  function refresh() {
    const has = callbacks.hasProgress();
    const cont = $("title-continue"), fresh = $("title-new");
    fill(cont, UI_TEXT.continueDay.replace("{day}", callbacks.day()));
    cont.classList.toggle("hidden", !has);
    fresh.classList.toggle("title-big", !has);
    $("title-story").classList.toggle("hidden", !callbacks.onStory || !has);     // (a new game plays the story anyway)
    $("title-story").classList.toggle("new", !!(callbacks.storyNew && callbacks.storyNew()));   // a twinkle until she has seen it
    if (has) $("title-row").append(fresh);                 // (at the end of the row, away from her thumb)
    else cont.after(fresh);
  }

  function setup(cb) {
    callbacks = cb;
    fill($("title-name"), UI_TEXT.title);
    const cont = $("title-continue"), fresh = $("title-new");
    fill(fresh, UI_TEXT.newGame);
    fill($("title-story"), UI_TEXT.story);
    $("title-story").classList.toggle("hidden", !cb.onStory);
    fill($("title-settings"), UI_TEXT.settings);
    fill($("title-credits"), UI_TEXT.credits);

    cont.addEventListener("click", () => { unlock(true); close(); cb.onContinue(); });
    fresh.addEventListener("click", () => {
      if (!cb.hasProgress()) { unlock(true); close(); cb.onNewGame(); return; }
      unlock(false);
      ask(UI_TEXT.newGameAsk, UI_TEXT.newGameYes, false, () => ask(UI_TEXT.newGameSure, UI_TEXT.newGameSureYes, true, () => { close(); cb.onNewGame(); }));
    });
    $("title-story").addEventListener("click", () => { unlock(true); if (cb.onStory) cb.onStory(); });
    $("title-settings").addEventListener("click", () => { unlock(false); cb.onSettings(); });
    $("title-credits").addEventListener("click", () => { unlock(false); $("credits").classList.remove("hidden"); });
    $("title").addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      unlock(false);
      const r = canvas.getBoundingClientRect(), m = scene.magpie;
      const gx = ((e.clientX - r.left) / r.width) * W, gy = ((e.clientY - r.top) / r.height) * H;
      const reach = (24 / r.height) * H;                    // 24 points, in the picture's pixels
      if (Math.hypot(gx - m.x, gy - m.y) <= reach && clock - hopAt > 0.5) {
        hopAt = clock;
        for (let i = 0; i < 3; i++) setTimeout(() => Sound.chirp("chatter", 1500, i), i * 140);
      }
    });
    window.addEventListener("keydown", (e) => {
      if (!open || e.key !== "Enter" || !$("confirm").classList.contains("hidden") || !$("credits").classList.contains("hidden")) return;
      (cb.hasProgress() ? cont : fresh).click();
    });

    const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const homeScreen = navigator.standalone === true || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
    const withKorean = (el, en, ko) => { el.textContent = en; const k = document.createElement("small"); k.className = "korean"; k.textContent = ko; el.appendChild(k); };
    fill($("title-fullscreen"), UI_TEXT.fullScreen);
    $("title-fullscreen").classList.toggle("hidden", !(apple && !homeScreen) && !PARAMS.has("fullscreenTip"));
    withKorean($("fullscreen-title"), UI_TEXT.fullScreen, UI_TEXT.fullScreenKorean);
    for (const [en, ko] of UI_TEXT.fullScreenSteps) { const li = document.createElement("li"); withKorean(li, en, ko); $("fullscreen-steps").appendChild(li); }
    withKorean($("fullscreen-note"), UI_TEXT.fullScreenNote[0], UI_TEXT.fullScreenNote[1]);
    fill($("fullscreen-done"), UI_TEXT.done);
    $("title-fullscreen").addEventListener("click", () => { unlock(false); $("fullscreen-card").classList.remove("hidden"); });
    $("fullscreen-done").addEventListener("click", () => $("fullscreen-card").classList.add("hidden"));
    $("fullscreen-card").addEventListener("pointerdown", (e) => { if (e.target === $("fullscreen-card")) $("fullscreen-card").classList.add("hidden"); });

    fill($("credits-title"), UI_TEXT.credits);
    const d = window.DEDICATION || {};
    fill($("credits-made"), d.by && d.for ? UI_TEXT.madeByFor.replace("{by}", d.by).replace("{for}", d.for) : UI_TEXT.madeWithLove);
    fill($("credits-thanks"), UI_TEXT.thanks);
    fill($("credits-music"), UI_TEXT.credit);
    fill($("credits-done"), UI_TEXT.done);
    $("credits-done").addEventListener("click", () => $("credits").classList.add("hidden"));
    $("credits").addEventListener("pointerdown", (e) => { if (e.target === $("credits")) $("credits").classList.add("hidden"); });

    fill($("confirm-no"), UI_TEXT.no);
    $("confirm-no").addEventListener("click", () => $("confirm").classList.add("hidden"));
    $("confirm-yes").addEventListener("click", () => {
      $("confirm").classList.add("hidden");
      const f = onYes; onYes = null;
      if (f) setTimeout(f, 120);             // the next card comes up after this one closes
    });

    fill($("menu-resume"), UI_TEXT.resume);
    fill($("menu-settings"), UI_TEXT.settings);
    fill($("menu-title"), UI_TEXT.titleScreen);
    $("menu-resume").addEventListener("click", () => $("menu").classList.add("hidden"));
    if ($("menu-diary")) {
      fill($("menu-diary"), UI_TEXT.diary);
      $("menu-diary").addEventListener("click", () => { $("menu").classList.add("hidden"); if (window.Diary) Diary.open(); });
    }
    $("menu-settings").addEventListener("click", () => { $("menu").classList.add("hidden"); cb.onSettings(); });
    $("menu-title").addEventListener("click", () => { $("menu").classList.add("hidden"); cb.onBackToTitle(); });
    $("menu").addEventListener("pointerdown", (e) => { if (e.target === $("menu")) $("menu").classList.add("hidden"); });

    window.addEventListener("resize", () => open && resize());
    show();
  }

  let onYes = null;
  function ask(text, yes, showWhat, then, korean) {
    fill($("confirm-text"), text);
    if (korean) { const k = document.createElement("small"); k.className = "korean"; k.textContent = korean; $("confirm-text").appendChild(k); }
    fill($("confirm-yes"), yes);
    const what = $("confirm-what");
    what.innerHTML = "";
    what.classList.toggle("rows", typeof showWhat === "function");
    if (typeof showWhat === "function") showWhat(what);
    else if (showWhat) { const { stars, friends } = callbacks.summary(); fillWhat(what, stars, friends); }
    onYes = then;
    $("confirm").classList.remove("hidden");
  }

  function show() {
    open = true;
    refresh();
    $("title").classList.remove("hidden");
    document.body.classList.add("on-title");
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function close() {
    open = false;
    $("title").classList.add("hidden");
    document.body.classList.remove("on-title");
  }

  return {
    setup,
    hide: close,
    reopen: show,
    isOpen: () => open,
    showMenu: () => $("menu").classList.remove("hidden"),
    ask,
    bigButton: () => {
      if (!open) return null;
      const b = $("title-continue").classList.contains("hidden") ? $("title-new") : $("title-continue");
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    },
  };
})();
