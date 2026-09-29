
const HOUSE_STYLES = ["cottage", "a", "b", "c"];

function houseVariant() {
  const asked = typeof PARAMS !== "undefined" ? PARAMS.get("house") : null;      // (?house=a, js/dev.js)
  const style = HOUSE_STYLES.includes(asked) ? asked : window.HOUSE_STYLE || "cottage";
  return Math.max(0, HOUSE_STYLES.indexOf(style));
}

const HANOK_DESIGNS = [
  {
    W: 96, H: 88, roof: "giwa", roofTop: 7, eave: 48, lift: 13, ridgeHalf: 33, spacing: 4, flare: 5,
    wallTop: 44, porch: 67, base: 75, pillars: [10, 32, 61, 83],
    panels: [{ kind: "door", x0: 13, x1: 32 }, { kind: "hall", x0: 35, x1: 61 }, { kind: "door", x0: 64, x1: 83 }],
    chimney: { side: 1, kind: "stone" }, lanterns: true,
  },
  {
    W: 96, H: 88, roof: "celadon", roofTop: 5, eave: 53, lift: 17, ridgeHalf: 26, spacing: 5, flare: 6,
    wallTop: 49, porch: 68, base: 76, pillars: [13, 32, 61, 80],
    panels: [{ kind: "moon", x0: 16, x1: 32 }, { kind: "door", x0: 35, x1: 61 }, { kind: "moon", x0: 64, x1: 80 }],
    chimney: { side: 1, kind: "stone" }, lanterns: false,
  },
  {
    W: 96, H: 88, roof: "roseTile", roofTop: 8, eave: 47, lift: 11, ridgeHalf: 36, spacing: 4, flare: 5,
    wallTop: 43, porch: 66, base: 75, pillars: [8, 34, 59, 85],
    panels: [{ kind: "door", x0: 11, x1: 34 }, { kind: "door", x0: 37, x1: 59 }, { kind: "door", x0: 62, x1: 85 }],
    chimney: { side: 1, kind: "stone" }, lanterns: true,
  },
];

function hanok(o) {
  const fx = { corners: true, tiles: true, joints: true, sides: true, shadow: true };
  const { W, H } = o;
  const b = new PixelBuffer(W, H);
  const cx = W / 2 - 0.5;
  const ground = H - 1;
  const lights = [];
  const paperPx = [];                // the paper in the doors and windows (it glows at night)
  const wood = RAMPS.wood, bark = RAMPS.bark, cream = RAMPS.cream;

  b.rect(5, o.base, W - 10, ground - o.base - 3, "stone", { shadeAs: [W / 2, o.base - 6, W * 0.6, 14] });
  for (let y = o.base + 3; y < ground - 3; y += 3) {
    for (let x = 7 + ((y / 3) % 2) * 5; x < W - 7; x += 10) b.set(x, y, RAMPS.stone[2]);
  }
  b.rect(5, o.base, W - 10, 1, RAMPS.stone[0], { flat: true });
  b.rect(cx - 13, ground - 5, 27, 5, "stone", { shadeAs: [cx, ground - 8, 16, 7] });

  b.rect(7, o.porch, W - 14, o.base - o.porch, "wood", { shadeAs: [W / 2, o.porch - 10, W * 0.7, 16] });
  for (let x = 11; x < W - 8; x += 5) b.rect(x, o.porch, 1, o.base - o.porch - 1, wood[2], { flat: true, onlyFilled: true });
  b.rect(7, o.base - 1, W - 14, 1, wood[3], { flat: true });

  const wallBottom = o.porch;
  b.rect(8, o.wallTop, W - 16, wallBottom - o.wallTop, "cream", { flat: true });
  b.rect(8, o.wallTop, W - 16, 3, "wood", { flat: true });
  b.rect(8, o.wallTop + 3, W - 16, 1, wood[2], { flat: true });
  for (const p of o.panels) {
    const x0 = p.x0, w = p.x1 - p.x0, y0 = o.wallTop + 5, h = wallBottom - y0 - 1;
    if (p.kind === "hall") {
      b.rect(x0, y0, w, h, bark[3], { flat: true });
      b.rect(x0, y0 + h - 3, w, 3, wood[2], { flat: true });
      for (const [dx, dw] of [[3, w / 2 - 5], [w / 2 + 2, w / 2 - 5]]) {
        b.rect(x0 + dx, y0 + 3, dw, h - 8, cream[2], { flat: true });
        for (let x = x0 + dx + 2; x < x0 + dx + dw - 1; x += 3) b.rect(x, y0 + 3, 1, h - 8, bark[2], { flat: true });
        for (const fy of [y0 + 5, y0 + 3 + Math.round((h - 8) / 2), y0 + h - 7]) b.rect(x0 + dx, fy, dw, 1, bark[2], { flat: true });
        lights.push([x0 + dx, y0 + 3, dw, h - 8]);
        for (let y = Math.floor(y0 + 3); y < y0 + 3 + h - 8; y++) for (let x = Math.floor(x0 + dx); x < x0 + dx + dw; x++) if (b.get(x, y) === cream[2]) paperPx.push([x, y]);
      }
    } else if (p.kind === "moon") {
      const r = Math.min(w, h) / 2 - 1, mx = x0 + w / 2, my = y0 + h / 2;
      b.circle(mx, my, r + 1.5, "wood");
      b.circle(mx, my, r, "cream", { flat: true });
      for (let x = Math.round(mx - r) + 1; x < mx + r; x += 3) b.rect(x, my - r, 1, r * 2, wood[2], { flat: true, onlyFilled: true, clip: (px, py) => (px + 0.5 - mx) ** 2 + (py + 0.5 - my) ** 2 < r * r });
      b.rect(mx - r, my - 0.5, r * 2, 1, wood[2], { flat: true, clip: (px, py) => (px + 0.5 - mx) ** 2 + (py + 0.5 - my) ** 2 < r * r });
      lights.push([Math.round(mx - r * 0.7), Math.round(my - r * 0.7), Math.round(r * 1.4), Math.round(r * 1.4)]);
      for (let y = Math.floor(my - r); y <= my + r; y++) for (let x = Math.floor(mx - r); x <= mx + r; x++) if ((x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2 < r * r && b.get(x, y) === cream[1]) paperPx.push([x, y]);
    } else {
      b.rect(x0, y0, w, h, "wood", { flat: true });
      const leaves = w > 20 ? 2 : 1, lw = (w - 3) / leaves;
      for (let i = 0; i < leaves; i++) {
        const lx = Math.round(x0 + 1.5 + i * lw), lx1 = Math.round(x0 + 1.5 + (i + 1) * lw) - 1;
        b.rect(lx, y0 + 1, lx1 - lx, h - 2, "cream", { flat: true });
        for (let x = lx + 1; x < lx1; x += 3) b.rect(x, y0 + 1, 1, h - 2, wood[1], { flat: true });
        for (const fy of [y0 + 3, y0 + Math.round(h / 2), y0 + h - 4]) b.rect(lx, fy, lx1 - lx, 1, wood[1], { flat: true });
        lights.push([lx, y0 + 1, lx1 - lx, h - 2]);
        for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = lx; x < lx1; x++) if (b.get(x, y) === cream[1]) paperPx.push([x, y]);
      }
    }
  }
  b.rect(8, o.wallTop + 4, W - 16, 1, RAMPS.cream[3], { flat: true, onlyFilled: true, clip: (x, y) => !o.pillars.some((p) => x >= p && x < p + 3) });
  for (const p of o.pillars) b.rect(p, o.wallTop, 3, o.porch - o.wallTop + 1, "bark", { shadeAs: [p + 1, o.wallTop + 8, 3, 18] });

  const chimX = o.chimney.side > 0 ? W - 7 : 6;
  let smoke;
  if (o.chimney.kind === "stone") {
    const top = o.porch - 8;
    b.rect(chimX - 3, top, 7, ground - 4 - top, "stone", { shadeAs: [chimX, top + 4, 6, 14] });
    for (let y = top + 3; y < ground - 5; y += 3) b.set(chimX - 1 + ((y / 3) % 2) * 2, y, RAMPS.stone[2]);
    b.polygon([[chimX - 5, top + 1], [chimX + 6, top + 1], [chimX + 4, top - 3], [chimX - 3, top - 3]], o.roof);
    smoke = [chimX + 1, top - 5];
  } else {
    const top = o.porch - 4;
    b.ellipse(chimX + 0.5, ground - 6, 5, 6, "stone", { shadeAs: [chimX, ground - 9, 5, 6] });
    b.ellipse(chimX + 0.5, top + 3, 4.2, 4.6, "onggi", { shadeAs: [chimX - 1, top + 1, 4, 5] });
    b.rect(chimX - 2, top - 2, 5, 2, "onggi");
    b.ellipse(chimX + 0.5, top - 2, 2.2, 1, RAMPS.onggi[3], { flat: true });
    smoke = [chimX + 1, top - 5];
  }

  const half = W / 2 - 1;
  const eaveAt = fx.corners
    ? (x) => { const t = Math.min(1, Math.abs(x - cx) / half); return o.eave - o.lift * Math.pow(t, 2.2) - o.flare * Math.pow(t, 8); }
    : (x) => o.eave - o.lift * Math.pow(Math.min(1, Math.abs(x - cx) / half), 2.2);
  const ridgeY = o.roofTop + 4 + (fx.lower || 0);
  const xl = cx - o.ridgeHalf, xr = cx + o.ridgeHalf;
  const tipL = fx.corners ? eaveAt(0) : eaveAt(0) - o.flare;
  const tipR = fx.corners ? eaveAt(W - 1) : eaveAt(W - 1) - o.flare;
  const pts = [[xl, ridgeY], [xr, ridgeY], [W - 1, tipR]];
  for (let x = W - 1; x >= 0; x -= fx.corners ? 1 : 2) pts.push([x, eaveAt(x)]);
  pts.push([0, tipL]);
  const roofShape = [cx, (ridgeY + o.eave) / 2, W * 0.55, (o.eave - ridgeY) * 0.8];
  b.polygon(pts, o.roof, { shadeAs: roofShape });
  const topAt = (x) => {
    if (x >= xl && x <= xr) return ridgeY;
    const [x0, y0, x1, y1] = x < xl ? [xl, ridgeY, 0, tipL] : [xr, ridgeY, W - 1, tipR];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
  const ramp = rampFor(o.roof);
  const band = (c) => ramp.indexOf(c);
  const lighter = (i) => ramp[Math.max(0, i - 1)], darker = (i) => ramp[Math.min(3, i + 1)];
  for (let x = 0; x < W; x++) {
    if (x > xl - 1 && x < xr + 1) continue;
    for (let y = Math.ceil(topAt(x)); y < eaveAt(x); y++) {
      const c = b.get(x, y);
      if (!c) continue;
      if (fx.sides) { const i = band(c); if (i >= 0) b.set(x, y, x < cx ? ramp[Math.min(1, i)] : ramp[Math.max(2, i)]); }
      else if (c === ramp[0] || c === ramp[1]) b.set(x, y, ramp[2]);
    }
  }
  for (let x = 1; x < W - 1; x++) {
    const k = ((Math.round(x - cx) % o.spacing) + o.spacing) % o.spacing;
    const y0 = Math.ceil(topAt(x)) + 1, y1 = Math.floor(eaveAt(x)) - 1;
    const side = x < xl - 1 || x > xr + 1;
    if (!fx.tiles) {
      for (let y = y0; y < y1; y++) {
        if (!b.get(x, y)) continue;
        if (k === 0) b.set(x, y, side ? ramp[3] : ramp[2]);
        else if (k === 1 && !side) b.set(x, y, ramp[0]);
      }
      if (k === 1 || k === 2) { b.set(x, y1, ramp[0]); b.set(x, y1 - 1, ramp[1]); }
      if (k === 0) b.set(x, y1, ramp[3]);
      continue;
    }
    for (let y = y0; y < y1 - 1; y++) {
      const i = band(b.get(x, y));
      if (i < 0) continue;
      if (side) { if (k === 0) b.set(x, y, darker(i)); continue; }
      const joint = fx.joints && (y - Math.ceil(ridgeY) + (Math.floor((x - cx + 100 * o.spacing) / o.spacing) % 2) * 2) % 4 === 0;
      if (k === 0) b.set(x, y, joint ? ramp[i] : lighter(i));
      else if (k === 1) b.set(x, y, joint ? darker(i) : ramp[i]);
      else if (k === 2) b.set(x, y, darker(i));
    }
    if (side) continue;
    if (k === 0 || k === 1) { b.set(x, y1 - 1, ramp[0]); b.set(x, y1, ramp[0]); b.set(x, y1 + 1, ramp[k === 0 ? 1 : 2]); }
    else if (k === 2) { b.set(x, y1 - 1, ramp[1]); b.set(x, y1, ramp[2]); b.set(x, y1 + 1, ramp[3]); }
    else { b.set(x, y1, ramp[3]); b.set(x, y1 + 1, ramp[3]); }
  }
  for (const [x0, x1, dir] of [[xl, 1, -1], [xr, W - 2, 1]]) {
    const y1 = fx.corners ? eaveAt(x1) : eaveAt(x1) - o.flare;
    b.line(x0, ridgeY + 1, x1, y1, 3, ramp[1], { flat: true });
    b.line(x0 + dir * 0.6, ridgeY + 1, x1 + dir * 0.6, y1, 1, ramp[3]);
    b.line(x0 - dir * 0.8, ridgeY, x1 - dir * 0.8, y1 - 1, 1, ramp[0]);
  }
  b.rect(xl - 2, ridgeY - 4, xr - xl + 5, 6, o.roof, { shadeAs: [cx, ridgeY - 7, W * 0.5, 8] });
  b.rect(xl - 1, ridgeY - 2, xr - xl + 3, 1, "snow", { flat: true });
  b.rect(xl - 1, ridgeY + 1, xr - xl + 3, 1, cream[2], { flat: true });
  for (const [ex, dir] of [[xl - 3, -1], [xr + 3, 1]]) b.polygon([[ex, ridgeY + 2], [ex - dir * 3, ridgeY + 2], [ex + dir * 1, ridgeY - 5], [ex + dir * 2, ridgeY - 5]], o.roof, { shadeAs: [ex, ridgeY - 3, 3, 5] });
  if (fx.corners) {
    for (const [x, dir] of [[0, -1], [W - 1, 1]]) { const t = Math.round(eaveAt(x)); b.set(x, t - 1, ramp[1]); b.set(x - dir, t - 1, ramp[1]); b.set(x, t - 2, ramp[0]); }
  } else {
    for (const [x, dir] of [[0, -1], [W - 1, 1]]) b.triangle(x - dir * 5, eaveAt(x) - o.flare + 1, x, eaveAt(x) - o.flare - 4, x + dir * 0.5, eaveAt(x) - o.flare + 2, o.roof, { shadeAs: roofShape });
  }
  if (fx.shadow) {
    const ramps = [cream, wood, bark, RAMPS.stone];
    const down = (c) => { for (const r of ramps) { const i = r.indexOf(c); if (i >= 0) return r[Math.min(3, i + 1)]; } return null; };
    for (let x = 0; x < W; x++) {
      const e = Math.floor(eaveAt(x) + 0.5);
      for (let y = e; y < e + (fx.shadow === true ? 2 : fx.shadow); y++) { const c = b.get(x, y); if (c && band(c) < 0) { const d = down(c); if (d) b.set(x, y, d); } }
    }
  }

  const lanternPx = [];
  if (o.lanterns) {
    for (const lx of [o.pillars[0] + 1, o.pillars[o.pillars.length - 1] + 1]) {
      const ly = eaveAt(lx) + 2;
      b.rect(lx, ly - 2, 1, 3, bark[2], { flat: true });
      b.ellipse(lx + 0.5, ly + 4, 3, 3.6, "coral");
      for (let y = Math.floor(ly + 1); y < ly + 8; y++) for (let x = lx - 3; x <= lx + 3; x++) if (b.get(x, y)) lanternPx.push([x, y]);
      b.rect(lx - 2, ly + 5, 5, 2, "speculum", { flat: true, onlyFilled: true });
      b.rect(lx - 1, ly + 8, 3, 1, "beeYellow", { flat: true });
    }
  }
  const potX = o.chimney.side > 0 ? 9 : W - 10;
  b.ellipse(potX, ground - 4, 4.2, 3.8, "onggi", { shadeAs: [potX - 1, ground - 6, 4, 4] });
  b.rect(potX - 2.5, ground - 8.5, 5, 1.5, RAMPS.onggi[3], { flat: true });
  const out = outline(b);
  const shoeY = ground - 3;
  for (const sx of [cx - 7, cx - 4, cx + 2, cx + 5]) {
    const x = Math.round(sx) + 1;
    out.set(x, shoeY, RAMPS.snow[0]); out.set(x + 1, shoeY, RAMPS.snow[1]);
    out.set(x, shoeY + 1, RAMPS.snow[1]); out.set(x + 1, shoeY + 1, RAMPS.snow[2]);
    out.set(x, shoeY + 2, RAMPS.snow[2]); out.set(x + 1, shoeY + 2, RAMPS.snow[3]);
    out.set(x + (sx < cx ? 1 : 0), shoeY, RAMPS.plum[2]);                      // the opening at the heel
  }
  const glow = new PixelBuffer(W + 2, H + 2);
  for (const [x, y] of paperPx) { const c = b.get(x, y); if (cream.includes(c)) glow.set(x + 1, y + 1, PALETTE.lamplight); }
  const coralR = rampFor("coral"), blueR = rampFor("speculum");
  for (const [x, y] of lanternPx) {
    const c = b.get(x, y);
    if (coralR.includes(c)) glow.set(x + 1, y + 1, PALETTE.peach);
    else if (blueR.includes(c)) glow.set(x + 1, y + 1, blueR[0]);
  }
  const shift = (r) => [r[0] + 1, r[1] + 1, r[2], r[3]];
  const baseBox = [5, o.base, W - 2, H - 3];                  // the stone base and the chimney beside it
  return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: Math.round(W / 2) + 1, ay: H + 1, lights: lights.map(shift), smoke: [smoke[0] + 1, smoke[1] + 1], base: baseBox };
}

function cottage() {
  const W = 96, H = 88, cx = W / 2 - 0.5, ground = H - 1;
  const b = new PixelBuffer(W, H);
  const lights = [], glowPx = [];                 // glowPx: [x, y, color] that light up at night
  const stone = RAMPS.stone, wood = RAMPS.wood, straw = RAMPS.thatch, glass = RAMPS.pond;
  const within = (ramp) => (x, y) => ramp.includes(b.get(x, y));

  const baseTop = 79;
  b.rect(6, baseTop, W - 12, 6, "stone", { shadeAs: [W * 0.4, baseTop + 4, W * 0.6, 12] });
  for (let row = 0; row < 2; row++) {
    const y = baseTop + row * 3;
    for (let x = 6 + row * 4, i = 0; x < W - 6; i++) {
      const w = 7 + Math.floor(hash2(i, row, 91) * 3);
      b.rect(x + 1, y, Math.min(w - 2, W - 7 - x), 1, stone[0], { flat: true });
      if (x + w - 1 < W - 6) b.rect(x + w - 1, y, 1, 3, stone[3], { flat: true });
      x += w;
    }
  }
  b.rect(6, baseTop + 5, W - 12, 1, stone[3], { flat: true });
  b.rect(cx - 7.5, ground - 4, 16, 4, "stone", { shadeAs: [cx - 4, ground - 3, 12, 4], clip: (x, y) => !((x < cx - 6.5 || x > cx + 6.5) && (y < ground - 3 || y > ground - 2)) });
  b.rect(cx - 6.5, ground - 4, 14, 1, stone[0], { flat: true });

  const wallTop = 47, wallBottom = baseTop;
  b.rect(9, wallTop, W - 18, wallBottom - wallTop, "wall", { flat: true });
  b.rect(W - 13, wallTop, 4, wallBottom - wallTop, RAMPS.wall[2], { flat: true });
  for (const [x0, dir] of [[9, 1], [W - 14, -1]]) {
    for (let i = 0, y = wallTop + 6; y < wallBottom - 4; y += 5, i++) {
      const w = i % 2 ? 4 : 6, x = dir > 0 ? x0 : x0 + 5 - w;
      b.rect(x, y, w, 4, "stone", { shadeAs: [x + w / 2 - 1, y + 1, w / 2 + 1, 3] });
    }
  }
  b.rect(9, wallBottom - 2, W - 18, 2, "wood", { shadeAs: [W / 2, wallBottom - 3, W * 0.5, 2] });

  const dW = 14, dx0 = cx - dW / 2 + 0.5, archY = 60, doorBottom = wallBottom - 2;
  const arch = (r) => (x, y) => y >= archY || (x + 0.5 - (cx + 0.5)) ** 2 + (y + 0.5 - archY) ** 2 <= r * r;
  b.rect(dx0 - 2, archY - dW / 2 - 2, dW + 4, doorBottom - archY + dW / 2 + 2, "bark", { flat: true, clip: arch(dW / 2 + 2) });
  b.rect(dx0, archY - dW / 2, dW, doorBottom - archY + dW / 2, "chestnut", { shadeAs: [cx - 3, archY, dW * 0.8, 14], clip: arch(dW / 2) });
  for (let x = dx0 + 3; x < dx0 + dW - 1; x += 3) b.rect(x, archY - dW / 2, 1, doorBottom - archY + dW / 2, RAMPS.chestnut[2], { flat: true, clip: within(RAMPS.chestnut) });
  b.circle(cx + 0.5, archY - 1, 2.6, glass[1], { flat: true });
  b.set(Math.floor(cx) - 1, archY - 2, glass[0]);
  for (let y = archY - 4; y <= archY + 2; y++) for (let x = Math.floor(cx) - 3; x <= cx + 4; x++) if (glass.includes(b.get(x, y))) glowPx.push([x, y, PALETTE.lamplight]);
  b.set(dx0 + dW - 3, archY + 7, "beeYellow");
  lights.push([dx0 + 3, archY - 4, dW - 6, 6]);

  const flowerColors = ["petalPink", "coral", "butter", "petalPink", "lilac", "coral"];
  for (const wc of [23.5, 71.5]) {
    const ww = 12, wh = 11, x0 = Math.round(wc - ww / 2), y0 = 55;
    for (const sx of [x0 - 6, x0 + ww + 2]) {
      b.rect(sx, y0 - 1, 4, wh + 2, "celadon", { shadeAs: [sx + 1, y0 + 2, 3, wh] });
      for (let y = y0 + 1; y < y0 + wh; y += 2) b.rect(sx + 1, y, 2, 1, RAMPS.celadon[2], { flat: true });
    }
    b.rect(x0 - 1, y0 - 1, ww + 2, wh + 2, "snow", { flat: true });
    b.rect(x0, y0, ww, wh, glass[1], { flat: true });
    for (const [gx, gy] of [[1, 1], [2, 1], [1, 2]]) b.set(x0 + gx, y0 + gy, glass[0]);            // a glint on the glass
    b.rect(x0 + ww / 2 - 0.5, y0, 1, wh, "snow", { flat: true });
    b.rect(x0, y0 + 5, ww, 1, "snow", { flat: true });
    for (const [cx0, dir] of [[x0, 1], [x0 + ww - 1, -1]]) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) b.set(cx0 + dir * j, y0 + i, i === 3 - j ? RAMPS.petalPink[2] : RAMPS.petalPink[1]);
    }
    for (let y = y0; y < y0 + wh; y++) for (let x = x0; x < x0 + ww; x++) {
      const c = b.get(x, y);
      if (glass.includes(c)) glowPx.push([x, y, PALETTE.lamplight]);
      else if (RAMPS.petalPink.includes(c)) glowPx.push([x, y, PALETTE.peach]);
    }
    lights.push([x0, y0, ww, wh]);
    b.rect(x0 - 2, y0 + wh + 1, ww + 4, 3, "wood", { shadeAs: [x0 + ww / 2 - 2, y0 + wh + 1, ww / 2 + 2, 2] });
    for (let i = 0; i < 6; i++) {
      const fx = x0 - 1 + i * 2.6, fy = y0 + wh - 1 + (i % 2);
      b.rect(fx, fy + 1, 2, 2, "leaf", { flat: true });
      b.rect(fx + (i % 2), fy, 2, 2, flowerColors[i], { flat: true });
      b.set(fx + (i % 2), fy, RAMPS[flowerColors[i]][0]);
    }
  }

  const vine = [[12, 74], [11, 70], [12, 66], [14, 62], [13, 58], [12, 54], [14, 51]];
  for (let i = 0; i < vine.length - 1; i++) b.line(vine[i][0], vine[i][1], vine[i + 1][0], vine[i + 1][1], 1, RAMPS.leaf[2]);
  for (const [x, y, rose] of [[10, 71, 0], [13, 67, 1], [11, 64, 0], [15, 60, 1], [12, 56, 0], [14, 53, 1], [16, 64, 0], [10, 59, 0]]) {
    if (rose) {
      b.rect(x, y, 2, 2, "petalPink", { flat: true });
      b.set(x, y, RAMPS.petalPink[0]);
      b.set(x + 1, y + 1, RAMPS.petalPink[2]);
    } else {
      b.rect(x, y, 2, 1, "leaf", { flat: true });
      b.set(x + 1, y, RAMPS.leaf[0]);
    }
  }

  const bedColors = ["petalPink", "butter", "lilac", "coral", "snow", "petalPink"];
  for (const [x0, x1] of [[8, cx - 11], [cx + 11, W - 9]]) {
    for (let x = x0, i = 0; x < x1; x += 5, i++) {
      const fy = ground - 4 + (i % 2);
      b.rect(x, fy + 1, 3, 2, "leaf", { flat: true });
      b.set(x + 1, fy + 1, RAMPS.leaf[0]);
      const c = bedColors[(i + (x0 > cx ? 3 : 0)) % bedColors.length];
      b.rect(x + (i % 2), fy - 1, 2, 2, c, { flat: true });
      b.set(x + (i % 2), fy - 1, RAMPS[c][0]);
    }
  }

  const ridgeY = 9, eave = 51, topL = 20, topR = W - 21;
  const roofShape = [cx - 10, ridgeY + 12, W * 0.62, (eave - ridgeY) * 0.95];
  b.polygon([[topL + 3, ridgeY], [topR - 3, ridgeY], [W - 1, eave - 7], [W - 1, eave - 1], [0, eave - 1], [0, eave - 7]], "thatch", { shadeAs: roofShape });
  for (const ex of [topL + 4, topR - 4]) b.ellipse(ex, ridgeY + 11, 15, 11.5, "thatch", { shadeAs: roofShape });
  for (let x = 2; x < W - 1; x += 6) b.circle(x + 1, eave - 1, 3.4, "thatch", { shadeAs: roofShape });      // the soft, thick eave
  const roofTop = (x) => { for (let y = 0; y < H; y++) if (straw.includes(b.get(x, y))) return y; return H; };
  const band = (c) => straw.indexOf(c);
  for (let y = 0; y < eave + 3; y++) for (let x = 0; x < W; x++) {
    if (band(b.get(x, y)) < 0) continue;
    const t = (x - 6) / (W - 12) + (y - ridgeY) / (eave - ridgeY) * 0.25;
    b.set(x, y, straw[t < 0.28 ? 0 : t < 0.86 ? 1 : 2]);
  }
  for (let x = 0; x < W; x++) {
    const top = roofTop(x);
    for (let y = top + 2; y < eave - 3; y++) {
      const i = band(b.get(x, y));
      if (i < 0) continue;
      const row = Math.floor((y - ridgeY - 2) / 6), k = (y - ridgeY - 2) - row * 6;
      const stroke = hash2(x, row, 71), wob = hash2(x >> 1, row, 73) < 0.5 ? 1 : 0;
      if (k === 5 - wob && hash2(x, row, 72) < 0.75) b.set(x, y, straw[Math.min(3, i + 1)]);          // the soft underside of a row
      else if (k === 0 && stroke > 0.55) b.set(x, y, straw[Math.max(0, i - 1)]);                       // straw ends catching the light
      else if (k >= 2 && k <= 3 + wob && stroke < 0.32) b.set(x, y, straw[Math.min(3, i + 1)]);       // short strokes of straw
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = eave - 5; y < eave + 3; y++) {
      const i = band(b.get(x, y));
      if (i < 0) continue;
      if (!straw.includes(b.get(x, y + 1))) b.set(x, y, straw[3]);
      else if (!straw.includes(b.get(x, y - 1)) || y === eave - 5) b.set(x, y, straw[Math.max(0, i - 1)]);
    }
  }
  b.rect(topL, ridgeY - 3, topR - topL + 1, 7, "thatch", { shadeAs: [cx - 6, ridgeY - 4, W * 0.4, 6] });
  for (let x = topL; x <= topR; x++) {
    const k = (x - topL) % 6;
    const d = k < 3 ? k : 6 - k;                   // points hanging down from the ridge
    for (let y = ridgeY + 4; y < ridgeY + 4 + d; y++) b.set(x, y, straw[2]);
    b.set(x, ridgeY + 3 + d, straw[3]);
  }
  for (let x = topL + 3; x < topR - 3; x += 7) {
    for (let j = 0; j < 5; j++) { b.set(x + j, ridgeY - 2 + j * 0.8, wood[2]); b.set(x + 4 - j, ridgeY - 2 + j * 0.8, wood[2]); }
  }
  for (const [ex, dir] of [[topL, -1], [topR, 1]]) b.ellipse(ex + dir, ridgeY + 0.5, 3.5, 3.5, "thatch", { shadeAs: [ex, ridgeY - 2, 3, 4] });
  const ewY = 30;
  b.ellipse(cx + 0.5, ewY + 1, 11, 8, straw[1], { flat: true });
  b.ellipse(cx + 0.5, ewY + 2, 7.5, 5, straw[2], { flat: true });               // a little shade around the window
  for (let x = Math.floor(cx - 10); x <= cx + 11; x++) {
    const dy = Math.sqrt(Math.max(0, 1 - ((x + 0.5 - (cx + 0.5)) / 11) ** 2)) * 8;
    b.set(x, Math.round(ewY + 1 - dy), straw[0]);
    b.set(x, Math.round(ewY + 1 - dy) + 1, straw[1]);
  }
  b.rect(cx - 4.5, ewY - 1, 10, 6, "snow", { flat: true, clip: (x, y) => y > ewY - 1 || Math.abs(x + 0.5 - (cx + 0.5)) < 4 });
  b.rect(cx - 3.5, ewY, 8, 5, glass[1], { flat: true, clip: (x, y) => y > ewY || Math.abs(x + 0.5 - (cx + 0.5)) < 3 });
  for (let y = ewY; y < ewY + 5; y++) for (let x = Math.floor(cx - 3.5); x < cx + 4.5; x++) if (glass.includes(b.get(x, y))) glowPx.push([x, y, PALETTE.lamplight]);
  b.rect(cx, ewY, 1, 5, "snow", { flat: true });
  b.set(Math.floor(cx) - 2, ewY + 1, glass[0]);
  lights.push([cx - 3.5, ewY, 8, 5]);

  const chX = 68, chTop = 1, chBottom = 24;
  b.rect(chX, chTop + 2, 9, chBottom - chTop - 2, "stone", { shadeAs: [chX + 3, chTop + 8, 6, 14] });
  for (let y = chTop + 5, row = 0; y < chBottom - 1; y += 3, row++) for (let x = chX + 1 + (row % 2) * 3; x < chX + 8; x += 5) { b.set(x, y, stone[2]); b.set(x + 1, y, stone[2]); }
  b.rect(chX - 1, chTop, 11, 3, "stone", { shadeAs: [chX + 3, chTop, 6, 3] });
  b.rect(chX + 2, chTop - 1, 5, 1, stone[3], { flat: true });
  b.ellipse(chX + 4.5, chBottom, 8, 3.2, straw[2], { flat: true });                          // the straw tucked around its foot
  b.ellipse(chX + 3.5, chBottom - 1, 6, 1.6, straw[1], { flat: true });
  const smoke = [chX + 4, chTop - 3];

  for (let x = 9; x < W - 9; x++) {
    let e = -1;
    for (let y = eave + 3; y > eave - 6; y--) if (straw.includes(b.get(x, y))) { e = y; break; }
    for (let y = e + 1; y < e + 3; y++) {
      const c = b.get(x, y);
      for (const r of [RAMPS.wall, stone, RAMPS.celadon, RAMPS.snow, RAMPS.leaf, RAMPS.petalPink]) {
        const i = r.indexOf(c);
        if (i >= 0) { b.set(x, y, r[Math.min(3, i + 1)]); break; }
      }
    }
  }

  const lx = dx0 + dW + 3;                          // its left edge, one pixel of wall from the door frame
  b.rect(lx, eave + 3, 1, 3, "ink", { flat: true });                 // the bracket's plate on the wall
  b.rect(lx, eave + 4, 4, 1, "ink", { flat: true });                 // its arm
  b.set(lx + 2, eave + 5, "ink");                                    // the hook
  b.rect(lx + 1, eave + 6, 3, 1, "ink", { flat: true });             // the cap
  b.rect(lx, eave + 7, 5, 1, "ink", { flat: true });
  b.rect(lx, eave + 8, 5, 4, "ink", { flat: true });                 // the frame
  b.rect(lx + 1, eave + 8, 3, 4, "butter", { flat: true });          // the glass
  b.set(lx + 1, eave + 8, RAMPS.butter[0]);
  b.rect(lx + 1, eave + 12, 3, 1, "ink", { flat: true });            // the bottom, and a little knob
  b.set(lx + 2, eave + 13, "ink");
  for (let y = eave + 8; y < eave + 12; y++) for (let x = lx + 1; x < lx + 4; x++) glowPx.push([x, y, PALETTE.lamplight]);
  lights.push([lx, eave + 6, 5, 7, 18]);            // (a bigger halo than the windows')

  const out = outline(b);
  const glow = new PixelBuffer(W + 2, H + 2);
  for (const [x, y, c] of glowPx) if (b.get(x, y)) glow.set(x + 1, y + 1, c);
  const shift = (r) => [r[0] + 1, r[1] + 1, r[2], r[3], r[4]];
  return { canvas: out.toCanvas(), glow: glow.toCanvas(), ax: Math.round(W / 2) + 1, ay: H + 1, lights: lights.map(shift), smoke: [smoke[0] + 1, smoke[1] + 1], base: [6, baseTop, W - 7, ground - 2] };
}

PROP_RENDERERS.house = (v = 0) => (v === 0 ? cottage() : hanok(HANOK_DESIGNS[v - 1] || HANOK_DESIGNS[0]));
