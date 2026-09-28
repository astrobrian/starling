
const portraitCache = {};

const PORTRAIT_LOOKS = {};
function setPortraitLook(who, look) {
  if (look) PORTRAIT_LOOKS[who] = look; else delete PORTRAIT_LOOKS[who];
}

function renderPortrait(who, face = "happy", look = null) {
  if (who === "husband" && typeof renderHusbandPortrait === "function") return renderHusbandPortrait(face === "joy" ? "joy" : "happy");
  if (!BIRDS[who]) return null;
  look = look || PORTRAIT_LOOKS[who] || null;
  const bird = look ? { ...BIRDS[who], ...look } : BIRDS[who];
  const key = `${who}/${face}` + (look ? "/" + JSON.stringify(look) : "");
  if (!portraitCache[key]) portraitCache[key] = paintPortrait(bird, face).toCanvas();
  return portraitCache[key];
}

const BEAK_OPEN = { happy: 0.16, joy: 0.36, hungry: 0.55, curious: 0, sad: 0 };

function paintPortrait(bird, face) {
  const shape = bird.shape || "songbird";
  const body = new PixelBuffer(62, 62), beak = new PixelBuffer(62, 62);
  const rig = (PORTRAIT_BODIES[shape] || PORTRAIT_BODIES.songbird)(body, beak, bird, BEAK_OPEN[face] || 0);
  const darkFace = (e) => { const c = body.get(e.x + e.w / 2, e.y + e.h / 2); return c && lightness(c) < 0.4 ? c : null; };
  const out = outline(body);
  out.stamp(outline(tidy(beak)), 0, 0);    // the beak has its own outline, so it shows on any face
  if (bird.blush !== false) {
    for (const [x, y, w] of bird.cheekSpot ? rig.blush.slice(1) : rig.blush) for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < 2; dy++) out.set(x + 1 + dx, y + 1 + dy, "blush");
  }
  for (const e of rig.eyes) drawPortraitEye(out, bird, face, e, darkFace(e));
  if (bird.pollen && rig.eyes.length > 1) portraitPollen(out, bird, rig.eyes);
  if (face === "curious") stampIcon(out, "question", 52, 2);
  if (face === "sad") stampIcon(out, "gloom", 52, 2);
  if (face === "joy") { stampIcon(out, "sparkle", 2, 3); stampIcon(out, "sparkle", 56, 36); }
  return out;
}

function portraitPollen(out, bird, eyes) {
  const e = eyes[1], mx = e.x + 1 + 8, my = e.y + 1 + 10;
  const feathers = new Set([bird.head, bird.cap, bird.crest, bird.body].filter(Boolean).flatMap((c) => rampFor(c) || []).map((c) => c.toLowerCase()));
  const dust = [[mx - 4, my - 4, 7.5, 6.5], [mx - 3, my + 4, 5.5, 3.5]];
  for (let y = my - 12; y <= my + 9; y++) for (let x = mx - 13; x <= mx + 3; x++) {
    const c = out.get(x, y);
    if (!c || !feathers.has(c.toLowerCase())) continue;
    const d = Math.min(...dust.map(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2));
    if (d > 1 || hash2(x, y, 88) > 1.15 - d) continue;
    out.set(x, y, hash2(x, y, 89) < 0.3 || d > 0.7 ? "beeYellow" : "butter");
  }
}

function profileBeak(buf, x, y, L, h, color, open, hook = false) {
  const drop = L * 0.07, up = h * 0.55, down = h * 0.45, a = (open / 2) * Math.min(1, 10 / L) * (L > 12 ? 0.5 : 1);
  const at = (px, py, turn) => [x + px * Math.cos(turn) - py * Math.sin(turn), y + px * Math.sin(turn) + py * Math.cos(turn)];
  const upper = [[-0.5, -up], [L * 0.5, -up * 0.5], [L, drop], [0, 0]].map(([px, py]) => at(px, py, -a));
  const lower = (L > 12 ? [[0, 0], [L * 0.9, drop + 0.7], [L * 0.86, drop + 2.2], [-0.5, Math.max(down, 2.2)]] : [[0, 0], [L * 0.9, drop + 0.7], [-0.5, down]]).map(([px, py]) => at(px, py, a));
  const R = rampFor(color);
  const reach = Math.min(L * 0.75, 9);
  if (open > 0.05) buf.polygon([[x, y], at(reach, drop, -a), at(reach * 0.92, drop + 0.7, a)], "coral", { flat: true });
  buf.polygon(lower, R[2], { flat: true });
  buf.polygon(upper, R[1], { flat: true });
  if (L > 8) buf.line(x + 1, y - up + 1.2, x + L * 0.55, y - up * 0.45 + 0.6, 1, R[0], { onlyFilled: true });   // a glint along the top
  if (hook) {
    const [tx, ty] = at(L, drop, -a);
    buf.polygon([[tx - 3.5, ty - 1.2], [tx + 0.6, ty - 0.6], [tx + 0.4, ty + 2.6], [tx - 1.2, ty + 1]], R[1], { flat: true });
  }
}

function tidy(buf) {
  const lone = [];
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    if (buf.get(x, y) && !buf.get(x + 1, y) && !buf.get(x - 1, y) && !buf.get(x, y + 1) && !buf.get(x, y - 1)) lone.push([x, y]);
  }
  for (const [x, y] of lone) buf.set(x, y, null);
  return buf;
}

function hullOf(...shapes) {
  const pts = [];
  for (const [cx, cy, rx, ry] of shapes) for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

function duckBill(buf, x, y, L, h, color, nail, open) {
  const a = open / 2;
  const at = (px, py, turn) => [x + px * Math.cos(turn) - py * Math.sin(turn), y + px * Math.sin(turn) + py * Math.cos(turn)];
  const upper = [[-1, -h * 0.62], [L * 0.45, -h * 0.4], [L - 2, -h * 0.34], [L, -h * 0.12], [L - 0.5, h * 0.08], [0, 0]].map(([px, py]) => at(px, py, -a));
  const lower = [[0, 0], [L - 1.5, h * 0.1], [L - 3, h * 0.36], [-1, h * 0.38]].map(([px, py]) => at(px, py, a));
  const R = rampFor(color);
  if (open > 0.05) buf.polygon([[x, y], at(L - 2, 0, -a), at(L - 3, 0.5, a)], "coral", { flat: true });
  buf.polygon(lower, R[2], { flat: true });
  buf.polygon(upper, R[1], { flat: true });
  buf.line(x + 1, y - h * 0.62 + 1.4, x + L * 0.5, y - h * 0.4 + 1, 1, R[0], { onlyFilled: true });
  if (nail) {
    const [nx, ny] = at(L - 2, -h * 0.2, -a);
    buf.ellipse(nx, ny, 2.2, 1.8, nail, { flat: true, onlyFilled: true });
  }
}

const capClip = (H) => (x, y) => ((x + 0.5 - (H[0] + H[2] * 0.37)) / (H[2] * 0.84)) ** 2 + ((y + 0.5 - (H[1] + H[3] * 0.3)) / (H[3] * 0.72)) ** 2 > 1;
const headShade = (H) => [H[0], H[1] + H[3] * 0.25, H[2] * 1.05, H[3] * 1.3];

function backOf(b, bird, H, B, HS, neckY) {
  const hull = hullOf(H, B), back = (x) => x < H[0] - 2;
  b.polygon(hull, bird.body, { shadeAs: B, clip: (x, y) => back(x) && y >= neckY });
  b.polygon(hull, bird.cap || bird.head || bird.body, { shadeAs: HS, clip: (x, y) => back(x) && y < neckY });
}

const PORTRAIT_BODIES = {
  songbird(b, k, bird, open) {
    const beakLen = bird.beakLen || 2.4, long = beakLen > 4;
    const L = long ? Math.min(17, 6 + beakLen * 1.5) : 6.5 + beakLen * 1.5;
    const h = (bird.beakH || 2.2) * 3;
    const sx = Math.min(0, 60 - (49 + L));                      // a long beak moves the bird left to fit
    const H = [33 + sx, 25, 21, 19], B = [26 + sx, 58, 20, 14], C = [H[0] + 3, H[1] + 24, 13, 11];
    const tail = bird.tail || {};
    if ((tail.length || 0) >= 6) {
      const n = tail.length;
      b.polygon([[B[0] - 12, B[1] - 3], [B[0] - 4, B[1] + 5], [B[0] - 18 - n, B[1] + 16], [B[0] - 24 - n * 0.4, B[1] + 7]], tail.color);
    }
    const HS = headShade(H);
    backOf(b, bird, H, B, HS, H[1] + 16);
    b.ellipse(...B, bird.body);
    const chest = bird.chest || bird.body;
    b.ellipse(...C, chest, { shadeAs: B });
    b.ellipse(B[0] + 14, B[1] - 5, 14, 15, chest, { onlyFilled: true, shadeAs: B });
    if (bird.belly && bird.belly !== chest) b.ellipse(B[0] + 14, B[1] + 7, 15, 10, bird.belly, { onlyFilled: true, shadeAs: B });
    if (bird.bellyStripe) b.polygon([[B[0] + 12, B[1] - 17], [B[0] + 16, B[1] - 17], [B[0] + 15.5, B[1] + 1], [B[0] + 14, B[1] + 5], [B[0] + 12.5, B[1] + 1]], bird.bellyStripe, { onlyFilled: true, flat: true });
    const W = [B[0] - 7, B[1] - 1, 15, 9.5, -0.5];
    b.rotEllipse(...W, bird.wing || bird.body, { onlyFilled: true });
    if (bird.wingTip && bird.wingTip !== (bird.wing || bird.body)) b.rotEllipse(W[0] - 9, W[1] + 3.5, 8, 4.5, -0.5, bird.wingTip, { onlyFilled: true });
    if (bird.mantle) b.ellipse(B[0] - 11, B[1] - 12, 9, 5.5, bird.mantle, { onlyFilled: true, shadeAs: B });
    if (bird.wingPatch) b.rotEllipse(W[0] + 0.5, W[1] - 5.5, 10, 3.2, -0.5, bird.wingPatch, { onlyFilled: true });
    if (bird.wingBar) b.rotEllipse(W[0] + 1.5, W[1] - 3, 8, 1.1, -0.5, bird.wingBar, { onlyFilled: true, flat: true });
    if (bird.wingScales) for (const [dx, dy] of [[-6, -2], [0, -5], [5, -7], [-3, 2], [3, -1], [-9, 4], [0, 4]]) b.rect(W[0] + dx, W[1] + dy, 2, 1, bird.wingScales, { onlyFilled: true, flat: true });
    if (bird.crest) for (const [dx, hgt] of [[-10, 8], [-5, 10], [0, 8]]) b.triangle(H[0] + dx - 5, H[1] - 16, H[0] + dx + 4, H[1] - 18, H[0] + dx - 9, H[1] - 18 - hgt, bird.crest);
    b.ellipse(...H, bird.head || bird.body, { shadeAs: HS });
    if (bird.cap && bird.cap !== (bird.head || bird.body)) b.ellipse(...H, bird.cap, { onlyFilled: true, clip: capClip(H), shadeAs: HS });
    const cs = bird.cheekSize || 1;
    if (bird.cheek && bird.cheek !== (bird.head || bird.body)) {
      const big = cs > 1;
      if (bird.earPatch) b.ellipse(H[0] - 14, H[1] + 5, 5, 6.5, bird.cheek, { onlyFilled: true, shadeAs: HS });    // behind the eye
      else b.ellipse(H[0] - 8, H[1] + (big ? 10 : 8), 7 + (cs - 1) * 6, 5.5 + (cs - 1) * 3, bird.cheek, { onlyFilled: true, shadeAs: HS, clip: big ? (x, y) => y > H[1] + 3 : null });
    }
    if (bird.cheekSpot) b.ellipse(H[0] - 11, H[1] + 9, 3.6, 3, bird.cheekSpot, { onlyFilled: true, flat: true });
    if (bird.neckSpot) b.ellipse(H[0] - 15, H[1] + 11, 3.5, 3, bird.neckSpot, { onlyFilled: true, flat: true });
    if (bird.neckPatch) for (let i = 0; i < 3; i++) b.rect(H[0] - 17, H[1] + 11 + i * 2, 6, 1, i % 2 ? "snow" : bird.neckPatch, { onlyFilled: true, flat: true });
    if (bird.bib) b.ellipse(H[0] + 11, H[1] + 16, 5.5, 4, bird.bib, { onlyFilled: true, shadeAs: HS });
    profileBeak(k, H[0] + 16, H[1] + 5, L, h, bird.beak, open);
    return {
      eyes: [{ x: H[0] - 8, y: H[1] - 4, w: 6, h: 8, near: true }, { x: H[0] + 8, y: H[1] - 5, w: 4, h: 7 }],
      blush: [[H[0] - (bird.earPatch ? 8 : 10), H[1] + 6, 4], [H[0] + 8, H[1] + 5, 3]],
    };
  },

  duck(b, k, bird, open) {
    const baby = !!bird.fuzzy;
    const H = baby ? [30, 26, 20.5, 18] : [31, 24, 19, 16.5];
    const B = baby ? [26, 60, 19, 13] : [26, 58, 20, 14], C = [H[0] + 4, H[1] + 24, 13, 11];
    const HS = headShade(H);
    backOf(b, bird, H, B, HS, H[1] + (bird.neckRing ? 19 : 16));
    b.ellipse(...B, bird.body);
    const chest = bird.chest || bird.body;
    b.ellipse(...C, chest, { shadeAs: B });
    b.ellipse(H[0] + 1, H[1] + 16, baby ? 14 : 12, 11, bird.head || bird.body, { onlyFilled: true, shadeAs: HS });
    if (bird.neckRing) b.ellipse(H[0] + 1, H[1] + 20, 13, 1.8, bird.neckRing, { onlyFilled: true, flat: true, clip: (x, y) => y >= H[1] + 19 });
    b.ellipse(B[0] + 12, B[1] - 3, 14, 12, chest, { onlyFilled: true, shadeAs: B, clip: bird.neckRing ? (x, y) => y > H[1] + 20 : (x, y) => y > H[1] + 17 });
    if (bird.belly && bird.belly !== chest) b.ellipse(B[0] + 12, B[1] + 8, 14, 7, bird.belly, { onlyFilled: true, shadeAs: B });
    if (bird.spots) for (const [dx, dy] of [[6, -6], [11, -2], [15, -7], [8, 3], [14, 4], [18, -1]]) b.rect(B[0] + dx, B[1] + dy, 2, 1, "hair", { onlyFilled: true, flat: true });
    const W = [B[0] - 8, B[1] + 2, 14, 8.5, -0.35];
    b.rotEllipse(...W, bird.wing || bird.body, { onlyFilled: true });
    if (bird.speculum) b.rotEllipse(W[0] - 3, W[1] + 2, 6, 2.4, -0.35, bird.speculum, { onlyFilled: true, flat: true });
    if (baby) for (const [dx, hgt] of [[-5, 5], [0, 6], [5, 4]]) b.triangle(H[0] + dx - 3, H[1] - 16, H[0] + dx + 3, H[1] - 16, H[0] + dx - 1, H[1] - 18 - hgt, bird.cap || bird.head);
    b.ellipse(...H, bird.head || bird.body, { shadeAs: HS });
    if (bird.cap && bird.cap !== bird.head) b.ellipse(...H, bird.cap, { onlyFilled: true, clip: capClip(H), shadeAs: HS });
    if (bird.face) b.ellipse(H[0] + 5, H[1] + 6, 13, 10, bird.face, { onlyFilled: true, shadeAs: HS, clip: (x, y) => !capClip(H)(x, y) });
    if (bird.eyeStripe) {
      b.line(H[0] - 18, H[1] + 4, H[0] - 3, H[1] + 2, 2.2, bird.eyeStripe, { onlyFilled: true });
      b.line(H[0] + 8, H[1] + 1.5, H[0] + 14, H[1] + 0.5, 2, bird.eyeStripe, { onlyFilled: true });
    }
    duckBill(k, H[0] + 14, H[1] + 4, baby ? 11 : 15, baby ? 8 : 10, bird.beak, bird.billTip, open);
    return {
      eyes: [{ x: H[0] - 7, y: H[1] - 4, w: 6, h: 8, near: true }, { x: H[0] + 7, y: H[1] - 5, w: 4, h: 7 }],
      blush: [[H[0] - 9, H[1] + 6, 4], [H[0] + 7, H[1] + 5, 3]],
    };
  },

  wader(b, k, bird, open) {
    const stocky = !!bird.stocky;
    const H = stocky ? [26, 21, 16, 14] : [24, 17, 13.5, 12];
    const S = [22, 72, 34, 18];
    b.ellipse(...S, bird.wing || bird.body);
    if (bird.back) b.ellipse(S[0] - 20, S[1] - 6, 18, 13, bird.back, { onlyFilled: true, shadeAs: S });
    if (bird.plumes) for (const [x0, y0] of [[14, 50], [10, 53], [18, 54]]) b.line(x0, y0, x0 - 16, y0 + 12, 1.2, bird.plumes);
    const nw = stocky ? 12 : 8.5;
    b.polygon([[H[0] - nw, H[1] + 6], [H[0] + nw, H[1] + 6], [H[0] + nw + 5, 62], [H[0] - nw + 3, 62]], bird.neck || bird.body, { shadeAs: [H[0] + 2, 44, nw + 6, 22] });
    if (bird.neckStreaks) for (const [dx, y] of [[2, 31], [5, 37], [3, 44], [6, 50], [4, 56]]) b.rect(H[0] + dx, y, 1.5, 4, bird.neckStreaks, { onlyFilled: true, flat: true });
    if (bird.crest && !bird.cap) for (const [dy, len, w] of [[-6, 22, 2.2], [-3, 24, 1.8]]) b.line(H[0] - 2, H[1] + dy, H[0] - len, H[1] + dy + 5 + len * 0.1, w, bird.crest);
    if (bird.crest && bird.cap) for (const dy of [-2, 0]) b.line(H[0] - 6, H[1] + dy, H[0] - 26, H[1] + dy + 12, 1.4, bird.crest);
    b.ellipse(...H, bird.head || bird.body);
    if (bird.cap) b.ellipse(...H, bird.cap, { onlyFilled: true, clip: capClip(H), shadeAs: H });
    if (bird.crest && !bird.cap) b.line(H[0] + 3, H[1] - 7, H[0] - 13, H[1] - 6, 2, bird.crest, { onlyFilled: true });    // the black stripe from over the eye to the crest
    if (bird.feet && !bird.cap) b.ellipse(H[0] + 9, H[1] + 1, 3, 2.2, bird.feet, { onlyFilled: true, flat: true });      // the egret's yellow face
    const bx = H[0] + H[2] * 0.62;
    profileBeak(k, bx, H[1] + 2, Math.min(60 - bx, 8 + (bird.beakLen || 8) * 1.9), stocky ? 6.5 : 5.5, bird.beak, open);
    return {
      eyes: [{ x: H[0] - 6, y: H[1] - 5, w: 5, h: 7, near: true }, { x: H[0] + 5, y: H[1] - 6, w: 3, h: 6 }],
      blush: [[H[0] - 8, H[1] + 4, 4], [H[0] + 5, H[1] + 3, 2]],
    };
  },

  cormorant(b, k, bird, open) {
    const H = [24, 19, 14, 12.5], S = [22, 72, 34, 18];
    b.ellipse(...S, bird.wing || bird.body);
    if (bird.wingEdge) for (const [x, y] of [[4, 58], [12, 56], [20, 58], [8, 62], [16, 61], [40, 58], [48, 60]]) b.rect(x, y, 4, 1, bird.wingEdge, { onlyFilled: true, flat: true });
    b.polygon([[H[0] - 9, H[1] + 6], [H[0] + 9, H[1] + 6], [H[0] + 13, 62], [H[0] - 7, 62]], bird.body, { shadeAs: [H[0] + 2, 44, 15, 22] });
    b.ellipse(...H, bird.head || bird.body);
    if (bird.cheek) b.ellipse(H[0] + 3, H[1] + 8, 9, 5, bird.cheek, { onlyFilled: true, shadeAs: H });
    if (bird.throat) b.ellipse(H[0] + 11, H[1] + 4, 3.5, 3, bird.throat, { onlyFilled: true, flat: true });
    profileBeak(k, H[0] + 11, H[1] + 2, 21, 5, bird.beak, open, true);
    return {
      eyes: [{ x: H[0] - 6, y: H[1] - 5, w: 6, h: 7, near: true }, { x: H[0] + 5, y: H[1] - 6, w: 3, h: 6 }],
      blush: [[H[0] - 8, H[1] + 4, 4], [H[0] + 5, H[1] + 3, 2]],
    };
  },

  grebe(b, k, bird, open) {
    const H = [31, 25, 19, 17], B = [26, 58, 20, 14], C = [H[0] + 4, H[1] + 24, 13, 11];
    const HS = headShade(H);
    backOf(b, bird, H, B, HS, H[1] + 16);
    b.ellipse(...B, bird.body);
    if (bird.rear) b.ellipse(B[0] - 12, B[1] - 3, 10, 8, bird.rear, { onlyFilled: true, shadeAs: B });   // its fluffy back end
    b.ellipse(...C, bird.body, { shadeAs: B });
    b.ellipse(H[0] + 7, H[1] + 18, 8, 7, bird.cheek || bird.head, { onlyFilled: true, shadeAs: HS });   // the chestnut throat
    b.ellipse(...H, bird.head || bird.body, { shadeAs: HS });
    if (bird.cheek) b.rotEllipse(H[0] - 6, H[1] + 12, 11, 6, 0.45, bird.cheek, { onlyFilled: true, shadeAs: HS, clip: (x, y) => y > H[1] + 5 });
    if (bird.gape) b.ellipse(H[0] + 15, H[1] + 5, 2.6, 2.2, bird.gape, { flat: true });
    profileBeak(k, H[0] + 16, H[1] + 4, 11, 5.5, bird.beak, open);
    return {
      eyes: [{ x: H[0] - 7, y: H[1] - 4, w: 6, h: 8, near: true }, { x: H[0] + 7, y: H[1] - 5, w: 4, h: 7 }],
      blush: [[H[0] - 9, H[1] + 6, 4], [H[0] + 7, H[1] + 5, 3]],
    };
  },

  owl(b, k, bird, open) {
    const H = [31, 27, 21, 19.5];
    b.ellipse(31, 61, 27, 15, bird.body);
    for (const s of [-1, 1]) b.triangle(H[0] + s * 11, 11, H[0] + s * 18, 13, H[0] + s * 17, 4, bird.head || bird.body);
    b.ellipse(...H, bird.head || bird.body);
    b.ellipse(H[0], H[1] + 2, 16, 13, bird.face, { onlyFilled: true, flat: true });
    k.triangle(H[0] - 3, H[1] + 3, H[0] + 3, H[1] + 3, H[0], H[1] + 9 + open * 4, bird.beak, { flat: true });
    return {
      eyes: [{ x: H[0] - 14, y: H[1] - 4, w: 8, h: 8, near: true }, { x: H[0] + 6, y: H[1] - 4, w: 8, h: 8 }],
      blush: [[H[0] - 15, H[1] + 7, 4], [H[0] + 11, H[1] + 7, 4]],
    };
  },
};

function drawPortraitEye(out, bird, face, e, darkFace) {
  const eye = paletteColor(bird.eyes || "plum");
  const iris = bird.eyes && bird.eyes !== "plum";
  const light = darkFace ? RAMPS.duskLavender[2] : null;           // lines that must show on a dark face
  const rim = darkFace ? mix(darkFace, RAMPS.duskLavender[2], 0.5) : null;
  const x = e.x + 1, outer = e.near ? -1 : 1;
  let top = e.y + 1, W = e.w, H = e.h;
  if (face === "joy") {
    const arch = W >= 6 ? ["..##..", ".####.", "##..##", "#....#"] : W >= 4 ? [".##.", "####", "#..#"] : [".#.", "###", "#.#"];
    const ox = Math.floor((W - arch[0].length) / 2), oy = Math.floor(H / 2) - 1;
    arch.forEach((row, dy) => [...row].forEach((c, dx) => c === "#" && out.set(x + ox + dx, top + oy + dy, light || "plum")));
    return;
  }
  if (face === "hungry" || (face === "curious" && e.near)) { W += 1; H += 1; top -= 1; }
  if (face === "sad") { top += 1; H -= 1; }
  const inEye = (dx, dy) => {
    if (dx < 0 || dy < 0 || dx >= W || dy >= H) return false;
    if ((dy === 0 || dy === H - 1) && (dx === 0 || dx === W - 1)) return false;      // round corners
    const fromOuter = outer < 0 ? dx : W - 1 - dx;
    if ((face === "sad" || face === "hungry") && W >= 5 && dy + fromOuter < (face === "sad" ? 3 : 2)) return false;
    return true;
  };
  if (rim) {
    for (let dy = Math.floor(H / 2); dy <= H; dy++) for (let dx = -1; dx <= W; dx++) {
      if (inEye(dx, dy)) continue;
      if (inEye(dx + 1, dy) || inEye(dx - 1, dy) || inEye(dx, dy - 1)) out.set(x + dx, top + dy, rim);
    }
  }
  if (face === "sad") {
    const brow = e.near ? [[1, 1], [2, 1], [3, 0], [4, 0]] : [[0, 0], [1, 1], [2, 1]];
    for (const [dx, dy] of brow) out.set(x + dx, top - 3 + dy, light || "plum");
  }
  for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) if (inEye(dx, dy)) out.set(x + dx, top + dy, eye);
  if (iris) {
    const pw = Math.max(1, W - 4), px = Math.floor((W - pw) / 2);
    for (let dy = 2; dy < H - 2; dy++) for (let dx = px; dx < px + pw; dx++) out.set(x + dx, top + dy, "plum");
  }
  const look = { hungry: [0, -1], sad: [0, 1], curious: [1, 0] }[face] || [0, 0];
  const sw = W >= 5 ? 2 : 1;
  const sx = x + 1 + Math.max(0, look[0]), sy = top + 1 + (face === "sad" ? 1 : 0) + (face === "hungry" ? 1 : 0);
  if (face === "hungry" && W >= 5) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) out.set(sx + dx, sy + dy, "cream");
  } else {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < sw; dx++) out.set(sx + dx, sy + dy, "cream");
  }
  if (W >= 4) out.set(x + W - (W >= 6 ? 3 : 2) + look[0], top + H - 3 + look[1], "cream");
  if (face === "hungry") for (let dx = 1; dx < W - 1; dx++) out.set(x + dx, top + H - 2, mix(eye, PALETTE.cream, 0.35));
  if (face === "sad" && e.near) {
    for (const [dx, dy, band] of [[1, 0, 2], [0, 1, 0], [1, 1, 2], [0, 2, 2], [1, 2, 2], [0, 3, 2], [1, 3, 3]]) out.set(x + dx, top + H + dy, RAMPS.pond[band]);
  }
}

function stampIcon(out, name, x, y) {
  if (!window.ICONS || !ICONS[name]) return;
  out.stamp(iconFromGrid(ICONS[name]), x, y);
}

function archedBeak(buf, x, y, L, h, color, open) {
  const a = (open / 2) * 0.5;
  const at = (px, py, turn) => [x + px * Math.cos(turn) - py * Math.sin(turn), y + px * Math.sin(turn) + py * Math.cos(turn)];
  const upper = [[-2, -h * 0.66], [L * 0.35, -h * 0.64], [L * 0.7, -h * 0.4], [L * 0.94, -h * 0.08], [L, h * 0.12], [L * 0.8, 0.4], [0, 0]].map(([px, py]) => at(px, py, -a));
  const lower = [[0, 0], [L * 0.82, 0.8], [L * 0.55, h * 0.3], [-1, h * 0.42]].map(([px, py]) => at(px, py, a));
  const R = rampFor(color);
  if (open > 0.05) buf.polygon([[x, y], at(L * 0.7, 0.3, -a), at(L * 0.65, 0.9, a)], "coral", { flat: true });
  buf.polygon(lower, R[2], { flat: true });
  buf.polygon(upper, R[1], { flat: true });
  buf.line(...at(1, -h * 0.5, -a), ...at(L * 0.6, -h * 0.5, -a), 1, R[0], { onlyFilled: true });   // a glint along the top
}

function rigPortrait(b, k, bird, open) {
  const tail = bird.tail || {};
  const rig = PORTRAIT_BODIES.songbird(b, k, bird, open);
  const hx = rig.eyes[0].x + 8, hy = rig.eyes[0].y + 4, bx = hx - 7, by = 58;
  const HS = headShade([hx, hy, 21, 19]);
  const where = (names) => { const set = shadesOf(...names); return (x, y) => set.has(b.get(x, y)); };
  const paintWhere = (test, color) => { for (let y = 0; y < 62; y++) for (let x = 0; x < 62; x++) if (test(x, y)) b.set(x, y, color); };

  if (tail.bars && tail.length >= 6) { const on = where([tail.color]); paintWhere((x, y) => on(x, y) && y > by - 4 && Math.round(x * 0.6 + y) % 4 === 0, tail.bars); }
  if (bird.bodySpots) { const on = where([bird.body, bird.chest, bird.belly]); paintWhere((x, y) => on(x, y) && y > hy + 20 && x > bx - 4 && !(y % 3) && !((x + (y % 6 ? 2 : 0)) % 4), bird.bodySpots); }
  const W = [bx - 7, by - 1, 15, 9.5, -0.5];                 // the folded wing (PORTRAIT_BODIES.songbird)
  if (bird.wingPanel) {
    b.rotEllipse(W[0] + 7, W[1] - 4.5, 5.5, 3.6, -0.5, bird.wingPanel.color, { onlyFilled: true });
    b.rotEllipse(W[0] + 7, W[1] - 4.5, 5.5, 3.6, -0.5, bird.wingPanel.bars, { onlyFilled: true, flat: true, clip: (x, y) => (x + y) % 3 === 0 });
  }
  if (bird.wingMirror) b.rotEllipse(W[0] - 1, W[1] + 1, 3.5, 2.6, -0.5, bird.wingMirror, { onlyFilled: true, flat: true });
  if (bird.wingSpots) {
    const c = Math.cos(0.5), s = Math.sin(0.5);
    const inWing = (x, y) => { const dx = x + 0.5 - W[0], dy = y + 0.5 - W[1], u = dx * c - dy * s, v = dx * s + dy * c; return (u / 15) ** 2 + (v / 9.5) ** 2 <= 1 && u < -2; };
    const on = where([bird.wing, bird.wingTip]);
    paintWhere((x, y) => on(x, y) && inWing(x, y) && !((x + y) % 3) && !(y % 2), bird.wingSpots);
  }
  if (bird.bibSize > 1) b.ellipse(hx + 7, hy + 12, 5.5 * bird.bibSize, 4.2 * bird.bibSize, bird.bib, { onlyFilled: true, shadeAs: HS, clip: (x, y) => y > hy + 5 && y < hy + 20 });
  if (bird.breastBand) b.ellipse(hx + 4, hy + 20.5, 15, 2, bird.breastBand, { onlyFilled: true, flat: true });
  if (bird.nape) b.ellipse(hx - 15, hy - 8, 5.5, 4.5, bird.nape, { onlyFilled: true, shadeAs: HS });
  if (bird.eyeStripe) b.line(hx + 17, hy + 1, hx - 21, hy - 1, 4, bird.eyeStripe, { onlyFilled: true });
  if (bird.moustache) {
    const pts = bird.moustacheToNape ? [[hx + 13, hy + 11], [hx + 2, hy + 16], [hx - 11, hy + 13], [hx - 18, hy + 3]] : [[hx + 14, hy + 9], [hx + 7, hy + 14], [hx + 3, hy + 19]];
    for (let i = 0; i + 1 < pts.length; i++) b.line(...pts[i], ...pts[i + 1], 5, bird.moustache, { onlyFilled: true });
  }
  if (bird.crownStreaks) for (const [dx, dy] of [[-9, -14], [-3, -16], [3, -14], [-13, -9], [0, -11], [7, -10]]) b.rect(hx + dx, hy + dy, 2, 1, bird.crownStreaks, { onlyFilled: true, flat: true });
  if (bird.forehead) b.ellipse(hx + 14, hy - 1, 3.4, 3, bird.forehead, { onlyFilled: true, shadeAs: HS });
  if (bird.wattle) {
    b.rotEllipse(hx - 4, hy + 3, 7.5, 10.5, 0.25, bird.wattle, { onlyFilled: true, shadeAs: HS });
    b.ellipse(hx + 10, hy + 4, 2.6, 4, bird.wattle, { onlyFilled: true, shadeAs: HS, clip: (x, y) => y > hy });
  }
  if (bird.earTufts) for (const dy of [0, 4]) b.triangle(hx - 13, hy - 12 + dy, hx - 9, hy - 16 + dy, hx - 22, hy - 17 + dy * 0.6, bird.earTufts);
  if (bird.neckRing) b.ellipse(hx, hy + 18.5, 17, 1.8, bird.neckRing, { onlyFilled: true, flat: true });
  if (bird.chick) for (const [dx, hgt] of [[-6, 5], [0, 7], [6, 4]]) b.triangle(hx + dx - 3, hy - 16, hx + dx + 3, hy - 16, hx + dx - 1, hy - 18 - hgt, bird.cap || bird.head);
  if (bird.mottle) b.line(hx + 16, hy + 6, hx + 3, hy + 9, 1.2, rampFor(bird.head)[3], { onlyFilled: true });

  if (bird.arched) {
    k.px.fill(null);
    archedBeak(k, hx + 14, hy + 5, 17, 11, bird.beak, open);
  }
  if (bird.chick && bird.gape) k.ellipse(hx + 15, hy + 5, 3, 3.6 + open * 3, bird.gape, { flat: true });

  if (bird.gloss) {
    const lit = RAMPS.ink[0], gloss = rampFor(bird.gloss);
    for (let i = 0; i < b.px.length; i++) if (b.px[i] === lit) b.px[i] = gloss[1];
  }
  if (bird.mottle) {
    const on = where([bird.body, bird.wing, bird.head, bird.cap, tail.color, bird.wingTip]);
    const face = capClip([hx, hy, 21, 19]);
    const [pale, dark] = bird.mottle.map((c) => rampFor(c));
    paintWhere((x, y) => on(x, y) && face(x, y) && hash2(x >> 1, y, 41) < 0.14 && y % 2 === 0, dark[1]);
    paintWhere((x, y) => on(x, y) && face(x, y) && hash2(x, y, 43) > 0.93, pale[1]);
  }
  return rig;
}

for (const shape of Object.keys(RIG_PLANS)) PORTRAIT_BODIES[shape] = rigPortrait;
