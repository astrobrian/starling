
const propCache = {};

function prop(type, variant = 0, frame = 0) {
  const key = `${type}/${variant}/${frame}`;
  if (!propCache[key]) propCache[key] = PROP_RENDERERS[type](variant, frame);
  return propCache[key];
}

function finish(buf, ax, ay) {
  return { canvas: outline(buf).toCanvas(), ax: ax + 1, ay: ay + 1 };
}

function leafBall(b, cx, cy, rx, ry, color, seed, opts = {}) {
  const whole = [cx, cy, rx, ry];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash2(seed, i, 3);
    const r = 0.45 + hash2(seed, i, 4) * 0.2;
    b.ellipse(cx + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.5, rx * r * 1.1, ry * r * 1.1, color, { shadeAs: whole });
  }
  b.ellipse(cx, cy, rx * 0.7, ry * 0.7, color, { shadeAs: whole });
  const ramp = rampFor(color);
  for (let i = 0; i < 6; i++) {
    const x = cx + (hash2(seed, i, 5) - 0.7) * rx * 1.1, y = cy + (hash2(seed, i, 6) - 0.75) * ry * 1.1;
    b.ellipse(x, y, rx * 0.2, ry * 0.16, ramp[0], { onlyFilled: true, flat: true });
  }
  for (let i = 0; i < (opts.dark === false ? 0 : 5); i++) {
    const x = cx + (hash2(seed, i, 7) - 0.3) * rx * 1.1, y = cy + (hash2(seed, i, 8) - 0.2) * ry * 1.1;
    b.ellipse(x, y, rx * 0.18, ry * 0.12, ramp[3], { onlyFilled: true, flat: true });
  }
}

function clumpCanopy(b, cx, cy, rx, ry, color, seed, opts = {}) {
  const R = rampFor(color);
  const cr = opts.clump || 5;
  const clumps = [];
  const rim = Math.max(6, Math.round((rx + ry) / (cr * 0.62)));
  for (let i = 0; i < rim; i++) {
    const a = (i / rim) * Math.PI * 2 + hash2(seed, i, 1) * 0.6;
    const r = cr * (0.78 + hash2(seed, i, 2) * 0.44);
    clumps.push([cx + Math.cos(a) * (rx - r * 0.8), cy + Math.sin(a) * (ry - r * 0.8), r]);
  }
  const inner = opts.inner ?? Math.round((rx * ry) / (cr * cr * 1.6));
  for (let i = 0; i < inner; i++) {
    const a = hash2(seed, i, 3) * Math.PI * 2, d = Math.sqrt(hash2(seed, i, 4)) * 0.6;
    const r = cr * (0.85 + hash2(seed, i, 5) * 0.4);
    clumps.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r]);
  }
  clumps.sort((p, q) => p[1] + p[2] * 0.3 - (q[1] + q[2] * 0.3));     // back first, front last
  b.ellipse(cx, cy, rx * 0.84, ry * 0.84, R[3], { flat: true });        // no holes in the middle
  const bias = opts.bias || 0;                                          // +1: a whole band darker (back rows)
  for (const [x, y, r] of clumps) {
    const whole = shadeBand((x - cx) / rx, (y - cy) / ry);
    const body = Math.min(3, Math.max(1, whole + bias));
    const lit = Math.max(0, body - 1), dark = Math.min(3, body + 1);
    const inC = (px, py, ox, oy) => (px + 0.5 - (x + ox)) ** 2 + (py + 0.5 - (y + oy)) ** 2 <= r * r;
    for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
      for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
        if (!inC(px, py, 0, 0)) continue;
        if (opts.clip && !opts.clip(px, py)) continue;
        let band = body;
        if (!inC(px, py, r * 0.34, r * 0.34)) band = lit;               // lit crescent, upper left
        else if (!inC(px, py, -r * 0.3, -r * 0.3)) band = dark;         // shaded crescent, lower right
        b.set(px, py, R[band]);
      }
    }
  }
  for (let i = 0; i < (opts.tips ?? 6); i++) {
    const a = Math.PI * (1.05 + hash2(seed, i, 7) * 0.75);            // upper-left half
    const x = Math.round(cx + Math.cos(a) * (rx + 0.3)), y = Math.round(cy + Math.sin(a) * (ry + 0.3));
    if (!b.get(x, y) && (b.get(x + 1, y) || b.get(x, y + 1))) b.set(x, y, R[1]);
  }
}

function trunk(b, cx, top, bottom, w, color = "bark") {
  const hw = w / 2;
  b.polygon([[cx - hw, top], [cx + hw, top], [cx + hw + 0.5, bottom - 4], [cx + hw + 3.5, bottom], [cx + 1, bottom - 1.2],
    [cx - 1, bottom - 1.2], [cx - hw - 3.5, bottom], [cx - hw - 0.5, bottom - 4]], color);
  const R = rampFor(color);
  for (let y = top + 2; y < bottom - 2; y++) {
    if ((y + Math.round(cx)) % 5 !== 0) b.set(Math.round(cx + hw * 0.35), y, R[3]);
    if ((y + Math.round(cx)) % 7 < 4) b.set(Math.round(cx - hw * 0.55), y, R[0]);
  }
}

function bushOf(color, seed, w, h, extra) {
  const b = new PixelBuffer(w, h);
  clumpCanopy(b, w / 2, h / 2 + 0.5, w / 2 - 0.5, h / 2 - 0.8, color, seed, { clump: 3.6, tips: 4 });
  for (let x = 0; x < w; x++) if (b.get(x, h - 2)) b.set(x, h - 2, RAMPS[color][3]);   // the base sits in its own shade
  if (extra) extra(b);
  return finish(b, Math.floor(w / 2), h - 1);
}

const GREEN_PERSIMMON = { body: "#D2E27A", shade: "#9DBA55", shine: "#F6F8D2", calyx: "#4F7A3A", calyxLit: "#6F9A48", rim: "#4A6E36" };
function greenPersimmon(b, x, y) {
  const G = GREEN_PERSIMMON, X = Math.round(x), Y = Math.round(y);
  b.ellipse(x, y + 0.3, 2.9, 2.7, G.rim, { flat: true });
  b.ellipse(x, y + 0.3, 2.1, 1.9, G.body, { flat: true });
  const body = paletteColor(G.body);
  for (let py = Math.floor(y - 2); py <= y + 3; py++) for (let px = Math.floor(x - 3); px <= x + 3; px++) {
    if (b.get(px, py) === body && (px + 0.5 - x) * 0.7 + (py + 0.5 - y - 0.3) > 1.0) b.set(px, py, G.shade);
  }
  b.set(X - 1, Math.round(y - 0.4), G.shine);
  for (let dx = -2; dx <= 2; dx++) b.set(X + dx, Y - 2, Math.abs(dx) === 1 ? G.calyxLit : G.calyx);
  b.set(X - 3, Y - 1, G.calyx); b.set(X + 3, Y - 1, G.calyx);
  b.set(X, Y - 3, G.calyx);
}

function persimmonFruits(v = 0) {
  const all = [[12, 28], [33, 19], [38, 31], [19, 15], [27, 33]];
  return v === 2 ? [all[0], all[1], all[3]] : all.slice(0, v === 1 ? 4 : 5);
}

function plumFruits() {
  return [[13, 30], [33, 19], [39, 31], [21, 17], [28, 33], [15, 21], [36, 25]];
}

const PROP_RENDERERS = {
  bigTree(v) {
    const b = new PixelBuffer(66, 78);
    trunk(b, 33, 44, 77, 11);
    b.line(31, 52, 22, 42, 3.2, "bark", { flat: false });               // the fork
    b.line(35, 52, 44, 41, 3.2, "bark", { flat: false });
    clumpCanopy(b, 33, 29, 31, 24, "leaf", 11 + v, { clump: 7 });
    b.line(28, 57, 11, 59, 2.4, "bark", { flat: false });
    clumpCanopy(b, 10, 57, 4.4, 3, "leaf", 91, { clump: 2.6, inner: 1, tips: 0 });
    b.ellipse(36.5, 63, 1.8, 2.4, RAMPS.bark[3], { flat: true });          // knothole
    b.set(36, 62, RAMPS.plum[3]);
    return finish(b, 33, 77);
  
  },

  woodsTree(v) {
    const short = v >= 16 ? 11 : 0;
    v = v % 16;
    const shape = v % 4, back = (v >> 2) & 1, pine = v >= 8;
    const b = new PixelBuffer(44, 54);
    if (pine) {
      trunk(b, 22, 22, 53, 4.5, "pineBark");
      b.line(22, 36, 12, 29, 1.6, "pineBark"); b.line(22, 30, 32, 24, 1.6, "pineBark");
      for (const [x, y, rx, ry] of [[14, 30, 9, 4.2], [30, 24, 9, 4.2], [20, 15, 10, 5], [23, 7, 7, 4]]) {
        clumpCanopy(b, x, y, rx, ry, "pine", 300 + v + x, { clump: 3, bias: back, tips: 3 });
      }
      return finish(b, 22, 53);
    }
    if (short) b.rect(19, 40, 6, 13, "bark"); else trunk(b, 22, 32, 53, 6);
    const r = 14 + shape * 1.3;
    clumpCanopy(b, 22 + (shape % 2 ? -1 : 1), 22 + short, r, r * 0.9, back ? "forest" : "hedge", 30 + v, { clump: 5, bias: back ? 1 : 0 });
    return finish(b, 22, 53);
  
  },

  persimmonTree(v) {
    const b = new PixelBuffer(50, 62);
    trunk(b, 25, 36, 61, 7);
    b.line(24, 44, 13, 32, 2.4, "bark", { flat: false });
    b.line(26, 44, 38, 30, 2.4, "bark", { flat: false });
    clumpCanopy(b, 25, 24, 22, 18, "leafGold", 50, { clump: 5.2 });
    for (const [x, y] of persimmonFruits(v)) greenPersimmon(b, x, y);
    return finish(b, 25, 61);
  },

  house() {
    const b = new PixelBuffer(84, 74);
    b.rect(62, 2, 9, 16, "stone");                                      // chimney
    b.rect(4, 38, 76, 33, "wall");                                      // walls
    b.rect(3, 68, 78, 5, "stone");                                      // stone base
    b.polygon([[0, 40], [5, 35], [14, 12], [70, 12], [79, 35], [84, 40], [76, 40], [42, 40], [8, 40]], "roof");
    const roofRamp = RAMPS.roof;
    for (let y = 17; y < 38; y += 5) b.rect(8, y, 68, 1, roofRamp[2], { onlyFilled: true, flat: true });
    b.triangle(0, 40, 3, 33, 7, 39, "roof");                            // curled corners
    b.triangle(84, 40, 81, 33, 77, 39, "roof");
    b.rect(36, 50, 12, 21, "bark");                                     // door
    b.circle(45.5, 61, 0.9, "beeYellow", { flat: true });
    for (const wx of [11, 59]) {
      b.rect(wx, 46, 14, 11, "pond");
      b.rect(wx + 6.5, 46, 1, 11, "wall", { flat: true });
      b.rect(wx, 51, 14, 1, "wall", { flat: true });
      b.rect(wx - 2, 57, 18, 4, "wood");                                // window box
      for (let i = 0; i < 6; i++) {
        const c = ["petalPink", "butter", "coral", "snow"][(i + wx) % 4];
        b.circle(wx - 0.5 + i * 3, 56, 1.2, c, { flat: true });
      }
    }
    return finish(b, 42, 73);
  },

  bush(v) {
    return bushOf("leaf", 70 + v, 20, 16);
  },

  berryBush(v) {
    return bushOf("hedge", 80 + v, 21, 17, (b) => {
      for (const [x, y] of [[4, 5], [12, 3], [8, 9], [15, 8], [11, 12], [3, 10]]) {
        for (const [dx, dy] of [[0, 0], [2, 0], [1, 2]]) {
          b.set(x + dx, y + dy, RAMPS.berry[0]); b.set(x + dx + 1, y + dy, RAMPS.berry[1]);
          b.set(x + dx, y + dy + 1, RAMPS.berry[1]); b.set(x + dx + 1, y + dy + 1, RAMPS.berry[2]);
        }
      }
    });
  },

  hedge(v) {
    return bushOf("hedge", 90 + v, 20, 17);
  },

  rock(v) {
    const b = new PixelBuffer(14, 10);
    b.ellipse(7, 5.5, 6.5 - (v % 2), 4.2, "stone");
    if (v % 2) b.ellipse(10.5, 7, 3, 2.4, "stone");
    b.ellipse(5.6, 3.8, 3.6, 1.6, RAMPS.stone[0], { flat: true, onlyFilled: true });
    b.set(8, 6, RAMPS.stone[3]); b.set(9, 7, RAMPS.stone[3]);
    if (!(v % 2)) { b.set(3, 3, RAMPS.leaf[1]); b.set(4, 2, RAMPS.leaf[0]); b.set(5, 2, RAMPS.leaf[1]); }
    return finish(b, 7, 9);
  
  },

  bigRock(v) {
    const b = new PixelBuffer(28, 18);
    b.ellipse(11, 9.5, 10, 8, "stone");
    b.ellipse(21, 12, 6.5, 5.5, "stone");
    b.ellipse(9, 6, 6, 3, RAMPS.stone[0], { flat: true, onlyFilled: true });
    for (const [x, y] of [[13, 9], [14, 10], [14, 11], [15, 12]]) b.set(x, y, RAMPS.stone[3]);
    for (const [x, y, c] of [[5, 4, 1], [6, 3, 0], [7, 3, 1], [8, 2, 1], [9, 3, 2], [4, 5, 2]]) b.set(x, y, RAMPS.leaf[c]);
    return finish(b, 14, 17);
  
  },

  log() {
    const b = new PixelBuffer(30, 12);
    b.rect(4, 1, 22, 10, "bark");
    b.ellipse(26, 6, 3.5, 5, "wood");
    b.ellipse(26, 6, 1.6, 2.4, RAMPS.wood[2], { flat: true });
    b.ellipse(4, 6, 3.5, 5, "bark");
    return finish(b, 15, 11);
  },

  stump() {
    const b = new PixelBuffer(14, 12);
    b.rect(2, 4, 10, 7, "bark");
    b.ellipse(7, 4, 5, 2.6, "wood");
    b.ellipse(7, 4, 2.4, 1.2, RAMPS.wood[2], { flat: true });
    b.polygon([[1, 11], [3, 8], [4, 11]], "bark");
    b.polygon([[13, 11], [11, 8], [10, 11]], "bark");
    return finish(b, 7, 11);
  },

  mushrooms(v) {
    const b = new PixelBuffer(14, 10);
    const caps = [[4, 5, 3], [9.5, 3.5, 3.4], [11, 7.5, 2]];
    for (const [x, y, r] of caps.slice(0, 2 + (v % 2))) {
      b.rect(x - 0.8, y, 1.8, 9.5 - y, "cream", { flat: true });
      b.ellipse(x, y, r, r * 0.75, "coral", { clip: (px, py) => py < y + 0.5 });
      b.set(Math.round(x - r * 0.4), Math.round(y - r * 0.3), "cream");
      b.set(Math.round(x + r * 0.3), Math.round(y - r * 0.1), "cream");
    }
    return finish(b, 7, 9);
  },

  fence(v) {
    const b = new PixelBuffer(16, 16);
    if (v === 0) {
      b.rect(0, 5, 16, 2, "wood");
      b.rect(0, 10, 16, 2, "wood");
      b.rect(6, 1, 4, 14, "wood");
    } else {
      b.rect(6, 0, 3, 16, RAMPS.wood[2], { flat: true });
      b.rect(5.5, 3, 4, 12, "wood");
    }
    return finish(b, 8, 15);
  },

  bench() {
    const b = new PixelBuffer(30, 18);
    b.rect(2, 1, 26, 8, "wood");
    for (let y = 3; y < 9; y += 3) b.rect(2, y, 26, 1, RAMPS.wood[2], { flat: true, onlyFilled: true });
    b.rect(1, 10, 28, 3, "wood");
    for (const x of [3, 25]) b.rect(x, 12, 2, 6, "bark", { flat: true });
    return finish(b, 15, 17);
  },

  mailbox(v) {
    const b = new PixelBuffer(16, 24);
    const R = RAMPS.roof, box = [8, 6.5, 6.5, 4.5];
    b.rect(7, 10, 2, 14, "wood");
    b.rect(1.5, 4, 13, 7, "roof", { shadeAs: box });
    b.ellipse(8, 4.5, 6.5, 2.6, "roof", { clip: (x, y) => y < 5, shadeAs: box });
    b.rect(1.5, 4, 1, 7, R[2], { flat: true, onlyFilled: true });                   // the door's edge
    b.set(3, 7, "beeYellow");                                                      // its knob
    for (let x = 4; x < 14; x++) b.set(x, 10, R[3]);                               // the box's underside
    if (v === 1) {
      b.rect(0, 5, 3, 4, "cream", { flat: true });
      b.set(0, 8, RAMPS.cream[2]); b.set(1, 8, RAMPS.cream[2]);
      b.set(1, 6, "petalPink"); b.set(1, 7, RAMPS.petalPink[2]);
      b.rect(12, 1, 1, 8, "scarlet", { flat: true });
      b.rect(12, 0.5, 3.5, 2.5, "scarlet");
    } else {
      b.rect(7, 7, 6, 1, RAMPS.scarlet[1], { flat: true });
      b.rect(5, 6.5, 2.5, 2.5, "scarlet");
    }
    b.set(12, 8, RAMPS.stone[2]);                                                  // the flag's pin
    return finish(b, 8, 23);
  },

  wateringCan() {
    const b = new PixelBuffer(16, 11);
    b.ellipse(6, 6.5, 5, 4, "sheen");
    b.line(10, 6, 15, 1.5, 1.6, "sheen");
    b.rect(14, 0.5, 2, 2, "sheen", { flat: true });
    b.ellipse(5, 2, 3, 2, "sheen", { clip: (x, y) => y < 2 });
    return finish(b, 7, 10);
  },

  pottedPlant(v) {
    const b = new PixelBuffer(14, 16);
    leafBall(b, 7, 6, 6, 5, "leaf", 110 + v);
    const bloom = ["petalPink", "butter", "coral"][v % 3];
    b.circle(5, 4, 1.5, bloom, { flat: true });
    b.circle(9.5, 6, 1.4, bloom, { flat: true });
    b.polygon([[2, 9], [12, 9], [11, 15.5], [3, 15.5]], "clay");
    b.rect(1.5, 9, 11, 2, "clay");
    return finish(b, 7, 15);
  },

  birdFeeder(v) {
    const b = new PixelBuffer(18, 32);
    b.rect(8, 12, 2, 20, "wood");
    b.rect(3, 10, 12, 3, "wood");                                       // tray
    if (v !== 1) b.rect(4, 8, 10, 2, "beeYellow", { flat: true });      // seeds
    b.polygon([[1, 5], [9, 0], [17, 5]], "roof");
    b.rect(3, 5, 1, 5, "wood", { flat: true });
    b.rect(14, 5, 1, 5, "wood", { flat: true });
    return finish(b, 9, 31);
  },

  birdBath(v) {
    const b = new PixelBuffer(24, 20);
    b.polygon([[9, 8], [15, 8], [16, 17], [19, 19.5], [5, 19.5], [8, 17]], "stone");
    b.ellipse(12, 6, 11.5, 4.5, "stone");
    if (v === 1) {
      const S = RAMPS.stone;
      b.ellipse(12, 5.5, 9, 3, S[2], { flat: true });                   // the inside, in the rim's shade
      b.ellipse(13.2, 6.4, 7, 2.1, S[1], { flat: true, onlyFilled: true });   // the floor, where the sun reaches
      b.ellipse(14, 6.8, 4, 1.2, S[0], { flat: true, onlyFilled: true });
      for (const x of [5, 6, 7]) b.set(x, 4, S[3]);                      // deepest under the back left rim
      for (const [x, y, c] of [[9, 6, 1], [10, 6, 1], [11, 6, 2], [10, 7, 2], [10, 5, 0]]) b.set(x, y, RAMPS.wood[c]);
      for (const [x, y, c] of [[15, 5, 1], [16, 5, 1], [16, 6, 2], [17, 6, 2]]) b.set(x, y, RAMPS.leafGold[c]);
    } else {
      b.ellipse(12, 5.5, 9, 3, "pond", { flat: true });
      b.rect(8, 4, 3, 1, RAMPS.pond[0], { flat: true });
    }
    const s = finish(b, 12, 19), front = document.createElement("canvas");
    front.width = s.canvas.width; front.height = s.canvas.height;
    front.getContext("2d").drawImage(s.canvas, 0, 7, s.canvas.width, s.canvas.height - 7, 0, 7, s.canvas.width, s.canvas.height - 7);
    return { ...s, front };
  },

  birdhouse() {
    const b = new PixelBuffer(16, 34);
    b.rect(7, 14, 2, 20, "wood");
    b.rect(2, 6, 12, 10, "petalPink");
    b.polygon([[0, 7], [8, 0], [16, 7]], "sheen");
    b.circle(8, 10.5, 1.8, "plum", { flat: true });
    b.rect(7, 13, 2, 1, "wood", { flat: true });                        // perch
    return finish(b, 8, 33);
  },

  feather(v) {
    if (v === 3) return crowFeatherSprite(0);
    if (v === 2) {
      const b = new PixelBuffer(14, 7);
      b.rotEllipse(7.5, 3.5, 6, 1.6, -0.3, "wood");
      b.set(10, 5, null);                                               // a little nick in the edge
      b.line(2, 5.4, 13, 2, 1, "cream", { onlyFilled: true });           // a light quill, like the icon
      for (const [x, y] of [[5, 4], [8, 3], [10, 2]]) b.set(x, y, RAMPS.wood[0]);
      const out = outline(b);
      out.set(1, 6, "cream"); out.set(2, 6, "cream");
      return { canvas: out.toCanvas(), ax: 8, ay: 6 };
    }
    const b = new PixelBuffer(14, 7);
    const vane = v % 2 ? "sheen" : "ink";
    b.rotEllipse(7.5, 3.5, 6, 1.6, -0.3, vane);
    b.set(10, 5, null);                                                 // a little nick in the edge
    b.line(2, 5.4, 13, 2, 1, v % 2 ? RAMPS.sheen[3] : RAMPS.snow[2], { onlyFilled: true });   // the quill
    if (!(v % 2)) for (const [x, y] of [[5, 3], [7, 2], [9, 2]]) b.set(x, y, RAMPS.sheen[1]);  // gloss
    const out = outline(b);
    out.set(1, 6, "cream"); out.set(2, 6, "cream");                     // bare end of the quill
    return { canvas: out.toCanvas(), ax: 8, ay: 6 };
  },

  seedSack() {
    const b = new PixelBuffer(14, 15);
    b.ellipse(7, 9.5, 6, 5.2, "path");
    b.polygon([[4, 5], [10, 5], [11.5, 2], [2.5, 2]], "path");
    b.rect(4, 4, 6, 2, "wood", { flat: true });                         // the string
    b.ellipse(7, 1.8, 3.5, 1.5, "beeYellow", { flat: true });           // seeds at the top
    b.set(5, 1, RAMPS.beeYellow[0]); b.set(8, 1, RAMPS.beeYellow[2]);
    b.rect(3, 9, 1, 3, RAMPS.path[2], { flat: true, onlyFilled: true }); // a crease
    return finish(b, 7, 14);
  },

  seedPouch() {
    const b = new PixelBuffer(7, 7);
    b.ellipse(3.5, 4.6, 3.1, 2.3, "path");                              // the pouch
    b.polygon([[2.2, 2.8], [4.8, 2.8], [5.6, 0.9], [1.4, 0.9]], "path", { shadeAs: [3.5, 4, 3.1, 3] });   // its gathered neck
    b.rect(2, 2, 3, 1, "wood", { flat: true });                         // the string
    b.set(2, 0, "beeYellow"); b.set(3, 0, RAMPS.beeYellow[0]); b.set(4, 0, RAMPS.beeYellow[2]);   // seeds peeking out
    return finish(b, 3, 6);
  },

  jangdokdae() {
    const b = new PixelBuffer(46, 30);
    b.rect(1, 22, 44, 7, "stone");
    b.rect(1, 22, 44, 1, RAMPS.stone[0], { flat: true });
    for (const [cx, w, h] of [[9, 12, 15], [23, 15, 19], [37, 12, 15]]) {
      const bot = 22;
      b.polygon([
        [cx - w * 0.3, bot], [cx + w * 0.3, bot], [cx + w / 2, bot - h * 0.62], [cx + w * 0.38, bot - h * 0.9],
        [cx + w * 0.25, bot - h], [cx - w * 0.25, bot - h], [cx - w * 0.38, bot - h * 0.9], [cx - w / 2, bot - h * 0.62],
      ], "onggi");
      b.rect(cx - w * 0.27, bot - h - 1, w * 0.54, 1, RAMPS.onggi[3], { flat: true });        // rim
      b.ellipse(cx, bot - h - 2.2, w * 0.3, 2.2, "onggi", { clip: (x, y) => y < bot - h - 1 }); // lid
      b.set(Math.round(cx - 0.5), Math.round(bot - h - 4.4), RAMPS.onggi[0]);                // knob
      b.rect(cx - w * 0.28, bot - h * 0.85, 1, 4, RAMPS.onggi[0], { flat: true, onlyFilled: true }); // glaze
    }
    return finish(b, 23, 29);
  },

  sotdae() {
    const b = new PixelBuffer(16, 50);
    b.rect(7, 10, 2, 40, "bark");
    b.ellipse(7, 8, 5.5, 2.6, "wood");                                  // bird body
    b.circle(12, 5, 2, "wood");                                         // head
    b.triangle(13.5, 4.2, 16, 5, 13.5, 6, "beeYellow", { flat: true });  // beak
    b.polygon([[2, 7], [0, 5], [3, 6.5]], "wood");                     // tail
    const out = finish(b, 8, 49);
    return out;
  },

  willow(v, frame = 1) {
    const b = new PixelBuffer(48, 60);
    const R = RAMPS.willow;
    const lean = v === 1 ? 2 : v === 2 ? -1 : -2;
    const cx = 24 + lean, sway = frame - 1;
    trunk(b, 24, 24, 59, 5);
    b.polygon([[cx - 12, 12], [cx + 12, 12], [cx + 19, 46], [cx + 8, 49], [cx - 8, 49], [cx - 19, 46]], R[3], { flat: true,
      clip: (x, y) => !(Math.abs(x + 0.5 - 24) < 2.6 && y > 38) });
    clumpCanopy(b, cx, 10, 15, 8, "willow", 120 + v, { clump: 3.4, tips: 6 });
    const N = 17;
    for (const layer of [0, 1]) {
      for (let i = layer; i < N; i += 2) {
        const t = (i / (N - 1)) * 2 - 1;                               // -1 left .. 1 right
        const x0 = cx + t * 14;
        const y0 = (layer ? 9 : 11) + Math.abs(t) * 6;
        const len = 31 + (1 - Math.abs(t)) * 5 + Math.round((hash2(v, i, 5) - 0.5) * 9) - (layer ? 0 : 2);
        const flare = t * 6;
        for (let k = 0; k < len; k++) {
          const u = k / len;
          const tip = k > len - 8 ? sway : 0;
          const x = Math.round(x0 + flare * Math.sin((u * Math.PI) / 2) + tip);
          const y = Math.round(y0 + k);
          let band = layer ? 1 : 2;
          if (layer && t < -0.15 && u < 0.5) band = 0;                  // sunlit, upper left
          if (u > 0.7) band = Math.min(3, band + 1);                    // the crown shades the lower curtain
          if (!layer && t > 0.3) band = 3;
          b.set(x, y, R[band]);
          if (k < len - 4) b.set(x + 1, y, R[Math.min(3, band + (layer ? 1 : 0))]);
          if (layer && k % 4 === 2 && k < len - 3) b.set(x + (k % 8 < 4 ? -1 : 2), y, R[band]);   // leaf nodes
        }
      }
    }
    return finish(b, 24, 59);
  
  },

  riverRock(v) {
    const b = new PixelBuffer(16, 12);
    b.ellipse(8, 6, 6.5 - (v % 2), 4, "stone", { clip: (x, y) => y < 9 });
    if (v % 2) b.ellipse(11.5, 7, 2.6, 2, "stone", { clip: (x, y) => y < 9 });
    const out = outline(b);
    for (let x = 0; x < out.w; x++) {
      let top = -1;
      for (let y = 0; y < out.h; y++) if (out.get(x, y)) { top = y; break; }
      if (top > 0) out.set(x, top - 1, "cream");                                   // foam
    }
    for (let x = 0; x < out.w; x++) {
      if (out.get(x, 10)) out.set(x, 10, null);                                    // no outline underneath
      if (out.get(x, 9)) out.set(x, 9, RAMPS.pond[0]);                             // the foot, in the water
    }
    out.set(1, 11, RAMPS.pond[0]); out.set(2, 11, RAMPS.pond[0]);                 // wake
    out.set(out.w - 3, 11, RAMPS.pond[0]); out.set(out.w - 2, 11, RAMPS.pond[0]);
    return { canvas: out.toCanvas(), ax: 9, ay: 11 };
  },

  bridgeRail(n) {
    const w = n * 16 + 10;
    const b = new PixelBuffer(w, 9);
    b.rect(0, 2, w, 2, "wood");
    for (let x = 0; x < w; x += 8) b.rect(x, 0, 2, 9, "wood");
    b.rect(w - 2, 0, 2, 9, "wood");
    return finish(b, w / 2, 8);
  },

  fish(v, frame = 1) {
    const b = new PixelBuffer(11, 8);
    const angle = [-0.7, 0, 0.7][frame];
    const c = Math.cos(angle), s2 = Math.sin(angle);
    b.rotEllipse(6, 4, 3.6, 1.7, angle, "sheen");
    b.rotEllipse(6 - s2 * 0.9, 4 + c * 0.9, 2.8, 0.9, angle, "cream", { onlyFilled: true, flat: true });
    b.triangle(6 - c * 3.2, 4 - s2 * 3.2, 6 - c * 5.4 - s2 * 1.8, 4 - s2 * 5.4 + c * 1.8, 6 - c * 5.4 + s2 * 1.8, 4 - s2 * 5.4 - c * 1.8, "sheen");
    const out = outline(b);
    out.set(Math.round(7 + c * 2), Math.round(4 + s2 * 2), "plum");                        // eye
    return { canvas: out.toCanvas(), ax: 6, ay: 5 };
  },

  reeds(v, frame = 1) {
    const b = new PixelBuffer(16, 25);
    const R = RAMPS.reed, lean = frame - 1;
    const blades = [[3, 13, -1, 2], [5, 19, 0, 2], [7, 23, 0, 1], [9, 17, 1, 1], [10, 21, 0, 2], [12, 14, 1, 2], [6, 11, -1, 1]];
    blades.forEach(([x0, h, bend, band], i) => {
      for (let k = 0; k < h; k++) {
        const u = k / h;
        const x = Math.round(x0 + bend * u * u * 2 + (k > h - 5 ? lean : 0));
        b.set(x, 23 - k, R[k > h * 0.6 && band === 1 ? 0 : band]);
      }
      if (i === 1 || i === 5) { const x = Math.round(x0 + bend * 2 + lean); b.set(x + (bend || 1), 23 - h, R[band]); b.set(x + 2 * (bend || 1), 24 - h, R[band]); }
    });
    for (const [x, top] of v % 2 ? [[6, 3]] : [[6, 3], [10, 6]]) {
      const X = x + lean;
      b.rect(X, top, 2, 5, "seed", { shadeAs: [X + 1, top + 2.5, 1.2, 2.6] });
      b.set(X, top + 1, RAMPS.seed[0]);
      b.set(X, top - 1, R[2]);
    }
    const out = outline(b);
    for (const x of [2, 3, 12, 13]) out.set(x, 24, RAMPS.pond[0]);
    return { canvas: out.toCanvas(), ax: 8, ay: 24 };
  
  },

  lilyPad(v) {
    const b = new PixelBuffer(16, 10);
    const r = v % 3 === 1 ? 6.5 : 7.5, flip = v % 2 ? -1 : 1;
    b.ellipse(8, 5, r, r * 0.56, "leaf", { clip: (x, y) => !((x + 0.5 - 8) * flip >= 0 && Math.abs(y + 0.5 - 5) < Math.abs(x + 0.5 - 8) * 0.18) });
    if (v % 2 === 0) {
      b.circle(6, 3.5, 1.8, "petalPink", { flat: true });
      b.set(6, 3, "cream");
    }
    return finish(b, 8, 9);
  },

  fern(v) {
    const b = new PixelBuffer(24, 13);
    const color = v % 2 ? "hedge" : "forest", R = RAMPS[color];
    const fronds = [[-1.2, 9], [-0.75, 11], [-0.3, 12], [0.2, 12], [0.65, 11], [1.1, 9]];
    fronds.forEach(([a, len], i) => {
      for (let k = 0; k < len; k++) {
        const u = k / len;
        const x = 12 + Math.sin(a) * k * 0.95, y = 12 - Math.cos(a) * k * 0.9 + u * u * 4;
        const band = u < 0.35 ? 2 : a < 0 ? (u > 0.7 ? 0 : 1) : 2;
        b.set(Math.round(x), Math.round(y), R[band]);
        if (k % 2 === 1 && u > 0.15) { b.set(Math.round(x) - 1, Math.round(y) + 1, R[Math.min(3, band + 1)]); b.set(Math.round(x) + 1, Math.round(y) + 1, R[Math.min(3, band + 1)]); }
      }
    });
    return finish(b, 12, 12);
  },

  tallGrass(v, frame) {
    const b = new PixelBuffer(12, 10);
    const lean = frame - 1;
    const tips = [[1, 3], [4, 0], [6, 2], [8, 0.5], [11, 3]];
    tips.forEach(([x, y], i) => {
      if (v % 2 && i === 4) return;
      b.line(3 + i * 1.5, 10, x + lean, y + (v % 3), 1, i % 2 ? RAMPS.grass[2] : RAMPS.meadowGreen[1]);
      b.set(Math.round(x + lean), Math.round(y + (v % 3)), RAMPS.grass[0]);
    });
    return { canvas: b.toCanvas(), ax: 6, ay: 9 };
  },
};

const BATH_WATER = { dx: 0, dy: -11 };

const BREAD = ["#F0C98E", "#D9A061", "#B5773F", "#8F5A33"];

Object.assign(PROP_RENDERERS, {
  bathSplash(v, frame = 0) {
    const b = new PixelBuffer(30, 18);
    const cx = 15, cy = 13;                                   // the water, in the middle of the basin
    const drops = [
      [[-6, -3, 2], [6, -3, 2], [-3, -6, 1], [3, -6, 2], [0, -8, 1]],
      [[-9, -6, 2], [9, -5, 2], [-5, -10, 2], [5, -11, 1], [-1, -12, 1], [2, -9, 1]],
      [[-13, -2, 2], [13, -1, 2], [-9, -6, 1], [9, -7, 1], [-4, -9, 1], [4, -8, 1]],
    ][frame % 3];
    const P = RAMPS.pond;
    for (const [dx, dy, s] of drops) {
      const x = cx + dx, y = cy + dy;
      if (s === 1) { b.set(x, y, P[0]); continue; }
      b.set(x, y, "cream"); b.set(x + 1, y, P[0]); b.set(x, y + 1, P[0]); b.set(x + 1, y + 1, P[1]);
    }
    const out = outline(b);
    const crown = [[[-8, 0], [-7, -1], [-5, -1], [5, -1], [7, -1], [8, 0]], [[-7, 0], [-6, -1], [6, -1], [7, 0]], [[-9, 0], [-6, 0], [6, 0], [9, 0]]][frame % 3];
    for (const [dx, dy] of crown) out.set(cx + dx + 1, cy + dy + 1, dy < 0 ? "cream" : P[0]);
    return { canvas: out.toCanvas(), ax: cx + 1, ay: cy + 1 };
  },

  wateringCanPour(v, frame = 0) {
    const b = new PixelBuffer(24, 30);
    const a = 1.0, c = Math.cos(a), s = Math.sin(a), C = [6, 6.5], O = [2, 2];
    const at = (x, y) => [O[0] + C[0] + (x - C[0]) * c - (y - C[1]) * s, O[1] + C[1] + (x - C[0]) * s + (y - C[1]) * c];
    const h = [[2.5, 3.5], [3.5, 0.5], [8, 0.5], [9, 2.5]].map(([x, y]) => at(x, y));
    for (let i = 0; i < h.length - 1; i++) b.line(...h[i], ...h[i + 1], 1.3, RAMPS.sheen[2]);
    const [bx, by] = at(6, 6.5);
    b.rotEllipse(bx, by, 5, 4, a, "sheen");
    b.line(...at(10, 6), ...at(15, 1.5), 1.6, "sheen");
    const [rx, ry] = at(15, 1.2);
    b.rotEllipse(rx, ry, 1.1, 1.8, a, RAMPS.sheen[2], { flat: true });
    const [lx, ly] = at(4, 3.6);
    b.set(lx, ly, RAMPS.sheen[0]); b.set(lx + 1, ly - 1, RAMPS.sheen[0]);         // a glint on the lit shoulder
    const out = outline(b);
    const [sx, sy] = [Math.round(rx + 2), Math.round(ry + 1)];
    const len = 13, P = RAMPS.pond;
    for (const spread of [-1, 0, 1]) {
      for (let k = 0; k < len; k++) {
        if ((k + frame * 2 + (spread + 1)) % 5 === 4) continue;                  // gaps that move down
        const x = sx + spread + Math.round(k * 0.25 + spread * k * 0.18), y = sy + k;
        out.set(x, y, k % 5 === (frame + 1) % 5 ? "cream" : P[spread < 0 ? 0 : 1]);
        if (!spread) out.set(x + 1, y, P[2]);                                     // the middle stream's shaded side
      }
    }
    const landX = sx + Math.round(len * 0.25), landY = sy + len;
    for (const [dx, dy] of [[[-3, -1], [3, -2]], [[-4, -2], [4, -1]], [[-2, -2], [3, -1]]][frame % 3]) out.set(landX + dx, landY + dy, "cream");   // drops leaping up where it lands
    return { canvas: out.toCanvas(), ax: landX, ay: landY, hand: { x: Math.round(h[1][0] + 2), y: Math.round(h[1][1] + 1) } };
  },

  breakfast(v) {
    const b = trayPicture(v & 15);
    const out = outline(b.buf);
    for (const [x, y, c] of b.steam) out.set(x + 1, y + 1, c);                  // steam: soft, no outline
    const desk = v & 16;
    return { canvas: out.toCanvas(), ax: b.ax + 1 + (desk ? 6 : 0), ay: b.ay + 1 + (desk ? 14 : 6) };
  },

  riceGrains(v) {
    const b = new PixelBuffer(14, 7);
    const grains = [[5, 3, 0], [9, 2, 1], [2, 5, 0], [11, 5, 0], [7, 1, 1], [7, 5, 0], [3, 2, 1], [12, 2, 0], [9, 5, 1]];
    const S = RAMPS.snow;
    for (const [x, y, up] of grains.slice(0, [9, 5, 2][v] || 9)) {
      if (up) { b.set(x, y, S[1]); b.set(x, y + 1, S[3]); }
      else { b.set(x, y, S[0]); b.set(x + 1, y, S[3]); }
    }
    return { canvas: b.toCanvas(), ax: 7, ay: 6 };
  },

  breadCrumbs(v) {
    const b = new PixelBuffer(14, 7);
    const crumbs = [[5, 3, 2], [9, 1, 1], [1, 4, 1], [11, 4, 2], [7, 5, 1], [3, 1, 1], [12, 1, 1], [8, 3, 1]];
    for (const [x, y, s] of crumbs.slice(0, [8, 5, 2][v] || 8)) {
      if (s === 2) { b.set(x, y, BREAD[0]); b.set(x + 1, y, BREAD[1]); b.set(x, y + 1, BREAD[1]); b.set(x + 1, y + 1, BREAD[2]); }
      else { b.set(x, y, BREAD[1]); b.set(x + 1, y, BREAD[2]); }
    }
    return { canvas: b.toCanvas(), ax: 7, ay: 6 };
  },

  crowFeatherFalling(v, frame = 0) {
    return crowFeatherSprite(1 + (frame % 4));
  },

  beakFlower() {
    const icon = {
      colors: { P: "petalPink", W: "cream", S: "#cf829d", Y: "beeYellow", L: "leaf", G: "#579064" },
      grid: [
        ".....PPP.",
        "....PWPPS",
        "LLLLPPYPS",
        "..G.PPPSS",
        ".GG..PSS.",
      ],
    };
    return { canvas: iconFromGrid(icon).toCanvas(), ax: 1, ay: 3 };
  },
});

const CROW_SHEEN = "#4A4679";
function crowFeatherSprite(frame) {
  const angle = [-0.3, -0.5, -0.15, 0.2, 0.5][frame] ?? -0.3;
  const W = 20, H = 13, cx = 10, cy = 6.5;
  const b = new PixelBuffer(W, H);
  const c = Math.cos(angle), s = Math.sin(angle);
  b.rotEllipse(cx, cy, 8, 2, angle, "ink");
  b.set(Math.round(cx + c * 3.5 - s * 1.8), Math.round(cy + s * 3.5 + c * 1.8), null);
  b.line(cx - c * 8.5, cy - s * 8.5 + 0.3, cx + c * 7.5, cy + s * 7.5 - 0.3, 1, RAMPS.ink[0], { onlyFilled: true });
  for (const k of [-3, 1]) b.set(Math.round(cx + c * k + s * 1.1), Math.round(cy + s * k - c * 1.1), CROW_SHEEN);
  const out = outline(b);
  if (frame === 0) {
    const qx = Math.round(cx - c * 9.2) + 1, qy = Math.round(cy - s * 9.2) + 1;
    out.set(qx, qy, RAMPS.duskLavender[2]); out.set(qx - 1, qy - Math.sign(s), RAMPS.duskLavender[2]);
  }
  return { canvas: out.toCanvas(), ax: Math.round(cx) + 1, ay: frame === 0 ? Math.round(cy) + 3 : Math.round(cy) + 1 };
}

const crowNightCache = {};
function crowFeatherNight(frame = 0) {
  const f = ((frame % 4) + 4) % 4;
  if (crowNightCache[f]) return crowNightCache[f];
  const day = crowFeatherSprite(1 + f);
  const c = nightBird(day.canvas);
  const darker = { [PALETTE.starBand]: PALETTE.starFaint, [PALETTE.starFaint]: PALETTE.night3, [PALETTE.night3]: PALETTE.night2, [PALETTE.night2]: PALETTE.night1 };
  const g = c.getContext("2d"), img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const map = Object.fromEntries(Object.entries(darker).map(([k, v]) => [k.toLowerCase(), hexToRgb(v)]));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const to = map[rgbToHex([d[i], d[i + 1], d[i + 2]]).toLowerCase()];
    if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2]; }
  }
  g.putImageData(img, 0, 0);
  const lit = moonlit(c, null, PALETTE.starBand, { maxY: day.canvas.height });
  return (crowNightCache[f] = { canvas: lit, ax: day.ax, ay: day.ay });
}

function drawCrowFeatherFalling(ctx, x, y, time, night = true) {
  const k = [0, 1, 2, 3, 2, 1][Math.floor(time * 3) % 6];
  const s = night ? crowFeatherNight(k) : prop("crowFeatherFalling", 0, k);
  ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - s.ay));
}

function drawBathFront(ctx, x, y, variant = 0) {
  const s = prop("birdBath", variant);
  ctx.drawImage(s.front, Math.round(x - s.ax), Math.round(y - s.ay));
}

function drawBathSplash(ctx, x, y, frame = 0) {
  const s = prop("bathSplash", 0, ((frame % 3) + 3) % 3);
  ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - 14 - s.ay));
}

function drawCanPouring(ctx, x, y, frame = 0, faceLeft = false) {
  const s = prop("wateringCanPour", 0, ((frame % 3) + 3) % 3);
  const X = Math.round(x), Y = Math.round(y);
  ctx.save();
  if (faceLeft) { ctx.translate(X + s.ax, Y - s.ay); ctx.scale(-1, 1); }
  else ctx.translate(X - s.ax, Y - s.ay);
  ctx.drawImage(s.canvas, 0, 0);
  ctx.restore();
  return { x: faceLeft ? X + s.ax - s.hand.x : X - s.ax + s.hand.x, y: Y - s.ay + s.hand.y };
}

const TRAY_ITEMS = ["rice", "bread", "cup", "sweet"];
function trayVariant(left = TRAY_ITEMS, onDesk = false) {
  return TRAY_ITEMS.reduce((v, item, i) => (left.includes(item) ? v : v | (1 << i)), 0) + (onDesk ? 16 : 0);
}

const YAKGWA = ["#F2BD74", "#D08A3E", "#A5602F", "#8A4C27"];
function trayPicture(taken = 0) {
  const W = 18, H = 17;
  const b = new PixelBuffer(W, H);
  const T = RAMPS.onggi;
  b.polygon([[1.5, 7], [16.5, 7], [17.5, 8], [17.5, 13], [0.5, 13], [0.5, 8]], T[1], { flat: true });
  b.rect(1.5, 7, 15, 1, T[0], { flat: true });
  b.rect(0.5, 13, 17, 1, T[2], { flat: true });
  b.rect(0.5, 14, 17, 1, T[3], { flat: true });
  for (const [x, dx] of [[2, -1], [15, 1]]) { b.set(x, 15, "bark"); b.set(x + dx, 16, "bark"); b.set(x + 1, 15, RAMPS.bark[2]); }

  const dishes = [];
  const dish = (draw) => { const d = new PixelBuffer(W, H); draw(d); dishes.push(d); };
  if (!(taken & 1)) dish((d) => {                                              // the rice bowl (back left)
    d.ellipse(5, 4.2, 3.4, 3, "snow", { clip: (x, y) => y < 4 });             // a heaped dome of rice
    d.rect(1.5, 4, 7, 1, RAMPS.celadon[0], { flat: true });                   // the bowl's lit rim
    d.polygon([[1.8, 5], [8.2, 5], [7, 8.2], [3, 8.2]], "celadon");
    d.set(4, 2, RAMPS.snow[2]); d.set(6, 3, RAMPS.snow[2]); d.set(3, 3, "#FFFFFF");     // grains
  });
  if (!(taken & 4)) dish((d) => {                                              // the cup of barley tea (back right)
    d.rect(10.5, 4, 5, 4.2, "snow");
    d.rect(10.5, 6, 5, 1, "pond", { flat: true, onlyFilled: true });           // a blue band
    d.rect(11.5, 4, 3, 1, "#C98A4B", { flat: true });                          // amber tea
    d.set(15, 5, RAMPS.snow[2]); d.set(15, 6, RAMPS.snow[2]);                   // its handle
  });
  if (!(taken & 2)) dish((d) => {                                              // the bun (front left)
    d.ellipse(6, 10.5, 3.7, 2.4, BREAD[1]);
    d.set(5, 9, BREAD[0]); d.set(6, 9, BREAD[0]); d.set(7, 10, BREAD[0]);       // its score, catching the light
  });
  if (!(taken & 8)) dish((d) => {                                              // the 약과 (front right)
    d.ellipse(13, 11.3, 3.3, 1.7, YAKGWA[1]);
    for (const x of [10, 16]) d.set(x, 10, null);                             // scalloped, like a flower
    d.set(13, 9, null);
    d.ellipse(13.3, 11.5, 1.6, 0.8, YAKGWA[2], { flat: true, onlyFilled: true });
    d.set(11, 10, YAKGWA[0]); d.set(12, 10, YAKGWA[0]); d.set(13, 11, "cream");   // glaze, and a pine nut
  });
  for (const d of dishes) {
    const o = outline(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inside = d.get(x, y), edge = o.get(x + 1, y + 1);
      if (inside) b.set(x, y, inside);
      else if (edge && b.get(x, y)) b.set(x, y, edge);          // outlined only against what's behind it
    }
  }
  const steam = [];                                   // (cold barley tea, 보리차, as it's drunk in summer: no steam)
  return { buf: b, ax: Math.floor(W / 2), ay: H - 1, steam };
}

(function () {
  const b = trayPicture(0).buf, colors = {}, letters = {}, grid = [];
  const names = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let n = 0;
  for (let y = 0; y < b.h; y++) {
    let row = "";
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (!c) { row += "."; continue; }
      if (!letters[c]) { letters[c] = names[n++]; colors[letters[c]] = c; }
      row += letters[c];
    }
    grid.push(row);
  }
  while (grid.length && !/[^.]/.test(grid[0])) grid.shift();
  window.ICONS.tray = { colors, grid };
})();

function beakTip(bird, pose = "stand") {
  const L = bird.tail.length;
  const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6, hr = bird.headR || 5.4;
  const beakLen = bird.beakLen || 2.4, beakH = bird.beakH || 2.4;
  const ox = Math.max(0, Math.ceil(L + 4.5 - 10)) + (pose === "fly1" ? 6 : 0);
  const bx = ox + 10, by = +(1.4 * hr + 1.1 * ry).toFixed(1);
  let hx = bx + rx * 0.77, hy = by - ry * 1.22;
  const peck = pose === "peck";
  if (peck) { hx += 1.5; hy += 3; }
  const bxp = hx + hr * 0.85, byp = hy - beakH * 0.25;
  if (peck) return { x: Math.floor(bxp + beakLen * 0.2) + 1, y: Math.floor(byp + beakH * 0.75) + 1 };
  return { x: Math.floor(bxp + beakLen * 0.35) + 1, y: Math.floor(byp + beakH * 0.5) + 1 };
}

function drawBeakFlower(ctx, footX, footY, faceLeft = false, pose = "stand", bird = BIRDS.magpie) {
  drawInBeak(ctx, "flower", footX, footY, faceLeft, pose, bird);
}

function drawInBeak(ctx, what, footX, footY, faceLeft = false, pose = "stand", bird = BIRDS.magpie, { night = false } = {}) {
  const s = renderBird(bird, pose), tip = beakTip(bird, pose);
  if (night && what !== "crowFeather") return;
  const f = what === "flower" ? prop("beakFlower") : what === "persimmon" ? prop("beakPersimmon")
    : what === "plum" ? prop("beakPlum") : what === "crowFeather" ? (night ? beakCrowFeatherNight() : prop("beakCrowFeather")) : null;
  let sprite = f;
  if (!sprite) {
    if (!ICONS[what]) return;
    const c = iconFromGrid(ICONS[what]).toCanvas();
    sprite = { canvas: c, ax: Math.floor(c.width / 2), ay: 1 };
  }
  const x = faceLeft ? footX + s.footX - tip.x : footX - s.footX + tip.x, y = footY - s.footY + tip.y;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) - sprite.ay);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, -sprite.ax, 0);
  ctx.restore();
}

Object.assign(PROP_RENDERERS, {
  beakPersimmon() {
    const icon = {
      colors: { P: "persimmon", H: "#F9C07E", L: "leafGold", S: "bark" },
      grid: [
        "..S...",
        ".LSL..",
        ".PPPP.",
        "PHPPPP",
        "PPPPPP",
        "PPPPPP",
        ".PPPP.",
      ],
    };
    return { canvas: iconFromGrid(icon).toCanvas(), ax: 3, ay: 1 };
  },
  beakPlum() {
    const icon = {
      colors: { P: "#A4476F", p: "#853A5E", c: "#6E2E4E", H: "#E9A9C5", S: "bark" },
      grid: [
        "..S.",
        ".PPP",
        "PHPc",
        "PPpc",
        ".pp.",
      ],
    };
    return { canvas: iconFromGrid(icon).toCanvas(), ax: 3, ay: 1 };
  },
  beakCrowFeather() {
    const s = crowFeatherSprite(4);                     // (tipped down and forward: its quill end is up at the left)
    return { canvas: s.canvas, ax: 3, ay: 3 };
  },
});
let beakFeatherNight = null;
function beakCrowFeatherNight() {
  return beakFeatherNight || (beakFeatherNight = { canvas: crowFeatherNight(3).canvas, ax: 3, ay: 3 });
}

const SOIL = "#A7805F", SOIL_WET = "#7E5E48";

function plotSprite({ stage = 0, wet = false, species = null, color = null, frame = 1, tall = null } = {}) {
  const sp = species && FLOWERS[species];
  if (tall === null) tall = !!(sp && sp.size === "tall");
  if (sp && !color) color = sp.colors[0];
  const key = `plot/${stage}/${wet ? 1 : 0}/${tall ? 1 : 0}/${species}/${color}/${stage === 5 ? frame : 1}`;
  if (propCache[key]) return propCache[key];
  const H = 40, b = new PixelBuffer(16, H), top = H - 11;                          // (the bed: its back board at top)
  const S = rampFor(wet ? SOIL_WET : SOIL), W = RAMPS.wood;
  b.rect(1, top, 14, 1.5, "wood", { flat: true });
  b.rect(1, top, 1.5, 9, W[1], { flat: true });
  b.rect(13.5, top, 1.5, 9, W[2], { flat: true });
  b.rect(1, top + 7, 14, 3, "wood");
  b.rect(1, top + 7, 14, 1, W[0], { flat: true });                                 // its lit top edge
  b.set(4, top + 8, W[2]); b.set(9, top + 9, W[2]); b.set(12, top + 8, W[2]);      // grain
  for (let y = top + 1.5; y < top + 7; y++) {
    const row = Math.floor(y - top - 1.5);
    const band = row % 2 === 0 ? 0 : row === 5 ? 3 : 2;
    b.rect(2.5, y, 11, 1, row === 0 ? S[2] : S[band === 0 ? 1 : band], { flat: true });
  }
  for (let x = 3; x < 13; x += 3) b.set(x + (top % 2), top + 2, S[0]);             // clods catching the light
  if (wet) for (const [x, y] of [[5, top + 4], [10, top + 2], [11, top + 5]]) b.set(x, y, RAMPS.pond[0]);   // a wet shine
  const cx = 8, soilY = top + 4.5;                                                  // where it grows
  const L = RAMPS.leaf;
  if (stage === 1) {
    for (const x of [4.5, 7.5, 10.5]) { b.set(x, top + 4, RAMPS.cream[2]); b.set(x + 1, top + 4, S[3]); }
    b.rect(12, top - 3, 1, 5, W[1], { flat: true });
    b.rect(11, top - 4, 3, 2, "cream", { flat: true });
    if (color) b.set(12, top - 4, rampFor(color)[1]);
  }
  if (stage === 2) {
    for (const [x, h] of [[5, 3], [10, 4]]) {
      b.rect(x, soilY - h, 1, h, L[1], { flat: true });
      b.rect(x - 2, soilY - h - 1, 2, 1.5, L[0], { flat: true });
      b.rect(x + 1, soilY - h - 1, 2, 1.5, L[1], { flat: true });
    }
  }
  if (stage === 3 || stage === 4) {
    if (tall) {
      b.line(cx, soilY, cx, soilY - 13, 1.4, "leaf", { flat: false });
      for (const [y, s] of [[soilY - 3, -1], [soilY - 7, 1], [soilY - 10, -1]]) {
        b.rotEllipse(cx + s * 2.6, y, 2.6, 1.1, s * 0.5, "leaf");
      }
    } else {
      for (const [x, y, rx, ry, a] of [[5.2, soilY - 2.6, 2.7, 1.2, -0.5], [10.8, soilY - 2.6, 2.7, 1.2, 0.5], [6.8, soilY - 4.6, 2.2, 1, -1.1], [9.4, soilY - 4.8, 2.2, 1, 1.1], [8, soilY - 1.2, 3, 1.3, 0]]) {
        b.rotEllipse(x, y, rx, ry, a, "leaf");
      }
    }
    if (stage === 4) {
      const budY = tall ? soilY - 15 : soilY - 7;
      b.line(cx, budY + 3, cx, budY + 1, 1, "leaf");
      b.ellipse(cx + 0.5, budY, 1.6, 2.1, "leaf");
      if (color) { b.set(cx, budY - 2, rampFor(color)[1]); b.set(cx, budY - 1, rampFor(color)[2]); }
    }
  }
  let out = outline(b);
  if (stage === 5 && sp) {
    const f = renderFlower(species, color, 0), fc = f.frames[frame] || f.frames[1];
    const c = out.toCanvas(), g = c.getContext("2d");
    g.drawImage(fc, 1 + cx - 8, 1 + Math.round(soilY) + 1 - f.h + 1);
    return (propCache[key] = { canvas: c, ax: 8 + 1, ay: top + 9 + 1 });
  }
  return (propCache[key] = { canvas: out.toCanvas(), ax: 8 + 1, ay: top + 9 + 1 });
}

Object.assign(PROP_RENDERERS, {
  gardenPlot(v, frame = 1) {
    return plotSprite({ stage: v & 7, wet: !!(v & 8), tall: !!(v & 16), frame });
  },

  skipPebble(v, frame = 0) {
    const b = new PixelBuffer(5, 3);
    b.ellipse(2.5, 1.5, 2.5, 1.5, "#9E9AB0");
    const R = rampFor("#9E9AB0"), lit = [[1, 0], [2, 0], [3, 0], [3, 1]][frame % 4];
    b.set(lit[0], lit[1], R[0]);
    return finish(b, 2, 2);
  },

  skipSplash(v, frame = 0) {
    const b = new PixelBuffer(24, 14);
    const cx = 12, cy = 10, P = RAMPS.pond;
    const drops = v === 1
      ? [[[0, -3, 2]], [[0, -6, 2], [0, -3, 1]], [[0, -5, 1]], []][frame % 4]
      : [[[-2, -2, 1], [2, -2, 1], [0, -3, 2]], [[-4, -4, 2], [4, -4, 2], [0, -6, 1]], [[-6, -2, 1], [6, -1, 1], [-1, -4, 1]], []][frame % 4];
    for (const [dx, dy, s] of drops) {
      const x = cx + dx, y = cy + dy;
      if (s === 1) { b.set(x, y, P[0]); continue; }
      b.set(x, y, "cream"); b.set(x + 1, y, P[0]); b.set(x, y + 1, P[0]); b.set(x + 1, y + 1, P[1]);
    }
    const out = outline(b);
    const r = (v === 1 ? [2, 4, 6, 8] : [2, 3.5, 5, 6.5])[frame % 4];
    for (let a = 0; a < 20; a++) {
      const ang = (a / 20) * Math.PI * 2;
      if (r < 3 && Math.abs(Math.sin(ang)) > 0.8) continue;                        // it opens as "( )"
      if (frame % 4 === 3 && a % 2) continue;                                      // fading
      const x = Math.round(cx + 1 + Math.cos(ang) * r), y = Math.round(cy + 1 + Math.sin(ang) * r * 0.45);
      if (!out.get(x, y)) out.set(x, y, frame % 4 < 2 ? "cream" : P[0]);
    }
    return { canvas: out.toCanvas(), ax: cx + 1, ay: cy + 1 };
  },
});

function drawSkipPebble(ctx, x, y, frame = 0) {
  const s = prop("skipPebble", 0, ((frame % 4) + 4) % 4);
  ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - s.ay));
}
function drawSkipSplash(ctx, x, y, frame = 0, sink = false) {
  const s = prop("skipSplash", sink ? 1 : 0, Math.max(0, Math.min(3, frame)));
  ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - s.ay));
}

const VISITOR_FRUIT = { apple: "#D6DE78", appleBlush: "#EE9580", plum: "#A4476F", plumBloom: "#E9A9C5", plumCrease: "#6E2E4E" };
function plumFruit(b, x, y) {
  b.ellipse(x, y, 1.8, 2.2, VISITOR_FRUIT.plum, { shadeAs: [x, y, 1.8, 2.2] });
  b.set(Math.round(x - 1), Math.round(y - 1), VISITOR_FRUIT.plumBloom);
  b.set(Math.round(x + 0.6), Math.round(y - 0.4), VISITOR_FRUIT.plumCrease);
  b.set(Math.round(x + 0.6), Math.round(y + 0.6), VISITOR_FRUIT.plumCrease);
  b.set(Math.round(x), Math.round(y - 2.6), "bark");
}
function visitorFruit(b, x, y, r, color, mark, markAt, blush = null) {
  const box = [x, y, r, r];
  b.circle(x, y, r, color, { shadeAs: box });
  if (blush) b.ellipse(x + r * 0.4, y + r * 0.35, r * 0.7, r * 0.65, blush, { onlyFilled: true, shadeAs: box });
  b.set(Math.round(x - r * 0.45), Math.round(y - r * 0.45), rampFor(color)[0]);
  if (mark) b.set(Math.round(x + markAt[0]), Math.round(y + markAt[1]), mark);
  b.set(Math.round(x), Math.round(y - r - 0.4), "bark");
}
Object.assign(PROP_RENDERERS, {
  appleTree(v) {
    const b = new PixelBuffer(50, 60);
    trunk(b, 25, 36, 59, 6.5);
    b.line(24, 43, 14, 33, 2.2, "bark", { flat: false });
    b.line(26, 42, 37, 32, 2.2, "bark", { flat: false });
    clumpCanopy(b, 25, 24, 21, 17, "leaf", 64, { clump: 5 });
    for (const [x, y] of [[12, 28], [31, 17], [38, 29], [19, 16], [26, 31], [18, 35]].slice(0, 6 - Math.min(3, v))) {
      visitorFruit(b, x, y, 2.8, VISITOR_FRUIT.apple, null, null, VISITOR_FRUIT.appleBlush);
    }
    return finish(b, 25, 59);
  },

  plumTree(v) {
    const b = new PixelBuffer(52, 62);
    trunk(b, 26, 37, 59, 6);
    b.line(25, 44, 15, 34, 2.1, "bark", { flat: false });
    b.line(27, 43, 38, 35, 2.1, "bark", { flat: false });
    clumpCanopy(b, 26, 25, 20, 18, "hedge", 71, { clump: 4.6 });
    for (const [x, y] of plumFruits()) plumFruit(b, x, y);
    const fallen = [[10, 59.2], [40, 59.6], [33, 60.6]].slice(0, v ? 4 - Math.min(3, v) : 0);
    for (const [x, y] of fallen) {
      b.ellipse(x, y, 2.1, 1.5, VISITOR_FRUIT.plum);
      b.set(Math.round(x - 1), Math.round(y - 1), VISITOR_FRUIT.plumBloom);
      b.set(Math.round(x + 1), Math.round(y), VISITOR_FRUIT.plumCrease);
    }
    return finish(b, 26, 59);
  },

  dish(v) {
    const b = new PixelBuffer(14, 8);
    b.ellipse(7, 4.3, 6.2, 2.9, "snow");                                    // the dish's side, white porcelain
    b.rect(2, 5, 10, 1, "#8DA6D6", { onlyFilled: true, flat: true });       // with a blue band round it
    b.ellipse(7, 3.4, 6.1, 2.5, RAMPS.snow[0], { flat: true });             // its rim
    b.ellipse(7, 3.6, 4.7, 1.7, v ? "pond" : "#DCD6E6", { flat: !v });      // inside: bare, or water
    if (v) { b.set(5, 3, "cream"); b.set(6, 3, "cream"); b.set(9, 4, RAMPS.pond[0]); }
    else b.rect(3, 3, 8, 1, RAMPS.snow[3], { onlyFilled: true, flat: true }); // the far inside wall, in shade
    return finish(b, 7, 7);
  },
});
