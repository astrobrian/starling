
const keepsakeCache = {};
function keepsake(key, make) {
  return keepsakeCache[key] || (keepsakeCache[key] = make());
}
const asCard = (buf) => ({ canvas: buf.toCanvas(), w: buf.w, h: buf.h, buf });

function paintBy(b, paint) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const c = paint(x + 0.5, y + 0.5, x, y);
    if (c) b.set(x, y, c);
  }
  return b;
}

function iconFromBuffer(buf) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", colors = {}, of = {}, grid = [];
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    let row = "";
    for (let x = 0; x < buf.w; x++) {
      const c = buf.get(x, y);
      if (!c) { row += "."; continue; }
      if (!of[c]) { of[c] = letters[n++]; colors[of[c]] = c; }
      row += of[c];
    }
    grid.push(row);
  }
  return { colors, grid };
}

function featherBird(id) {
  if (BIRDS[id]) return id;
  const page = window.FIELD_GUIDE && FIELD_GUIDE.birds && FIELD_GUIDE.birds[id];
  if (page && (page.portrait || (page.species && page.species[0]))) return page.portrait || page.species[0];
  return Object.keys(BIRDS).find((k) => (BIRDS[k].name || "").toLowerCase() === String(id).toLowerCase()) || "sparrow";
}

function featherOverride(id, key) {
  const pages = window.FIELD_GUIDE && FIELD_GUIDE.birds;
  if (!pages) return null;
  if (pages[id] && pages[id].feather) return pages[id].feather;
  const owner = Object.values(pages).find((p) => p && p.feather && p.species && p.species.includes(key));
  return owner ? owner.feather : null;
}

function featherLook(id) {
  const key = featherBird(id), B = BIRDS[key] || {}, tail = B.tail || {};
  const tl = tail.length || 5, dark = (c) => c && lightness(paletteColor(c)) < 0.35;
  let f;
  if (B.fuzzy || B.chick) f = { kind: "down", color: B.head || B.body, base: B.body, length: 9 };
  else if (B.plumes) f = { kind: "plume", color: B.body, length: 17, width: 2.6 };
  else if (B.speculum) f = { color: B.speculum, inner: B.wing, tip: "snow", tipLine: "ink", length: 13 };
  else if (B.wingPanel) f = { color: B.wingPanel.color, bars: B.wingPanel.bars, barGap: 2.4, tip: B.wingPanel.bars, length: 13 };
  else if (tail.bars) f = { color: tail.color, bars: tail.bars, kind: tl >= 12 ? "pointed" : "quill", spot: tail.spots, mottle: B.mottle,
    length: tl >= 15 ? 19 : tl >= 9 ? 15 : 13, width: tl >= 15 ? 2.5 : 2.8 };
  else if (B.wingSpots) f = { color: B.wing, spots: B.wingSpots, length: 14 };
  else if (B.gloss) f = { color: B.body, gloss: B.gloss, length: 15, width: 3 };
  else if (B.wingScales) f = { color: B.wing, center: B.wingScales, length: 12, width: 3.1 };
  else if (tail.fork) f = { color: tail.color, spot: "snow", kind: "pointed", length: 16, width: 2.4 };
  else if (B.wingPatch && B.wingTip && !dark(B.wingTip)) f = { color: B.wing, gloss: B.wingTip, inner: B.wingPatch, tip: B.wing, length: 15 };
  else if (B.shape === "owl") f = { color: B.body, bars: rampFor(B.body)[3], soft: true, length: 13, width: 3.1 };
  else if (B.shape === "grebe") f = { color: B.body, inner: B.rear, soft: true, length: 11, width: 3 };
  else if (B.shape === "cormorant") f = { color: B.body, edge: B.wingEdge, length: 15 };
  else if (B.shape === "wader") f = { color: B.wing || B.body, tip: B.crest && dark(B.crest) ? B.crest : null, edge: B.crest && !dark(B.crest) ? B.crest : null, length: 16, width: 2.6 };
  else {
    const color = B.wing || tail.color || B.body;
    f = { color, center: tail.color && tail.color !== color ? tail.color : null, tip: B.wingBar || null,
      length: Math.round(12 + Math.max(0, Math.min(3, (tl - 4) * 0.5))) };
  }
  return { length: 13, width: 2.8, ...f, ...(featherOverride(id, key) || {}) };
}

function featherBuffer(look, angle, raw = false) {
  const L = look.length, W = look.width, kind = look.kind || "quill";
  const c = Math.cos(angle), s = Math.sin(angle);
  const pad = W + 2, ex = c * L, ey = s * L;
  const bx = pad - Math.min(0, ex), by = pad - Math.min(0, ey);
  const b = new PixelBuffer(Math.ceil(Math.abs(ex) + 2 * pad), Math.ceil(Math.abs(ey) + 2 * pad));
  const q0 = kind === "down" ? 0.4 : 0.17;                                          // the bare quill
  const frame = (x, y) => { const dx = x - bx, dy = y - by; return [(dx * c + dy * s) / L, -dx * s + dy * c]; };
  const vane = paletteColor(look.color), light = lightness(vane);
  const shaftColor = look.shaft || (light < 0.25 ? RAMPS.duskLavender[2] : light > 0.85 ? rampFor(look.color)[2] : mix(vane, CREAM, 0.6));
  const quill = [];

  if (kind === "down") {
    const cx = bx + c * L * 0.62, cy = by + s * L * 0.62, R = L * 0.42;
    const top = rampFor(look.color), base = rampFor(look.base || look.color);
    paintBy(b, (x, y, px, py) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const edge = R * (0.72 + 0.4 * hash2(Math.round((a + 4) * 2.6), 3, 17));
      if (d > edge) return null;
      if (d > edge - 1 && (px + py) % 2) return null;                                  // wispy ends
      const lit = dx * -0.5 + dy * -0.85;
      if (d < R * 0.35) return base[1];
      return lit > R * 0.25 ? top[0] : lit < -R * 0.35 ? top[2] : top[1];
    });
    for (let u = 0; u < 0.3; u += 0.5 / L) quill.push([bx + c * u * L, by + s * u * L]);
  } else {
    const plume = kind === "plume", pointed = kind === "pointed" || plume;
    const lead = look.lead ?? (plume ? 0.9 : 0.72);
    const notchAt = 0.55 + (hash2(L, W * 10, 5) - 0.5) * 0.1;
    paintBy(b, (x, y) => {
      const [u, t] = frame(x, y);
      if (u < 0 || u > 1.02) return null;
      if (u < q0) { if (Math.abs(t) < 0.55) quill.push([x - 0.5, y - 0.5]); return null; }
      const v = (u - q0) / (1 - q0);                               // 0 at the vane's base, 1 at its tip
      const rise = Math.sin((Math.min(1, v / 0.22) * Math.PI) / 2);
      const taper = pointed ? Math.max(0, 1 - Math.pow(Math.max(0, (v - 0.25) / 0.75), 1.1))
        : Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (v - 0.42) / 0.6), 2)));
      const half = W * rise * taper, out = half * lead;
      if (t > half || t < -out || half < 0.35) return null;
      const fringe = hash2(Math.floor(x), Math.floor(y), 9) > 0.5;
      if (look.soft && t > half - 1 && fringe) return null;                         // a soft, fringed edge
      if (plume && (t > half - 1.1 || t < -out + 1.1) && (Math.floor(x) + Math.floor(y)) % 2 && v > 0.15) return null;   // lacy barbs, both sides
      if (!pointed && L >= 10 && t > half * 0.35 && Math.abs((v - notchAt) * L - t * 0.7) < 0.45) return null;
      const along = v * (L * (1 - q0));
      let col = t < 0 ? look.outer || look.color : look.inner || look.color;
      if (look.center && Math.abs(t) < W * 0.4 && v < 0.88) col = look.center;
      if (look.gloss && t < -0.4) col = look.gloss;
      if (look.bars && v > 0.1 && Math.floor((along + Math.abs(t) * 0.7) / (look.barGap || 2.5)) % 2 === 1) col = look.bars;
      if (look.spots && v > 0.12 && v < 0.9 && Math.abs(t) > (t < 0 ? out : half) * 0.4 && Math.floor(along / 2.2) % 2 === 1) col = look.spots;
      if (look.mottle && hash2(Math.round(x), Math.round(y), 23) > 0.8) col = look.mottle[hash2(Math.round(x), Math.round(y), 24) > 0.5 ? 0 : 1];
      if (look.edge && t > half - 1.05) col = look.edge;
      if (look.tip && v > (pointed ? 0.86 : 0.8)) col = look.tip;
      else if (look.tipLine && v > 0.72 && v <= 0.8) col = look.tipLine;
      if (look.spot && v > 0.6 && v < 0.74 && t > half * 0.15) col = look.spot;
      const R = rampFor(col) || rampFor(look.color);
      let band = 1;
      if (t < -out + 0.9) band = 0;
      else if (t > half * 0.6) band = v < 0.2 ? 3 : 2;
      if (Math.abs(t) < 0.6 && v < 0.8) return shaftColor;
      return R[band];
    });
  }
  const Q = rampFor(shaftColor) || RAMPS.cream;
  if (raw) {                                                                         // (for an icon grid: outlined later)
    for (const [x, y] of quill) if (!b.get(Math.floor(x), Math.floor(y))) b.set(Math.floor(x), Math.floor(y), Q[1]);
    return trimBuffer(b);
  }
  const out = outline(b);
  for (const [x, y] of quill) if (!b.get(Math.floor(x), Math.floor(y))) out.set(Math.floor(x) + 1, Math.floor(y) + 1, Q[1]);
  return trimBuffer(out);
}

function trimBuffer(buf) {
  let x0 = buf.w, y0 = buf.h, x1 = -1, y1 = -1;
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) if (buf.get(x, y)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return buf;
  const out = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.px[(y - y0) * out.w + (x - x0)] = buf.get(x, y);
  return out;
}

function featherSprite(species) {
  return keepsake(`feather/${species}`, () => asCard(featherBuffer(featherLook(species), -0.95)));
}

const TAPE = "#DCD5EE", TAPE_EDGE = "#C6BDE2";

function pressedFlower(species, color) {
  return keepsake(`pressed/${species}/${color}`, () => {
    const sp = FLOWERS[species] || FLOWERS.daisy;
    const b = new PixelBuffer(16, 19);
    b.line(8, 18.5, 8.6, 9, 1, "leaf", { flat: false });
    b.rotEllipse(5.2, 14.2, 3, 1.2, -0.55, "leaf");
    b.rotEllipse(11, 16, 2.4, 1, 0.5, "leaf");
    const r = sp.shape === "sunflower" ? 6.2 : sp.shape === "cosmos" ? 5.6 : 5;
    if (sp.shape === "tulip") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.26;
        b.rotEllipse(8.4 + Math.cos(a) * r * 0.5, 7 + Math.sin(a) * r * 0.5, r * 0.52, r * 0.32, a, color, { shadeAs: [8.4, 7, r, r] });
      }
      b.circle(8.4, 7, 1.2, sp.center, { flat: true });
    } else drawBloom(b, sp, color, 8.4, 7, r);
    const paler = new Map();
    for (const name of [color, "leaf", sp.center]) {
      const R = rampFor(name);
      if (!R) continue;
      [mix(R[0], CREAM, 0.45), R[0], R[1], R[2]].forEach((p, k) => paler.set(R[k].toLowerCase(), p));
    }
    for (let i = 0; i < b.px.length; i++) if (b.px[i] && paler.has(b.px[i].toLowerCase())) b.px[i] = paler.get(b.px[i].toLowerCase());
    const out = outline(b);
    const before = out.px.slice();
    paintBy(out, (x, y, px, py) => {
      const u = (x - 9.2) * 0.94 + (y - 17.4) * 0.34, v = -(x - 9.2) * 0.34 + (y - 17.4) * 0.94;
      const end = 4.2 + (py % 2) * 0.7;                                    // its torn ends, zigzag
      if (Math.abs(u) > end || Math.abs(v) > 1.3) return null;
      const under = before[py * out.w + px], tape = v > 0.45 ? TAPE_EDGE : TAPE;
      return under ? mix(under, tape, 0.65) : tape;
    });
    return asCard(out);
  });
}

function plantFlower(plant) {
  const p = window.PLANTS && PLANTS[plant];
  if (p && p.grows && FLOWERS[p.grows[0]]) return p.grows;
  if (FLOWERS[plant]) return [plant, FLOWERS[plant].colors[0]];
  return null;
}

function packetBuffer(plant, small = false) {
  const flower = plantFlower(plant);
  if (!flower) {
    const b = new PixelBuffer(small ? 5 : 7, small ? 7 : 10);
    const w = b.w, h = b.h;
    b.ellipse(w / 2, h / 2, w / 2 - 0.2, h / 2 - 0.2, "#E9DDBF");
    b.ellipse(w / 2 + 0.3, h / 2 + 0.3, w / 2 - 1.6, h / 2 - 1.8, "#F6EDD6", { flat: true });
    b.set(Math.floor(w / 2), 0, null);
    return b;
  }
  const [species, color] = flower, sp = FLOWERS[species];
  if (small) {
    const b = new PixelBuffer(6, 8);
    b.rect(0, 1, 6, 7, "cream");
    b.rect(0, 0, 6, 1.5, RAMPS.cream[2], { flat: true });                         // the folded top
    b.rect(1, 2.5, 4, 3, color);                                                   // its flower
    b.set(1, 2, null); b.set(4, 5, rampFor(color)[2]);
    b.rect(0, 6.5, 6, 1, rampFor(color)[1], { flat: true });
    return b;
  }
  const b = new PixelBuffer(11, 14);
  b.rect(0, 1.5, 11, 12.5, "cream");
  b.rect(0, 0, 11, 2.5, RAMPS.cream[2], { flat: true });                          // the folded top
  for (let x = 0; x < 11; x += 2) b.set(x, 2, RAMPS.cream[3]);                   // (its crimped edge)
  b.rect(1.5, 3.5, 8, 7, "noonGlass2", { flat: true });                          // the picture: sky...
  b.rect(1.5, 9, 8, 1.5, RAMPS.meadowGreen[1], { flat: true });                  // ...and grass
  b.line(5.5, 10, 5.5, 7, 1, "leaf");
  b.set(6, 8, RAMPS.leaf[1]); b.set(4, 9, RAMPS.leaf[1]);
  const pic = new PixelBuffer(11, 14);
  drawBloom(pic, sp, color, 5.5, 6.2, sp.shape === "sunflower" ? 3 : 2.6);
  for (let y = 3; y < 11; y++) for (let x = 1; x < 10; x++) if (pic.get(x, y)) b.set(x, y, pic.get(x, y));
  b.rect(0, 11.5, 11, 2.5, color);                                               // its color, along the bottom
  b.rect(2, 12.3, 7, 1, rampFor(color)[0], { flat: true });                     // (a label line)
  return b;
}

function seedPacket(plant) {
  return keepsake(`packet/${plant}`, () => asCard(outline(packetBuffer(plant))));
}

function seedIcon(plant) {
  const name = `seeds:${plant}`;
  if (!ICONS[name]) ICONS[name] = iconFromBuffer(packetBuffer(plant, true));
  return name;
}

const SILVER = "#D3D5E2", BRASS = "#D8AE5C", SLATE = "#9E9AB0", GRANITE = "#D9CCB8", ROSE_STONE = "#CDB2BC";

function hole(b, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) b.set(x, y, null);
  }
}
const ACORN = "#B7CC6C", ACORN_CUP = "#A48F68";

const KEEPSAKE_ART = {
  shiny: {
    button() {
      const b = new PixelBuffer(9, 9), R = RAMPS.petalPink;
      b.circle(4.5, 4.5, 4.2, "petalPink");
      b.circle(4.6, 4.6, 2.7, R[2], { flat: true });
      b.circle(5, 5, 2, R[1], { flat: true, onlyFilled: true });
      for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]]) b.set(x, y, R[3]);
      b.set(2, 2, R[0]); b.set(1, 3, R[0]);
      return b;
    },
    marble() {
      const b = new PixelBuffer(8, 8), R = RAMPS.pond;
      b.circle(4, 4, 3.7, "pond");
      for (const [x, y, c] of [[2, 4, 1], [3, 5, 1], [4, 5, 2], [5, 4, 2], [5, 3, 1], [3, 3, 0]]) b.set(x, y, RAMPS.coral[c]);
      b.set(4, 3, RAMPS.butter[1]);
      b.set(2, 2, "#FFFFFF"); b.set(3, 1, RAMPS.cream[0]); b.set(1, 3, RAMPS.cream[0]);
      b.set(5, 6, R[0]); b.set(6, 5, R[0]);                                        // light through the glass
      return b;
    },
    bell() {
      const b = new PixelBuffer(9, 11), R = RAMPS.sunflower;
      b.circle(4.5, 1.8, 1.6, R[2], { flat: true });
      b.set(4, 1, null); b.set(4, 2, null);
      b.circle(4.5, 6.6, 4, "sunflower");
      for (let x = 2; x <= 6; x++) b.set(x, 7, R[3]);
      b.set(1, 7, R[3]); b.set(7, 7, R[3]);
      b.set(4, 8, R[3]); b.set(4, 9, R[3]);
      b.set(2, 4, "#FFFFFF"); b.set(3, 4, R[0]); b.set(2, 5, R[0]);
      return b;
    },
    key() {
      const b = new PixelBuffer(13, 7);
      b.circle(3, 3.5, 2.8, BRASS);
      hole(b, 3, 3, 1.15);                                                     // the hole in its bow
      b.rect(5.5, 3, 7, 1.5, BRASS);
      b.rect(10, 4.5, 1, 2, BRASS, { flat: true }); b.rect(12, 4.5, 1, 1.5, BRASS, { flat: true });
      b.set(1, 2, rampFor(BRASS)[0]); b.set(7, 3, rampFor(BRASS)[0]); b.set(8, 3, rampFor(BRASS)[0]);
      return b;
    },
    ring() {
      const b = new PixelBuffer(9, 9);
      b.circle(4.5, 5.2, 3.6, SILVER);
      hole(b, 4.5, 5.2, 2.1);
      b.circle(4.5, 1.8, 1.6, "petalPink");
      b.set(4, 1, "#FFFFFF");
      return b;
    },
  },
  stones: {
    banded() {
      const b = new PixelBuffer(11, 8);
      b.ellipse(5.5, 4, 5.2, 3.5, SLATE);
      b.polygon([[3.5, 0], [5.4, 0], [8, 8], [6.1, 8]], "snow", { onlyFilled: true, shadeAs: [5.5, 4, 5.2, 3.5] });
      b.set(2, 2, rampFor(SLATE)[0]); b.set(3, 1, rampFor(SLATE)[0]);
      return b;
    },
    speckled() {
      const b = new PixelBuffer(11, 8);
      b.ellipse(5.5, 4, 5.2, 3.5, GRANITE);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 11; x++) {
        if (!b.get(x, y)) continue;
        const h = hash2(x, y, 31);
        if (h > 0.84) b.set(x, y, "#6E6478");
        else if (h < 0.1) b.set(x, y, "#FFFFFF");
        else if (h < 0.18) b.set(x, y, "#B98F7A");
      }
      return b;
    },
    quartz() {
      const b = new PixelBuffer(10, 9);
      b.polygon([[2, 1], [7, 0.5], [9.6, 4], [8, 8.5], [2.5, 8.6], [0.4, 5]], "snow");
      b.polygon([[2, 1], [7, 0.5], [5.5, 4], [1.2, 4]], RAMPS.snow[0], { flat: true, onlyFilled: true });
      b.set(5, 4, RAMPS.starBright[1]); b.set(6, 5, RAMPS.starBright[1]); b.set(4, 5, "#EBD9E6");
      b.set(3, 2, "#FFFFFF");
      return b;
    },
    heart() {
      const b = new PixelBuffer(11, 10), whole = [5.5, 4.8, 5.4, 5];
      b.circle(3.2, 3.2, 2.9, ROSE_STONE, { shadeAs: whole });
      b.circle(7.8, 3.2, 2.9, ROSE_STONE, { shadeAs: whole });
      b.polygon([[0.4, 3.6], [10.6, 3.6], [5.5, 9.8]], ROSE_STONE, { shadeAs: whole });
      b.set(2, 2, "#FFFFFF"); b.set(3, 1, rampFor(ROSE_STONE)[0]);
      return b;
    },
  },
  acorns: {
    green() {
      const b = new PixelBuffer(16, 14);
      for (const [cx, cy, a, len] of [[7.2, 5.2, -0.6, 5], [11.6, 4, -1.3, 4]]) {
        const c = Math.cos(a), s = Math.sin(a);
        for (let k = 0; k <= 4; k++) {
          const u = (k / 4 - 0.5) * len, w = 1.35 * Math.sin(((k + 0.6) / 5.2) * Math.PI);
          b.circle(cx + c * u, cy + s * u, Math.max(0.8, w), "leaf", { shadeAs: [cx, cy, len * 0.6, len * 0.6] });
        }
        for (let k = -len * 0.45; k < len * 0.45; k += 0.5) b.set(cx + c * k, cy + s * k, RAMPS.leaf[2]);
      }
      b.line(1.5, 13, 10.5, 7, 1.3, "bark", { flat: false });                       // the twig
      b.set(1, 13, RAMPS.wood[0]); b.set(2, 12, RAMPS.wood[1]);                    // its clean cut end
      for (const [x, y] of [[10.8, 9.8], [13.6, 9]]) {
        b.ellipse(x, y + 0.6, 1.9, 2.5, ACORN);
        b.ellipse(x, y - 0.8, 2.1, 1.4, ACORN_CUP, { clip: (px, py) => py < y });
        b.set(Math.round(x - 1), Math.round(y - 1), rampFor(ACORN_CUP)[3]);
        b.set(Math.round(x + 1), Math.round(y - 1), rampFor(ACORN_CUP)[3]);
        b.set(Math.round(x - 1), Math.round(y + 1), rampFor(ACORN)[0]);
        b.set(Math.round(x), Math.round(y + 3), rampFor(ACORN)[2]);
      }
      return b;
    },
  },
};

const KEEPSAKE_KINDS = { feathers: "feather", flowers: "flower", seed: "seeds", stone: "stones", acorn: "acorns" };
function keepsakeParts(item) {
  const i = String(item).indexOf(":");
  const kind = i < 0 ? String(item) : item.slice(0, i), id = i < 0 ? "" : item.slice(i + 1);
  return [KEEPSAKE_KINDS[kind] || kind, id];
}

function keepsakeSprite(item) {
  return keepsake(`item/${item}`, () => {
    const [kind, id] = keepsakeParts(item);
    if (kind === "feather") return featherSprite(id);
    if (kind === "flower") {
      const [species, color] = id.split("-");
      return pressedFlower(species, color || (FLOWERS[species] && FLOWERS[species].colors[0]));
    }
    if (kind === "seeds") return seedPacket(id);
    const draw = KEEPSAKE_ART[kind] && KEEPSAKE_ART[kind][id];
    if (draw) return asCard(outline(draw()));
    console.warn(`keepsakes: no drawing for "${item}"`);
    return asCard(iconFromGrid(ICONS.sparkle));
  });
}

function keepsakeSilhouette(item) {
  return keepsake(`faint/${item}`, () => {
    const src = keepsakeSprite(item).buf, out = new PixelBuffer(src.w, src.h);
    const empty = (x, y) => !src.get(x, y);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      if (!empty(x, y) && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) out.set(x, y, RAMPS.duskLavender[0]);
    }
    return asCard(out);
  });
}

function keepsakeIcon(item) {
  if (ICONS[item]) return item;
  const [kind, id] = keepsakeParts(item);
  let icon = null;
  if (kind === "feather") {                                   // (a size smaller, to fit a thought bubble)
    const look = featherLook(id);
    icon = iconFromBuffer(featherBuffer({ ...look, length: Math.round(look.length * 0.8) }, -0.8, true));
  }
  else if (kind === "seeds") return seedIcon(id);
  else if (kind === "flower") {
    const [species, color] = id.split("-");
    if (FLOWERS[species]) icon = { ...iconFromBuffer(pressedFlower(species, color || FLOWERS[species].colors[0]).buf), bare: true };
  } else if (KEEPSAKE_ART[kind] && KEEPSAKE_ART[kind][id]) icon = iconFromBuffer(KEEPSAKE_ART[kind][id]());
  if (!icon) return null;
  ICONS[item] = icon;
  return item;
}

function groundSprite(item, where = "grass") {
  return keepsake(`ground/${item}/${where}`, () => {
    const [kind, id] = keepsakeParts(item);
    const pic = kind === "feather" ? featherBuffer(featherLook(id), -0.28) : null;
    const src = pic ? pic.toCanvas() : keepsakeSprite(item).canvas;
    const w = src.width + 2, h = src.height + 1;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.drawImage(src, 1, 0);
    if (where === "path") return { canvas: c, ax: Math.floor(w / 2), ay: h - 2 };
    const G = [RAMPS.grass[2], RAMPS.meadowGreen[1], RAMPS.grass[3]];
    for (let x = (hash2(w, h, 40) > 0.5 ? 0 : 1); x < w; x += 2) {
      if (hash2(x, w, 41) < 0.2) continue;
      const tall = Math.max(2, Math.min(5, Math.round(src.height * (0.22 + hash2(x, h, 42) * 0.22))));
      const lean = tall > 2 && hash2(x, 7, 43) > 0.6 ? (hash2(x, 8, 44) > 0.5 ? 1 : -1) : 0;
      for (let k = 0; k < tall; k++) {
        g.fillStyle = k === tall - 1 ? RAMPS.grass[0] : G[(x >> 1) % 3];
        g.fillRect(x + (k === tall - 1 ? lean : 0), h - 1 - k, 1, 1);
      }
    }
    return { canvas: c, ax: Math.floor(w / 2), ay: h - 2 };
  });
}

function drawGlint(ctx, x, y, time, seed = 0) {
  const period = 3.4, p = (time + seed * 1.37) % period;
  if (p > 0.55) return;
  const k = p < 0.12 || p > 0.43 ? 0 : p < 0.2 || p > 0.35 ? 1 : 2;
  const X = Math.round(x), Y = Math.round(y);
  ctx.fillStyle = PALETTE.starlight;
  for (let d = 1; d <= k; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) ctx.fillRect(X + dx, Y + dy, 1, 1);
  ctx.fillStyle = PALETTE.cream;
  ctx.fillRect(X, Y, 1, 1);
}

for (const plant of new Set([...Object.keys(window.PLANTS || {}), ...Object.keys(FLOWERS).filter((k) => FLOWERS[k].sown)])) seedIcon(plant);
for (const id of new Set([...Object.keys(BIRDS), ...Object.keys((window.FIELD_GUIDE && FIELD_GUIDE.birds) || {})])) keepsakeIcon(`feather:${id}`);
for (const [kind, items] of Object.entries(KEEPSAKE_ART)) for (const id of Object.keys(items)) keepsakeIcon(`${kind}:${id}`);
