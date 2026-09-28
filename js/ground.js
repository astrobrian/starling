
const GROUND_KIND = { GRASS: 0, PATH: 1, WATER: 2, WOODS: 3, BANK: 4, BRIDGE: 5 };
let GROUND_INFO = null;                // what each ground pixel is, once it's baked

function bakeGround(world, tileSize) {
  const { W: TW, H: TH, tile } = world;
  const W = TW * tileSize, H = TH * tileSize;
  const buf = new PixelBuffer(W, H);
  const K = GROUND_KIND;
  const tileAtPx = (px, py) => tile(Math.floor(px / tileSize), Math.floor(py / tileSize));

  const wobbly = (x, y, seed, amount) => tileAtPx(
    x + (valueNoise(x / 12, y / 12, seed) - 0.5) * amount,
    y + (valueNoise(x / 12, y / 12, seed + 50) - 0.5) * amount);

  const row = RIVER.bridgeRow;
  let bx0 = Infinity, bx1 = -Infinity;
  for (let x = 0; x < TW; x++) if (tile(x, row) === "b") { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
  const onBridge = (x, y) => y >= row * tileSize + 1 && y < row * tileSize + 15 &&
    x >= bx0 * tileSize - 6 && x < (bx1 + 1) * tileSize + 6;

  const mapTile = (px, py) => { const r = window.GARDEN_MAP[Math.floor(py / tileSize)]; return r ? r[Math.floor(px / tileSize)] || "E" : "E"; };
  const pw = RIVER.pathWidth || 2;
  const onPath = (x, y, r) => {
    if (mapTile(x + (valueNoise(x / 12, y / 12, 1) - 0.5) * 8, y + (valueNoise(x / 12, y / 12, 51) - 0.5) * 8) === "=") return true;
    if (r.side <= 0 || !".S=".includes(mapTile(x, y))) return false;
    const wob = (valueNoise(x / 14, y / 14, 5) - 0.5) * 0.35;
    return r.d > 0.3 + wob && r.d < 0.3 + pw + wob;
  };

  const kind = new Uint8Array(W * H);
  const depth = new Float32Array(W * H);       // how deep the water is (tiles)
  const riffle = new Uint8Array(W * H);
  const pool = new Uint8Array(W * H);
  const flowX = new Float32Array(W * H), flowY = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const exact = tileAtPx(x, y);
      if (onBridge(x, y)) { kind[i] = K.BRIDGE; continue; }
      const r = world.river.at(x / tileSize, y / tileSize);
      const d = r.d + (fractalNoise(x / 9, y / 9, 17) - 0.5) * 0.22;
      if (exact !== "H" && d < -0.1) {
        kind[i] = K.WATER;
        depth[i] = -d;
        riffle[i] = r.riffle ? 1 : 0;
        pool[i] = r.pool ? 1 : 0;
        flowX[i] = r.fx; flowY[i] = r.fy;
      } else if (exact !== "H" && d < 0.14 && exact !== "E") {
        kind[i] = K.BANK;
        depth[i] = d;
      } else if (wobbly(x, y, 21, 9) === "E") {
        kind[i] = K.WOODS;
      } else if (onPath(x, y, r)) {
        kind[i] = K.PATH;
      } else {
        kind[i] = K.GRASS;
      }
    }
  }
  const kindAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? K.WOODS : kind[y * W + x]);
  const land = (k) => k === K.GRASS || k === K.PATH || k === K.WOODS || k === K.BANK;

  function distTo(test) {
    const d = new Float32Array(W * H).fill(1e6);
    for (let i = 0; i < W * H; i++) if (test(kind[i])) d[i] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + 1.4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 1.4); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 1.4); if (x > 0) v = Math.min(v, d[i + W - 1] + 1.4); }
      d[i] = v;
    }
    return d;
  }
  const toWoods = distTo((k) => k === K.WOODS), toWater = distTo((k) => k === K.WATER || k === K.BANK);

  const boost = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) boost[i] = Math.max(0, 0.42 * (1 - toWoods[i] / 14), 0.28 * (1 - toWater[i] / 10));
  const LUSH_AROUND = { bigTree: 34, persimmonTree: 26, willow: 20, bush: 12, hedge: 12, berryBush: 12, rock: 8, bigRock: 14, stump: 9, log: 12 };
  for (const t of world.things) {
    const r = LUSH_AROUND[t.type];
    if (!r) continue;
    for (let y = Math.floor(t.footY - r * 0.6); y <= t.footY + r * 0.5; y++) {
      for (let x = Math.floor(t.footX - r); x <= t.footX + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot((x - t.footX) / r, (y - t.footY + 2) / (r * 0.55));
        if (d < 1) boost[y * W + x] = Math.max(boost[y * W + x], 0.4 * (1 - d));
      }
    }
  }
  const inClearing = (x, y) => (window.CLEARINGS || []).some((c) => ((x / tileSize - c.x) / c.rx) ** 2 + ((y / tileSize - c.y) / c.ry) ** 2 <= 1);
  const lushAt = (x, y) => fractalNoise(x / 46, y / 46, 7) + boost[y * W + x];

  const G = RAMPS.grass, P = RAMPS.path, Wt = RAMPS.pond, wood = RAMPS.wood, F = RAMPS.forest;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, k = kind[i];
      let c;
      if (k === K.PATH) {
        const n = fractalNoise(x / 4, y / 4, 3);
        c = n > 0.76 ? P[0] : n < 0.18 ? P[2] : P[1];
        const g = (dx, dy) => kindAt(x + dx, y + dy) !== K.PATH && kindAt(x + dx, y + dy) !== K.BRIDGE;
        if (g(0, -1)) c = P[3];
        else if (g(0, -2) || g(-1, 0)) c = P[2];
        else if (g(0, -3) && hash2(x, y, 5) < 0.5) c = P[2];
        else if (g(1, 0)) c = P[0];
        if (hash2(x, y, 4) > 0.995) c = P[3];
      } else if (k === K.WATER) {
        const dp = depth[i];
        if (riffle[i]) {
          c = dp < 0.2 ? Wt[0] : fractalNoise(x / 4, y / 4, 31) > 0.62 ? Wt[0] : Wt[1];
          const u = x * flowX[i] + y * flowY[i], v = y * flowX[i] - x * flowY[i];
          const f = fractalNoise(v / 4, u / 1.5, 36);
          if (f > 0.7) c = PALETTE.cream;
          else if (f > 0.62) c = RAMPS.snow[2];
        } else {
          const deep = dp + (fractalNoise(x / 14, y / 10, pool[i] ? 33 : 35) - 0.5) * 0.5;
          let band = dp < 0.16 ? 0 : deep < 0.62 ? 1 : deep < (pool[i] ? 2.5 : 9) ? 2 : 3;
          if (band < 3 && (land(kindAt(x, y - 1)) || land(kindAt(x, y - 2)) || land(kindAt(x - 1, y)))) band = Math.min(3, Math.max(band, 1) + 1);
          if (band === 0 && hash2(x, y, 8) < 0.12) band = 1;
          c = Wt[band];
          if (land(kindAt(x, y + 1)) && kindAt(x, y + 1) !== K.BRIDGE) c = PALETTE.cream;
        }
      } else if (k === K.BANK) {
        const wetBelow = kindAt(x, y + 1) === K.WATER, wet2 = kindAt(x, y + 2) === K.WATER;
        c = wetBelow ? P[3] : wet2 ? P[2] : kindAt(x, y - 1) === K.WATER ? P[0] : P[1];
        const r = hash2(x, y, 34);
        if (!wetBelow && r > 0.95) c = RAMPS.stone[1];
        else if (!wetBelow && r > 0.92) c = RAMPS.stone[0];
      } else if (k === K.BRIDGE) {
        const top = row * tileSize + 1, py = y - top;
        c = (x - bx0 * tileSize) % 3 === 2 ? wood[2] : py < 2 ? wood[0] : wood[1];
        if (py >= 12) c = wood[3];
        if (py >= 13) c = Wt[2];
      } else if (k === K.WOODS) {
        c = fractalNoise(x / 7, y / 7, 12) > 0.6 ? F[2] : F[3];
      } else {
        c = G[1];                    // grass: one calm base; the texture comes next
      }
      buf.px[i] = c;
    }
  }

  if (bx0 <= bx1) {
    const y0 = row * tileSize - 3;
    for (let x = bx0 * tileSize - 5; x < (bx1 + 1) * tileSize + 5; x++) {
      buf.set(x, y0 + 1, wood[0]); buf.set(x, y0 + 2, wood[1]); buf.set(x, y0 + 3, wood[3]);
    }
    for (let x = bx0 * tileSize - 5; x < (bx1 + 1) * tileSize + 5; x += 8) {
      for (let y = y0 - 1; y < y0 + 5; y++) { buf.set(x, y, wood[1]); buf.set(x + 1, y, wood[2]); }
    }
  }

  const setIf = (x, y, want, c) => { if (x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] === want) buf.px[y * W + x] = c; };
  for (let gy = 0; gy < H; gy += 4) {
    for (let gx = 0; gx < W; gx += 4) {
      const cx = gx + Math.floor(hash2(gx, gy, 301) * 4), cy = gy + Math.floor(hash2(gx, gy, 302) * 4);
      if (kindAt(cx, cy) !== K.GRASS) continue;
      const L = lushAt(cx, cy);
      let p = L < 0.36 ? 0.2 : L < 0.64 ? 0.3 : 0.7;
      if (inClearing(cx, cy)) p *= 0.45;
      if (hash2(gx, gy, 303) > p) continue;
      const sunny = L < 0.36, lush = L >= 0.64;
      const n = 2 + Math.floor(hash2(gx, gy, 304) * 3);
      const tip = hash2(cx, cy, 306) < 0.45;
      for (let i = 0; i < n; i++) {
        const bx = cx + Math.round((i - (n - 1) / 2) * 2);
        const h = 2 + Math.floor(hash2(cx + i, cy, 305) * 2) + (i === (n >> 1) ? 1 : 0);
        const lean = i === 0 ? -1 : i === n - 1 ? 1 : 0;
        for (let k = 0; k < h; k++) {
          let c;
          if (sunny) c = G[0];
          else if (lush) c = k === 0 ? G[3] : k === h - 1 ? G[1] : G[2];
          else c = k === h - 1 && tip ? G[0] : G[2];
          setIf(bx + (k === h - 1 ? lean : 0), cy - k, K.GRASS, c);
        }
      }
    }
  }

  for (let y = 2; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (kind[y * W + x] !== K.PATH) continue;
      if (kindAt(x, y + 1) === K.GRASS && hash2(x, y, 401) < 0.3) {
        buf.px[y * W + x] = G[1];
        if (kindAt(x, y - 1) === K.PATH) buf.px[(y - 1) * W + x] = hash2(x, y, 402) < 0.5 ? G[0] : G[1];
      } else if (kindAt(x, y - 1) === K.GRASS && hash2(x, y, 403) < 0.22) buf.px[y * W + x] = G[2];
      if (hash2(x, y, 404) > 0.9975 && kindAt(x + 1, y + 1) === K.PATH && kindAt(x, y - 1) === K.PATH) {
        buf.px[y * W + x] = P[0]; buf.px[y * W + x + 1] = RAMPS.stone[1];
        buf.px[(y + 1) * W + x] = RAMPS.stone[1]; buf.px[(y + 1) * W + x + 1] = P[3];
      }
    }
  }

  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      if (hash2(x, y, 13) > 0.012 || kindAt(x, y) !== K.GRASS) continue;
      let nearPB = false;
      for (let j = -3; j <= 3 && !nearPB; j++) for (let q = -3; q <= 3; q++) { const kk = kindAt(x + q, y + j); if (kk === K.PATH || kk === K.BANK) { nearPB = true; break; } }
      if (!nearPB) continue;
      buf.set(x, y, RAMPS.stone[1]);
      buf.set(x + 1, y, RAMPS.stone[2]);
      if (hash2(x, y, 14) > 0.5) buf.set(x, y - 1, RAMPS.stone[0]);
    }
  }

  for (const { x: tx, y: ty } of world.clover) {
    for (let k = 0; k < 5; k++) {
      const x = tx * tileSize + 2 + Math.floor(hash2(tx, ty, 100 + k) * 11);
      const y = ty * tileSize + 3 + Math.floor(hash2(tx, ty, 110 + k) * 10);
      buf.set(x, y, RAMPS.meadowGreen[0]); buf.set(x + 1, y, RAMPS.meadowGreen[0]);
      buf.set(x, y + 1, RAMPS.meadowGreen[1]); buf.set(x + 1, y + 1, RAMPS.meadowGreen[2]);
      buf.set(x - 1, y + 1, RAMPS.meadowGreen[1]);
      if (k === 0 && hash2(tx, ty, 120) > 0.5) { buf.set(x, y - 1, "snow"); buf.set(x + 1, y - 1, "cream"); }
    }
  }

  for (const p of world.petals) {
    if (kindAt(p.x, p.y) !== K.GRASS) continue;
    buf.set(p.x, p.y, RAMPS[p.color] ? RAMPS[p.color][1] : p.color);
    if (hash2(p.x, p.y, 130) > 0.5) buf.set(p.x + 1, p.y, RAMPS[p.color] ? RAMPS[p.color][2] : p.color);
  }

  for (const t of world.things) {
    if (!["willow", "reeds", "riverRock", "bigRock", "rock", "bench"].includes(t.type)) continue;
    const s = prop(t.type, t.variant);
    const d = s.canvas.getContext("2d").getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    const ox = Math.round(t.footX - s.ax), oy = Math.round(t.footY - s.ay), foot = Math.round(t.footY);
    for (let sy = 0; sy < s.canvas.height; sy++) {
      for (let sx = 0; sx < s.canvas.width; sx++) {
        if (!d[(sy * s.canvas.width + sx) * 4 + 3]) continue;
        const wy = oy + sy, my = 2 * foot - wy;
        if ((my - foot) % 4 === 3) continue;
        const mx = ox + sx + ((my >> 1) & 1);
        if (mx < 0 || my < 0 || mx >= W || my >= H || kind[my * W + mx] !== K.WATER || riffle[my * W + mx]) continue;
        const c = buf.px[my * W + mx];
        if (c !== PALETTE.cream) buf.px[my * W + mx] = shadowOf(c);
      }
    }
  }

  const SHADOWS = {
    bigTree: [31, 10, 6, -4, 9], persimmonTree: [23, 7.5, 5, -3, 6], willow: [18, 5.5, 4, -2, 4], woodsTree: [15, 5, 4, -2, 0],
    bush: [9, 3, 2.5, -1], hedge: [9.5, 3.2, 2.5, -1], berryBush: [10, 3.2, 2.5, -1], rock: [6.5, 2.2, 1.5, -0.5], bigRock: [13.5, 3.4, 2.5, -0.5],
    log: [14, 2.6, 2, -0.5], stump: [6.5, 2.2, 1.5, -0.5], bench: [14, 2.8, 2.5, -0.5], jangdokdae: [22, 3, 3, -0.5],
    birdFeeder: [5, 1.6, 2, -0.5], birdBath: [9, 2.4, 2, -0.5], birdhouse: [4.5, 1.5, 2, -0.5], mailbox: [5, 1.6, 2, -0.5],
    sotdae: [4, 1.4, 2, -0.5], pottedPlant: [6, 2, 1.5, -0.5], wateringCan: [6, 2, 1.5, -0.5], seedSack: [6, 2, 1.5, -0.5], fence: [8, 1.8, 1, -0.5],
  };
  for (const t of world.things) {
    if (t.noShadow || t.wet) continue;
    if (t.type === "house") {
      const s = prop(t.type, t.variant);
      const x0 = Math.round(t.footX - s.ax) + s.base[0], y0 = Math.round(t.footY - s.ay) + s.base[1];
      const x1 = Math.round(t.footX - s.ax) + s.base[2], y1 = Math.round(t.footY - s.ay) + s.base[3];
      for (let y = y0 + 2; y <= y1 + 4; y++) {
        for (let x = x0 + 1; x <= x1 + 4; x++) {
          if (x <= x1 && y <= y1) continue;                    // under the house itself
          const c = buf.get(x, y);
          if (c) buf.px[y * buf.w + x] = shadowOf(c);
        }
      }
      continue;
    }
    const spec = SHADOWS[t.type];
    if (!spec) continue;
    const [rx, ry, dx, dy, flecks = 0] = spec;
    const cx = t.footX + dx, cy = t.footY + dy;
    const holes = [];
    for (let k = 0; k < flecks; k++) holes.push([cx + (hash2(t.x, k, 501) - 0.5) * rx * 1.4, cy + (hash2(t.y, k, 502) - 0.5) * ry * 1.2, 1 + hash2(t.x + k, t.y, 503) * 1.6]);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
        if (holes.some(([hx, hy, hr]) => ((x + 0.5 - hx) / hr) ** 2 + ((y + 0.5 - hy) / (hr * 0.55)) ** 2 <= 1)) continue;
        if (kindAt(x, y) === K.WOODS || kindAt(x, y) === K.WATER) continue;
        const c = buf.get(x, y);
        if (c) buf.px[y * buf.w + x] = shadowOf(c);
      }
    }
  }

  const canvas = buf.toCanvas();

  const g = canvas.getContext("2d");
  const stone = steppingStone();
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      if (tile(tx, ty) !== "o") continue;
      g.fillStyle = Wt[0];
      g.fillRect(tx * tileSize + 2, ty * tileSize + 3, 12, 1);
      g.drawImage(stone, tx * tileSize + 1, ty * tileSize + 3);
    }
  }
  GROUND_INFO = { kind, W, H };
  return canvas;
}

function paintShadow(buf, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
      const c = buf.get(x, y);
      if (c) buf.px[y * buf.w + x] = shadowOf(c);
    }
  }
}

function shadowOf(c) {
  const lc = c.toLowerCase();
  for (const r of Object.values(RAMPS)) {
    const i = r.findIndex((v) => v.toLowerCase() === lc);
    if (i >= 0) return r[Math.min(3, i + 1)];            // already the deepest band: it stays
  }
  return darken(c, 0.25);
}

function steppingStone() {
  const b = new PixelBuffer(12, 9);
  b.polygon([[1, 2], [3, 0.5], [9, 0.5], [11, 2], [11, 7], [9, 8.5], [3, 8.5], [1, 7]], "stone");
  b.rect(2, 7, 8, 1.5, RAMPS.stone[2], { flat: true, onlyFilled: true });
  return outline(b).toCanvas();
}
