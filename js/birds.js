
const birdCache = new WeakMap();     // bird -> { pose: sprite }
let EYES_CLOSED = false;             // while drawing a blink

function renderBird(bird, pose = "stand", blink = false) {
  if (!birdCache.has(bird)) birdCache.set(bird, {});
  const poses = birdCache.get(bird), key = blink ? pose + "~blink" : pose;
  if (!poses[key]) {
    const shape = BIRD_SHAPES[bird.shape || "songbird"] || BIRD_SHAPES.songbird;
    EYES_CLOSED = blink;
    try {
      if ((pose === "fly1" || pose === "fly2") && !RIG_PLANS[bird.shape]) poses[key] = songbirdFlap(bird, pose === "fly1" ? 1 : 2);
      else if (pose === "swim-bob") poses[key] = bobbed(renderBird(bird, "swim", blink));
      else poses[key] = shape(bird, pose);
    } finally { EYES_CLOSED = false; }
  }
  return poses[key];
}

function birdEye(out, ex, ey, bird, w = 2, h = 3, blush = true, asleep = false) {
  const eye = bird.eyes || "plum";
  if (asleep) {
    const head = paletteColor(bird.head || bird.body || "plum");
    const lid = lightness(head) < 0.3 ? RAMPS.duskLavender[0] : eye;
    out.set(ex - 1, ey + h - 2, lid);
    for (let x = 0; x < w; x++) out.set(ex + x, ey + h - 1, lid);
    out.set(ex + w, ey + h - 2, lid);
  } else if (EYES_CLOSED) {
    const head = paletteColor(bird.head || bird.body || "plum");
    const lid = lightness(head) < 0.3 ? RAMPS.duskLavender[0] : eye;
    for (let x = 0; x < w; x++) out.set(ex + x, ey + h - 1, lid);
    out.set(ex - 1, ey + h - 2, lid);
  } else {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(ex + x, ey + y, eye);
    out.set(ex, ey, "cream");
  }
  if (bird.cheekSpot) {
    for (const [x, y] of [[-2, h + 1], [-1, h + 1], [-2, h + 2], [-1, h + 2]]) out.set(ex + x, ey + y, bird.cheekSpot);
  } else if (blush && bird.blush !== false) {
    out.set(ex - 1, ey + h + 1, "blush");
    out.set(ex, ey + h + 1, "blush");
  }
  if (bird.pollen) pollenFace(out, bird, ex, ey, h);
}

function shineBeak(out, buf, bird, upper) {
  if (!bird.beakShine) return;
  const [[ax, ay], [tx, ty]] = upper, len = Math.hypot(tx - ax, ty - ay) || 1;
  const nx = -(ty - ay) / len, ny = (tx - ax) / len;
  const xs = upper.map((p) => p[0]), ys = upper.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (!buf.get(x, y) || !pointInPolygon(cx, cy, upper)) continue;
      if (Math.abs((cx - ax) * nx + (cy - ay) * ny) <= 0.9) out.set(x + 1, y + 1, bird.beakShine);
    }
  }
}

function pollenFace(out, bird, ex, ey, h) {
  const feathers = new Set([bird.head, bird.cap, bird.crest, bird.chest].filter(Boolean).flatMap((c) => rampFor(c) || []).map((c) => c.toLowerCase()));
  const cx = ex + 2.5, cy = ey + h / 2;
  for (let y = ey - 4; y <= ey + h + 4; y++) for (let x = ex - 2; x <= ex + 4; x++) {
    const c = out.get(x, y);
    if (!c || !feathers.has(c.toLowerCase())) continue;
    if (((x + 0.5 - cx) / 3.6) ** 2 + ((y + 0.5 - cy) / (h / 2 + 2.6)) ** 2 > 1) continue;
    out.set(x, y, (x + y) % 3 ? "butter" : "beeYellow");
  }
}

function packBird(out, footX, footY, headX, headY, extra = null) {
  const s = { canvas: out.toCanvas(), footX: Math.round(footX) + 1, footY: Math.round(footY) + 1, headX: Math.round(headX) + 1, headY: Math.round(headY) + 1 };
  if (extra) for (const [k, v] of Object.entries(extra)) s[k] = Math.round(v) + 1;
  return s;
}

const SONGBIRD_POSES = {
  stand: {},
  peck: { head: [1.5, 3], beak: "down", tail: 2.5 },
  bob: { tail: 2.5 },
  fly: { wing: "up", legs: 0 },
  drink: { head: [2.6, 5], beak: "down", tail: 3.5 },
  tipUp: { head: [-2.4, -0.6], tilt: -0.55, tail: -1 },       // (the head well back over the body, so looking up reads at any size)
  sing: { head: [-0.5, -0.8], tilt: -0.65, open: 1.3, tail: -1 },
  sing2: { head: [-0.8, -1.2], tilt: -0.8, open: 1.9, tail: -1.5 },
  sleep: { head: [-0.9, 2.4], tilt: 0.45, beak: "tuck", tail: -0.6, body: [1.12, 1.14], legs: 0, asleep: true },
  roost: { head: [-0.9, 2.4], tilt: 0.45, beak: "tuck", hang: 60, body: [1.12, 1.14], legs: 0, asleep: true },   // asleep on a twig, the tail hanging down
  crouch: { head: [0.3, 1.5], tail: 1.5, body: [1.07, 0.9], legs: 1 },
  jump: { head: [0, -0.8], tail: -1.5, body: [0.95, 1.05], legs: "long" },
  soak: { head: [0.8, 1.2], tail: 3, body: [1.1, 1.08], legs: 0, water: true },
  bathe: { head: [0.8, 1.2], tail: 3.5, body: [1.1, 1.08], legs: 0, wing: "half", water: true },
  bathe2: { head: [1.7, 2.6], tail: 4, body: [1.1, 1.08], legs: 0, wing: "low", water: true },
  pant: { open: 1.1, wing: "ajar" },                     // a hot day: the beak held open, the wings a little out from the body
  pant2: { open: 1.1, wing: "ajar", throat: true },       // ...and its throat fluttering (a pixel fuller)
  wings: { wing: "half", tail: -0.5 },                   // wings lifted: a proud flap, showing off
  fan: { wing: "half", open: 1.1, tail: -0.5 },          // fanning itself with a wing, panting
  fanTail: { tail: 3, fanTail: true, head: [-0.3, -0.5], tilt: -0.2 },   // showing off its tail: raised and spread in a fan, head up
};

function turned(cx, cy, dx, dy, angle) {
  if (!angle) return [cx + dx, cy + dy];
  const c = Math.cos(angle), s = Math.sin(angle);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

function songbirdFlap(bird, frame) {
  const L = bird.tail.length;
  const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6, hr = bird.headR || 5.4;
  const beakLen = bird.beakLen || 2.4, beakH = bird.beakH || 2.4;
  const ox = Math.max(0, Math.ceil(L + 4.5 - 10)) + (frame === 1 ? 6 : 0);
  const bx = ox + 10, by = +(1.4 * hr + 1.1 * ry).toFixed(1);
  const hx = bx + rx * 0.77, hy = by - ry * 1.22;
  const W = Math.ceil(hx + hr * 0.85 + beakLen + 3), H = Math.ceil(by + ry * (frame === 2 ? 2.4 : 1.1) + 2);
  const buf = new PixelBuffer(W, H);
  buf.polygon([[bx - rx * 0.58, by - 1.2], [bx - rx * 0.58, by + 1.6], [bx - 3.5 - L, by + 0.2 - L * 0.12], [bx - 3.5 - L, by - 2.4 - L * 0.12]], bird.tail.color);
  const body = [bx, by, rx, ry];
  buf.ellipse(...body, bird.body);
  if (bird.mantle) buf.ellipse(bx + rx * 0.2, by - ry * 0.75, rx * 0.45, ry * 0.3, bird.mantle, { onlyFilled: true, shadeAs: body });
  buf.ellipse(bx + rx * 0.2, by + ry * 0.35, rx * 0.88, ry * 0.65, bird.belly, { onlyFilled: true, shadeAs: body });
  buf.ellipse(bx + rx * 0.65, by - ry * 0.13, rx * 0.46, ry * 0.65, bird.chest, { onlyFilled: true, shadeAs: body, clip: (x, y) => y < by + 0.5 });
  if (bird.bellyStripe) buf.rect(bx + rx * 0.3, by - ry * 0.45, 1.6, ry * 1.25, bird.bellyStripe, { onlyFilled: true, flat: true });
  let wing, tip;
  if (frame === 1) {
    wing = [[bx - rx * 0.45, by - ry * 0.6], [bx + rx * 0.4, by - ry * 0.62], [bx - rx * 1.1, by - ry * 1.2], [bx - rx * 2.2, by - ry * 0.95]];
    tip = [[bx - rx * 2.2, by - ry * 0.95], [bx - rx * 1.1, by - ry * 1.2], [bx - rx * 2.9, by - ry * 1.3]];
  } else {
    wing = [[bx - rx * 0.5, by - ry * 0.25], [bx + rx * 0.35, by - ry * 0.35], [bx - rx * 0.1, by + ry * 1.75], [bx - rx * 1.1, by + ry * 1.45]];
    tip = [[bx - rx * 1.1, by + ry * 1.45], [bx - rx * 0.1, by + ry * 1.75], [bx - rx * 0.75, by + ry * 2.35]];
  }
  buf.polygon(wing, bird.wing);
  buf.polygon(tip, bird.wingTip);
  if (bird.wingPatch && bird.wing === "ink") {
    const [a, b2, c] = frame === 1 ? [wing[2], wing[3], 0.5] : [wing[2], wing[3], 0.5];
    buf.line(a[0] * c + wing[0][0] * (1 - c), a[1] * c + wing[0][1] * (1 - c), b2[0], b2[1], 1.6, bird.wingPatch, { onlyFilled: true });
  }
  const head = [hx, hy, hr, hr * 0.96];
  buf.ellipse(...head, bird.head);
  buf.ellipse(...head, bird.cap, { onlyFilled: true, clip: (x, y) => y < hy - hr * 0.37 });
  if (bird.crest) for (const [dx, h] of [[-3, 3.2], [-1, 3.8], [1, 2.6]]) buf.triangle(hx + dx - 1.2, hy - hr * 0.7, hx + dx + 1.2, hy - hr * 0.8, hx + dx - 2, hy - hr - h, bird.crest);
  const cs = bird.cheekSize || 1;
  buf.ellipse(hx + hr * 0.26, hy + hr * (bird.cheekY || 0.44), hr * 0.41 * cs, hr * 0.26 * cs, bird.cheek, { onlyFilled: true, shadeAs: head });
  if (bird.bib) buf.ellipse(hx + hr * 0.42, hy + hr * 0.92, hr * 0.3, hr * 0.24, bird.bib, { onlyFilled: true, flat: true });
  if (bird.neckSpot) buf.circle(hx - hr * 0.55, hy + hr * 0.55, 1.1, bird.neckSpot, { onlyFilled: true, flat: true });
  const bxp = hx + hr * 0.85, byp = hy - beakH * 0.25;
  buf.triangle(bxp, byp, bxp + beakLen, byp + beakH * 0.5, bxp, byp + beakH, bird.beak, { flat: true });
  const out = outline(buf);
  shineBeak(out, buf, bird, [[bxp, byp], [bxp + beakLen, byp + beakH * 0.5], [bxp, byp + beakH * 0.5]]);
  birdEye(out, Math.round(hx + hr * 0.22) + 1, Math.round(hy - hr * 0.37) + 1, bird, 2, hr < 4 ? 2 : 3);
  return packBird(out, bx, by + ry * 0.93 + 2, hx, hy - hr);
}

const roostLeafCache = {};
function roostLeaves(bird, n, step, color = "leaf") {
  const key = [bird.name, n, step, color].join("/");
  if (roostLeafCache[key]) return roostLeafCache[key];
  const s = renderBird(bird, "roost"), headH = s.footY - s.headY;
  const w = Math.round((n - 1) * step + 24), h = headH + 12, ax = w / 2, ay = headH + 5;
  const back = new PixelBuffer(w, h);
  clumpCanopy(back, ax, ay - headH / 2 + 0.5, w / 2 - 0.5, headH / 2 + 4.5, color, 40 + n, { clump: 3.4, tips: 6, bias: 1 });
  const front = new PixelBuffer(w, h);
  const spots = [[ax - w / 2 + 4, ay - 1, 3.4], [ax + w / 2 - 4, ay - 1, 3.4]];
  for (let i = 1; i < n - 1; i += 2) spots.push([ax + (i - (n - 1) / 2) * step, ay + 1, 2.4]);
  spots.forEach(([x, y, r], k) => clumpCanopy(front, x, y, r + 0.5, r, color, 50 + k, { clump: r * 0.75, tips: 2, inner: 1 }));
  return (roostLeafCache[key] = { back: outline(back).toCanvas(), front: outline(front).toCanvas(), ax: Math.round(ax) + 1, ay: ay + 1 });
}

function bobbed(s) {
  const c = document.createElement("canvas");
  c.width = s.canvas.width; c.height = s.canvas.height;
  const g = c.getContext("2d");
  g.drawImage(s.canvas, 0, 1);
  g.clearRect(0, s.footY, c.width, c.height);
  g.drawImage(s.canvas, 0, s.footY, c.width, 1, 1, s.footY, c.width, 1);
  return { ...s, canvas: c };
}

function waderFlying(bird, stocky) {
  const buf = new PixelBuffer(40, 26);
  const bx = 18, by = 15;
  buf.line(bx - 6, by + 1, bx - 17, by + 3, 1.2, bird.legs);                 // legs trailing behind
  buf.ellipse(bx, by, 8, 4.4, bird.body);
  buf.polygon([[bx - 6, by - 2], [bx + 5, by - 3], [bx + 1, by - 13], [bx - 9, by - 11]], bird.wing, { shadeAs: [bx - 2, by - 8, 7, 6] });
  if (bird.back) buf.ellipse(bx - 1, by - 2, 6, 1.6, bird.back, { onlyFilled: true });
  const hx = bx + 9, hy = by - 3, hr = stocky ? 4 : 3.6;
  buf.circle(hx, hy, hr, bird.head || bird.neck || bird.body);
  if (bird.cap) buf.circle(hx, hy, hr, bird.cap, { onlyFilled: true, clip: (x, y) => y < hy - 0.5 });
  if (bird.crest) buf.line(hx - 1, hy - 1, hx - 6, hy - 2, 1, bird.crest);
  const len = Math.min(bird.beakLen || 8, 7);
  buf.triangle(hx + hr * 0.8, hy - 0.8, hx + hr * 0.8 + len, hy + 0.4, hx + hr * 0.8, hy + 1.2, bird.beak, { flat: true });
  const out = outline(buf);
  birdEye(out, Math.round(hx + 0.4) + 1, Math.round(hy - 1.4) + 1, bird, 2, 2);
  return packBird(out, bx, by + 8, hx, hy - hr);
}

function cormorantFlying(bird) {
  const buf = new PixelBuffer(34, 22);
  const bx = 14, by = 13;
  buf.ellipse(bx, by, 8, 3.6, bird.body);
  buf.polygon([[bx - 5, by - 1], [bx + 4, by - 2], [bx + 1, by - 11], [bx - 8, by - 9]], bird.wing, { shadeAs: [bx - 2, by - 6, 7, 6] });
  buf.line(bx + 6, by - 1, bx + 12, by - 2.5, 2.6, bird.body, { flat: false });
  const hx = bx + 13, hy = by - 3, hr = 3;
  buf.circle(hx, hy, hr, bird.head || bird.body);
  buf.ellipse(hx + 0.4, hy + 1.4, 1.6, 1, bird.cheek, { onlyFilled: true, flat: true });
  buf.polygon([[hx + 2.2, hy - 0.4], [hx + 7, hy + 0.2], [hx + 7, hy + 1.4], [hx + 2.2, hy + 1.2]], bird.beak, { flat: true });
  buf.rect(bx - 12, by - 1, 5, 2, bird.body);                                 // the tail
  const out = outline(buf);
  birdEye(out, Math.round(hx + 0.2) + 1, Math.round(hy - 1.2) + 1, bird, 2, 2);
  return packBird(out, bx, by + 6, hx, hy - hr);
}

function owlFlying(bird) {
  const buf = new PixelBuffer(28, 18);
  const cx = 14;
  for (const s of [-1, 1]) buf.polygon([[cx + s * 3, 8], [cx + s * 13, 4], [cx + s * 12, 10], [cx + s * 4, 13]], bird.body, { shadeAs: [cx + s * 8, 7, 6, 5] });
  buf.ellipse(cx, 10, 4.6, 5.4, bird.body);
  buf.ellipse(cx, 6, 4.6, 4.2, bird.head || bird.body);
  buf.ellipse(cx, 6.6, 3.6, 3, bird.face, { onlyFilled: true, flat: true });
  const out = outline(buf);
  for (const ex of [cx - 3, cx + 1]) { out.set(ex + 1, 6, bird.eyes || "beeYellow"); out.set(ex + 2, 6, "plum"); }
  return packBird(out, cx, 16, cx, 1);
}

const BIRD_SHAPES = {
  songbird(bird, pose) {
    const P = SONGBIRD_POSES[pose] || {};
    const L = bird.tail.length;
    const rx0 = bird.bodyRx || 5.2, ry0 = bird.bodyRy || 4.6, hr = bird.headR || 5.4;
    const [fx, fy] = P.body || [1, 1];
    const rx = rx0 * fx, ry = ry0 * fy;                              // (fluffed up or squashed)
    const beakLen = bird.beakLen || 2.4, beakH = bird.beakH || 2.4, legLen = bird.legLen || 1.6;
    const flying = P.wing === "up";
    const legs = P.legs === undefined ? legLen : P.legs === "long" ? legLen + 1.5 : P.legs;
    const ox = Math.max(0, Math.ceil(L + 4.5 - 10), P.water ? Math.ceil(rx * 2.5 - 9) : 0, P.fanTail ? Math.ceil(L + 3.2 + rx * 0.55 - 9) : 0);
    const [dhx, dhy] = P.head || [0, 0];
    const by0 = +(1.4 * hr + 1.1 * ry0).toFixed(1);                  // (the magpie: 12.6)
    const top = Math.max(0, Math.ceil(hr + (bird.crest ? 3.8 : 0) - (by0 - ry0 * 1.22 + dhy)), P.fanTail ? Math.ceil(L + 4.7 - by0) : 0);
    const bx = ox + 10, by = by0 + top;
    const hx = bx + rx0 * 0.77 + dhx, hy = by - ry0 * 1.22 + dhy;
    const water = P.water ? Math.round(by + ry * 0.2) : null;
    const clip = water === null ? undefined : (x, y) => y < water;
    const hang = P.hang ? { a: (P.hang * Math.PI) / 180, x: bx - rx * 0.58 + 0.6, y: by + 0.2, len: L + 2 } : null;
    const W = Math.ceil(hx + hr * 0.85 + beakLen + 3);
    const H = water === null ? Math.ceil(Math.max(by + ry + (flying ? legLen : legs), hang ? hang.y + Math.sin(hang.a) * hang.len + 1 : 0) + 2) : water + 1;
    const buf = new PixelBuffer(W, H);

    const lift = P.tail || 0;
    if (hang) {
      const dx = -Math.cos(hang.a), dy = Math.sin(hang.a), nx = dy, ny = -dx;
      const tx = hang.x + dx * hang.len, ty = hang.y + dy * hang.len;
      buf.polygon([[hang.x + nx * 1.5, hang.y + ny * 1.5], [hang.x - nx * 1.5, hang.y - ny * 1.5], [tx - nx * 0.8, ty - ny * 0.8], [tx + nx * 0.8, ty + ny * 0.8]], bird.tail.color);
    } else {
      buf.polygon([
        [bx - rx * 0.58, by - 1.2], [bx - rx * 0.58, by + 1.6],
        [bx - 3.5 - L, by - 0.6 - L * 0.12 - lift], [bx - 3.5 - L, by - 2 - L * 0.12 - lift],
      ], bird.tail.color, { clip });
    }

    let wing = null, tip = null;
    if (P.wing === "half") {
      wing = [[bx - rx * 0.45, by - ry * 0.3], [bx + rx * 0.35, by - ry * 0.5], [bx - rx * 0.55, by - ry * 1.75], [bx - rx * 1.55, by - ry * 1.35]];
      tip = [wing[3], wing[2], [bx - rx * 1.45, by - ry * 2.15]];
      const far = (pts) => pts.map(([x, y]) => [x + rx * 0.5, y - ry * 0.2]);
      buf.polygon(far(wing), rampFor(bird.wing)[2], { flat: true });
      buf.polygon(far(tip), rampFor(bird.wingTip)[2], { flat: true });
    } else if (P.wing === "low") {
      wing = [[bx - rx * 0.5, by - ry * 0.5], [bx + rx * 0.3, by - ry * 0.45], [bx - rx * 0.9, by + ry * 0.15], [bx - rx * 2.3, by + ry * 0.1], [bx - rx * 2.0, by - ry * 0.3]];
      tip = [[bx - rx * 1.6, by - ry * 0.4], [bx - rx * 1.7, by + ry * 0.15], [bx - rx * 2.45, by + ry * 0.1]];
    }

    if (P.fanTail) {
      const cx = bx - rx * 0.55, cy = by - 0.5, R = L + 3.2, a0 = Math.PI * 1.04, a1 = Math.PI * 1.46, n = 5;
      const T = rampFor(bird.tail.color), ray = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      for (let i = 0; i < n; i++) {
        const f0 = a0 + ((a1 - a0) * i) / n, f1 = a0 + ((a1 - a0) * (i + 1)) / n;
        buf.polygon([[cx + 0.5, cy + 1.2], ...[0, 1, 2, 3].map((k) => ray(f0 + ((f1 - f0) * k) / 3, R))], i % 2 ? T[2] : T[1], { clip, flat: true });
      }
      const fringe = paletteColor(bird.tail.fringe || T[0]);
      for (let y = Math.floor(cy - R); y <= cy; y++) for (let x = Math.floor(cx - R); x <= cx; x++) {
        if ((buf.get(x, y) === T[1] || buf.get(x, y) === T[2]) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R - 1.4) buf.set(x, y, fringe);
      }
      for (let i = 1; i < n; i++) buf.set(...ray(a0 + ((a1 - a0) * i) / n, R - 0.4), null);      // (a notch in the rim between two feathers)
    }

    const body = [bx, by, rx, ry];
    buf.ellipse(...body, bird.body, { clip });
    if (bird.mantle) buf.ellipse(bx + rx * 0.2, by - ry * 0.75, rx * 0.45, ry * 0.3, bird.mantle, { onlyFilled: true, shadeAs: body });
    buf.ellipse(bx + rx * 0.2, by + ry * 0.35, rx * 0.88, ry * 0.65, bird.belly, { onlyFilled: true, shadeAs: body });
    buf.ellipse(bx + rx * 0.65, by - ry * 0.13, rx * 0.46, ry * 0.65, bird.chest, { onlyFilled: true, shadeAs: body, clip: (x, y) => y < by + 0.5 });
    if (bird.bellyStripe) buf.rect(bx + rx * 0.3, by - ry * 0.45, 1.6, ry * 1.25, bird.bellyStripe, { onlyFilled: true, flat: true });

    if (flying) {
      buf.polygon([[bx - rx * 0.4, by - ry * 0.4], [bx + rx * 0.4, by - ry * 0.5], [bx - rx * 0.2, by - ry * 2.2], [bx - rx * 1.3, by - ry * 1.8]], bird.wing);
      buf.polygon([[bx - rx * 1.3, by - ry * 1.8], [bx - rx * 0.2, by - ry * 2.2], [bx - rx * 0.9, by - ry * 2.6]], bird.wingTip);
    } else if (wing) {
      buf.polygon(wing, bird.wing, { clip });
      buf.polygon(tip, bird.wingTip, { clip });
      const at = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const back = wing[3], front = wing[2];
      if (bird.wingPatch) buf.line(...at(wing[0], front, 0.35), ...at(wing[1], back, 0.8), 1.6, bird.wingPatch, { onlyFilled: true, clip });
      else if (bird.wingBar) buf.line(...at(wing[0], back, 0.3), ...at(wing[1], front, 0.3), 1, bird.wingBar, { onlyFilled: true, clip });
    } else {
      const ajar = P.wing === "ajar" ? 1 : 0;
      const wing = [bx - rx * 0.31 - ajar * 0.6, by - ry * 0.2 + ajar * 1.4, rx * 0.69, ry * 0.46];
      if (ajar) buf.line(bx - rx * 0.95, by - ry * 0.05 + 0.6, bx + rx * 0.3, by - ry * 0.45 + 0.6, 1, rampFor(bird.body)[3], { onlyFilled: true });
      buf.ellipse(...wing, bird.wing, clip && { clip });
      buf.polygon([[bx - rx * 0.88 - ajar, by - ry * 0.35 + ajar * 1.4], [bx - rx * 0.88 - ajar, by + ry * 0.39 + ajar * 1.4], [bx - rx * 1.54 - ajar * 1.5, by + ry * 0.26 + ajar * 2.4]], bird.wingTip, clip && { clip });
      if (bird.wingPatch) buf.ellipse(bx - rx * 0.15, by - ry * 0.26, rx * 0.54, ry * 0.3, bird.wingPatch, { onlyFilled: true, shadeAs: wing });
      if (bird.wingBar) buf.line(bx - rx * 0.9, by + ry * 0.05, bx + rx * 0.25, by - ry * 0.25, 1, bird.wingBar, { onlyFilled: true });
      if (bird.wingScales) {
        for (let i = 0; i < 6; i++) buf.set(bx - rx * 0.7 + (i % 3) * 2.2 + (i > 2 ? 1 : 0), by - ry * 0.35 + (i > 2 ? 1.6 : 0), RAMPS[bird.wingScales] ? RAMPS[bird.wingScales][2] : bird.wingScales);
      }
    }

    const tilt = P.tilt || 0;
    const at = (dx, dy) => turned(hx, hy, dx, dy, tilt);
    const head = [hx, hy, hr, hr * 0.96];
    buf.ellipse(...head, bird.head);
    const capClip = tilt ? (x, y) => turned(0, 0, x - hx, y - hy, -tilt)[1] < -hr * 0.37 : (x, y) => y < hy - hr * 0.37;
    buf.ellipse(...head, bird.cap, { onlyFilled: true, clip: capClip });
    if (bird.crest) {
      for (const [dx, h] of [[-3, 3.2], [-1, 3.8], [1, 2.6]]) {
        buf.triangle(...at(dx - 1.2, -hr * 0.7), ...at(dx + 1.2, -hr * 0.8), ...at(dx - 2, -hr - h), bird.crest);
      }
    }
    const mark = (dx, dy, mrx, mry, paint, opts) => (tilt ? buf.rotEllipse(...at(dx, dy), mrx, mry, tilt, paint, opts) : buf.ellipse(hx + dx, hy + dy, mrx, mry, paint, opts));
    const cheekScale = bird.cheekSize || 1;
    mark(hr * 0.26, hr * (bird.cheekY || 0.44), hr * 0.41 * cheekScale, hr * 0.26 * cheekScale, bird.cheek, { onlyFilled: true, shadeAs: head });
    if (P.asleep && bird.sleepFace) mark(hr * 0.22 + 0.2, -hr * 0.37 + 2, 2.4, 1.7, bird.sleepFace, { onlyFilled: true, flat: true });
    if (bird.bib) mark(hr * 0.42, hr * 0.92, hr * 0.3, hr * 0.24, bird.bib, { onlyFilled: true, flat: true });
    if (bird.breastBand) mark(hr * 0.3, hr * 1.0, hr * 0.62, hr * 0.26, bird.breastBand, { onlyFilled: true, flat: true });
    if (bird.neckSpot) buf.circle(...at(-hr * 0.55, hr * 0.55), 1.1, bird.neckSpot, { onlyFilled: true, flat: true });
    if (bird.neckPatch) {
      const [px, py] = at(-hr * 0.8, hr * 0.2);
      for (let i = 0; i < 4; i++) buf.rect(Math.round(px), Math.round(py) + i, 2, 1, i % 2 ? "heronGrey" : bird.neckPatch, { onlyFilled: true, flat: true });
    }

    const bxp = hx + hr * 0.85, byp = hy - beakH * 0.25;
    let beakTip = [bxp + beakLen, byp + beakH * 0.5];
    const mouth = [];
    let upperBeak = [[bxp, byp], beakTip, [bxp, byp + beakH * 0.5]];
    if (P.beak === "down") {
      buf.triangle(bxp - 0.6, byp, bxp + beakLen * 0.6, byp + beakLen * 0.9, bxp - 0.6, byp + beakH, bird.beak, { flat: true });
      beakTip = [bxp + beakLen * 0.6, byp + beakLen * 0.9];
      upperBeak = [[bxp - 0.6, byp], beakTip, [bxp - 0.6, byp + beakH * 0.5]];
    } else if (tilt || P.open) {
      const open = P.open || 0, x0 = hr * 0.85, len = beakLen * (P.beak === "tuck" ? 0.75 : open ? 1.35 : 1);
      const g = [x0, beakH * 0.25], T = [x0 + len, beakH * 0.25];
      const half = (pts, a) => pts.map(([x, y]) => at(...turned(g[0], g[1], x - g[0], y - g[1], a)));
      const upper = half([[x0, -beakH * 0.25], T, g], -open / 2), lower = half([g, T, [x0, beakH * 0.75]], open / 2);
      buf.polygon(upper, bird.beak, { flat: true });
      buf.polygon(lower, bird.beak, { flat: true });
      beakTip = at(...T);
      upperBeak = upper;
      if (open) {
        const toward = (p, k) => [upper[2][0] + (p[0] - upper[2][0]) * k, upper[2][1] + (p[1] - upper[2][1]) * k];
        const wedge = [upper[2], toward(upper[1], 0.75), toward(lower[1], 0.75)];
        const xs = wedge.map((p) => p[0]), ys = wedge.map((p) => p[1]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
          for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) if (pointInPolygon(x + 0.5, y + 0.5, wedge)) mouth.push([x, y]);
        }
      }
    } else {
      buf.triangle(bxp, byp, bxp + beakLen, byp + beakH * 0.5, bxp, byp + beakH, bird.beak, { flat: true });
    }

    if (P.throat) buf.ellipse(...at(hr * 0.62, hr * 0.62), 1.3, 1.1, bird.bib || bird.chest || bird.head, { flat: true });

    if (!flying && legs > 0) {
      buf.rect(bx - rx * 0.31, by + ry * 0.93, 1, legs, bird.legs, { flat: true });
      buf.rect(bx + rx * 0.23, by + ry * 0.93, 1, legs, bird.legs, { flat: true });
    }

    const out = outline(buf);
    for (const [x, y] of mouth) if (!buf.get(x, y)) out.set(x + 1, y + 1, "coral");
    shineBeak(out, buf, bird, upperBeak);
    const [exf, eyf] = at(hr * 0.22 - (P.asleep ? 0.8 : 0), -hr * 0.37);
    const ex = Math.round(exf) + 1, ey = Math.round(eyf) + 1;
    birdEye(out, ex, ey, bird, 2, hr < 4 ? 2 : 3, true, !!P.asleep);
    if (water !== null) for (let x = Math.round(bx - rx * 1.3); x < bx + rx * 1.4; x += 2) out.set(x + 1, water + 1, RAMPS.pond[0]);   // ripples
    const footY = water !== null ? water : by + ry * 0.93 + (flying ? legLen : legs) + 0.5;
    return packBird(out, bx, footY, hx, hy - hr, { beakX: beakTip[0], beakY: beakTip[1] });
  },

  duck(bird, pose) {
    const s = bird.size || 1;
    const onLand = pose === "walk" || pose === "walk2", flying = pose === "fly";
    const W = Math.ceil(28 * s) + 2, H = Math.ceil(20 * s) + (onLand ? 6 : 2);
    const buf = new PixelBuffer(W, H);
    const ground = H - 1;
    const water = onLand || flying ? H : Math.round(14 * s) + 0.5;     // the waterline
    const bw = (bird.bodyW || 8) * s, bh = 4.2 * s;
    const cx = 11 * s + 1, cy = onLand ? ground - 3 - bh * 0.9 : flying ? H * 0.55 : water - 2.4 * s;
    const clip = onLand || flying ? undefined : (x, y) => y < water;

    if (pose === "dabble") {
      const rear = [cx, water, 6.2 * s, 6.4 * s];
      buf.ellipse(...rear, bird.body, { clip });
      buf.ellipse(cx + 1.2 * s, water - 1.6 * s, 4.2 * s, 2.2 * s, bird.wing, { onlyFilled: true, shadeAs: rear });
      if (bird.speculum) buf.rect(cx - 1.5 * s, water - 2.2 * s, 4 * s, 1, bird.speculum, { onlyFilled: true, flat: true });
      buf.triangle(cx - 3.2 * s, water - 4.2 * s, cx + 0.2 * s, water - 5.6 * s, cx - 3 * s, water - 10 * s, bird.tail.color);
      if (bird.tailCurl) { buf.set(cx - 3.4 * s, water - 10.6 * s, bird.tailCurl); buf.set(cx - 2.4 * s, water - 11 * s, bird.tailCurl); }
      for (const [fx, tip] of [[cx + 2.5 * s, -9.2], [cx + 4.8 * s, -7.6]]) {
        buf.rect(fx - 0.5, water - 6 * s, 1, 2 * s, bird.legs, { flat: true });
        buf.triangle(fx - 1.6 * s, water + tip * s + 1.8 * s, fx + 1.6 * s, water + tip * s + 1.8 * s, fx, water + tip * s, bird.legs, { flat: true });
      }
      const out = outline(buf);
      for (let x = Math.round(cx - 7 * s); x < cx + 8 * s; x += 2) out.set(x, Math.round(water) + 1, RAMPS.pond[0]);
      return packBird(out, cx, water, cx, water - 11 * s);
    }

    const body = [cx, cy, bw, bh];
    buf.ellipse(...body, bird.body, { clip });
    if (bird.fuzzy) buf.ellipse(cx + 1.5 * s, cy + 1.2 * s, bw * 0.69, 2.6 * s, bird.belly, { onlyFilled: true, shadeAs: body });
    buf.ellipse(cx + bw * 0.62, cy, 3.8 * s, 3.6 * s, bird.chest, { onlyFilled: true, shadeAs: body });
    buf.triangle(cx - bw * 0.87, cy - 1.2 * s, cx - bw * 0.87 - 3.5 * s, cy - 3.5 * s, cx - bw * 0.81, cy + 1.2 * s, bird.tail.color);
    if (bird.tailCurl) { buf.set(cx - 10 * s, cy - 4.5 * s, bird.tailCurl); buf.set(cx - 9 * s, cy - 5.2 * s, bird.tailCurl); buf.set(cx - 8.4 * s, cy - 4.4 * s, bird.tailCurl); }
    if (flying) {
      buf.polygon([[cx - bw * 0.5, cy - 1], [cx + bw * 0.25, cy - 1.5], [cx - bw * 0.1, cy - 9 * s], [cx - bw * 0.85, cy - 7.5 * s]], bird.wing, { shadeAs: [cx - bw * 0.3, cy - 5 * s, bw * 0.6, 5 * s] });
      if (bird.speculum) buf.line(cx - bw * 0.62, cy - 5.6 * s, cx - bw * 0.1, cy - 6.4 * s, 1.2, bird.speculum, { onlyFilled: true });
    } else {
      const wing = [cx - 1.5 * s, cy - 0.8 * s, bw * 0.65, 2.2 * s];
      buf.ellipse(...wing, bird.wing, { onlyFilled: true });
      if (bird.speculum) {
        buf.rect(cx - 3 * s, cy - 0.4 * s, 3.6 * s, 1, "snow", { onlyFilled: true, flat: true });
        buf.rect(cx - 3 * s, cy + 0.6 * s, 3.6 * s, 1.2, bird.speculum, { onlyFilled: true, flat: true });
        buf.rect(cx - 3 * s, cy + 1.8 * s, 3.6 * s, 1, "snow", { onlyFilled: true, flat: true });
      }
    }
    if (bird.spots) for (let i = 0; i < 7; i++) buf.set(cx - 5 * s + (i * 2.3 * s) % (10 * s), cy - 1.5 * s + (i % 3) * 1.2 * s, RAMPS[bird.body][3]);

    const hr = (bird.headR || 4.4) * s;
    const hx = flying ? cx + bw + 1.5 * s : cx + 7.4 * s, hy = flying ? cy - 3 * s : cy - 7.2 * s;
    buf.line(cx + bw * 0.65, cy - 1.5 * s, hx - 0.5, hy + 1.5, 3.2 * s, bird.head, { flat: false });
    if (bird.neckRing) buf.rect(hx - 2.2 * s, hy + hr * 0.95, 3.6 * s, 1, bird.neckRing, { flat: true, onlyFilled: true });
    const head = [hx, hy, hr, hr * 0.95];
    buf.ellipse(...head, bird.head);
    if (bird.face) buf.ellipse(hx + hr * 0.2, hy + hr * 0.2, hr * 0.75, hr * 0.6, bird.face, { onlyFilled: true, shadeAs: head });
    if (bird.cap) buf.ellipse(...head, bird.cap, { onlyFilled: true, clip: (x, y) => y < hy - hr * 0.45 });
    if (bird.eyeStripe) buf.line(hx - hr * 0.95, hy + 0.3, hx - 0.8, hy + 0.3, 1, bird.eyeStripe, { onlyFilled: true });
    const bl = hx + hr * 0.75, bt = hy - 0.2;
    buf.polygon([[bl, bt], [bl + 4.6 * s, bt + 0.8 * s], [bl + 4.6 * s, bt + 2.2 * s], [bl, bt + 2.3 * s]], bird.beak, { flat: true });
    if (bird.billTip) buf.rect(bl + 3.6 * s, bt + 0.8 * s, 1.2 * s, 1.4 * s, bird.billTip, { flat: true });
    if (onLand) {
      const legTop = Math.round(cy + bh * 0.8);
      for (const [i, lx] of [[0, cx - 2 * s], [1, cx + 1.5 * s]]) {
        const lift = pose === "walk2" ? (i === 0 ? 1 : 0) : (i === 1 ? 1 : 0);
        buf.rect(Math.round(lx), legTop, 1, ground - legTop - lift, bird.legs, { flat: true });
        buf.rect(Math.round(lx), ground - lift, 2, 1, bird.legs, { flat: true });
      }
    }
    if (flying) buf.rect(cx - bw * 0.3, cy + bh * 0.7, 3, 1, bird.legs, { flat: true, onlyFilled: false });

    const out = outline(buf);
    birdEye(out, Math.round(hx + hr * 0.1) + 1, Math.round(hy - hr * 0.35) + 1, bird, 2, hr < 3.5 ? 2 : 3);
    if (!onLand && !flying) for (let x = Math.round(cx - 8 * s); x < cx + 9 * s; x += 2) out.set(x + 1, Math.round(water) + 1, RAMPS.pond[0]);  // ripple
    return packBird(out, cx, onLand ? ground + 1 : flying ? cy + bh + 4 : water, hx, hy - hr);
  },

  wader(bird, pose) {
    const stocky = !!bird.stocky;
    const W = 34, H = stocky ? 30 : 36;
    const buf = new PixelBuffer(W, H);
    const ground = H - 1;
    const legTop = stocky ? ground - 9 : ground - 12;
    const bx = 12, by = legTop - (stocky ? 4.5 : 4);
    const walking = pose === "walk", striking = pose === "strike";
    if (pose === "fly") return waderFlying(bird, stocky);

    const legs = walking ? [[bx - 2, bx - 5], [bx + 1.5, bx + 4]] : [[bx - 1.5, bx - 3], [bx + 1.5, bx + 3]];
    for (const [top, bottom] of legs) {
      buf.line(top, legTop, bottom, ground - 0.5, 1.2, bird.legs);
      buf.rect(bottom, ground - 1, 2, 1, bird.feet || bird.legs, { flat: true });
    }
    const body = [bx, by, stocky ? 7.5 : 7.2, stocky ? 5.6 : 4.6];
    buf.ellipse(...body, bird.body);
    buf.ellipse(bx - 1, by - 1, body[2] * 0.85, body[3] * 0.72, bird.wing, { onlyFilled: true, shadeAs: body });
    if (bird.back) buf.ellipse(bx - 0.5, by - body[3] * 0.55, body[2] * 0.8, body[3] * 0.45, bird.back, { onlyFilled: true, shadeAs: body });
    buf.triangle(bx - body[2] + 1, by - 1, bx - body[2] - 3, by + 1, bx - body[2] + 1, by + 2, bird.wing);
    if (bird.plumes) for (let i = 0; i < 3; i++) buf.line(bx - 2 + i, by - 3, bx - 8 + i, by + 1 + i, 1, bird.plumes, { onlyFilled: false });

    let hx, hy;
    const neckW = stocky ? 3.6 : 2.6;
    if (stocky) {
      hx = bx + 6.5; hy = by - 5.5;
      buf.line(bx + 4, by - 2, hx - 1, hy + 2, neckW, bird.neck || bird.body, { flat: false });
    } else if (striking) {
      hx = bx + 15; hy = by + 3;
      buf.line(bx + 5, by - 2, hx - 1, hy - 1, neckW, bird.neck || bird.body, { flat: false });
    } else {
      hx = bx + 7; hy = by - 13;
      const pts = [[bx + 5, by - 3], [bx + 7, by - 6.5], [bx + 5.5, by - 9.5], [hx, hy + 2]];
      for (let i = 0; i < 3; i++) buf.line(...pts[i], ...pts[i + 1], neckW, bird.neck || bird.body, { flat: false });
      if (bird.neckStreaks) for (const [dx, y] of [[7, -7], [6, -5], [6.5, -9]]) buf.set(Math.round(bx + dx), Math.round(by + y), bird.neckStreaks);
    }
    const hr = stocky ? 4.2 : 4;
    buf.circle(hx, hy, hr, bird.head || bird.neck || bird.body);
    if (bird.cap) buf.circle(hx, hy, hr, bird.cap, { onlyFilled: true, clip: (x, y) => y < hy - 0.5 });
    if (bird.crest) buf.line(hx - 1, hy - 1, hx - 7, hy - 3, 1, bird.crest);
    if (bird.faceWhite) buf.ellipse(hx + 0.6, hy + 1.2, hr * 0.7, hr * 0.55, "snow", { onlyFilled: true, flat: true });
    const bl = hx + hr * 0.8, len = bird.beakLen || 8;
    if (striking) buf.triangle(bl - 1, hy - 0.8, bl + len * 0.7, hy + len * 0.6, bl - 1, hy + 1.4, bird.beak, { flat: true });
    else buf.triangle(bl, hy - 0.9, bl + len, hy + 0.5, bl, hy + 1.3, bird.beak, { flat: true });

    const out = outline(buf);
    birdEye(out, Math.round(hx + 0.4) + 1, Math.round(hy - 1.6) + 1, bird, 2, 3);
    return packBird(out, bx, ground + 1, hx, hy - hr);
  },

  cormorant(bird, pose) {
    if (pose === "fly") return cormorantFlying(bird);
    const spread = pose === "spread";
    const W = spread ? 36 : 24, H = 30;
    const buf = new PixelBuffer(W, H);
    const cx = spread ? 18 : 11, ground = H - 1;
    if (spread) {
      for (const side of [-1, 1]) {
        const wing = [[cx + side * 2, 11], [cx + side * 9, 7.5], [cx + side * 15.5, 8.5], [cx + side * 17, 12]];
        for (let i = 4; i >= 0; i--) wing.push([cx + side * (4 + i * 3), 18.5 - i * 1.1 + (i % 2) * 1.2]);
        buf.polygon(wing, bird.wing);
        buf.line(cx + side * 4, 11, cx + side * 14.5, 10, 1.4, bird.wingEdge || bird.wing, { onlyFilled: true });
      }
    }
    const body = [cx, 19.2, 4.8, 6.4];
    buf.ellipse(...body, bird.body);
    buf.triangle(cx - 2, ground - 3, cx + 2, ground - 3, cx - 1, ground, bird.body);
    buf.line(cx + 1.5, 13, cx + 2.5, 8, 2.8, bird.body, { flat: false });
    const hx = cx + 3, hy = 5.4, hr = 4.2;                                  // a big chibi head
    buf.circle(hx, hy, hr, bird.head || bird.body);
    buf.ellipse(hx + 0.6, hy + 2.3, 2.3, 1.5, bird.cheek, { onlyFilled: true, flat: true });
    buf.rect(hx + 1.8, hy + 3, 1.6, 1.5, bird.throat || "beeYellow", { flat: true });
    buf.polygon([[hx + 3.4, hy - 0.4], [hx + 8.5, hy + 0.3], [hx + 8.5, hy + 1.6], [hx + 3.4, hy + 1.3]], bird.beak, { flat: true });
    buf.set(hx + 8.5, hy + 1.6, bird.beak);
    buf.rect(cx - 2, ground - 1.5, 4, 1.5, bird.legs, { flat: true });
    const out = outline(buf);
    birdEye(out, Math.round(hx + 0.4) + 1, Math.round(hy - 1.6) + 1, bird, 2, 3);
    return packBird(out, cx, ground, hx, hy - hr);
  },

  grebe(bird) {
    const W = 21, H = 17, water = 12;
    const buf = new PixelBuffer(W, H);
    const clip = (x, y) => y < water;
    const body = [9, 10.2, 5.6, 4.2];
    buf.circle(4, 8.6, 2.8, bird.rear || bird.body, { clip });                      // the fluffy rear, tipped up
    buf.ellipse(...body, bird.body, { clip });
    const hx = 13, hy = 5.6, hr = 4;
    const head = [hx, hy, hr, hr];
    buf.ellipse(hx - 0.6, hy + 3.6, 2.8, 2.4, bird.cheek, { shadeAs: [hx - 1, hy + 1, 4, 4] });   // the chestnut neck
    buf.ellipse(...head, bird.head);
    buf.ellipse(hx + 0.4, hy + 1.4, 3.4, 2.6, bird.cheek, { onlyFilled: true, shadeAs: [hx - 1, hy, 7, 7] });
    buf.ellipse(...head, bird.cap, { onlyFilled: true, clip: (x, y) => y < hy - 1.2 });
    buf.triangle(hx + 3.4, hy - 0.6, hx + 6.2, hy + 0.4, hx + 3.4, hy + 1.2, bird.beak, { flat: true });
    const out = outline(buf);
    out.set(Math.round(hx + 3.4) + 1, Math.round(hy + 0.4) + 1, bird.gape || "beeYellow");
    out.set(Math.round(hx + 3.4), Math.round(hy + 0.4) + 1, bird.gape || "beeYellow");
    birdEye(out, Math.round(hx + 0.6) + 1, Math.round(hy - 1.4) + 1, bird, 2, 2);
    for (let x = 2; x < 17; x += 2) out.set(x + 1, Math.round(water) + 1, RAMPS.pond[0]);
    return packBird(out, 9, water, hx, hy - hr);
  },

  owl(bird, pose) {
    if (pose === "fly") return owlFlying(bird);
    const W = 16, H = 22;
    const buf = new PixelBuffer(W, H);
    buf.ellipse(8, 14, 5.4, 6.4, bird.body);
    const head = [8, 7.5, 5.8, 5.2];
    buf.ellipse(...head, bird.head || bird.body);
    for (const side of [-1, 1]) buf.triangle(8 + side * 2.6, 3.2, 8 + side * 5.6, 3.6, 8 + side * 5, 0.6, bird.head || bird.body);
    buf.ellipse(8, 8.2, 4.6, 3.8, bird.face, { onlyFilled: true, flat: true });
    for (const [x, y] of [[5, 13], [10, 12], [7, 16], [11, 16], [4, 17], [8, 19]]) buf.set(x, y, RAMPS[bird.body][3]);
    buf.triangle(7.2, 9.4, 8.8, 9.4, 8, 11.2, bird.beak, { flat: true });
    buf.rect(5.5, 19.5, 2, 1.5, bird.legs, { flat: true });
    buf.rect(8.5, 19.5, 2, 1.5, bird.legs, { flat: true });
    const out = outline(buf);
    for (const ex of [4, 9]) {
      if (pose === "blink") {
        for (let x = 0; x < 3; x++) out.set(ex + x + 1, 8, RAMPS[bird.body][3]);
      } else {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) out.set(ex + x + 1, 6 + y + 1, bird.eyes || "beeYellow");
        out.set(ex + 2, 8, "plum"); out.set(ex + 2, 9, "plum");
        out.set(ex + 1, 7, "cream");
      }
      out.set(ex + (ex < 8 ? 0 : 3), 11, "blush");
    }
    return packBird(out, 8, 20.5, 8, 0);
  },
};

function rigFrame(x, y, angle, mirror = false) {
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const dx = mirror ? ay : -ay, dy = mirror ? -ax : ax;
  return {
    x, y, angle,
    at: (u, w) => [x + u * ax + w * dx, y + u * ay + w * dy],
    local: (px, py) => { const X = px - x, Y = py - y; return [X * ax + Y * ay, X * dx + Y * dy]; },
  };
}

function turnedBox(cx, cy, ru, rw, angle) {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return [cx, cy, Math.hypot(ru * c, rw * s), Math.hypot(ru * s, rw * c)];
}

function shadesOf(...names) {
  const set = new Set();
  for (const n of names) if (n) { const r = rampFor(n); if (r) r.forEach((c) => set.add(c)); else set.add(paletteColor(n)); }
  return set;
}

function packRig(out, footX, footY, headX, headY) {
  let x0 = out.w, y0 = out.h, x1 = -1, y1 = -1;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    if (!out.px[y * out.w + x]) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const c = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px[(y - y0) * c.w + (x - x0)] = out.px[y * out.w + x];
  return {
    canvas: c.toCanvas(), footX: Math.round(footX) + 1 - x0, footY: Math.round(footY) + 1 - y0,
    headX: Math.round(headX) + 1 - x0, headY: headY === null ? 0 : Math.round(headY) + 1 - y0,
  };
}

const RIG_WINGS = {
  round: {
    up: { wing: [[-0.4, -0.4], [0.4, -0.5], [-0.2, -2.2], [-1.3, -1.8]], tip: [[-1.3, -1.8], [-0.2, -2.2], [-0.9, -2.6]] },
    level: { wing: [[-0.45, -0.6], [0.4, -0.62], [-1.1, -1.2], [-2.2, -0.95]], tip: [[-2.2, -0.95], [-1.1, -1.2], [-2.9, -1.3]] },
    down: { wing: [[-0.5, -0.25], [0.35, -0.35], [-0.1, 1.75], [-1.1, 1.45]], tip: [[-1.1, 1.45], [-0.1, 1.75], [-0.75, 2.35]] },
  },
  pointed: {
    up: { wing: [[-0.45, -0.45], [0.35, -0.6], [0.05, -1.9], [-0.55, -1.6]], tip: [[-0.55, -1.6], [0.05, -1.9], [-1.2, -3.2]] },
    level: { wing: [[-0.6, -0.55], [0.4, -0.7], [-0.5, -1.2], [-1.4, -0.95]], tip: [[-1.4, -0.95], [-0.5, -1.2], [-3.1, -1.25]] },
    down: { wing: [[-0.5, -0.3], [0.3, -0.4], [-0.1, 1.3], [-0.7, 1.1]], tip: [[-0.7, 1.1], [-0.1, 1.3], [-1.1, 2.9]] },
  },
};

function rigBird(bird, P = {}) {
  const rx = (bird.bodyRx || 5.2) * (P.long || 1), ry = (bird.bodyRy || 4.6) * (P.flat || 1), hr = bird.headR || 5.4;
  const beakLen = bird.beakLen || 2.4, beakH = bird.beakH || 2.4, legLen = bird.legLen || 1.6;
  const buf = new PixelBuffer(84, 72);
  const bx = 42, by = 38, tilt = P.tilt || 0, mir = !!P.mirror;
  const B = rigFrame(bx, by, tilt, mir);
  const box = turnedBox(bx, by, rx, ry, tilt);
  const ell = (F, u, w, ru, rw, paint, opts) => buf.rotEllipse(...F.at(u, w), ru, rw, F.angle, paint, opts);
  const poly = (F, pts, paint, opts) => buf.polygon(pts.map(([u, w]) => F.at(u, w)), paint, opts);
  const within = (F, test) => (x, y) => test(...F.local(x + 0.5, y + 0.5));
  const onBody = { onlyFilled: true, shadeAs: box };
  const bodyC = bird.body, wingC = bird.wing || bodyC;

  const tail = bird.tail || { length: 0, color: bodyC };
  if (tail.length > 0) {
    const T = rigFrame(...B.at(-rx * 0.58, 0.2), tilt + Math.PI + (mir ? -1 : 1) * (P.tailUp ?? 0.12), !mir);
    const Lt = Math.max(1.5, 3.5 + tail.length - rx * 0.58), wb = tail.width || 2.8, wt = tail.stiff ? 0.4 : tail.tip || 1.4;
    if (tail.fork) {
      poly(T, [[0, -wb / 2], [0, wb / 2], [Lt * 0.5, 0.9], [Lt * 0.5, -0.9]], tail.color);
      buf.line(...T.at(Lt * 0.42, -0.5), ...T.at(Lt, -1.5), 1.1, tail.color);
      buf.line(...T.at(Lt * 0.42, 0.6), ...T.at(Lt * 0.86, 1.6), 1.1, tail.color);
    } else poly(T, [[0, -wb / 2], [0, wb / 2], [Lt, wt / 2], [Lt, -wt / 2]], tail.color);
    if (tail.bars) for (let u = 3.5; u < Lt - 1; u += 3) poly(T, [[u, -3], [u + 1, -3], [u + 1, 3], [u, 3]], tail.bars, { onlyFilled: true, flat: true });
    if (tail.spots && ["up", "level", "down"].includes(P.wing)) poly(T, [[Lt - 2.2, -3], [Lt + 1, -3], [Lt + 1, 3], [Lt - 2.2, 3]], tail.spots, { onlyFilled: true, flat: true });
  }

  buf.rotEllipse(bx, by, rx, ry, tilt, bodyC, { shadeAs: box });
  if (bird.rump) ell(B, -rx * 0.74, -ry * 0.28, rx * 0.3, ry * 0.4, bird.rump, onBody);
  if (bird.mantle) ell(B, rx * 0.2, -ry * 0.75, rx * 0.45, ry * 0.3, bird.mantle, onBody);
  const belly = bird.belly || bodyC, chest = bird.chest || belly;
  ell(B, rx * 0.2, ry * 0.35, rx * 0.88, ry * 0.65, belly, onBody);
  ell(B, rx * 0.65, -ry * 0.13, rx * 0.46, ry * 0.65, chest, { ...onBody, clip: within(B, (u, w) => w < 0.5) });
  if (P.puff) ell(B, rx * 0.72, -ry * 0.28, rx * 0.44, ry * 0.72, chest, { shadeAs: box });
  if (bird.vent) ell(B, -rx * 0.66, ry * 0.52, rx * 0.3, ry * 0.36, bird.vent, onBody);
  if (bird.bodySpots) {
    const on = shadesOf(bodyC, belly, chest);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      if (!on.has(buf.get(x, y)) || y % 2 || (x + (y % 4 ? 2 : 0)) % 4) continue;
      const [u, w] = B.local(x + 0.5, y + 0.5);
      if (u > -rx * 0.75 && w > -ry * 0.55) buf.set(x, y, bird.bodySpots);
    }
  }

  const wing = P.wing || "fold";
  if (wing === "fold" || wing === "droop") {
    const drop = wing === "droop";
    const W = drop ? rigFrame(...B.at(-rx * 0.05, ry * 0.2), tilt + (mir ? -1 : 1) * 0.75, mir) : B;
    const Wc = drop ? [-rx * 0.3, 0, rx * 0.66, ry * 0.42] : [-rx * 0.31, -ry * 0.2, rx * 0.69, ry * 0.46];
    const wbox = turnedBox(...W.at(Wc[0], Wc[1]), Wc[2], Wc[3], W.angle);
    const reach = bird.wingLen || 0;
    ell(W, ...Wc, wingC, { shadeAs: wbox });
    const tip = drop ? [[-rx * 0.85, -ry * 0.3], [-rx * 0.85, ry * 0.3], [-rx * 1.45 - reach * 0.6, ry * 0.1]]
      : [[-rx * 0.88, -ry * 0.35], [-rx * 0.88, ry * 0.39], [-rx * 1.54 - reach, ry * 0.26 - reach * 0.1]];
    poly(W, tip, bird.wingTip || wingC);
    const onWing = { onlyFilled: true, shadeAs: wbox };
    const ps = bird.wingPatchSize || 1;
    if (bird.wingPatch) ell(W, Wc[0] + rx * 0.16, Wc[1] - ry * 0.06, rx * 0.54 * ps, ry * 0.3 * ps, bird.wingPatch, onWing);
    if (bird.wingPanel) {
      const [pu, pw] = [Wc[0] + rx * 0.36, Wc[1] + ry * 0.02];
      ell(W, pu, pw, rx * 0.42, ry * 0.4, bird.wingPanel.color, onWing);
      ell(W, pu, pw, rx * 0.42, ry * 0.4, bird.wingPanel.bars, { onlyFilled: true, flat: true, clip: (x, y) => (x + y) % 3 === 0 });
    }
    if (bird.wingMirror) ell(W, Wc[0] - rx * 0.2, Wc[1] + ry * 0.2, rx * 0.2, ry * 0.2, bird.wingMirror, { onlyFilled: true, flat: true });
    if (bird.wingBar) buf.line(...W.at(-rx * 0.9, ry * 0.05), ...W.at(rx * 0.25, -ry * 0.25), 1, bird.wingBar, { onlyFilled: true });
    if (bird.wingSpots) {
      const on = shadesOf(wingC, bird.wingTip);
      for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
        if (!on.has(buf.get(x, y)) || (x + y) % 3 || y % 2) continue;
        if (W.local(x + 0.5, y + 0.5)[0] < Wc[0] - rx * 0.05) buf.set(x, y, bird.wingSpots);
      }
    }
    if (drop && P.bandage) {
      const onW = shadesOf(wingC, bird.wingTip);
      buf.line(...W.at(Wc[0] - rx * 0.1, -ry), ...W.at(Wc[0] - rx * 0.1, ry), 2.2, "snow", { onlyFilled: true, flat: false, clip: (x, y) => onW.has(buf.get(x, y)) });
    }
  } else {
    const shape = RIG_WINGS[bird.wingShape || "round"][wing];
    const S = bird.wingSpan || 1, sh = [0, -0.5];
    const at = ([a, b]) => [(sh[0] + (a - sh[0]) * S) * rx, (sh[1] + (b - sh[1]) * S) * ry];
    const pts = shape.wing.map(at), tip = shape.tip.map(at);
    poly(B, pts, wingC);
    poly(B, tip, bird.wingTip || wingC);
    const mid = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (bird.wingPatch) buf.line(...B.at(...mid(pts[0], pts[3], 0.2)), ...B.at(...mid(pts[1], pts[2], 0.35)), 2, bird.wingPatch, { onlyFilled: true, flat: false });
    if (bird.wingPanel) {
      const [pu, pw] = mid(pts[1], pts[2], 0.45);
      ell(B, pu - 0.8, pw, 2, 1.6, bird.wingPanel.color, { onlyFilled: true });
      ell(B, pu - 0.8, pw, 2, 1.6, bird.wingPanel.bars, { onlyFilled: true, flat: true, clip: (x) => x % 2 === 0 });
    }
    if (bird.wingMirror) ell(B, ...mid(pts[3], pts[2], 0.25), 1.4, 1.2, bird.wingMirror, { onlyFilled: true, flat: true });
    if (bird.wingSpots) {
      const on = shadesOf(wingC, bird.wingTip);
      for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) if (on.has(buf.get(x, y)) && !((x + y) % 3) && !(y % 2) && B.local(x + 0.5, y + 0.5)[0] < -rx * 0.5) buf.set(x, y, bird.wingSpots);
    }
    if (bird.flightPatch) buf.line(...B.at(...mid(tip[0], tip[2], 0.3)), ...B.at(...mid(tip[1], tip[2], 0.3)), 1.6, bird.flightPatch, { onlyFilled: true });
  }

  const [hu, hw] = P.head || [rx * 0.77, -ry * 1.22];
  const [hx, hy] = B.at(hu, hw);
  const H = rigFrame(hx, hy, P.look ?? tilt, P.headMirror ?? mir);
  const hbox = [hx, hy, hr, hr];
  const headC = bird.head || bodyC, capC = bird.cap || headC;
  if (bird.neck) buf.line(...B.at(rx * 0.55, -ry * 0.45), ...H.at(-hr * 0.1, hr * 0.5), hr * 1.25, headC, { flat: false, shadeAs: hbox });
  if (bird.neckRing) buf.line(...H.at(-hr * 0.5, hr * 1.1), ...H.at(hr * 0.55, hr * 1.02), 1.4, bird.neckRing, { onlyFilled: true });
  ell(H, 0, 0, hr, hr * 0.96, headC, { shadeAs: hbox });
  const onHead = { onlyFilled: true, shadeAs: hbox };
  if (capC !== headC) ell(H, 0, 0, hr, hr * 0.96, capC, { ...onHead, clip: within(H, (u, w) => w < -hr * (bird.capLow ?? 0.37)) });
  const cs = bird.cheekSize || 1;
  if (bird.cheek && bird.cheek !== headC) ell(H, hr * 0.26, hr * (bird.cheekY ?? 0.44), hr * 0.41 * cs, hr * 0.26 * cs, bird.cheek, onHead);
  if (bird.nape) ell(H, -hr * 0.72, -hr * 0.42, hr * 0.36, hr * 0.34, bird.nape, onHead);
  if (bird.wattle) ell(H, hr * 0.24, -hr * 0.14, hr * 0.44, hr * 0.46, bird.wattle, onHead);
  if (bird.eyeStripe) buf.line(...H.at(hr * 0.95, -hr * 0.24), ...H.at(-hr, -hr * 0.2), 1.3, bird.eyeStripe, { onlyFilled: true });
  if (bird.moustache) {
    const start = bird.moustacheToNape ? [hr * 0.5, hr * 0.62] : [hr * 0.72, hr * 0.3];
    buf.line(...H.at(...start), ...H.at(-hr * 0.3, hr * 0.72), 1.4, bird.moustache, { onlyFilled: true });
    if (bird.moustacheToNape) buf.line(...H.at(-hr * 0.3, hr * 0.72), ...H.at(-hr * 0.92, -hr * 0.1), 1.4, bird.moustache, { onlyFilled: true });
  }
  if (bird.crownStreaks) for (const [u, w] of [[-0.3, -0.8], [0.15, -0.8], [0.45, -0.6], [-0.65, -0.55], [-0.05, -0.55]]) {
    const [x, y] = H.at(u * hr, w * hr);
    if (buf.get(x, y)) buf.set(x, y, bird.crownStreaks);
  }
  if (bird.forehead) ell(H, hr * 0.78, -hr * 0.32, hr * 0.22, hr * 0.22, bird.forehead, { onlyFilled: true, flat: true });
  const bs = bird.bibSize || 1;
  if (bird.bib) ell(H, hr * 0.42, hr * (0.92 - (bs - 1) * 0.2), hr * 0.3 * bs, hr * 0.24 * bs, bird.bib, { onlyFilled: true, flat: true });
  if (bird.breastBand) buf.line(...H.at(hr * 0.75, hr * 1.02), ...H.at(-hr * 0.05, hr * 1.12), 1.5, bird.breastBand, { onlyFilled: true });
  if (bird.earTufts) poly(H, [[-hr * 0.25, -hr * 0.8], [-hr * 0.7, -hr * 0.62], [-hr * 1.2, -hr * 1.05]], bird.earTufts);
  if (bird.chick) for (const [u, h] of [[-0.35, 1.6], [0.1, 2]]) poly(H, [[(u - 0.2) * hr, -hr * 0.85], [(u + 0.2) * hr, -hr * 0.88], [u * hr - 0.6, -hr - h]], capC);

  const u0 = hr * 0.85, open = P.gape || 0;
  if (bird.arched) {
    poly(H, [[u0 - 1.2, -beakH * 0.62], [u0 + beakLen * 0.5, -beakH * 0.55], [u0 + beakLen * 0.92, -beakH * 0.1], [u0 + beakLen, beakH * 0.3],
      [u0 + beakLen * 0.55, beakH * 0.52], [u0, beakH * 0.75]], bird.beak, { flat: true });
    buf.line(...H.at(u0 - 0.6, -beakH * 0.52), ...H.at(u0 + beakLen * 0.55, -beakH * 0.45), 1, rampFor(bird.beak)[0], { onlyFilled: true });
  } else if (open > 0) {
    const L = beakLen, up = [u0 + L, beakH * 0.2 - open * L * 0.75], low = [u0 + L * 0.85, beakH * 0.45 + open * L * 0.75];
    poly(H, [[u0 - 0.5, beakH * 0.05], up, low, [u0 - 0.5, beakH * 0.65]], bird.mouth || "coral", { flat: true });
    poly(H, [[u0, -beakH * 0.3], up, [u0 + 0.6, beakH * 0.15]], bird.beak, { flat: true });
    poly(H, [[u0, beakH * 0.55], low, [u0 + 0.6, beakH * 0.9]], bird.beak, { flat: true });
  } else poly(H, [[u0, -beakH * 0.25], [u0 + beakLen, beakH * 0.25], [u0, beakH * 0.75]], bird.beak, { flat: true });
  if (bird.gape && bird.chick) ell(H, u0 - 0.4, beakH * 0.25, 1.1, 1.2 + open * 0.6, bird.gape, { flat: true });

  if (bird.gloss) {
    const lit = RAMPS.ink[0], gloss = rampFor(bird.gloss);
    for (let i = 0; i < buf.px.length; i++) if (buf.px[i] === lit) buf.px[i] = gloss[1];
  }
  if (bird.mottle) {
    const on = shadesOf(bodyC, wingC, headC, capC, tail.color, bird.wingTip);
    const [pale, dark] = bird.mottle.map((c) => rampFor(c));
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      if (!on.has(buf.get(x, y))) continue;
      const n = hash2(x, y, 41);
      if (n < 0.2) buf.set(x, y, dark[1]);
      else if (n > 0.86) buf.set(x, y, pale[1]);
    }
  }

  const legC = bird.legs || "plum", legTop = by + box[3] * 0.93;
  const lx = [bx - rx * 0.31, bx + rx * 0.23];
  let footX = bx, footY = legTop + legLen + 0.5;
  const legs = P.legs || "stand";
  if (legs === "stand") for (const x of lx) buf.rect(x, legTop, 1, legLen, legC, { flat: true });
  else if (legs === "walk1" || legs === "walk2") {
    const bottom = legTop + legLen;
    const feet = legs === "walk1" ? [[lx[0], lx[0] - 1.5, 0], [lx[1], lx[1] + 1.5, 0]] : [[lx[0] + 0.5, lx[0] + 0.5, 0], [lx[1] - 0.5, lx[1] + 0.5, 1.2]];
    for (const [top, foot, lift] of feet) {
      buf.line(top + 0.5, legTop, foot + 0.5, bottom - lift, 1, legC);
      buf.rect(Math.floor(foot) + 1, Math.ceil(bottom - lift) - 1, 1, 1, legC, { flat: true });
    }
  } else if (legs === "tuck" || legs === "crouch") {
    footY = legs === "crouch" ? by + box[3] + 0.5 : legTop + 2;
  } else if (legs === "grip" || legs === "hang") {
    const edge = Math.floor(bx + box[2]) + 1;
    const spots = legs === "grip" ? [ry * 0.2, ry * 0.85] : [-rx * 0.55 - ry * 0.2, rx * 0.35];
    for (const dy of spots) buf.rect(edge - 2, Math.round(by + dy), 2, 1, legC, { flat: true });
    footX = edge; footY = Math.round(by + spots[1]) + 0.5;
  }

  const out = outline(buf);
  const eyeH = hr < 4 ? 2 : 3;
  const [ecx, ecy] = H.at(hr * 0.22 + 1, -hr * 0.37 + eyeH / 2);
  const wasClosed = EYES_CLOSED;
  if (P.eyesClosed) EYES_CLOSED = true;
  birdEye(out, Math.round(ecx - 1) + 1, Math.round(ecy - eyeH / 2) + 1, bird, 2, eyeH, false);
  EYES_CLOSED = wasClosed;
  if (bird.blush !== false) {
    const [cx, cy] = H.at(hr * 0.22, -hr * 0.37 + eyeH / 2 + eyeH);
    for (const dx of [-1, 0]) out.set(Math.round(cx) + dx + 1, Math.round(cy) + 1, "blush");
  }
  return packRig(out, footX, footY, hx, P.mirror ? null : hy - hr);
}

const RIG_PLANS = {
  corvid: {
    poses: ["stand", "stand~blink", "peck", "bob", "walk", "walk2", "hop", "proud", "bow", "cache", "fly", "fly1", "fly2"],
    flap: ["fly", "fly1", "fly2", "fly1"], flapRate: 8,
    pose(bird, pose) {
      const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6;
      return {
        stand: {},
        peck: { head: [rx * 0.77 + 1.5, -ry * 1.22 + 3.2], look: 0.95, tailUp: 0.5 },
        bob: { tailUp: 0.45, head: [rx * 0.77, -ry * 1.15] },
        walk: { legs: "walk1", head: [rx * 0.85, -ry * 1.18], tailUp: 0.05 },
        walk2: { legs: "walk2", head: [rx * 0.8, -ry * 1.24], tailUp: 0.1 },
        hop: { legs: "tuck", tailUp: 0.35, head: [rx * 0.8, -ry * 1.3], look: -0.1 },
        proud: { head: [rx * 0.55, -ry * 1.5], look: -0.35, puff: true, tailUp: -0.2, tilt: -0.12 },
        bow: { tilt: 0.3, head: [rx * 0.98, -ry * 0.62], look: 0.85, tailUp: 0.55, eyesClosed: true },
        cache: { tilt: 0.42, head: [rx * 1.0, -ry * 0.05], look: 1.35, tailUp: 0.75 },
        fly: { wing: "up", legs: "tuck", tailUp: 0 },
        fly1: { wing: "level", legs: "tuck", tailUp: 0 },
        fly2: { wing: "down", legs: "tuck", tailUp: 0 },
      }[pose];
    },
  },

  clinger: {
    poses: ["stand", "stand~blink", "climb", "peck", "drum1", "drum2", "down", "down~blink", "down2", "fly", "fly1", "fly2"],
    flap: ["fly", "fly1", "fly", "fly1", "fly2", "fly2", "fly2"], flapRate: 10,
    pose(bird, pose) {
      const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6, up = -Math.PI / 2 - 0.14;
      const prop = bird.tail && bird.tail.stiff ? -0.55 : 0.1;       // a woodpecker props itself on its tail
      const cling = { tilt: up, head: [rx * 1.15, ry * 0.15], look: -0.08, tailUp: prop, legs: "grip" };
      return {
        stand: cling,
        climb: { ...cling, tilt: up + 0.12, head: [rx * 1.25, ry * 0.05], tailUp: prop + 0.45, long: 1.06 },
        peck: { ...cling, head: [rx * 1.08, ry * 0.5], look: 0.5 },
        drum1: { ...cling, head: [rx * 1.1, -ry * 0.25], look: -0.3 },
        drum2: { ...cling, head: [rx * 1.1, ry * 0.55], look: 0.18 },
        down: { tilt: Math.PI / 2 + 0.05, mirror: true, head: [rx * 1.08, -ry * 0.55], look: Math.PI - 0.25, tailUp: 0.2, legs: "hang" },
        down2: { tilt: Math.PI / 2 + 0.12, mirror: true, head: [rx * 1.12, -ry * 0.45], look: Math.PI - 0.4, tailUp: 0.35, legs: "hang" },
        fly: { wing: "up", legs: "tuck", tailUp: 0 },
        fly1: { wing: "down", legs: "tuck", tailUp: 0 },
        fly2: { wing: "fold", legs: "tuck", tailUp: 0, long: 1.08, flat: 0.9 },
      }[pose];
    },
  },

  pheasant: {
    poses: ["stand", "stand~blink", "walk", "walk2", "peck", "crouch", "alert", "fly", "fly1", "fly2"],
    flap: ["fly", "fly2"], flapRate: 14,
    pose(bird, pose) {
      const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6;
      return {
        stand: { tilt: -0.1, head: [rx * 0.82, -ry * 1.35], tailUp: 0.18 },
        walk: { tilt: -0.05, head: [rx * 0.92, -ry * 1.25], tailUp: 0.15, legs: "walk1" },
        walk2: { tilt: -0.08, head: [rx * 0.88, -ry * 1.3], tailUp: 0.18, legs: "walk2" },
        peck: { tilt: 0.14, head: [rx * 1.08, -ry * 0.35], look: 1.05, tailUp: 0.1 },
        crouch: { tilt: 0.04, flat: 0.8, head: [rx * 0.86, -ry * 0.78], tailUp: -0.04, legs: "crouch" },
        alert: { tilt: -0.22, head: [rx * 0.66, -ry * 1.85], look: -0.08, tailUp: 0.1 },
        fly: { wing: "up", legs: "tuck", head: [rx * 1.02, -ry * 0.95], tailUp: 0.05 },
        fly1: { wing: "level", legs: "tuck", head: [rx * 1.02, -ry * 0.95], tailUp: 0.05 },
        fly2: { wing: "down", legs: "tuck", head: [rx * 1.02, -ry * 0.95], tailUp: 0.05 },
      }[pose];
    },
  },

  swallow: {
    poses: ["stand", "stand~blink", "peck", "bob", "fly", "fly1", "fly2"],
    flap: ["fly", "fly1", "fly2", "fly1"], flapRate: 11,
    pose(bird, pose) {
      const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6;
      const sit = { tilt: bird.chick ? -0.32 : -0.28, tailUp: bird.chick ? 0 : -0.3 };
      return {
        stand: sit,
        peck: { ...sit, head: [rx * 0.52, -ry * 0.95], look: 1.7 },
        bob: { ...sit, head: [rx * 0.7, -ry * 1.3], look: -0.35, gape: 0.45 },
        gape: { ...sit, head: [rx * 0.55, -ry * 1.5], look: -1.05, gape: 1 },
        hurt: { ...sit, wing: "droop", look: 0.25 },
        bandage: { ...sit, wing: "droop", bandage: true, look: 0.1 },
        fly: { wing: "up", legs: "tuck", tailUp: 0 },
        fly1: { wing: "level", legs: "tuck", tailUp: 0 },
        fly2: { wing: "down", legs: "tuck", tailUp: 0 },
      }[pose];
    },
  },

  nightjar: {
    poses: ["rest", "stand", "stand~blink", "fly", "fly1", "fly2", "hawk"],
    flap: ["fly", "fly1", "fly2", "fly1", "hawk", "fly1"], flapRate: 7,
    pose(bird, pose) {
      const rx = bird.bodyRx || 5.2, ry = bird.bodyRy || 4.6;
      const sit = { tilt: 0.02, head: [rx * 0.74, -ry * 0.85], tailUp: 0.02, legs: "crouch" };
      return {
        rest: { ...sit, eyesClosed: true },
        stand: { ...sit, head: [rx * 0.76, -ry * 1.05], look: -0.05 },
        fly: { wing: "up", legs: "tuck", tailUp: 0 },
        fly1: { wing: "level", legs: "tuck", tailUp: 0 },
        fly2: { wing: "down", legs: "tuck", tailUp: 0 },
        hawk: { wing: "level", legs: "tuck", tailUp: 0, gape: 1, look: -0.1 },
      }[pose];
    },
  },
};

for (const [name, plan] of Object.entries(RIG_PLANS)) {
  BIRD_SHAPES[name] = (bird, pose) => rigBird(bird, plan.pose(bird, pose) || plan.pose(bird, plan.poses[0]));
}
