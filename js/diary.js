
const DIARY_PICTURE = { w: 112, h: 84 };

function diaryLunarDate(day) {
  try {
    if (typeof Moon !== "undefined" && Moon.lunarDate) {
      const d = Moon.lunarDate(day);
      if (d && d.month && d.day) return { month: d.month, day: d.day };
    }
  } catch (e) { /* (the count below) */ }
  return day <= 23 ? { month: 6, day: day + 6 } : { month: 7, day: day - 23 };
}

function diaryMoon(day, r = 5) {
  try {
    if (typeof Moon !== "undefined" && Moon.sprite && Moon.forDay) {
      const s = Moon.sprite(r, Moon.forDay(day));
      const c = s && (s.getContext ? s : s.canvas);
      if (c) return c;
    }
  } catch (e) { /* (the plain disc below) */ }
  const c = document.createElement("canvas");
  c.width = c.height = r * 2 + 1;
  const g = c.getContext("2d");
  const phase = ((diaryLunarDate(day).day - 1) / 29.53) * Math.PI * 2;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const dx = x, dy = y;
    if (dx * dx + dy * dy > r * r + r * 0.8) continue;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy)), edge = half * Math.cos(phase);
    const lit = phase < Math.PI ? dx > edge - 0.5 : dx < -edge + 0.5;
    g.fillStyle = !lit ? PALETTE.night3 : dx * dx + dy * dy > (r - 1.5) ** 2 && dy < 0 ? PALETTE.cream : PALETTE.starlight;
    g.fillRect(x + r, y + r, 1, 1);
  }
  return c;
}

function makeDiaryPictures(W = DIARY_PICTURE.w, H = DIARY_PICTURE.h) {
  const make = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const HZ = Math.round(H * 0.4);                   // where the meadow meets the sky

  function sunsetLit(src) {
    const c = make(src.width, src.height), g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "multiply"; g.fillStyle = "#FFD9C4"; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "screen"; g.globalAlpha = 0.16; g.fillStyle = "#FF8FA0"; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "destination-in"; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-over";
    return c;
  }

  function blob(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g.fillRect(x, y, 1, 1);
    }
  }
  const shadow = (g, x, y, rx, ry = 1.6) => blob(g, x + 1, y + 0.5, rx, ry, RAMPS.grass[2]);

  function backdrop(kind) {
    const bands = {
      day: [PALETTE.daySky0, PALETTE.daySky1, PALETTE.daySky2, PALETTE.daySky3],
      hot: [PALETTE.daySky1, PALETTE.daySky2, PALETTE.daySky3, mix(PALETTE.daySky3, PALETTE.butter, 0.55)],
      dusk: [PALETTE.duskLavender, mix(PALETTE.duskLavender, PALETTE.petalPink, 0.55), PALETTE.duskGlass, PALETTE.duskGlass2],
    }[kind];
    const sky = make(W, HZ + 4);
    drawSkyBands(sky.getContext("2d"), W, HZ + 4, bands);
    const land = make(W, H), l = land.getContext("2d");
    for (const [color, lift, seed] of [[mix(RAMPS.leaf[0], PALETTE.daySky3, 0.45), 5, 611], [mix(RAMPS.leaf[1], PALETTE.daySky3, 0.12), 0, 612]]) {
      l.fillStyle = color;
      for (let x0 = -6, i = 0; x0 < W; i++) {
        const tw = 9 + Math.floor(hash2(i, 1, seed) * 10), top = 4 + hash2(i, 2, seed) * 6;
        for (let x = x0; x < x0 + tw; x++) {
          const k = (x - x0 + 0.5) / tw;
          const h = top * Math.sqrt(Math.max(0, 1 - (k * 2 - 1) ** 2)) + 2 + lift;
          l.fillRect(x, Math.round(HZ - h), 1, Math.ceil(h) + 1);
        }
        x0 += tw - 2;
      }
    }
    l.fillStyle = PALETTE.grass;
    l.fillRect(0, HZ, W, H - HZ);
    l.fillStyle = RAMPS.grass[2];
    l.fillRect(0, HZ, W, 1);                                     // (the woods' shade along their foot)
    for (let i = 0; i < (W * (H - HZ)) / 22; i++) {
      const x = Math.floor(hash2(i, 1, 621) * W), k = Math.sqrt(hash2(i, 2, 622));
      const y = HZ + 3 + Math.floor(k * (H - HZ - 3));
      l.fillStyle = RAMPS.grass[hash2(i, 3, 623) < 0.6 ? 2 : 0];
      if (k < 0.35) { l.fillRect(x, y, 1, 1); continue; }         // far off: just a blade
      l.fillRect(x, y, 1, 2);
      l.fillRect(x + 1, y - 1, 1, 2);
      if (hash2(i, 4, 624) < 0.5) l.fillRect(x - 1, y, 1, 1);
    }
    return { sky, land: kind === "dusk" ? sunsetLit(land) : land };
  }
  const backdrops = {};
  function back(g, kind, between = null) {
    const b = backdrops[kind] || (backdrops[kind] = backdrop(kind));
    g.drawImage(b.sky, 0, 0);
    if (between) between();
    g.drawImage(b.land, 0, 0);
  }

  function sun(g, t, hot = false) {
    const x = 10, y = 9, r = hot ? 7 : 6;
    Daylight.drawLight(g, x, y, Math.round(r + 11 + Math.sin(t * 1.5)), "butter", hot ? 1 : 0.8);
    g.fillStyle = hot ? mix(PALETTE.persimmon, PALETTE.beeYellow, 0.35) : PALETTE.beeYellow;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const from = dx && dy ? Math.round(r * 0.72) + 2 : r + 2, len = hot ? 3 : 2;
      for (let s = from; s < from + len; s++) g.fillRect(x + dx * s, y + dy * s, 1, 1);
    }
    blob(g, x + 0.5, y + 0.5, r, r, hot ? mix(PALETTE.butter, PALETTE.persimmon, 0.5) : PALETTE.butter);
    blob(g, x - 0.5, y - 0.5, r - 1.5, r - 1.5, hot ? PALETTE.butter : mix(PALETTE.butter, PALETTE.cream, 0.5));
    g.fillStyle = PALETTE.cream;
    g.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.55), 2, 2);
  }

  const flips = new Map();
  function birdSprite(bird, pose, left = false, blink = false) {
    const s = renderBird(bird, pose, blink);
    if (!left) return { canvas: s.canvas, footX: s.footX, footY: s.footY, headX: s.headX, headY: s.headY };
    if (!flips.has(s)) flips.set(s, flipCanvas(s.canvas));
    const w = s.canvas.width;
    return { canvas: flips.get(s), footX: w - s.footX, footY: s.footY, headX: w - s.headX, headY: s.headY };
  }
  function drawBird(g, bird, pose, x, y, left = false, blink = false) {
    const s = birdSprite(bird, pose, left, blink);
    g.drawImage(s.canvas, Math.round(x - s.footX), Math.round(y - s.footY));
    return s;
  }
  let herFrames = null;
  function drawHer(g, x, feetY, facing, doll, blink = false) {
    herFrames = herFrames || renderPlayer();
    const top = Math.round(feetY - 32);
    const frame = blink && herFrames.blink[facing] ? herFrames.blink[facing] : herFrames[facing][0];
    shadow(g, x + 8, feetY - 1, 5.5);
    if (doll) Dolls.drawOnBack(g, doll, x, top, facing, true);
    g.drawImage(frame, x, top);
    if (doll) Dolls.drawOnBack(g, doll, x, top, facing, false);
  }
  const flower = (g, species, color, x, bottom, variant = 0, t = 0) => {
    const f = renderFlower(species, color, variant);
    const sway = Math.sin(t * 1.2 + x * 0.37 + variant);
    g.drawImage(f.frames[sway < -0.6 ? 0 : sway > 0.6 ? 2 : 1], Math.round(x - f.w / 2), Math.round(bottom - f.h));
  };
  const drawProp = (g, type, variant, x, y) => { const p = prop(type, variant); g.drawImage(p.canvas, Math.round(x - p.ax), Math.round(y - p.ay)); return p; };
  const icon = (() => { const cache = {}; return (name) => cache[name] || (cache[name] = iconFromGrid(ICONS[name]).toCanvas()); })();
  const drawIcon = (g, name, x, y) => { const c = icon(name); g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); };
  const twinkle = (g, x, y) => drawIcon(g, "sparkle", x, y);

  const star = (() => {
    const b = new PixelBuffer(15, 15), pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.1 : 7.2;
      pts.push([7.5 + Math.cos(a) * r, 7.9 + Math.sin(a) * r]);
    }
    b.polygon(pts, "starlight", { flat: true });
    for (const [x, y] of [[7, 6], [6, 7], [7, 7], [8, 7], [7, 8]]) b.set(x, y, "cream");
    return outline(b).toCanvas();
  })();

  const MAGPIE = BIRDS.magpie;
  const pollenBulbul = { ...BIRDS.bulbul, pollen: true };

  const firstPatch = ((window.FLOWER_PATCHES && FLOWER_PATCHES[0] && FLOWER_PATCHES[0].flowers) || [["daisy", "snow"], ["tulip", "petalPink"]])
    .filter(([sp]) => FLOWERS[sp] && FLOWERS[sp].size !== "tall");
  const kindOf = (i) => firstPatch[i % firstPatch.length];
  function d1(g, t, opts = {}) {
    back(g, "day", () => sun(g, t));
    const sx = 58, sy = 60;
    [[34, 56], [46, 53], [70, 53], [82, 57]].forEach(([x, y], i) => flower(g, ...kindOf(i), x, y, i, t));
    const pulse = (Math.sin(t * 2.4) + 1) / 2;
    Daylight.drawLight(g, sx, sy, 17 + Math.round(pulse * 3), "starlight", 1);
    Daylight.drawLight(g, sx, sy, 12 + Math.round(pulse * 2), "starlight", 1);
    Daylight.drawLight(g, sx, sy, 8, "cream", 0.5 + pulse * 0.5);
    g.drawImage(star, sx - 8, sy - 8 + Math.round(Math.sin(t * 2) * 0.6));
    shadow(g, 92, 73, 6);
    drawBird(g, MAGPIE, (t % 3.2) < 0.4 ? "bob" : "stand", 92, 73, true, (t % 4.1) < 0.14);
    drawHer(g, 8, 81, "right", opts.doll, (t % 3.7) < 0.14);
    [[40, 74], [77, 75], [59, 87]].forEach(([x, y], i) => flower(g, ...kindOf(i + 2), x, y, i + 5, t));
    const bump = (t % 2.4) / 2.4, reach = bump < 0.3 ? bump / 0.3 : bump < 0.4 ? 1 : Math.max(0, 1 - (bump - 0.4) / 0.5);
    const bx = sx - 20 + Math.round(reach * 8), by = sy - 5 + Math.round(Math.sin(t * 5) * 1.2);
    g.drawImage(smallBee(Math.floor(t * 16) % 2), bx - 4, by - 4);
    if (Math.sin(t * 3.1) > 0.55) twinkle(g, sx + 8, sy - 9);
    if (Math.sin(t * 2.3 + 2) > 0.7) twinkle(g, sx - 8, sy + 3);
  }

  function d2(g, t, opts = {}) {
    back(g, "day", () => sun(g, t));
    const ux = 38, uy = 73;                                                // the plum tree
    blob(g, ux + 3, uy - 0.5, 12, 2.4, RAMPS.grass[2]);
    drawProp(g, "plumTree", 0, ux, uy);
    const tx = 92, ty = 72;                                                // the persimmon tree
    blob(g, tx + 3, ty - 0.5, 12, 2.4, RAMPS.grass[2]);
    const tree = drawProp(g, "persimmonTree", 0, tx, ty);
    const px = tx - tree.ax + 39, py = ty - tree.ay + 32;
    Daylight.drawLight(g, px, py, 7 + Math.round(Math.sin(t * 2) * 1), "starlight", 1);
    Daylight.drawLight(g, px, py, 4, "starlight", 0.6);
    if (Math.sin(t * 2.6) > 0.6) twinkle(g, px + 5, py - 5);
    drawBird(g, MAGPIE, "stand", tx + 3, ty - 23, false, (t % 4.3) < 0.14);
    shadow(g, 50, 78, 5);
    const pecking = (t % 1.6) < 0.5 && Math.floor((t % 1.6) / 0.25) % 2 === 0;
    const st = birdSprite(BIRDS.bulbul, "stand");
    drawIcon(g, "plum", 50 - st.footX + st.canvas.width, 75);
    drawBird(g, BIRDS.bulbul, pecking ? "peck" : "stand", 50, 78);
    drawHer(g, 4, 83, "right", opts.doll, (t % 3.9) < 0.14);
  }

  const COLORS4 = [["tulip", "scarlet"], ["daisy", "butter"], ["rose", "petalPink"], ["tulip", "snow"],
    ["rose", "scarlet"], ["tulip", "butter"], ["daisy", "petalPink"], ["daisy", "snow"]];
  function d3(g, t) {
    back(g, "day", () => sun(g, t));
    [[12, 52], [28, 50], [84, 50], [100, 53], [20, 64], [92, 64]].forEach(([x, y], i) => flower(g, ...COLORS4[i % 8], x, y, i, t));
    shadow(g, 50, 74, 6);
    const hop = (t % 1.4) < 0.3 ? 1 : 0;
    const b = drawBird(g, pollenBulbul, "stand", 50, 74 - hop);
    shadow(g, 82, 76, 6);
    const laugh = Math.floor(t * 4) % 4 < 2 && (t % 3) < 1.6;
    drawBird(g, MAGPIE, laugh ? "bob" : "stand", 82, 76 - (laugh ? 1 : 0), true, laugh);
    g.fillStyle = PALETTE.butter;
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.35 + i / 5) % 1);
      const x = 50 - b.footX + b.headX + 4 + Math.round(Math.sin(k * 6 + i) * 3 + i - 2), y = 74 - b.footY + b.headY - Math.round(k * 12);
      if (k < 0.85) g.fillRect(x, y, 1, 1);
    }
    [[14, 80], [36, 78], [66, 81], [102, 79]].forEach(([x, y], i) => flower(g, ...COLORS4[(i + 4) % 8], x, y, i + 6, t));
    const bx = 30 + Math.round(Math.sin(t * 0.9) * 8), by = 40 + Math.round(Math.sin(t * 2.1) * 3);
    g.drawImage(smallBee(Math.floor(t * 16) % 2), bx - 4, by - 4);
  }

  let bathFront = null;
  function d4(g, t) {
    back(g, "hot", () => sun(g, t, true));
    const x = 50, y = 80;
    const bath = prop("birdBath", 0);
    const bx = x - bath.ax, by = y - bath.ay, water = by + 7;
    if (!bathFront) {
      bathFront = make(bath.canvas.width, bath.canvas.height);
      bathFront.getContext("2d").drawImage(bath.canvas, 0, 7, bath.canvas.width, bath.canvas.height - 7, 0, 7, bath.canvas.width, bath.canvas.height - 7);
    }
    shadow(g, x, y - 1, 9, 1.8);
    shadow(g, 16, 79, 6);
    drawProp(g, "wateringCan", 0, 16, 80);                        // (she filled the bath with it)
    [["tulip", "scarlet", 88, 80], ["daisy", "snow", 101, 77], ["rose", "petalPink", 106, 86], ["daisy", "butter", 30, 88]]
      .forEach(([sp, col, fx, fy], i) => flower(g, sp, col, fx, fy, i + 2, t));
    g.drawImage(bath.canvas, bx, by);
    const flutter = Math.floor(t * 5) % 2;
    g.save();
    g.beginPath(); g.rect(0, 0, W, water + 1); g.clip();
    drawBird(g, BIRDS.dove, flutter ? "bathe2" : "bathe", x - 8, water + 4);
    drawBird(g, BIRDS.dove, flutter ? "bathe" : "bathe2", x + 9, water + 4, true);
    g.restore();
    g.drawImage(bathFront, bx, by);
    const hop = Math.round(Math.abs(Math.sin(t * 2.2)) * 3);
    shadow(g, x + 24, y - 1, 5, 1.2);
    drawBird(g, MAGPIE, Math.floor(t * 9) % 2 ? "fly1" : "fly2", x + 21, water - 7 - hop, true);
    for (let i = 0; i < 9; i++) {
      const k = (t * 0.9 + i / 9) % 1, side = i % 2 ? 1 : -1;
      const dx = side * (4 + (i % 3) * 2 + k * 9), dy = -15 * k + 17 * k * k;
      const px = Math.round(x + dx), py = Math.round(water - 3 + dy - (i % 3));
      g.fillStyle = RAMPS.pond[1]; g.fillRect(px, py, 1, 2);
      g.fillStyle = PALETTE.cream; g.fillRect(px, py, 1, 1);
    }
  }

  const ROOST = { x: 50, y: 53, step: 8 };                     // the middle of their twig
  const dusk = (() => {
    const b = new PixelBuffer(W, H);
    trunk(b, 104, 0, H - 3, 12);
    b.line(99, 42, 88, 46, 2.4, "bark", { flat: false });
    clumpCanopy(b, 100, 6, 22, 13, "leaf", 81, { clump: 4.4 });
    clumpCanopy(b, 86, 44, 5, 4, "leaf", 83, { clump: 2.6, tips: 2 });
    clumpCanopy(b, ROOST.x, ROOST.y + 7, 31, 12, "leaf", 84, { clump: 4, tips: 5 });     // their bush
    const c = outline(b).toCanvas();
    const g = c.getContext("2d");
    for (const [type, v, x] of [["hedge", 1, 12], ["bush", 2, 34], ["hedge", 3, 70]]) {
      const p = prop(type, v);
      g.drawImage(p.canvas, x - p.ax + 1, H + 1 - p.ay);
    }
    return sunsetLit(c);
  })();
  const tucked = (() => {
    const L = roostLeaves(BIRDS.parrotbill, 5, ROOST.step), s = birdSprite(BIRDS.parrotbill, "roost", true);
    const c = make(L.back.width, L.back.height), g = c.getContext("2d");
    g.drawImage(L.back, 0, 0);
    for (let i = 0; i < 5; i++) g.drawImage(s.canvas, Math.round(L.ax + (i - 2) * ROOST.step - s.footX), L.ay - s.footY);
    g.drawImage(L.front, 0, 0);
    return { canvas: sunsetLit(c), ax: L.ax, ay: L.ay };
  })();
  function d5(g, t) {
    back(g, "dusk", () => {
      Daylight.drawLight(g, 26, HZ - 13, 20, "peach", 1);
      blob(g, 26.5, HZ - 12.5, 7, 7, mix(PALETTE.peach, PALETTE.butter, 0.45));
      blob(g, 25.5, HZ - 13.5, 5, 5, mix(PALETTE.butter, PALETTE.cream, 0.3));
    });
    if (Math.sin(t * 1.3) > -0.4) twinkle(g, 58, 7);
    g.drawImage(dusk, -1, -1);
    g.drawImage(tucked.canvas, ROOST.x - tucked.ax, ROOST.y - tucked.ay);
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.28 + i * 0.5) % 1;
      if (k > 0.8) continue;
      drawIcon(g, "zzz", 40 + i * 20 + Math.round(Math.sin(k * 5 + i) * 2), 34 - Math.round(k * 14));
    }
  }

  let night = null;
  function empty(g, t) {
    if (!night) {
      night = make(W, H);
      const n = night.getContext("2d");
      drawSkyBands(n, W, H, nightBands());
      for (let i = 0; i < 40; i++) { n.fillStyle = hash2(i, 3, 631) < 0.3 ? PALETTE.starBand : PALETTE.starFaint; n.fillRect(Math.floor(hash2(i, 1, 631) * W), Math.floor(hash2(i, 2, 631) * H), 1, 1); }
    }
    g.drawImage(night, 0, 0);
    const pulse = (Math.sin(t * 2) + 1) / 2;
    Daylight.drawLight(g, W / 2, H / 2, 14 + Math.round(pulse * 3), "starBright", 0.8);
    g.drawImage(star, Math.round(W / 2) - 8, Math.round(H / 2) - 8);
    if (pulse > 0.8) twinkle(g, W / 2 + 9, H / 2 - 8);
  }

  return { d1, d2, d3, d4, d5, empty };
}

const Diary = !document.getElementById("diary") ? null : (() => {
  const $ = (id) => document.getElementById(id);
  const root = $("diary"), page = $("diary-page"), canvas = $("diary-picture"), ctx = canvas.getContext("2d");
  const W = DIARY_PICTURE.w, H = DIARY_PICTURE.h;
  const BASE_FONT = 25, SMALLEST_FONT = 18;
  const WEATHER_ICON = { sunny: "sun", hot: "hot", cloudy: "cloudy", rainy: "rainy" };
  let open = false, mode = null, days = [], index = 0, done = null, pending = null;
  let pictures = null, clock = 0, last = 0, turning = false, ready = false, swipe = null;

  const entry = (day) => (window.DIARY && DIARY[day]) || null;
  const moonNote = (day) => {
    try { const m = typeof Moon !== "undefined" && Moon.forDay ? Moon.forDay(day) : null; return m && typeof m.note === "string" ? m.note : null; } catch (e) { return null; }
  };
  const dollOn = (day) => {
    const s = State.get();
    return (s.diaryDolls && s.diaryDolls[day]) || (s.dollDay === day ? s.doll : null) || null;
  };
  function keepDoll(day) {
    const s = State.get();
    if (s.dollDay === day && s.doll) State.keepDiaryDoll(day, s.doll);
  }

  function sizeCanvas(c, w, h, points) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.round((points * dpr) / h));
    c.style.width = (w * k) / dpr + "px";
    c.style.height = (h * k) / dpr + "px";
  }
  function paint(c, src, points) {
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    sizeCanvas(c, src.width, src.height, points);
  }

  function setUp() {
    if (ready) return;
    ready = true;
    canvas.width = W; canvas.height = H;
    $("diary-title").textContent = UI_TEXT.diaryTitle;
    $("diary-title-ko").textContent = UI_TEXT.diaryTitleKorean;
    for (const [id, grid, label] of [["diary-prev", ICONS.chevronLeft, UI_TEXT.diaryBack], ["diary-next", ICONS.chevronRight, UI_TEXT.diaryNext]]) {
      const b = $(id);
      b.setAttribute("aria-label", label);
      const c = document.createElement("canvas");
      paint(c, iconFromGrid(grid).toCanvas(), 22);
      b.appendChild(c);
      b.addEventListener("click", () => turn(id === "diary-next" ? 1 : -1));
    }
    $("diary-done").addEventListener("click", finish);
    root.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      swipe = mode === "read" ? { x: e.clientX, y: e.clientY } : null;
      if (e.target.closest(".word")) return;
      let best = null;
      for (const s of $("diary-text").querySelectorAll(".word[data-word]")) {
        if (!s.classList.contains("dim") && !Words.info(s.textContent)) continue;
        const r = s.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
        if (d <= 12 && (!best || d < best.d)) best = { s, d };
      }
      if (best) Speech.showHint(best.s.textContent, best.s, (entry(days[index]) || {}).korean || null);
    });
    root.addEventListener("pointerup", (e) => {
      const s = swipe;
      swipe = null;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
    });
    window.addEventListener("keydown", (e) => {
      if (!open) return;
      e.stopPropagation();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); if (mode === "read") turn(e.key === "ArrowRight" ? 1 : -1); }
      else if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); finish(); }
    }, true);
    window.addEventListener("keyup", (e) => { if (open) e.stopPropagation(); }, true);
    window.addEventListener("resize", () => { if (open) { layout(); fitText(); } });
  }

  function render() {
    const day = days[index], data = entry(day);
    root.classList.toggle("empty", !data);
    for (const id of ["diary-day", "diary-lunar", "diary-weather"]) $(id).classList.toggle("hidden", !data);
    const text = $("diary-text");
    text.innerHTML = "";
    text.style.fontSize = BASE_FONT + "px";
    if (data) {
      $("diary-day").textContent = UI_TEXT.diaryDay.replace("{day}", day);
      const lunar = diaryLunarDate(day);
      $("diary-lunar-text").textContent = UI_TEXT.lunarDate.replace("{month}", lunar.month).replace("{day}", lunar.day);
      paint($("diary-moon"), diaryMoon(day), 18);
      const weather = data.weather || "sunny";
      paint($("diary-weather-icon"), iconFromGrid(ICONS[WEATHER_ICON[weather]] || ICONS.sun).toCanvas(), 22);
      const word = $("diary-weather-word");
      word.innerHTML = "";
      words(word, (UI_TEXT.weather && UI_TEXT.weather[weather]) || weather, day, data.korean);
      let n = 0;
      for (const line of pageLines(day, data)) {
        const p = document.createElement("p");
        n = words(p, line, day, data.korean, n);
        text.appendChild(p);
      }
      const note = data.moon || moonNote(day);
      if (note) {
        const p = document.createElement("p");
        p.className = "diary-moon-note";
        n = words(p, note, day, data.korean, n);
        text.appendChild(p);
      }
    } else {
      const p = document.createElement("p");
      words(p, UI_TEXT.diaryEmpty, 0, null);
      const k = document.createElement("p");
      k.className = "diary-korean";
      k.textContent = UI_TEXT.diaryEmptyKorean;
      text.append(p, k);
    }
    const dots = $("diary-dots");
    dots.innerHTML = "";
    if (mode === "read" && days.length > 1) {
      if (days.length <= 12) days.forEach((d, i) => { const s = document.createElement("span"); if (i === index) s.className = "on"; dots.appendChild(s); });
      else dots.textContent = `${index + 1} / ${days.length}`;
    }
    $("diary-prev").classList.toggle("off", index <= 0);
    $("diary-next").classList.toggle("off", index >= days.length - 1);
    clock = 0;
    layout();
    fitText();
  }

  const doneAll = (day, ids) => [].concat(ids || []).every((id) => State.isDone(`d${day}_${id}`));
  function pageLines(day, data) {
    const out = [];
    let waiting = false, shown = false;
    for (const line of data.text || []) {
      if (typeof line === "string") { out.push(line); continue; }
      if (!line || typeof line.text !== "string") continue;
      if (doneAll(day, line.after)) { out.push(line.text); if (line.after) shown = true; }
      else waiting = true;
    }
    if (waiting && !shown) out.push(...[].concat(data.fallback || []));
    return out;
  }

  const pictureOf = (day, data) => (data && data.picture && doneAll(day, data.pictureAfter) ? data.picture : "empty");

  function words(el, text, day, korean, n = 0) {
    const today = new Set(day ? Words.learnedOn(day) : []);
    for (const piece of Speech.pieces(Speech.fill(text))) {
      const s = Speech.wordSpan(piece, "her", true, korean || null);
      if (s.dataset.word && today.has(s.dataset.word)) { s.classList.add("today"); s.style.setProperty("--i", n++); }
      el.appendChild(s);
    }
    return n;
  }

  function layout() {
    const body = page.querySelector(".diary-body"), frame = page.querySelector(".diary-picture");
    const dpr = window.devicePixelRatio || 1;
    const fs = getComputedStyle(frame), bs = getComputedStyle(body);
    const edge = parseFloat(fs.paddingTop) * 2 + parseFloat(fs.borderTopWidth) * 2;
    const h = body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - edge;
    const w = body.clientWidth * 0.5 - edge;
    const k = Math.max(1, Math.floor(Math.min((h * dpr) / H, (w * dpr) / W)));
    canvas.style.width = (W * k) / dpr + "px";
    canvas.style.height = (H * k) / dpr + "px";
    ctx.imageSmoothingEnabled = false;
  }

  function fitText() {
    const text = $("diary-text");
    let size = BASE_FONT;
    text.style.fontSize = size + "px";
    while (size > SMALLEST_FONT && text.scrollHeight > text.clientHeight + 1) text.style.fontSize = --size + "px";
  }

  let loopId = 0;                     // (one loop at a time, even when a page closes and opens in one frame)
  function loop(now, id) {
    if (!open || id !== loopId) return;
    clock += Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const day = days[index], data = entry(day);
    pictures = pictures || makeDiaryPictures(W, H);
    const draw = pictures[pictureOf(day, data)] || pictures.empty;
    ctx.clearRect(0, 0, W, H);
    draw(ctx, clock, { doll: data ? dollOn(day) : null });
    requestAnimationFrame((t) => loop(t, id));
  }

  function show(arrive) {
    setUp();
    open = true;
    turning = false;
    root.classList.toggle("bedtime", mode === "bedtime");
    root.classList.remove("hidden", "leaving");
    document.body.classList.add("diary-open");
    $("diary-done").textContent = mode === "bedtime" ? UI_TEXT.goodNight : UI_TEXT.diaryClose;
    render();
    page.classList.remove("arrive", "turn-out-next", "turn-out-back", "turn-in-next", "turn-in-back");
    root.classList.toggle("arriving", !!arrive);
    if (arrive) {
      void page.offsetWidth;
      page.classList.add("arrive");
      if ($("diary-text").querySelector(".today")) setTimeout(() => { if (open) Sound.twinkle(); }, 700);
    } else Sound.tap(760);
    last = performance.now();
    const id = ++loopId;
    requestAnimationFrame((t) => loop(t, id));
    pending = new Promise((ok) => { done = ok; });
    return pending;
  }

  function turn(dir) {
    if (!open || mode !== "read" || turning) return;
    const to = index + dir;
    if (to < 0 || to >= days.length) return;
    turning = true;
    $("hint").classList.add("hidden");
    Sound.tap(dir > 0 ? 820 : 700);
    root.classList.remove("arriving");
    page.classList.remove("arrive", "turn-in-next", "turn-in-back");
    page.classList.add(dir > 0 ? "turn-out-next" : "turn-out-back");
    setTimeout(() => {
      index = to;
      page.classList.remove("turn-out-next", "turn-out-back");
      render();
      page.classList.add(dir > 0 ? "turn-in-next" : "turn-in-back");
      setTimeout(() => { turning = false; }, 200);
    }, 160);
  }

  function finish() {
    if (!open) return;
    open = false;
    $("hint").classList.add("hidden");
    root.classList.add("leaving");
    document.body.classList.remove("diary-open");
    const ok = done;
    done = null; pending = null;
    setTimeout(() => { if (!open) root.classList.add("hidden"); root.classList.remove("leaving"); }, 260);
    Sound.tap(mode === "bedtime" ? 600 : 700);
    if (ok) ok();
  }

  function bedtime(day) {
    if (!entry(day)) return Promise.resolve();
    keepDoll(day);
    if (open && mode === "bedtime" && days[0] === day && pending) return pending;
    if (open) finish();
    mode = "bedtime";
    days = [day];
    index = 0;
    return show(true);
  }

  function openDiary() {
    if (open) return pending;
    const today = State.get().day;
    days = [];
    const upTo = State.get().again ? today : today - 1;
    for (let d = 1; d <= upTo; d++) if (entry(d)) days.push(d);
    mode = "read";
    index = Math.max(0, days.length - 1);
    return show(false);
  }

  function debug() {
    const at = (el) => {
      if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden" || el.closest(".hidden")) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      open, mode, day: open ? days[index] || null : null, pages: days.slice(), index,
      fontSize: parseFloat($("diary-text").style.fontSize) || null,
      fits: $("diary-text").scrollHeight <= $("diary-text").clientHeight + 1,
      picture: { ...at(canvas), scale: canvas.getBoundingClientRect().width / W, name: open ? pictureOf(days[index], entry(days[index])) : null },
      prev: at($("diary-prev")), next: at($("diary-next")), done: at($("diary-done")),
      words: [...root.querySelectorAll(".word")].map((s) => ({ word: s.textContent, dim: s.classList.contains("dim"), today: s.classList.contains("today"), ...at(s) })),
    };
  }

  return { bedtime, open: openDiary, close: finish, isOpen: () => open, debug };
})();
window.Diary = Diary;
