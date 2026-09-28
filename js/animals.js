
function creatureLook(species) {
  return (window.BIRDS && BIRDS[species]) || (window.ANIMALS && ANIMALS[species]) || null;
}

function animalEye(out, ex, ey, look, o = {}) {
  const w = o.w || 2, h = o.h || 3, state = o.state || "open";
  const eye = look.eyes || "plum";
  const dark = o.face && lightness(paletteColor(o.face)) < 0.4;
  const lid = dark ? RAMPS.duskLavender[0] : eye;
  if (state === "open") {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(ex + x, ey + y, eye);
    out.set(ex, ey, "cream");
  } else if (state === "blink") {
    for (let x = 0; x < w; x++) out.set(ex + x, ey + h - 1, lid);
    out.set(ex - 1, ey + h - 2, lid);
  } else if (state === "sleep") {
    out.set(ex - 1, ey + h - 2, lid);
    for (let x = 0; x < w; x++) out.set(ex + x, ey + h - 1, lid);
    out.set(ex + w, ey + h - 2, lid);
  } else if (state === "happy") {
    out.set(ex - 1, ey + h - 1, lid);
    for (let x = 0; x < w; x++) out.set(ex + x, ey + h - 2, lid);
    out.set(ex + w, ey + h - 1, lid);
  }
  if (o.blush !== false && look.blush !== false) {
    const by = ey + h + (o.blushGap ?? 1);
    for (let i = 0; i < (o.blushW || 2); i++) out.set(ex - 1 + i + (o.blushDx || 0), by, "blush");
  }
}

function packAnimal(out, pts) {
  let x0 = out.w, y0 = out.h, x1 = -1, y1 = -1;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    if (!out.px[y * out.w + x]) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const c = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px[(y - y0) * c.w + (x - x0)] = out.px[y * out.w + x];
  const s = { canvas: c.toCanvas() };
  for (const [k, v] of Object.entries(pts)) s[k] = Math.round(v) + 1 - (k.endsWith("X") ? x0 : y0);
  return s;
}

function animalRipples(out, x0, x1, y) {
  for (let x = Math.round(x0); x < x1; x += 2) out.set(x + 1, Math.round(y) + 1, RAMPS.pond[0]);
}

function grizzleCoat(buf, on, pale, dark, seed = 29) {
  const P = rampFor(pale), D = rampFor(dark);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const c = buf.get(x, y);
    if (!c || !on.has(c)) continue;
    const band = on.band.get(c), n = hash2(x, y, seed);
    if (n < 0.14 && band < 3) buf.set(x, y, D[Math.min(3, band + 1)]);
    else if (n > 0.88 && band < 2) buf.set(x, y, P[band]);
  }
}
function bandsOf(color) {
  const set = new Set(), band = new Map();
  (rampFor(color) || [paletteColor(color)]).forEach((c, i) => { set.add(c); band.set(c, i); });
  set.band = band;
  return set;
}

const QUAD_POSES = {
  stand: {},
  walk: { legs: "walk1", tailUp: 0.06 },
  walk2: { legs: "walk2", tailUp: -0.04 },
  sit: { tilt: -0.62, legs: "sit", tail: "wrap", head: [-1.2, -0.4] },
  sniff: { head: [1.4, 3.6], look: 0.75, tailUp: -0.08 },
  eat: { head: [1.6, 4.4], look: 0.95, mouth: "chew", tailUp: 0.1 },
  eat2: { head: [1.6, 3.6], look: 0.7, mouth: "open", tailUp: 0.18 },
  look: { head: [-0.8, -1.4], look: -0.55, tailUp: 0.12 },
  lie: { legs: "tuck", ground: true, long: 1.06, flat: 0.86, head: [0.8, 2.6], look: 0.1, eyes: "sleep", tail: "wrap" },
  hop: { legs: "leap", tilt: -0.16, tailUp: 0.3, long: 1.04 },
  play: { tilt: 0.3, legs: "bow", head: [1.2, 2.3], look: -0.18, tailUp: 0.7, eyes: "happy", mouth: "open" },
  play2: { tilt: -0.28, legs: "rear", head: [-0.4, -0.8], look: -0.22, tailUp: 0.4, eyes: "happy", mouth: "open" },
  swim: { water: true, legs: "none", head: [0.3, -0.6], look: -0.12, tailUp: -0.12 },
  curl: { curl: true },
  upright: { tilt: -1.3, legs: "upright", head: [-1, -0.6], tailUp: 0.7 },
};

function drawQuad(look, pose, blink) {
  const P = QUAD_POSES[pose] || {};
  if (P.curl) return drawCurl(look);
  const hr = look.headR || 5, legLen = look.legLen ?? 3, legW = look.legW || 2;
  const rx = (look.bodyRx || 6) * (P.long || 1), ry = (look.bodyRy || 4) * (P.flat || 1);
  const tilt = P.tilt || 0, legs = P.legs || "stand";
  const buf = new PixelBuffer(76, 60);
  const G = 46;                                       // the ground its feet stand on
  const halfH = Math.hypot(rx * Math.sin(tilt), ry * Math.cos(tilt));
  const bx = 34;
  let by = G - legLen - halfH * 0.8;
  if (legs === "sit" || legs === "upright" || P.ground) by = G - halfH + 0.4;
  if (legs === "rear") by -= 0.8;
  const water = P.water ? Math.round(G - 1) : null;
  if (water !== null) by = water + ry * 0.35;
  const clip = water === null ? undefined : (x, y) => y < water;
  const B = rigFrame(bx, by, tilt);
  const box = turnedBox(bx, by, rx, ry, tilt);
  const ell = (F, u, w, ru, rw, paint, opts) => buf.rotEllipse(...F.at(u, w), ru, rw, F.angle, paint, { clip, ...opts });
  const poly = (F, pts, paint, opts) => buf.polygon(pts.map(([u, w]) => F.at(u, w)), paint, { clip, ...opts });
  const within = (F, test) => (x, y) => test(...F.local(x + 0.5, y + 0.5)) && (!clip || clip(x, y));
  const onBody = { onlyFilled: true, shadeAs: box };
  const bodyC = look.body, headC = look.head || bodyC;
  const legC = look.legs || bodyC, farLeg = rampFor(legC)[2];

  const fu = rx * 0.5, bu = -rx * 0.5;
  const GAITS = {
    stand: [[fu, 0, 0], [bu, 0, 0], [fu, 0, 0], [bu, 0, 0]],
    walk1: [[fu, 1.4, 0], [bu, -1.4, 0], [fu, -1.2, 0.9], [bu, 1.2, 0.9]],
    walk2: [[fu, -1, 0.9], [bu, 1, 0.9], [fu, 1.4, 0], [bu, -1.4, 0]],
    leap: [[fu, 2.6, 1.4], [bu, -2.8, 0.6], [fu, 1.8, 1], [bu, -2, 0.3]],
  };
  const legTop = (u) => B.at(u, ry * 0.4);
  const paw = (x, y, color) => buf.rect(Math.round(x + legW / 2 - 0.5), Math.round(y) - 1, 1, 1, color, { clip, flat: true });
  const leg = ([u, dx, lift], far) => {
    const [x0, y0] = legTop(u), sh = far ? 1.3 : 0, color = far ? farLeg : legC;
    const x1 = x0 + sh + dx, y1 = G - 0.5 - lift;
    buf.line(x0 + sh, y0, x1, y1, legW, color, { clip, flat: far });
    paw(x1, y1 + 0.5, color);
  };
  const gait = GAITS[legs];
  if (gait) { leg(gait[2], true); leg(gait[3], true); }
  else if (legs === "bow") {
    const [x0, y0] = legTop(fu), [bx0, by0] = legTop(bu);
    buf.line(x0 + 1.3, y0, x0 + 4.7, G - 1, legW, farLeg, { flat: true });
    paw(x0 + 4.9, G - 0.5, farLeg);
    buf.line(bx0 + 1.3, by0, bx0 + 1.3, G - 0.5, legW, farLeg, { flat: true });
  } else if (legs === "rear" || legs === "upright") {
    const [bx0, by0] = legTop(bu);
    buf.line(bx0 + 1.3, by0, bx0 + 1.3, G - 0.5, legW, farLeg, { flat: true });
    paw(bx0 + 1.3, G, farLeg);
  }

  const tl = look.tail;
  const tailAngle = Math.PI + tilt + (tl && tl.up || 0) + (P.tailUp || 0);
  const drawTail = (T, L, tw) => {
    const tb = turnedBox(...T.at(L * 0.5, 0), L * 0.58, tw, T.angle);
    if (tl.shape === "brush") {
      ell(T, L * 0.5, 0.2, L * 0.58, tw, tl.color, { shadeAs: tb });
      if (tl.tip) ell(T, L * 0.5, 0.2, L * 0.58, tw, tl.tip, { onlyFilled: true, shadeAs: tb, clip: within(T, (u) => u > L * 0.74) });
    } else {
      ell(T, L * 0.48, 0.1, L * 0.55, tw, tl.color, { shadeAs: tb });
      if (tl.top) ell(T, L * 0.48, 0.1, L * 0.55, tw, tl.top, { onlyFilled: true, shadeAs: tb, clip: within(T, (u, w) => w < -tw * 0.35 && u > L * 0.15) });
      if (tl.tip) ell(T, L * 0.48, 0.1, L * 0.55, tw, tl.tip, { onlyFilled: true, shadeAs: tb, clip: within(T, (u) => u > L * 0.75) });
    }
  };
  if (tl && P.tail !== "wrap") {
    const T = rigFrame(...B.at(-rx * 0.8, -ry * 0.2), tailAngle, true);
    drawTail(T, tl.length, tl.width || 2.6);
  }

  buf.rotEllipse(bx, by, rx, ry, tilt, bodyC, { shadeAs: box, clip });
  if (look.saddle) ell(B, rx * 0.3, -ry * 0.15, rx * 0.24, ry * 1.2, look.saddle, onBody);
  if (look.belly) ell(B, -rx * 0.05, ry * 0.62, rx * 0.8, ry * 0.46, look.belly, onBody);
  if (look.chest) ell(B, rx * 0.74, ry * 0.12, rx * 0.36, ry * 0.8, look.chest, { ...onBody, clip: within(B, (u, w) => w > -ry * 0.3) });
  if (look.grizzle) grizzleCoat(buf, bandsOf(bodyC), ...look.grizzle);
  const domeBox = [...B.at(-rx * 0.1, -ry * 0.3), rx * 1.2, ry * 1.3];
  const inDome = (x, y) => {
    const [u, w] = B.local(x + 0.5, y + 0.5);
    return (u / (rx * 1.15)) ** 2 + ((w + ry * 0.2) / (ry * 1.22)) ** 2 <= 1 && w < ry * 0.5 && (!clip || clip(x, y));
  };
  if (look.spines) spineCoat(buf, look.spines, inDome, domeBox);

  if (gait) { leg(gait[1], false); leg(gait[0], false); }
  else if (legs === "sit") {
    for (const far of [true, false]) {
      const [x0, y0] = B.at(rx * 0.62, ry * 0.2), sh = far ? 1.4 : 0, color = far ? farLeg : legC;
      buf.line(x0 + sh, y0, x0 + sh + 0.4, G - 0.5, legW, color, { flat: far });
      paw(x0 + sh + 0.4, G, color);
    }
    const hb = [...B.at(-rx * 0.32, ry * 0.15), rx * 0.48, ry * 0.72];
    buf.ellipse(...hb, bodyC, { shadeAs: hb });
    const [hx0] = B.at(-rx * 0.1, 0);
    buf.ellipse(hx0 + 1, G - 0.9, legW * 0.95 + 0.4, 1.05, legC, { flat: false });   // the hind paw, on the ground
  } else if (legs === "tuck") {
    for (const far of [true, false]) buf.ellipse(bx + rx * 0.85 + (far ? 2.2 : 0.4), G - 1, legW * 0.9 + 0.3, 1, far ? farLeg : legC, { flat: far });
  } else if (legs === "bow") {
    const [x0, y0] = legTop(fu);
    buf.line(x0, y0, x0 + 3.4, G - 1, legW, legC);
    paw(x0 + 3.6, G - 0.5, legC);
    const [bx0, by0] = legTop(bu);
    buf.line(bx0, by0, bx0, G - 0.5, legW, legC);
    paw(bx0, G, legC);
  } else if (legs === "rear" || legs === "upright") {
    const [bx0, by0] = legTop(bu);
    buf.line(bx0, by0, bx0, G - 0.5, legW, legC);
    paw(bx0, G, legC);
    for (const far of [true, false]) {
      const [x0, y0] = B.at(rx * 0.55, ry * 0.3), sh = far ? 1.3 : 0;
      buf.line(x0 + sh, y0, x0 + sh + 1.6, y0 + legLen * 0.55, legW, far ? farLeg : legC, { flat: far });
    }
  }
  if (tl && P.tail === "wrap") {
    const L = tl.length * 0.95, tw = (tl.width || 2.6) * 0.78;
    const T = rigFrame(bx - rx * 0.45, G - tw * 0.9, 0.04, false);
    drawTail(T, L, tw);
  }

  const [hdx, hdy] = P.head || [0, 0];
  const [hu0, hw0] = look.headAt || [0.72, -0.98];
  const [hx0, hy0] = B.at(rx * hu0, ry * hw0);
  const hx = hx0 + hdx - (tilt < 0 ? tilt * 1.2 : 0), hy = hy0 + hdy;
  const H = rigFrame(hx, hy, P.look || 0);
  const hbox = [hx, hy, hr, hr];
  const onHead = { onlyFilled: true, shadeAs: hbox };
  buf.line(...B.at(rx * 0.45, -ry * 0.25), ...H.at(-hr * 0.2, hr * 0.3), hr * 1.1, bodyC, { flat: false, shadeAs: box, clip });
  const ears = look.ears, es = ears && (ears.size || hr * 0.8);
  const earTip = [];
  const earShape = (du, color, inner, opts) => {
    if (ears.shape === "pointed") {
      const base = [[-hr * 0.66 + du, -hr * 0.42], [hr * 0.06 + du, -hr * 0.84]], tip = [-hr * 0.46 + du, -hr * 0.8 - es];
      poly(H, [...base, tip], color, opts);
      earTip.push(H.at(...tip));
      if (inner) poly(H, [[-hr * 0.44 + du, -hr * 0.6], [-hr * 0.06 + du, -hr * 0.8], [-hr * 0.38 + du, -hr * 0.8 - es * 0.62]], inner, { onlyFilled: true });
    } else {
      ell(H, -hr * 0.3 + du, -hr * 0.8, es, es * 0.92, color, opts);
      earTip.push(H.at(-hr * 0.3 + du, -hr * 0.8 - es));
      if (inner) ell(H, -hr * 0.22 + du, -hr * 0.78, es * 0.5, es * 0.5, inner, { onlyFilled: true, flat: true });
    }
  };
  if (ears) earShape(hr * 0.5, rampFor(ears.color)[2], null, { flat: true });
  ell(H, 0, 0, hr, hr * 0.95, headC, { shadeAs: hbox });
  if (look.cheek) ell(H, hr * 0.28, hr * 0.55, hr * 0.76, hr * 0.46, look.cheek, onHead);
  if (look.brow) ell(H, hr * 0.3, -hr * 0.62, hr * 0.34, hr * 0.2, look.brow, onHead);
  if (look.mask) {
    ell(H, hr * 0.34, -hr * 0.02, hr * 0.5, hr * 0.4, look.mask, onHead);
    ell(H, hr * 0.02, hr * 0.32, hr * 0.36, hr * 0.3, look.mask, onHead);
  }

  if (look.spines) spineCoat(buf, look.spines, (x, y) => {
    const [hu, hw] = H.local(x + 0.5, y + 0.5);
    return hu * hu + hw * hw <= hr * hr * 1.1 && hu < -hr * 0.2 - hw * 0.6 && (!clip || clip(x, y));
  }, domeBox);

  const mL = look.muzzleLen || 2.5;
  const M = [hr * 0.72 + mL * 0.42, hr * 0.3], mr = [mL * 0.55 + 0.9, hr * 0.36];
  ell(H, ...M, ...mr, look.muzzle || headC, { shadeAs: [...H.at(...M), mr[0] + 1, mr[1] + 1] });
  if (look.muzzleTop) ell(H, ...M, ...mr, look.muzzleTop, { onlyFilled: true, shadeAs: [...H.at(...M), mr[0] + 1, mr[1] + 1], clip: within(H, (u, w) => w < hr * 0.24) });
  const nose = H.at(M[0] + mr[0] - 0.7, M[1] - mr[1] * 0.45);
  buf.set(nose[0], nose[1], look.nose || "ink");
  if (hr >= 4) buf.set(nose[0] - 1, nose[1], look.nose || "ink");
  if (ears) earShape(0, ears.color, ears.inner);

  const out = outline(buf);
  const eh = hr < 4 ? 2 : 3;
  const [ecx, ecy] = H.at(hr * 0.3, -hr * 0.12);
  const ex = Math.round(ecx - 1) + 1, ey = Math.round(ecy - eh / 2) + 1;
  animalEye(out, ex, ey, look, { h: eh, state: P.eyes || (blink ? "blink" : "open"), face: look.mask || headC, blush: water === null || ey + eh + 1 <= water });
  const mouth = H.at(hr * 0.78 + mL * 0.35, hr * 0.62);
  if (P.mouth === "open") { out.set(Math.round(mouth[0]) + 1, Math.round(mouth[1]) + 1, "coral"); out.set(Math.round(mouth[0]), Math.round(mouth[1]) + 1, "plum"); }
  else if (P.mouth === "chew") out.set(Math.round(mouth[0]) + 1, Math.round(mouth[1]) + 1, "plum");
  if (water !== null) animalRipples(out, bx - rx * 1.2, hx + hr + mL, water);

  const top = earTip.length ? Math.min(...earTip.map((p) => p[1])) : hy - hr;
  return packAnimal(out, {
    footX: bx, footY: water !== null ? water : G,
    headX: hx, headY: top,
    mouthX: H.at(hr * 0.72 + mL * 0.7, 0)[0], mouthY: mouth[1],
  });
}

function spineCoat(buf, S, inside, box, all = false) {
  const x0 = Math.floor(box[0] - box[2] - 1), x1 = Math.ceil(box[0] + box[2] + 1);
  const y0 = Math.floor(box[1] - box[3] - 1), y1 = Math.ceil(box[1] + box[3] + 1);
  const R = rampFor(S.color), tip = rampFor(S.tip), band = rampFor(S.band);
  const mask = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y);
  const band0 = (x, y) => shadeBand((x + 0.5 - box[0]) / box[2], (y + 0.5 - box[1]) / box[3]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!mask(x, y)) continue;
    const b = band0(x, y), streak = ((x - y) % 3 + 3) % 3 === 0 && b >= 1;
    buf.set(x, y, streak ? band[Math.min(3, b)] : R[b]);
  }
  const put = (x, y, c) => { if (!buf.get(x, y)) buf.set(x, y, c); };
  for (let x = x0; x <= x1; x++) {
    let t = -1;
    for (let y = y0; y <= y1; y++) if (mask(x, y)) { t = y; break; }
    if (t < 0 || (!all && x > box[0] + box[2] * 0.55)) continue;
    const k = 2 - (((x - x0) % 3) + 3) % 3;
    for (let i = 1; i <= k; i++) put(x, t - i, i === k ? tip[Math.min(1, band0(x, t))] : R[Math.min(3, band0(x, t))]);
  }
  for (let y = y0 + 1; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x++) if (mask(x, y)) { if (x < box[0] - box[2] * 0.3) put(x - 1, y - 1, R[Math.min(3, band0(x, y) + 1)]); break; }
  }
  if (all) for (let y = y0 + 1; y <= y1; y += 2) {
    for (let x = x1; x >= x0; x--) if (mask(x, y)) { if (x > box[0]) put(x + 1, y - 1, R[Math.min(3, band0(x, y) + 1)]); break; }
  }
}

function drawCurl(look) {
  const buf = new PixelBuffer(24, 22), G = 18, r = (look.bodyRy || 3.3) * 1.3;
  const cx = 11, cy = G - r;
  const box = [cx, cy, r, r];
  buf.circle(cx, cy, r, look.body, { shadeAs: box });
  spineCoat(buf, look.spines, (x, y) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r && y < G - 1, box, true);
  buf.ellipse(cx + r * 0.62, cy + r * 0.55, 1.7, 1.2, look.head || look.body, { flat: false });
  const out = outline(buf);
  out.set(Math.round(cx + r * 0.62 + 1.4) + 1, Math.round(cy + r * 0.55) + 1, look.nose || "ink");
  return packAnimal(out, { footX: cx, footY: G, headX: cx, headY: cy - r - 1, mouthX: cx + r, mouthY: cy + r * 0.6 });
}

const TURTLE_POSES = {
  stand: { neck: 0.55 },
  walk: { neck: 0.7, legs: "walk1" },
  walk2: { neck: 0.7, legs: "walk2" },
  tuck: { neck: 0, legs: "tuck" },
  bask: { neck: 1, raise: 0.8, legs: "splay", eyes: "happy" },
  swim: { neck: 0.8, raise: 0.7, legs: "none", water: true },
};

function drawTurtle(look, pose, blink) {
  const P = TURTLE_POSES[pose] || {};
  const buf = new PixelBuffer(48, 32), G = 26;
  const srx = look.shellRx || 6.4, sry = look.shellRy || 3.4;
  const legs = P.legs || "stand";
  const lower = legs === "tuck" ? 0 : legs === "splay" ? 0.5 : 1.3;
  const sx = 20, sy = G - 1.2 - lower;                         // the shell's flat bottom edge
  const water = P.water ? Math.round(sy - 0.5) : null;             // (the shell afloat, its dome showing)
  const clip = water === null ? undefined : (x, y) => y < water;
  const skin = look.skin, farSkin = rampFor(skin)[2];

  const foot = (x, far, rx = 1.7) => buf.ellipse(x, G - 0.9, rx, 1.05, far ? farSkin : skin, { clip, flat: far });
  const FEET = { stand: [0, 0, 0, 0], walk1: [1.2, -1.2, -1, 1], walk2: [-1, 1, 1.2, -1.2] };
  const f = FEET[legs];
  if (f) { foot(sx + srx * 0.55 + f[2] + 1.4, true); foot(sx - srx * 0.55 + f[3] + 1.4, true); }

  buf.triangle(sx - srx - 1.6, sy - 0.4, sx - srx + 1.5, sy - 1.6, sx - srx + 1.5, sy + 0.2, skin, { clip });
  const out0 = legs === "tuck" ? 0 : P.neck;
  const nx = sx + srx * 0.72, ny = sy - 1.6;
  const reach = (look.neckLen || 3) * out0, raise = P.raise || 0;
  const hr = 2.7;
  const hx = nx + 1.6 + reach * 0.9, hy = ny - 1.2 - raise * 2.6 - out0 * 0.8;
  const hb = [hx, hy, hr + 0.4, hr];
  if (out0 > 0) buf.line(nx, ny + 0.4, hx - 0.8, hy + 0.9, 2.6, skin, { clip, flat: false, shadeAs: hb });
  buf.ellipse(hx, hy, hr + 0.3, hr * 0.92, skin, { shadeAs: hb, clip });
  if (look.belly) buf.ellipse(hx + 0.4, hy + hr * 0.75, hr * 0.9, hr * 0.4, look.belly, { onlyFilled: true, shadeAs: hb, clip });
  const sn = look.snoutLen || 1.6, tilt = raise * 0.35;
  buf.line(hx + hr - 0.3, hy - 0.5, hx + hr + sn + 0.9, hy - 0.8 - tilt * 2, 1.1, skin, { clip, flat: true });

  buf.ellipse(sx - 0.3, sy - 0.5, srx + 1.3, 1.5, look.rim, { clip });
  buf.ellipse(sx - srx * 0.7, sy - 0.6, 2.6, 1.5, look.rim, { clip });
  const dome = [sx, sy - 1, srx, sry];
  buf.ellipse(...dome, look.shell, { clip: (x, y) => y + 0.5 < sy - 0.6 && (!clip || clip(x, y)) });
  if (look.spots) for (const [dx, dy] of [[-3.4, -2.6], [-0.4, -3.4], [2.6, -2.4], [-1.8, -1.6], [4.4, -1.4], [0.8, -1.8]]) {
    const x = Math.round(sx + dx), y = Math.round(sy + dy);
    if (buf.get(x, y) && (!clip || clip(x, y))) buf.set(x, y, rampFor(look.spots)[1]);
  }

  if (f) { foot(sx + srx * 0.55 + f[0], false); foot(sx - srx * 0.55 + f[1], false); }
  else if (legs === "splay") {
    foot(sx + srx * 0.75, false);
    buf.ellipse(sx - srx - 0.8, G - 1.1, 2.3, 0.95, skin, { flat: false });       // a hind foot stretched out behind
  } else if (legs === "tuck") {
    buf.ellipse(sx + srx * 0.5, G - 0.7, 1.2, 0.8, skin);
    buf.ellipse(sx - srx * 0.5, G - 0.7, 1.2, 0.8, skin);
  }

  const out = outline(buf);
  animalEye(out, Math.round(hx - 0.2) + 1, Math.round(hy - 1.4) + 1, look, { h: 2, state: P.eyes || (blink ? "blink" : "open"), blushGap: 0 });
  if (water !== null) animalRipples(out, sx - srx - 2, hx + hr + sn, water);
  return packAnimal(out, {
    footX: sx, footY: water !== null ? water : G,
    headX: hx, headY: hy - hr,
    mouthX: hx + hr + 0.5, mouthY: hy + 0.8,
  });
}

const FROG_POSES = {
  sit: {},
  hop: { hop: true },
  sing: { sac: 1 },
  sing2: { sac: 2, eyes: "happy" },
  swim: { water: true },
};

function drawFrog(look, pose, blink) {
  const P = FROG_POSES[pose] || {};
  const s = look.frogSize || 1;
  const buf = new PixelBuffer(30, 26), G = 20;
  const body = look.body, far = rampFor(body)[2];
  const water = P.water ? Math.round(G - 2.6 * s) : null;
  const clip = water === null ? undefined : (x, y) => y < water;
  const brx = 3.6 * s, bry = 2.5 * s;
  let bx = 11, by = G - 2.6 * s, tilt = -0.25;
  if (P.hop) { tilt = -0.5; by = G - 4 * s; }
  else if (P.water) { tilt = -0.05; by = water + 0.9 * s; }
  const hx = bx + 2.6 * s, hy = by - (P.hop ? 1.6 : 1.1) * s;
  const bbox = turnedBox(bx, by, brx, bry, tilt);

  const pads = [];
  if (P.hop) {
    buf.line(bx - 1.6 * s, by + 0.6, bx - 5.4 * s, by + 3 * s, 1.4 * s, far, { flat: true });
    buf.line(bx - 1.2 * s, by + 1, bx - 4.6 * s, by + 3.8 * s, 1.6 * s, body, { flat: false });
    pads.push([bx - 5.2 * s, by + 3.8 * s]);
    buf.line(hx, hy + 1.6 * s, hx + 2.2 * s, hy + 3.2 * s, 1.3, body, { flat: false });
    pads.push([hx + 2.4 * s, hy + 3.3 * s]);
  } else if (!P.water) {
    buf.line(hx + 1.4, hy + 1.6 * s, hx + 1.9, G - 0.6, 1.2 * s, far, { flat: true });                 // far front leg
  }
  buf.rotEllipse(bx, by, brx, bry, tilt, body, { shadeAs: bbox, clip });
  if (!P.hop && !P.water) {
    const th = [bx - 1.5 * s, by + 0.9 * s, 2.3 * s, 1.5 * s];
    buf.ellipse(...th, body, { shadeAs: th });                                            // the folded thigh
    buf.ellipse(bx - 0.1 * s, G - 0.6, 2.5 * s, 0.8, body, { flat: false });              // its long foot on the ground
    pads.push([bx + 2 * s, G - 0.5]);
  }
  buf.rotEllipse(bx + 1.2 * s, by + 1.7 * s, 3.4 * s, 1.3 * s, tilt, look.belly, { onlyFilled: true, shadeAs: bbox });
  const hb = [hx, hy, 2.9 * s, 2.2 * s];
  buf.ellipse(hx, hy, 2.8 * s, 2.1 * s, body, { shadeAs: hb, clip });
  buf.ellipse(hx + 0.9 * s, hy + 1.5 * s, 2 * s, 0.9 * s, look.belly, { onlyFilled: true, shadeAs: hb });
  const bump = [hx - 0.5 * s, hy - 1.5 * s, 1.75 * s, 1.75 * s];
  buf.circle(bump[0], bump[1], 1.75 * s, body, { shadeAs: bump, clip });
  if (P.sac) {
    const r = P.sac === 1 ? 1.3 * s : 2 * s, sb = [hx + 1.4 * s, hy + 1.5 * s + r * 0.5, r, r];
    buf.ellipse(...sb, look.sac, { shadeAs: sb });
  }
  if (!P.hop && !P.water) {
    buf.line(hx + 0.6, hy + 1.6 * s, hx + 1, G - 0.6, 1.3 * s, body, { flat: false });                 // near front leg
    pads.push([hx + 1.2, G - 0.5]);
  }

  const out = outline(buf);
  for (const [x, y] of pads) out.set(Math.round(x) + 1, Math.round(y) + 1, look.pads);
  const ex = Math.round(bump[0] - 1) + 1, ey = Math.round(bump[1] - 1) + 1;
  if (look.stripe) {
    for (const [dx, dy] of [[2, 1], [3, 1], [-1, 1], [-2, 2]]) {
      const x = ex + dx, y = ey + dy;
      if (buf.get(x - 1, y - 1) && (water === null || y - 1 < water)) out.set(x, y, look.stripe);
    }
  }
  animalEye(out, ex, ey, look, { h: 2, state: P.eyes || (blink ? "blink" : "open"), blushGap: 1, blushW: 2, blushDx: 1, blush: !P.water });
  if (water !== null) animalRipples(out, bx - brx - 1, hx + 3 * s, water);
  return packAnimal(out, {
    footX: bx, footY: water !== null ? water : G,
    headX: bump[0], headY: bump[1] - bump[2],
    mouthX: hx + 2.6 * s, mouthY: hy + 0.8 * s,
  });
}

const BEETLE_POSES = {
  stand: {},
  walk: { legs: 1 },
  walk2: { legs: 2 },
  back: { back: 1 },
  back2: { back: 2 },
  fly: { fly: true },
};

function drawBeetle(look, pose, blink) {
  const P = BEETLE_POSES[pose] || {};
  const buf = new PixelBuffer(36, 32), G = 24;
  const erx = 4.6, ery = 3.5;
  const base = G - 1.6;                                         // the underside, just above its feet
  const ex = 13, ey = base - 2.2;                               // the wing cases' middle
  const body = look.body, gloss = look.gloss, R = rampFor(body);
  const under = (x, y) => y + 0.5 < base;
  if (P.fly) {
    const w = look.wingsOpen || "snow";
    buf.rotEllipse(ex - 3, ey - ery - 2.4, 5.6, 1.5, -0.55, w, { flat: false });
    buf.rotEllipse(ex - 4.2, ey - ery - 0.6, 5.2, 1.4, -0.25, rampFor(w)[2], { flat: true });
    buf.ellipse(ex, ey + 0.4, erx * 0.95, ery * 0.62, R[2], { flat: true, clip: under });
  }
  const cz = P.fly ? [ex - 1.2, ey - ery * 0.75, erx, ery * 0.7, -0.6] : [ex, ey, erx, ery, 0];
  const cb = turnedBox(cz[0], cz[1], cz[2], cz[3], cz[4]);
  buf.rotEllipse(...cz, body, { shadeAs: cb, clip: P.fly ? undefined : under });
  const px = ex + erx * 0.88, py = ey + 0.3;
  const pb = [px, py, 2.6, 2.6];
  buf.ellipse(px, py, 2.5, 2.5, body, { shadeAs: pb, clip: under });
  buf.triangle(px + 0.4, py - 1.9, px + 2.9, py - 2.5, px + 1.2, py - 0.5, body, { flat: false });
  const hx = px + 2.6, hy = base - 1.4;
  buf.ellipse(hx, hy, 1.6, 1.4, body, { shadeAs: [hx, hy, 1.8, 1.8] });
  const hl = (look.horn && look.horn.length) || 5;
  buf.line(hx + 0.4, hy - 0.8, hx + 1.9, hy - hl * 0.55, 1.2, body, { flat: false });
  buf.line(hx + 1.9, hy - hl * 0.55, hx + 1.6, hy - hl, 1.1, body, { flat: false });
  if (look.horn && look.horn.fork) buf.set(Math.round(hx + 0.6), Math.round(hy - hl - 0.4), R[1]);
  if (gloss && !P.fly) {
    buf.line(ex - erx * 0.6, ey - ery * 0.35, ex + erx * 0.05, ey - ery * 0.82, 1, gloss, { onlyFilled: true, flat: true });
    buf.set(Math.round(px - 1), Math.round(py - 1.4), gloss);
  }
  if (!P.fly) for (let y = Math.round(py - 2.6); y < base; y++) {
    const x = Math.round(px - 2.2 + (y - py) * 0.25);
    if (buf.get(x, y) && buf.get(x, y - 1)) buf.set(x, y, R[3]);
  }
  let src = buf;
  const flip = !!P.back;
  const fy = (y) => (flip ? 2 * G - 2 - y : y);
  if (flip) {
    src = new PixelBuffer(buf.w, buf.h);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      const y2 = 2 * G - 2 - y;
      if (y2 >= 0 && y2 < buf.h) src.px[y2 * buf.w + x] = buf.px[y * buf.w + x];
    }
  }
  const out = outline(src);
  const L = rampFor(look.legs);
  const legLine = (pts, color) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx2, by2] = pts[i + 1], n = Math.max(Math.abs(bx2 - ax), Math.abs(by2 - ay), 1);
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx2 - ax) * k) / n) + 1, y = Math.round(fy(ay + ((by2 - ay) * k) / n)) + 1;
        if (!src.get(x - 1, y - 1)) out.set(x, y, color);
      }
    }
  };
  const feet = G - 0.5;
  let sets;
  if (P.fly) sets = [[[ex + 2, base], [ex + 3, base + 2], [ex + 3.5, base + 3.5]], [[ex, base], [ex - 0.5, base + 2.5], [ex - 0.5, base + 3.5]], [[ex - 2, base], [ex - 3.5, base + 2], [ex - 4, base + 3.2]]];
  else if (flip) {
    const w = P.back === 1 ? [0, 1, -1] : [1, -1, 0];
    sets = [0, 1, 2].map((i) => { const x = ex + 3.2 - i * 2.8; return [[x, base], [x + 1 + w[i], base + 2.2], [x + 0.4 + w[i] * 1.6, base + 3.8]]; });
  } else {
    const k = P.legs === 1 ? 1 : P.legs === 2 ? -1 : 0;
    sets = [[[ex + 3, base - 0.5], [ex + 4.4 + k * 0.7, base + 0.3], [ex + 5.2 + k * 0.7, feet]], [[ex + 0.2, base - 0.5], [ex + 0.6 - k * 0.6, base + 0.3], [ex + 0.2 - k * 0.8, feet]],
      [[ex - 2.6, base - 0.5], [ex - 3.8 + k * 0.6, base + 0.3], [ex - 4.8 + k * 0.6, feet]]];
  }
  for (const s of sets) legLine(s.map(([x, y]) => [x + 1, y]), L[2]);
  for (const s of sets) legLine(s, L[1]);
  animalEye(out, Math.round(hx - 0.6) + 1, Math.round(fy(hy - 0.8) - (flip ? 1 : 0)) + 1, look, { w: 1, h: 2, state: blink ? "blink" : "open", blushW: 1, blushDx: 0, blushGap: 0, blush: !flip });
  return packAnimal(out, {
    footX: ex, footY: flip ? G : P.fly ? base + 3.5 : G,
    headX: flip ? ex : hx + 1.6, headY: flip ? fy(base + 3.8) : hy - hl - 1,
    mouthX: hx + 1.4, mouthY: fy(hy + 1),
  });
}

const FLIER_POSES = {
  rest: { open: 1, lift: 0.4 },
  fly: { open: 1, lift: -1.2 },
  fly1: { open: 0.62, lift: -2.2 },
  fly2: { open: 0.3, lift: 1.6, under: true },
};

function drawFlier(look, pose, blink) {
  const P = FLIER_POSES[pose] || {};
  const buf = new PixelBuffer(40, 40);
  const cx = 20, cy = 12, o = P.open ?? 1, lift = P.lift || 0;
  const wingC = P.under ? rampFor(look.wings)[2] : look.wings;
  const hindC = P.under ? rampFor(look.hind || look.wings)[2] : look.hind || look.wings;
  const T = look.tails || 0;
  for (const side of [-1, 1]) {
    const X = (dx) => cx + side * (1 + dx * o * (look.span || 1));
    const hind = [[X(0), cy + 3.4], [X(5.2), cy + 5.2 + lift * 0.3], [X(4.6), cy + 7.6], [X(2.6), cy + 8.4]];
    if (T) hind.push([X(2.6 + 0.5), cy + 8.6 + T * 0.55], [X(3.4), cy + 8.4 + T], [X(2.2), cy + 8.2 + T * 0.9], [X(1.2), cy + 8.2]);
    buf.polygon(hind, hindC, { shadeAs: [X(2.6), cy + 7, 4.2, 4.5] });
    const fore = [[X(0), cy + 0.8], [X(4.2), cy - 1.2 + lift * 0.7], [X(7.6), cy - 1.6 + lift], [X(6.4), cy + 3.2 + lift * 0.4], [X(0), cy + 4.8]];
    buf.polygon(fore, wingC, { shadeAs: [X(3.6), cy + 1.4, 4.6, 3.6] });
    if (look.edge && !P.under) buf.line(X(0.2), cy + 0.8, X(7.4), cy - 1.5 + lift, 1.2, look.edge, { onlyFilled: true, flat: true });
    if (look.spot && !P.under && o > 0.5) {
      for (const [dx, dy] of [[4.2, cy + 1.3 + lift * 0.5], [2.8, cy + 6.3]]) {
        const x = Math.round(X(dx)), y = Math.round(dy);
        buf.set(x, y, look.spot[1]);
        buf.set(x + side, y, look.spot[0]); buf.set(x, y - 1, look.spot[0]);
      }
    }
  }
  buf.ellipse(cx, cy + 4.2, 1.7, 4.2, look.body, { shadeAs: [cx, cy + 4.2, 2, 4.4] });
  buf.circle(cx, cy, 2.6, look.body, { shadeAs: [cx, cy, 2.8, 2.8] });
  const out = outline(buf);
  const A = rampFor(look.antennae);
  let top = 0;
  while (top < out.h && !out.get(cx, top)) top++;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 1 : cx + 2;
    for (let k = 0; k < 3; k++) out.set(x0 + s * k, top - 1 - k, A[k === 2 ? 0 : 1]);
    out.set(x0 + s * 2, top - 2, A[2]);                                // a feathery barb, in shade
  }
  const state = blink ? "blink" : "open";
  animalEye(out, cx - 1, cy, look, { w: 1, h: 2, state, blushW: 1, blushDx: 0, blushGap: 0 });
  animalEye(out, cx + 2, cy, look, { w: 1, h: 2, state, blushW: 1, blushDx: 2, blushGap: 0 });
  return packAnimal(out, {
    footX: cx + 0.5, footY: cy + 8.4,
    headX: cx + 0.5, headY: cy - 5.5,
    mouthX: cx + 0.5, mouthY: cy + 2,
  });
}

const ANIMAL_PLANS = {
  quad: {
    poses: ["stand", "walk", "walk2", "sit", "sniff", "eat", "eat2", "look", "lie", "hop", "play", "play2", "swim"],
    alias: {
      peck: "sniff", bob: "look", crouch: "sit", jump: "hop", fly: "hop", fly1: "hop", fly2: "hop", glide: "hop",
      drink: "eat", tipUp: "look", sleep: "lie", soak: "swim", bathe: "swim", bathe2: "swim", dabble: "swim", float: "swim",
      sing: "look", sing2: "look", strike: "sniff", spread: "stand", blink: "stand", rest: "lie", curl: "lie", tuck: "lie",
      bask: "lie", upright: "sit", cheeks: "eat", cling: "stand", hang: "stand",
    },
    stride: 3,
    draw: drawQuad,
  },
  turtle: {
    poses: ["stand", "walk", "walk2", "tuck", "bask", "swim"],
    alias: {
      peck: "stand", sniff: "stand", eat: "stand", eat2: "stand", drink: "stand", strike: "stand", blink: "stand",
      bob: "bask", look: "bask", tipUp: "bask", sing: "bask", sing2: "bask", spread: "bask", sit: "stand",
      crouch: "tuck", sleep: "tuck", lie: "tuck", rest: "tuck", curl: "tuck", jump: "tuck", fly: "tuck", fly1: "tuck", fly2: "tuck",
      hop: "walk", play: "walk", play2: "walk2", soak: "swim", bathe: "swim", bathe2: "swim", dabble: "swim", float: "swim",
    },
    stride: 2,
    draw: drawTurtle,
  },
  frog: {
    poses: ["sit", "hop", "sing", "sing2", "swim"],
    alias: {
      stand: "sit", walk: "hop", walk2: "sit", jump: "hop", fly: "hop", fly1: "hop", fly2: "hop", play: "hop", strike: "hop",
      peck: "sit", bob: "sit", crouch: "sit", drink: "sit", sleep: "sit", sniff: "sit", eat: "sit", eat2: "sit", look: "sit",
      lie: "sit", play2: "sit", blink: "sit", rest: "sit", spread: "sit", tipUp: "sing",
      soak: "swim", bathe: "swim", bathe2: "swim", dabble: "swim", float: "swim",
    },
    stride: 5,
    draw: drawFrog,
  },
  beetle: {
    poses: ["stand", "walk", "walk2", "back", "back2", "fly"],
    alias: {
      peck: "stand", bob: "stand", crouch: "stand", drink: "stand", tipUp: "stand", sleep: "stand", sing: "stand", sing2: "stand",
      sit: "stand", sniff: "stand", eat: "stand", eat2: "stand", look: "stand", blink: "stand", strike: "stand", rest: "stand",
      jump: "fly", hop: "fly", fly1: "fly", fly2: "fly", spread: "fly", lie: "back", play: "walk", play2: "walk2",
      swim: "back2", soak: "back2", bathe: "back2", bathe2: "back2",
    },
    stride: 2,
    draw: drawBeetle,
  },
  flier: {
    poses: ["fly", "fly1", "fly2", "rest"],
    alias: {
      stand: "rest", sit: "rest", peck: "rest", bob: "rest", crouch: "rest", drink: "rest", tipUp: "rest", sleep: "rest",
      sniff: "rest", eat: "rest", eat2: "rest", look: "rest", lie: "rest", blink: "rest", swim: "rest", hang: "rest",
      walk: "fly", walk2: "fly1", jump: "fly", hop: "fly", play: "fly", play2: "fly1", glide: "fly1", hawk: "fly",
    },
    flap: ["fly", "fly1", "fly2", "fly1"], flapRate: 10,
    draw: drawFlier,
  },
};

function animalPoses(look) {
  const plan = ANIMAL_PLANS[look.plan];
  return look.poses ? [...plan.poses, ...look.poses.filter((p) => !plan.poses.includes(p))] : plan.poses;
}

function animalPose(look, pose) {
  const plan = ANIMAL_PLANS[look.plan], list = animalPoses(look);
  let p = pose;
  for (let i = 0; i < 4 && !list.includes(p); i++) p = (look.alias && look.alias[p]) || plan.alias[p] || list[0];
  return list.includes(p) ? p : list[0];
}

const animalCache = new WeakMap();      // look -> { pose: sprite }
function renderAnimal(look, pose = "stand", blink = false) {
  if (typeof pose === "string" && pose.includes("~")) {
    const [p, b] = pose.split("~");
    pose = p; blink = blink || b === "blink";
  }
  if (!animalCache.has(look)) animalCache.set(look, {});
  const cache = animalCache.get(look);
  if (pose === "swim-bob") {
    const key = blink ? "swim-bob~blink" : "swim-bob";
    return cache[key] || (cache[key] = bobbed(renderAnimal(look, "swim", blink)));
  }
  pose = animalPose(look, pose);
  const key = blink ? pose + "~blink" : pose;
  return cache[key] || (cache[key] = ANIMAL_PLANS[look.plan].draw(look, pose, blink));
}

const EYES_SHUT = new Set(["lie", "curl", "play", "play2", "bask", "sing2"]);

function animalSprite(b) {
  const look = b.look, plan = ANIMAL_PLANS[look.plan];
  const now = performance.now() / 1000;
  const seed = (b.id ? b.id.length : 0) * 0.37 + (b.home ? b.home.x * 0.013 : 0);
  if (b.stepAt === undefined) { b.stepAt = { x: b.x, y: b.y }; b.stepped = 0; }
  b.stepped += Math.hypot(b.x - b.stepAt.x, b.y - b.stepAt.y);
  b.stepAt.x = b.x; b.stepAt.y = b.y;
  let pose = b.pose || "stand";
  const flying = !!plan.flap && (pose === "fly" || pose === "hawk" || b.does === "hawk" || !!b.flight);
  if (flying) pose = plan.flap[Math.floor(now * (look.flapRate || plan.flapRate) + seed * 10) % plan.flap.length];
  else if (b.hop && (b.lift || 0) > 0.5) pose = "hop";                  // in the air, mid-hop (a frog's hop, a hop for joy)
  else if (pose === "walk" || pose === "walk2") pose = Math.floor(b.stepped / (look.stride || plan.stride || 3)) % 2 ? "walk2" : "walk";
  pose = animalPose(look, pose);
  if (pose === "swim" && Math.floor(now * 1.4 + seed * 5) % 2) pose = "swim-bob";
  if (!b.blinkAt) b.blinkAt = now + 1 + Math.random() * 4;
  if (now > b.blinkAt) { b.blinkUntil = now + 0.12; b.blinkAt = now + 2.5 + Math.random() * 2.5; }
  const blink = !flying && !EYES_SHUT.has(pose) && now < (b.blinkUntil || 0);
  return renderAnimal(look, pose, blink);
}
