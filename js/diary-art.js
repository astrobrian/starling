
const DIARY_PICTURE = { w: 112, h: 84 };

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

  function sun(g, t, hot = false, x = 10, y = 9) {
    const r = hot ? 7 : 6;
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

  const firstPatch = ((window.FLOWER_PATCHES && FLOWER_PATCHES[0] && FLOWER_PATCHES[0].flowers) || [["daisy", "snow"], ["zinnia", "petalPink"]])
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

  const COLORS4 = [["zinnia", "scarlet"], ["daisy", "butter"], ["rose", "petalPink"], ["zinnia", "snow"],
    ["rose", "scarlet"], ["zinnia", "butter"], ["daisy", "petalPink"], ["daisy", "snow"]];
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
    [["zinnia", "scarlet", 88, 80], ["daisy", "snow", 101, 77], ["rose", "petalPink", 106, 86], ["daisy", "butter", 30, 88]]
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

  const WIN = { x0: 20, x1: 92, y0: 6, sill: 62 };          // the window's frame, and the top of its sill
  const GLASS = { x0: WIN.x0 + 4, x1: WIN.x1 - 4, y0: WIN.y0 + 4, y1: WIN.sill };
  const wallpaper = (() => {
    const c = make(W, H), g = c.getContext("2d"), paper = RAMPS.wallpaper;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = (x + (Math.floor(y / 8) % 2) * 4) % 8, sy = y % 8;            // (little stars, as js/room.js bakeRoom draws them)
      g.fillStyle = (sx === 3 && sy >= 3 && sy <= 5) || (sy === 4 && sx >= 2 && sx <= 4) ? paper[2] : paper[1];
      g.fillRect(x, y, 1, 1);
    }
    return c;
  })();
  const windowFrame = (() => {
    const b = new PixelBuffer(W, H), { x0, x1, y0, sill } = WIN, mid = (x0 + x1) / 2;
    b.rect(x0, y0, x1 - x0, 4, "snow");
    b.rect(x0, y0, 4, sill - y0, "snow");
    b.rect(x1 - 4, y0, 4, sill - y0, "snow");
    b.rect(x0 + 4, y0 + 18, x1 - x0 - 8, 2, "snow", { flat: true });           // the high glazing bar
    b.rect(mid - 1, y0 + 4, 2, 14, "snow", { flat: true });                    // and a bar down the top pane
    b.rect(x0 - 8, sill, x1 - x0 + 16, 6, "snow");                            // the sill, wide enough to sit on
    b.rect(x0 - 8, sill, x1 - x0 + 16, 1, RAMPS.snow[0], { flat: true });     // (its lit top edge)
    b.rect(x0 - 11, y0 - 5, x1 - x0 + 22, 2, "wood");                         // the curtain rod
    for (const s of [-1, 1]) {
      const ex = s < 0 ? x0 : x1, k = (dx) => ex - s * dx;                      // (dx: toward the middle)
      b.polygon([[k(-6), y0 - 3], [k(13), y0 - 3], [k(7), y0 + 22], [k(3), y0 + 31], [k(6), sill], [k(-6), sill]], "petalPink");
      b.rect(Math.min(k(-5), k(5)), y0 + 30, 10, 2, "berry", { flat: true });  // the tie
    }
    return outline(b).toCanvas();
  })();
  const cupFlower = (() => {
    const b = new PixelBuffer(9, 15);
    b.polygon([[1.5, 9.5], [7.5, 9.5], [6.6, 14], [2.4, 14]], "celadon");
    b.rect(1.5, 9, 6, 1, RAMPS.celadon[0], { flat: true });                   // the lit rim
    b.line(4.5, 9, 4.5, 4.6, 1, "leaf", { flat: false });                      // the stem
    b.rotEllipse(6.3, 6.8, 1.7, 0.8, -0.6, "leaf");                            // a leaf
    const bloom = [".PPP.", "PWPPS", "PPYPS", "PPPSS", ".PSS."];
    const col = { P: "petalPink", W: "cream", S: RAMPS.petalPink[2], Y: "beeYellow" };
    bloom.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) b.set(2 + x, y, col[ch]); }));
    return outline(b).toCanvas();
  })();
  const VIEW_DROP = 12;
  function atWindow(g, t, { hot = false, sunUp = false } = {}) {
    g.drawImage(wallpaper, 0, 0);
    g.save();
    g.beginPath(); g.rect(GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, GLASS.y1 - GLASS.y0); g.clip();
    g.fillStyle = hot ? PALETTE.daySky1 : PALETTE.daySky0;                    // (the top band, above the lowered view)
    g.fillRect(GLASS.x0, GLASS.y0, GLASS.x1 - GLASS.x0, VIEW_DROP);
    g.translate(0, VIEW_DROP);
    back(g, hot ? "hot" : "day", sunUp || hot ? () => sun(g, t, hot, GLASS.x0 + 17, hot ? 3 : 5) : null);
    g.restore();
    g.drawImage(windowFrame, -1, -1);
  }
  const onSill = (g, pose, x, left = true, lift = 0, blink = false) => drawBird(g, MAGPIE, pose, x, WIN.sill - lift, left, blink);
  function rising(g, name, x, y, t, every = 1.2, n = 2, dir = -1) {
    for (let i = 0; i < n; i++) {
      const k = ((t / every) + i / n) % 1;
      if (k > 0.85 || k < 0.06) continue;
      drawIcon(g, name, x + Math.round(dir * k * 10 + Math.sin(k * 5 + i * 2) * 1.5), y - Math.round(k * 18));
    }
  }
  function d1early(g, t) {
    atWindow(g, t);
    const k = t % 1.6, pecking = k < 0.75 && Math.floor(k / 0.25) % 2 === 0;
    const s = onSill(g, pecking ? "peck" : "stand", 66, true, 0, !pecking && (t % 3.7) < 0.14);
    rising(g, "note", 66 - s.footX + s.headX - 6, WIN.sill - s.footY + s.headY - 2, t, 1.3, 2);
  }
  function d2early(g, t) {
    atWindow(g, t, { sunUp: true });
    const hop = (t % 2.4) < 0.3 ? 2 : 0;                                       // ("Good morning!": a happy little hop now and then)
    onSill(g, hop ? "jump" : "stand", 64, true, hop, (t % 4.1) < 0.14);
    if (Math.sin(t * 2.2) > 0.6) twinkle(g, 76, 34);
  }
  function d3early(g, t) {
    atWindow(g, t);
    g.drawImage(cupFlower, 38 - Math.floor(cupFlower.width / 2), WIN.sill - cupFlower.height + 1);
    const s = onSill(g, (t % 3.2) < 0.4 ? "bob" : "stand", 66, true, 0, (t % 4.3) < 0.14);
    rising(g, "heart", 66 - s.footX + s.headX, WIN.sill - s.footY + s.headY - 3, t, 2.2, 1);
  }
  function d4early(g, t) {
    atWindow(g, t, { hot: true });
    const s = onSill(g, Math.floor(t / 0.16) % 2 ? "pant2" : "pant", 66, true);
    const bob = Math.round(Math.sin(t * 3) * 1);
    drawIcon(g, "heat", 66 - s.footX + s.headX + 2, WIN.sill - s.footY + s.headY - 6 + bob);
  }
  function d5early(g, t) {
    atWindow(g, t);
    const per = 0.45, i = Math.floor(t / per), u = (t % per) / per, lift = Math.round(Math.sin(u * Math.PI) * 4);
    const s = onSill(g, lift > 1 ? "jump" : "crouch", 60, i % 2 === 0, lift);
    rising(g, "heart", 60 - s.footX + s.headX, WIN.sill - s.footY + s.headY - 4, t, 1.4, 2);
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

  return { d1, d2, d3, d4, d5, d1early, d2early, d3early, d4early, d5early, empty };
}
