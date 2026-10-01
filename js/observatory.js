
function buildPlace(map, objects, opts = {}) {
  const H = map.length, W = map[0].length;
  const tiles = map.map((row) => row.split(""));
  const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? (opts.outside || "#") : tiles[y][x]);
  const idx = (x, y) => y * W + x;
  const blocked = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((opts.walls || "#w").includes(tile(x, y))) blocked[idx(x, y)] = 1;
  let start = null, door = null;
  for (let y = 0; y < H; y++) {
    if (map[y].includes("A")) start = { x: map[y].indexOf("A"), y };
    if (map[y].includes("D")) door = { x: map[y].indexOf("D"), y };
  }
  const things = [];
  for (const o of objects) {
    const kind = OBSERVATORY_THINGS[o.type];
    const [w, h] = kind.size;
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) if (kind.blocks) blocked[idx(x, y)] = 1;
    things.push({
      type: o.type, x: o.x, y: o.y, w, h, variant: o.variant || 0,
      name: kind.name, tappable: !!kind.name, blocks: kind.blocks, flat: !!kind.flat, onWall: !!kind.onWall,
      korean: kind.korean || null,
      footX: (o.x + w / 2) * TILE, footY: (o.y + h) * TILE,
      bounce: 0, phase: 0,
    });
  }
  const noRiver = { at: () => ({ d: 99, fx: 0, fy: 1, t: 0, side: 1, pool: false, riffle: false }) };
  return {
    W, H, tile, tiles, blocked, things, start: start || { x: door.x, y: door.y - 1 }, door,
    indoors: !!opts.indoors, garden: false, small: true, alwaysNight: true, place: opts.place,
    patchOf: new Int16Array(W * H).fill(-1), clover: [], petals: [], flow: [],
    river: noRiver, isWater: () => false,
  };
}

const buildHill = () => buildPlace(HILL_MAP, HILL_OBJECTS, { walls: "s", outside: "s", place: "hill" });
const buildDome = () => buildPlace(DOME_MAP, DOME_OBJECTS, { walls: "#w", indoors: true, place: "dome" });

function bakeHill(world, T) {
  const Wpx = world.W * T, Hpx = world.H * T;
  const b = new PixelBuffer(Wpx, Hpx);
  const G = RAMPS.grass, P = RAMPS.path;
  const sky = [PALETTE.nightIndigo, PALETTE.night1, PALETTE.night2, PALETTE.night3];
  const at = (x, y) => world.tile(Math.floor(x / T), Math.floor(y / T));
  let crest = new Array(Wpx).fill(Hpx);
  for (let x = 0; x < Wpx; x++) for (let y = 0; y < Hpx; y++) if (at(x, y) !== "s") { crest[x] = y; break; }
  crest = crest.map((_, x) => {
    let s = 0, n = 0;
    for (let k = -28; k <= 28; k++) { const v = crest[Math.max(0, Math.min(Wpx - 1, x + k))]; s += v; n++; }
    return Math.round(s / n);
  });
  const wobs = Array.from({ length: Hpx }, (_, y) => Math.round((fractalNoise(y / 9, 1.3, 11) - 0.5) * 4));
  const wob = (y) => wobs[y] || 0;
  const isPath = (x, y) => "pAD".includes(at(x + wob(y), y));
  const kind = (x, y) => (x < 0 || y < 0 || x >= Wpx || y >= Hpx ? "" : y < crest[x] ? "sky" : isPath(x, y) ? "path" : "grass");
  for (let y = 0; y < Hpx; y++) {
    for (let x = 0; x < Wpx; x++) {
      const k = kind(x, y);
      let c;
      if (k === "sky") {
        const f = y / Math.max(1, crest[x]);
        c = sky[f < 0.45 ? 0 : f < 0.72 ? 1 : f < 0.9 ? 2 : 3];
      } else if (k === "path") {
        c = P[2];
        if (fractalNoise(x / 7, y / 7, 5) > 0.62) c = P[1];
        if (hash2(x, y, 6) < 0.05) c = P[3];
        if (kind(x - 1, y) === "grass" || kind(x - 2, y) === "grass") c = P[3];
        else if (kind(x + 1, y) === "grass") c = P[1];
        else if (kind(x, y + 1) === "grass") c = P[1];
      } else {
        c = G[1];
        if (hash2(x, y, 4) < 0.012) c = G[2];
        if (y - crest[x] < 2) c = G[0];
        else if (y - crest[x] < 4) c = G[1];
      }
      b.set(x, y, c);
    }
  }
  const grassAt = (x, y) => kind(x, y) === "grass" && y - crest[x] >= 5;
  for (let gy = 0; gy < Hpx; gy += 4) {
    for (let gx = 0; gx < Wpx; gx += 4) {
      const cx = gx + Math.floor(hash2(gx, gy, 311) * 4), cy = gy + Math.floor(hash2(gx, gy, 312) * 4);
      const drift = 0.06 + 0.34 * fractalNoise(cx / 40, cy / 40, 17) + (world.things.some((t) => Math.abs(t.footX - cx) < 22 && Math.abs(t.footY - cy) < 14) ? 0.25 : 0);
      const calm = Math.min(1, (cy - crest[cx]) / 26);                 // sparse near the crest
      if (!grassAt(cx, cy) || hash2(gx, gy, 313) > drift * calm) continue;
      const n = 2 + Math.floor(hash2(gx, gy, 314) * 3), tip = hash2(cx, cy, 316) < 0.45;
      for (let i = 0; i < n; i++) {
        const bx = cx + Math.round((i - (n - 1) / 2) * 2);
        const h = 2 + Math.floor(hash2(cx + i, cy, 315) * 2) + (i === (n >> 1) ? 1 : 0);
        const lean = i === 0 ? -1 : i === n - 1 ? 1 : 0;
        for (let k = 0; k < h; k++) {
          const x = bx + (k === h - 1 ? lean : 0), y = cy - k;
          if (grassAt(x, y)) b.set(x, y, k === h - 1 && tip ? G[0] : G[2]);
        }
      }
    }
  }
  for (let y = 1; y < Hpx; y++) for (let x = 1; x < Wpx - 1; x++) {
    if (kind(x, y) !== "path") continue;
    const side = kind(x - 1, y) === "grass" || kind(x + 1, y) === "grass";
    if (side && hash2(x, y, 401) < 0.3) {
      b.set(x, y, G[2]);
      if (kind(x, y - 1) === "path" && hash2(x, y, 402) < 0.5) b.set(x, y - 1, G[1]);
    }
  }
  for (let gy = 0; gy < Hpx; gy += 9) for (let gx = 0; gx < Wpx; gx += 9) {
    const f = hash2(gx, gy, 21);
    if (f > 0.1) continue;
    const x = gx + Math.floor(hash2(gx, gy, 22) * 9), y = gy + Math.floor(hash2(gx, gy, 23) * 9);
    if (grassAt(x, y)) b.set(x, y, ["snow", "petalPink", "butter", "lilac"].map(paletteColor)[Math.floor(f * 40) % 4]);
  }
  world.crest = crest;
  return b.toCanvas();
}

function bakeDome(world, T) {
  const Wpx = world.W * T, Hpx = world.H * T;
  const b = new PixelBuffer(Wpx, Hpx);
  const floor = RAMPS.floorWood, wall = RAMPS.stone, plum = RAMPS.plum;
  const at = (x, y) => world.tile(Math.floor(x / T), Math.floor(y / T));
  const slit = [5.4 * T, 9.6 * T];
  world.slit = { x0: slit[0], x1: slit[1], y0: T, y1: 4 * T - 6 };
  for (let y = 0; y < Hpx; y++) {
    for (let x = 0; x < Wpx; x++) {
      const t = at(x, y);
      let c;
      if (t === "#") {
        c = plum[2];
        if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => at(x + dx, y + dy) !== "#")) c = plum[1];
      } else if (t === "w") {
        let top = y; while (top > 0 && at(x, top - 1) === "w") top--;
        const wy = y - top, depth = 4 * T - top;
        c = wall[0];
        const mid = (world.W * T) / 2, bend = Math.round(((x - mid) / mid) * (wy / 10) * 3);
        const sx = (((x - bend) % 12) + 12) % 12;
        if (sx === 0) c = wall[2];
        else if (sx === 11) c = wall[1];
        if (wy % 10 === 5 && x % 12 === 3) c = wall[2];                 // rivets
        if (depth - wy <= 5) c = depth - wy === 5 ? wall[3] : depth - wy <= 2 ? wall[2] : wall[1];
        if (x >= slit[0] && x < slit[1] && depth - wy > 5) {
          c = PALETTE.nightIndigo;
          if (x - slit[0] < 2 || slit[1] - x <= 2) c = RAMPS.ink[1];
        }
      } else {
        const row = Math.floor(y / 6), inRow = y % 6;
        const offset = Math.floor(hash2(row, 5, 9) * 40);
        const end = (x + offset) % 40 === 0;
        c = inRow === 5 || end ? floor[2] : floor[1];
        if (inRow === 0 && !end) c = floor[0];
        const near = [[0, -6], [0, 6], [-6, 0], [6, 0]].some(([dx, dy]) => "#w".includes(at(x + dx, y + dy)));
        if (near && c === floor[0]) c = floor[1];
        else if (near && c === floor[1]) c = floor[2];
        if (at(x, y - 3) === "w") c = floor[2];
      }
      b.set(x, y, c);
    }
  }
  const d = world.door;
  for (let y = d.y * T; y < (d.y + 1) * T; y++) for (let x = d.x * T + 2; x < (d.x + 1) * T - 2; x++) b.set(x, y, y % 6 === 5 ? floor[2] : floor[1]);
  return b.toCanvas();
}

Object.assign(PROP_RENDERERS, {
  observatory() {
    const W = 110, H = 118, cx = 55;
    const b = new PixelBuffer(W, H);
    const S = RAMPS.snow, St = RAMPS.stone, lights = [];
    const glowPx = [];
    b.ellipse(cx, H - 6, 40, 6, "stone", { shadeAs: [cx - 10, H - 10, 44, 8] });
    const tower = [cx - 32, 62, 64, H - 66];
    b.rect(...tower, "snow", { shadeAs: [cx - 14, 76, 42, 60] });
    b.rect(cx - 32, H - 14, 64, 6, "stone", { shadeAs: [cx - 14, H - 12, 42, 6] });
    for (let x = cx - 30; x < cx + 32; x += 8) b.set(x, H - 11, St[2]);
    const dome = [cx, 64, 36, 33];
    b.ellipse(...dome, "snow", { clip: (x, y) => y < 64, shadeAs: [cx - 10, 44, 40, 32] });
    for (const k of [-2, -1, 1, 2]) {
      for (let y = 32; y < 63; y++) {
        const r = Math.sqrt(Math.max(0, 1 - ((y + 0.5 - 64) / 33) ** 2)) * 36;
        const x = Math.round(cx + (k / 3) * r);
        if (b.get(x, y)) b.set(x, y, S[2]);
      }
    }
    b.rect(cx - 36, 60, 72, 4, "stone", { shadeAs: [cx - 10, 60, 40, 4] });        // the rim
    const slit = [cx + 1, cx + 13];
    b.rect(slit[0], 30, slit[1] - slit[0], 31, "ink", { flat: true, clip: (x, y) => ((x + 0.5 - cx) / 36) ** 2 + ((y + 0.5 - 64) / 33) ** 2 <= 1 });
    for (let y = 30; y < 61; y++) { if (b.get(slit[0] - 1, y)) b.set(slit[0] - 1, y, S[2]); if (b.get(slit[1], y)) b.set(slit[1], y, S[3]); }
    const a = -0.95, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;      // up and to the right
    const from = [cx + 7, 50], len = 62, w = 7.5;
    const P = (along, across) => [from[0] + dx * along + px * across, from[1] + dy * along + py * across];
    const outside = (x, y) => x >= slit[0] && x < slit[1] ? true : ((x + 0.5 - cx) / 36) ** 2 + ((y + 0.5 - 64) / 33) ** 2 > 1;
    b.polygon([P(0, -w), P(len, -w), P(len, w), P(0, w)], "cream", { shadeAs: [...P(len / 2, -6), 30, 30], clip: outside });
    b.polygon([P(len - 9, -w - 1.5), P(len + 1, -w - 1.5), P(len + 1, w + 1.5), P(len - 9, w + 1.5)], "snow", { shadeAs: [...P(len - 4, -4), 12, 12], clip: outside });  // the dew shield
    b.polygon([P(len - 11, -w), P(len - 9, -w), P(len - 9, w), P(len - 11, w)], "speculum", { flat: true, clip: outside });            // a blue ring
    b.polygon([P(18, -w - 3), P(28, -w - 3), P(28, -w - 1), P(18, -w - 1)], "stone", { flat: true, clip: outside });                   // the finder scope
    const end = P(len + 1, 0);
    b.ellipse(end[0], end[1], 3, 8, "ink", { flat: true });
    b.set(Math.round(end[0]) - 1, Math.round(end[1]) - 3, RAMPS.sheen[0]);
    b.set(Math.round(end[0]), Math.round(end[1]) - 4, RAMPS.sheen[1]);
    b.rect(cx - 0.5, 24, 1, 8, "stone", { flat: true });
    for (const [x, y] of [[0, -3], [-1, -2], [0, -2], [1, -2], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [1, 1], [2, 1]]) b.set(cx + x, 22 + y, "starlight");
    const doorTop = 88, doorBottom = H - 8;
    const inArch = (r) => (x, y) => y >= doorTop + 7 || (x + 0.5 - cx) ** 2 + (y + 0.5 - (doorTop + 7)) ** 2 <= r * r;
    b.rect(cx - 9, doorTop - 2, 18, doorBottom - doorTop + 2, "bark", { flat: true, clip: inArch(9) });
    b.rect(cx - 7, doorTop, 14, doorBottom - doorTop, "chestnut", { shadeAs: [cx - 3, doorTop + 8, 10, 12], clip: inArch(7) });
    for (let x = cx - 4; x < cx + 6; x += 3) b.rect(x, doorTop + 2, 1, doorBottom - doorTop - 2, RAMPS.chestnut[2], { flat: true, clip: (px2, py2) => RAMPS.chestnut.includes(b.get(px2, py2)) });
    b.set(cx + 4, doorTop + 12, "beeYellow");
    for (const [wx, wy, r] of [[cx, 78, 3.5], [cx - 20, 80, 4.5], [cx + 20, 80, 4.5]]) {
      b.circle(wx, wy, r + 1.4, "stone", { shadeAs: [wx - 1, wy - 1, r + 1, r + 1] });
      b.circle(wx, wy, r, "pond", { flat: true });
      for (let y = Math.floor(wy - r); y <= wy + r; y++) for (let x = Math.floor(wx - r); x <= wx + r; x++) if (RAMPS.pond.includes(b.get(x, y))) glowPx.push([x, y]);
      b.set(Math.round(wx - r / 2), Math.round(wy - r / 2), RAMPS.pond[0]);
      lights.push([wx - r, wy - r, r * 2, r * 2]);
    }
    const out = outline(b);
    const glow = new PixelBuffer(W + 2, H + 2);
    for (const [x, y] of glowPx) glow.set(x + 1, y + 1, (x + y) % 5 === 0 ? PALETTE.lamplight : PALETTE.peach);
    const white = (c) => RAMPS.snow.includes(c) || RAMPS.cream.includes(c);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = b.get(x, y);
      if (!c) continue;
      if (RAMPS.starlight.includes(c)) glow.set(x + 1, y + 1, (x + y) % 2 ? PALETTE.starlight : PALETTE.cream);
      else if (white(c) && y < 64 && (!b.get(x - 1, y) || !b.get(x - 1, y - 1) || (!b.get(x, y - 1) && x <= cx))) glow.set(x + 1, y + 1, PALETTE.cream);
      else if (white(c) && y < 64 && (!b.get(x - 2, y) || (!b.get(x, y - 2) && x <= cx - 2))) glow.set(x + 1, y + 1, RAMPS.snow[1]);
    }
    return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: cx + 1, ay: H + 1, lights: lights.map((r) => [r[0] + 1, r[1] + 1, r[2], r[3]]) };
  },

  lampPost() {
    const b = new PixelBuffer(11, 36);
    b.rect(4.5, 9, 2, 25, "ink", { flat: true });
    b.rect(3, 32, 5, 3, "ink", { shadeAs: [5, 33, 3, 2] });
    b.rect(2, 3, 7, 7, "ink", { flat: true });
    b.rect(3, 4, 5, 5, "butter", { flat: true });
    b.polygon([[1, 3], [10, 3], [8, 0], [3, 0]], "ink", { flat: true });
    b.set(5, 1, RAMPS.ink[0]);
    const out = outline(b);
    const glow = new PixelBuffer(13, 38);
    for (let y = 4; y < 9; y++) for (let x = 3; x < 8; x++) glow.set(x + 1, y + 1, (x + y) % 3 === 0 ? PALETTE.cream : PALETTE.lamplight);
    return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: 6, ay: 37, lights: [[4, 5, 5, 5]] };
  },

  bigTelescope() {
    const W = 56, H = 92, cx = 28;
    const b = new PixelBuffer(W, H);
    b.rect(cx - 8, H - 26, 16, 22, "stone", { shadeAs: [cx - 3, H - 16, 10, 14] });
    b.ellipse(cx, H - 4, 10, 4, "stone", { shadeAs: [cx - 3, H - 6, 10, 4] });
    b.ellipse(cx, H - 26, 8, 3, RAMPS.stone[0], { flat: true });
    for (const s of [-1, 1]) b.rect(cx + s * 11 - 2, H - 50, 4, 26, "heronGrey", { shadeAs: [cx + s * 11, H - 40, 3, 14] });
    b.rect(cx - 13, H - 28, 26, 4, "heronGrey", { shadeAs: [cx, H - 27, 14, 3] });
    const a = -1.15, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const from = [cx - 6, H - 34], len = 58, w = 9;
    const P = (along, across) => [from[0] + dx * along + px * across, from[1] + dy * along + py * across];
    b.polygon([P(-4, -w), P(len, -w), P(len, w), P(-4, w)], "cream", { shadeAs: [...P(len / 2, -6), 26, 40] });
    b.polygon([P(len - 10, -w - 1.5), P(len + 1, -w - 1.5), P(len + 1, w + 1.5), P(len - 10, w + 1.5)], "snow", { shadeAs: [...P(len - 5, -4), 12, 12] });
    b.polygon([P(len - 12, -w), P(len - 10, -w), P(len - 10, w), P(len - 12, w)], "speculum", { flat: true });
    b.polygon([P(4, -w), P(8, -w), P(8, w), P(4, w)], "heronGrey", { flat: true });                    // the focuser ring
    const top = P(len + 1, 0);
    b.ellipse(top[0], top[1], 9, 3.4, "ink", { flat: true });                                             // the open end
    b.polygon([P(20, -w - 4), P(34, -w - 4), P(34, -w - 1), P(20, -w - 1)], "stone", { flat: true });
    const ep = P(6, -w - 1);
    b.rect(ep[0] - 7, ep[1] - 2, 7, 4, "ink", { shadeAs: [ep[0] - 4, ep[1] - 1, 4, 2] });
    b.rect(ep[0] - 9, ep[1] - 3, 3, 6, "ink", { flat: true });
    const out = outline(b);
    const glow = new PixelBuffer(W + 2, H + 2);
    const tube = (c) => RAMPS.cream.includes(c) || RAMPS.snow.includes(c);
    const lowEnd = P(10, 0)[1];                     // the tube's lower end stays in shade
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = b.get(x, y);
      if (!c) continue;
      if (tube(c) && y < lowEnd && (!b.get(x - 1, y) || !b.get(x, y - 1))) glow.set(x + 1, y + 1, PALETTE.cream);
      else if (tube(c) && y < lowEnd && (!b.get(x - 2, y) || !b.get(x, y - 2))) glow.set(x + 1, y + 1, RAMPS.cream[1]);
      else if (RAMPS.speculum.includes(c)) glow.set(x + 1, y + 1, RAMPS.speculum[0]);
    }
    return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: cx + 1, ay: H + 1 };
  },

  workDesk() {
    const b = new PixelBuffer(32, 38);
    b.rect(0, 20, 32, 5, "wood", { shadeAs: [12, 21, 18, 3] });
    b.rect(1, 25, 3, 12, "wood", { flat: true }); b.rect(28, 25, 3, 12, "wood", { flat: true });
    b.rect(1, 25, 30, 1, RAMPS.wood[3], { flat: true });
    b.rect(13, 16, 5, 4, "heronGrey", { flat: true });
    b.rect(3, 1, 24, 16, "ink", { flat: true });
    b.rect(4, 2, 22, 13, PALETTE.nightIndigo, { flat: true });
    for (const [x, y, c] of [[9, 6, "butter"], [10, 6, "butter"], [9, 7, "beeYellow"], [15, 9, "butter"], [16, 9, "cream"], [15, 10, "butter"], [21, 5, "butter"], [12, 12, "peach"], [19, 12, "butter"]]) b.set(x, y, c);
    for (const [x, y] of [[6, 4], [14, 4], [23, 9], [7, 11], [24, 13], [18, 3], [11, 9]]) b.set(x, y, RAMPS.duskLavender[1]);
    for (const [x, y, c] of [[20, 8, "skyBlue"], [21, 8, "cream"], [22, 8, "skyBlue"], [21, 9, "skyBlue"], [20, 7, "skyBlue"]]) b.set(x, y, c);
    b.rect(7, 18, 16, 2, "stone", { flat: true });
    b.rect(24, 17, 6, 3, "snow", { flat: true });
    b.rect(2, 17, 4, 3, "cream", { flat: true });
    b.rect(26, 11, 5, 6, "cream", { shadeAs: [27, 13, 3, 3] });
    b.rect(26, 13, 5, 1, "coral", { flat: true });
    b.rect(31, 12, 1, 3, "cream", { flat: true });
    b.set(27, 9, RAMPS.cream[1]); b.set(28, 8, RAMPS.cream[1]); b.set(28, 7, RAMPS.cream[2]);
    const out = outline(b);
    const glow = new PixelBuffer(34, 40);
    for (let y = 2; y < 15; y++) for (let x = 4; x < 26; x++) { const c = b.get(x, y); if (c && c !== PALETTE.nightIndigo) glow.set(x + 1, y + 1, c); }
    return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: 17, ay: 39, lights: [[5, 3, 22, 13]] };
  },

  whiteboard() {
    const b = new PixelBuffer(48, 26);
    b.rect(0, 0, 48, 22, "stone", { flat: true });
    b.rect(1, 1, 46, 20, "snow", { flat: true });
    b.rect(3, 22, 42, 2, "stone", { flat: true });
    b.rect(8, 21, 4, 1, "speculum", { flat: true }); b.rect(14, 21, 4, 1, "coral", { flat: true });
    const inks = ["speculum", "ink", "coral"];
    for (let row = 0; row < 4; row++) {
      let x = 4 + (row % 2) * 3;
      const y = 3 + row * 4;
      while (x < 40) {
        const len = 2 + Math.floor(hash2(x, row, 61) * 5);
        const c = inks[Math.floor(hash2(row, x, 62) * 3)];
        for (let i = 0; i < len; i++) b.set(x + i, y + ((i + x) % 3 === 0 ? 1 : 0), c);
        if (hash2(x, row, 63) < 0.3) { b.set(x + len + 1, y, "ink"); b.set(x + len + 1, y + 1, "ink"); }       // an "="
        x += len + 3;
      }
    }
    for (const [x, y] of [[4, 2], [5, 2], [4, 3], [4, 4], [4, 5], [4, 6], [3, 7], [4, 7]]) b.set(x, y + 10, "speculum");
    for (let a = 0; a < 12; a++) b.set(Math.round(38 + Math.cos(a / 12 * Math.PI * 2) * 4), Math.round(15 + Math.sin(a / 12 * Math.PI * 2) * 3), "coral");
    for (const [x, y] of [[43, 3], [45, 3], [42, 4], [43, 4], [44, 4], [45, 4], [46, 4], [43, 5], [44, 5], [45, 5], [44, 6]]) b.set(x, y, "petalPink");
    return { canvas: outline(b).toCanvas(), ax: 25, ay: 26 };
  },

  starChart() {
    const b = new PixelBuffer(30, 26);
    b.rect(0, 0, 30, 24, "wood", { flat: true });
    b.rect(1, 1, 28, 22, PALETTE.nightIndigo, { flat: true });
    b.circle(15, 12, 9.5, PALETTE.night2, { flat: true });
    for (let a = 0; a < 40; a++) b.set(Math.round(15 + Math.cos(a / 40 * Math.PI * 2) * 10), Math.round(12 + Math.sin(a / 40 * Math.PI * 2) * 10), RAMPS.duskLavender[1]);
    const stars = [[10, 8], [13, 7], [16, 9], [19, 8], [12, 14], [15, 16], [18, 15], [21, 13], [8, 12], [15, 5]];
    for (const [a1, a2] of [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]]) {
      const [x0, y0] = stars[a1], [x1, y1] = stars[a2];
      for (let i = 1; i < 4; i++) b.set(Math.round(x0 + (x1 - x0) * i / 4), Math.round(y0 + (y1 - y0) * i / 4), PALETTE.starLine);
    }
    for (const [x, y] of stars) b.set(x, y, "starlight");
    for (const [x, y] of [[4, 3], [26, 4], [25, 20], [4, 20]]) b.set(x, y, "cream");
    return { canvas: outline(b).toCanvas(), ax: 16, ay: 26 };
  },

  redLamp() {
    const b = new PixelBuffer(11, 30);
    b.rect(4.5, 8, 2, 20, "ink", { flat: true });
    b.ellipse(5.5, 28, 4, 1.6, "ink", { flat: true });
    b.polygon([[2, 8], [9, 8], [8, 1], [3, 1]], "coral", { shadeAs: [5, 3, 4, 5] });
    const out = outline(b);
    const glow = new PixelBuffer(13, 32);
    for (let y = 1; y < 9; y++) for (let x = 2; x < 10; x++) if (b.get(x, y)) glow.set(x + 1, y + 1, (x + y) % 4 === 0 ? PALETTE.peach : RAMPS.coral[0]);
    return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: 6, ay: 31, lights: [[3, 2, 6, 6]], red: true };
  },
});

const Observatory = (() => {
  let shooting = null, nextShoot = 3;
  const inSky = (x, y) => WORLD.place === "hill" ? WORLD.crest && y < WORLD.crest[Math.max(0, Math.min(WORLD.crest.length - 1, x))] - 1
    : WORLD.slit && x >= WORLD.slit.x0 + 2 && x < WORLD.slit.x1 - 2 && y >= WORLD.slit.y0 && y < WORLD.slit.y1;

  let moonFor = { day: null, spot: null };
  function hillMoon(covered) {
    if (typeof Moon === "undefined" || !WORLD.crest) return null;
    const day = typeof State !== "undefined" ? State.get().day : 1;
    if (moonFor.day === day) return moonFor.spot;
    const info = Moon.forDay(day), r = 6, Wpx = WORLD.W * TILE;
    let spot = null;
    if (info.up) {
      const tx = Wpx * (0.5 + ((info.az - 180) / 180) * 0.8), ty = TILE * (1.5 + (1 - Math.min(40, Math.max(0, info.alt)) / 40) * 1.6);
      const boxes = WORLD.things.map((t) => { const s = thingSprite(t, 1); return { s, l: t.footX - s.ax, t: t.footY - s.ay }; });
      const solid = (x, y) => covered(x, y) || boxes.some((b) => isSolid(b.s.canvas, x - b.l, y - b.t));
      const perPt = (window.devicePixelRatio || 1) / scale, inset = typeof safeEdges === "function" ? safeEdges().right : 0;
      const range = (world, view) => (world <= view ? [(world - view) / 2, (world - view) / 2] : [0, world - view]);
      const [cx0, cx1] = range(Wpx, canvas.width), [cy0, cy1] = range(WORLD.H * TILE, canvas.height);
      const corner = [{ w: 240, h: 72 }, { w: 76, h: 180 }].map((c) => ({
        l: canvas.width - (c.w + inset) * perPt + cx0, r: canvas.width + cx1, t: cy0, b: c.h * perPt + cy1,
      }));
      const byButtons = (x, y) => corner.some((c) => x + r + 2 > c.l && x - r - 2 < c.r && y + r + 2 > c.t && y - r - 2 < c.b);
      const glow = Math.ceil(r * (2.2 + info.lit) + r * (1 - info.lit) * 0.6) + 3;
      const clear = (x, y) => {
        if (byButtons(x, y)) return false;
        const R = Math.max(r + 8, glow);
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          if (d2 <= (r + 3) * (r + 3) && !inSky(x + dx, y + dy)) return false;
          if (solid(x + dx, y + dy)) return false;
        }
        return true;
      };
      const tries = [];
      for (let y = Math.round(1.5 * TILE); y <= 4 * TILE; y++) for (let x = 2 * TILE; x <= Wpx - 2 * TILE; x += 2) tries.push([x, y, ((x - tx) / 11) ** 2 + ((y - ty) / 4) ** 2]);
      tries.sort((a, b) => a[2] - b[2]);
      const hit = tries.find(([x, y]) => clear(x, y));
      if (hit) spot = { x: hit[0], y: hit[1], info, glow };
    }
    moonFor = { day, spot };
    return spot;
  }

  function drawNight(ctx, view, time, covered) {
    const x0 = view.x, y0 = view.y;
    if (WORLD.place === "dome" && WORLD.slit) {
      const sl = WORLD.slit;
      for (let i = 0; i < 26; i++) {
        const sx = Math.floor(sl.x0 + 3 + hash2(i, 5, 311) * (sl.x1 - sl.x0 - 6)), sy = Math.floor(sl.y0 + 2 + hash2(i, 6, 312) * (sl.y1 - sl.y0 - 4));
        if (covered(sx, sy)) continue;
        const tw = Math.sin(time * (0.8 + hash2(i, 7, 313)) + i) > 0.5, bright = i % 9 === 0;
        ctx.fillStyle = bright || tw ? PALETTE.starBright : PALETTE.starBand;
        ctx.fillRect(sx, sy, 1, 1);
        if (bright) { ctx.fillStyle = PALETTE.starlight; ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1); }
      }
    }
    if (WORLD.place === "hill") {
      const Wpx = WORLD.W * TILE;
      for (let i = 0; i < 420; i++) {
        const bx = hash2(i, 11, 321) * Wpx, spread = (hash2(i, 12, 322) - 0.5) + (hash2(i, 13, 323) - 0.5);
        const by = Math.floor(8 + (bx / Wpx) * 40 + spread * 16), sx = Math.floor(bx);
        if (!inSky(sx, by) || covered(sx, by)) continue;
        ctx.fillStyle = Math.abs(spread) < 0.25 && i % 3 === 0 ? PALETTE.starBand : PALETTE.starFaint;
        ctx.fillRect(sx, by, 1, 1);
      }
    }
    const count = WORLD.place === "hill" ? 260 : 0;
    for (let i = 0; i < count; i++) {
      const x = Math.floor(x0 + hash2(i, 1, 301) * view.w), y = Math.floor(y0 + hash2(i, 2, 302) * view.h);
      const worldX = Math.floor(hash2(i, 1, 301) * WORLD.W * TILE), worldY = Math.floor(hash2(i, 2, 302) * WORLD.H * TILE);
      const sx = WORLD.place === "hill" ? worldX : x, sy = WORLD.place === "hill" ? worldY : y;
      if (!inSky(sx, sy) || covered(sx, sy)) continue;
      const band = Math.abs(sy - (WORLD.H * TILE * 0.45 - sx * 0.22)) < 26;
      if (!band && hash2(i, 3, 303) < 0.35) continue;
      const tw = Math.sin(time * (0.7 + hash2(i, 4, 304) * 1.6) + i) > 0.55;
      const bright = i % 17 === 0;
      ctx.fillStyle = bright || tw ? PALETTE.starBright : band ? PALETTE.starBand : PALETTE.starFaint;
      ctx.fillRect(sx, sy, 1, 1);
      if (bright && !covered(sx + 1, sy) && !covered(sx - 1, sy)) {
        ctx.fillStyle = PALETTE.starlight;
        ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1);
      }
    }
    if (WORLD.place === "hill") {
      const m = hillMoon(covered);
      if (m) Moon.draw(ctx, m.x, m.y, 6, m.info);
      if (!shooting && time > nextShoot) {
        shooting = { x: (3 + Math.random() * (WORLD.W - 10)) * TILE, y: (0.5 + Math.random() * 2) * TILE, t: 0 };
        nextShoot = time + 5 + Math.random() * 6;
      }
      if (shooting) {
        shooting.t += 1 / 60;
        const k = shooting.t / 0.7;
        if (k >= 1) shooting = null;
        else for (let j = 0; j < 12; j++) {
          const sx = Math.round(shooting.x + (k * 60 - j) * 1.6), sy = Math.round(shooting.y + (k * 60 - j) * 0.7);
          if (!inSky(sx, sy)) continue;
          ctx.fillStyle = j < 2 ? PALETTE.cream : j < 6 ? PALETTE.starlight : PALETTE.starBand;
          ctx.fillRect(sx, sy, 1, 1);
        }
      }
    }
    for (const t of WORLD.things) {
      const s = prop(t.type, t.variant);
      if (!s.glow) continue;
      const ox = t.footX - s.ax, oy = t.footY - s.ay;
      ctx.drawImage(s.glow, ox, oy);
      for (const [x, y, w, h] of s.lights || []) Daylight.drawLight(ctx, ox + x + w / 2, oy + y + h / 2, s.red ? 22 : 14, s.red ? "coral" : "butter", s.red ? 0.7 : 0.6);
    }
  }

  let travel = null;
  function go(change) {
    if (travel) return;
    travel = { t: 0, dur: 1.5, changed: false, change };
    Sound.twinkle();
  }
  function update(dt) {
    if (!travel) return;
    travel.t += dt;
    if (!travel.changed && travel.t >= travel.dur / 2) { travel.changed = true; travel.change(); Sound.hearts(); }
    if (travel.t >= travel.dur) travel = null;
  }
  function drawTravel(ctx, w, h) {
    if (!travel) return;
    const k = travel.t / travel.dur, veil = 1 - Math.abs(k - 0.5) * 2;
    ctx.globalAlpha = Math.min(1, veil * 1.25);
    ctx.fillStyle = PALETTE.nightIndigo;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const sparkle = emoteSprite("sparkles");
    for (let i = 0; i < 46; i++) {
      const born = hash2(i, 7, 401) * 0.45, life = 0.35 + hash2(i, 8, 402) * 0.3;
      const age = k - born;
      if (age < 0 || age > life) continue;
      const x = Math.round(hash2(i, 9, 403) * w), y = Math.round(hash2(i, 10, 404) * h);
      if (i % 3 === 0) ctx.drawImage(sparkle, x - (sparkle.width >> 1), y - (sparkle.height >> 1));
      else {
        ctx.fillStyle = i % 2 ? PALETTE.starlight : PALETTE.cream;
        ctx.fillRect(x, y, 1, 1);
        if (age < life * 0.6) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
    }
  }

  return { drawNight, go, update, drawTravel, traveling: () => !!travel, shoot: (x, y) => { shooting = { x, y, t: 0 }; },
    moon: () => ({ day: moonFor.day, spot: moonFor.spot }) };
})();

function drawTelescopeSparkle(time) {
  const t = WORLD.things.find((x) => x.type === "bigTelescope");
  if (!t) return;
  const sparkleIcon = Cues.icon("sparkle", true);         // (twice as big: it's a cue)
  if (Math.sin(time * 2.2) < -0.2) return;
  const bob = Math.round(Math.sin(time * 3) * 2);
  ctx.drawImage(sparkleIcon, Math.round(t.footX - 26 - sparkleIcon.width / 2), Math.round(t.footY - 30 - sparkleIcon.height + bob));
}

let telescopeLooked = false, telescopeOpening = false;
function lookThroughTelescope() {
  if (Sky.isOpen() || telescopeOpening) return;
  telescopeLooked = true;
  const text = window.OBSERVATORY_TEXT || {};
  Husband.says(Object.keys(State.get().learned).length ? text.stars : text.noStars);
  telescopeOpening = true;
  setTimeout(() => {                        // (his line first, then the view tilts up, with its back arrow)
    telescopeOpening = false;
    UI.showBack(true);
    Sky.show(State.get().day, [], { review: true }).then(() => UI.showBack(false));
  }, 1500);
}
