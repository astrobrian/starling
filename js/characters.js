
const HEAD = [7, 8.6, 6.6, 7];                // cx, cy, rx, ry
const FACE_FRONT = [7, 11.2, 5.6, 5.2];
const FACE_SIDE = [5.2, 11.2, 4.6, 5.2];

function renderPlayer(look = window.PLAYER_LOOK) {
  const frames = (view) => [0, 1, 2].map((step) => renderPlayerView(look, view, step));
  const left = frames("left"), leftBlink = renderPlayerView(look, "left", 0, false, true);
  const sing = (view, sitting = false) => [{ mouth: "o" }, { mouth: "o", eyes: "happy" }].map((x) => renderPlayerView(look, view, 0, sitting, false, x));
  const singLeft = sing("left");
  const kissLeft = renderPlayerView(look, "left", 0, false, false, { eyes: "kiss", lean: true });
  const pourLeft = renderPlayerView(look, "left", 0, false, false, { arms: (b) => {
    b.line(6.8, 18.6, POUR_HAND.x, POUR_HAND.y - 0.8, 2.4, look.outfit.top, { flat: false });
    b.circle(POUR_HAND.x - 1, POUR_HAND.y - 1, 1.15, look.skin, { flat: true });
  } });
  return {
    down: frames("down"),
    up: frames("up"),
    left,
    right: left.map(flipCanvas),
    sit: renderPlayerView(look, "down", 0, true),
    blink: {
      down: renderPlayerView(look, "down", 0, false, true),
      left: leftBlink,
      right: flipCanvas(leftBlink),
      sit: renderPlayerView(look, "down", 0, true, true),
    },
    acts: {
      sing: { down: sing("down"), left: singLeft, right: singLeft.map(flipCanvas), sit: sing("down", true) },
      cheer: {
        down: raisedArms(renderPlayerView(look, "down", 0, false, false, { arms: "cheer", eyes: "happy" }), look, "down"),
        up: raisedArms(renderPlayerView(look, "up", 0, false, false, { arms: "cheer" }), look, "up"),
      },
      kiss: { left: kissLeft, right: flipCanvas(kissLeft) },
      pour: { left: pourLeft, right: flipCanvas(pourLeft) },
    },
  };
}
const POUR_HAND = { x: 2.2, y: 17.6 };

const CHEER_PAD = { x: 3, y: 2 };
function raisedArms(frame, look, view) {
  const P = CHEER_PAD, b = new PixelBuffer(14 + 2 * P.x, 30 + P.y);
  for (const s of [-1, 1]) {
    const sh = [7 + s * 4 + P.x, 18.4 + P.y], bow = [7 + s * 10.4 + P.x, 11 + P.y], hand = [7 + s * 6.2 + P.x, 1 + P.y];
    for (let t = 0; t <= 1.001; t += 0.05) {
      const u = 1 - t, x = u * u * sh[0] + 2 * u * t * bow[0] + t * t * hand[0], y = u * u * sh[1] + 2 * u * t * bow[1] + t * t * hand[1];
      b.circle(x, y, 1.15, look.outfit.top, { shadeAs: [7 + P.x, 12 + P.y, 11, 10] });
    }
    b.circle(...hand, 1.2, look.skin, { flat: true });
  }
  const arms = outline(b).toCanvas();
  const c = document.createElement("canvas");
  c.width = arms.width; c.height = arms.height;
  const g = c.getContext("2d");
  if (view === "up") { g.drawImage(frame, P.x, P.y); g.drawImage(arms, 0, 0); }
  else { g.drawImage(arms, 0, 0); g.drawImage(frame, P.x, P.y); }
  c.ox = P.x; c.oy = P.y;
  return c;
}

function leanIn(b, hair = []) {
  const out = new PixelBuffer(b.w + 1, b.h);
  const isHead = (c, y) => y < 17 || (y < 25 && hair.includes(c));
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.get(x, y); if (c && !isHead(c, y)) out.set(x + 1, y, c); }
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.get(x, y); if (c && isHead(c, y)) out.set(x, y, c); }
  return out;
}

function renderPlayerView(look, view, step = 0, sitting = false, blink = false, extra = {}) {
  let b = new PixelBuffer(14, 30);
  const has = (a) => (look.accessories || []).includes(a);

  drawBackHair(b, look, view);
  if (look.hairStyle === "long") {
    const H = rampFor(look.hairColor), side = view === "left";
    for (let x = 0; x < 14; x++) {
      let bottom = -1;
      for (let y = 0; y < 30; y++) if (b.get(x, y)) bottom = y;
      if (bottom < 18) continue;
      const cut = side ? [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0][x] : [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1][x];
      if (cut) b.set(x, bottom, null);
      if (!side && (x === 2 || x === 11)) for (let y = bottom - 5; y < bottom - 1; y++) if (b.get(x, y)) b.set(x, y, H[3]);   // a groove between locks
    }
  }
  drawBody(b, look, view, step, sitting, extra.arms);
  drawHead(b, look, view);
  if (view === "up" && look.hairStyle === "ponytail") {
    b.ellipse(7, 16.5, 1.8, 4, look.hairColor, { clip: (x, y) => y > 14 });
  }
  const H = rampFor(look.hairColor);
  for (let y = 1; y < 8; y++) {
    for (let x = 0; x < 14; x++) {
      const d = ((x + 0.5 - 7) / 5.6) ** 2 + ((y + 0.5 - 8.4) / 6.2) ** 2;
      const c = b.get(x, y);
      if (!c || d < 0.62 || d > 0.8 || x > (view === "up" ? 11 : 9)) continue;
      if (H && H.includes(c)) b.set(x, y, H[0]);
    }
  }

  if (extra.lean && view === "left") b = leanIn(b, rampFor(look.hairColor) || []);
  const out = outline(b);
  if (view === "down") drawFrontFace(out, look, has("glasses"), blink, extra);
  if (view === "left") drawSideFace(out, look, has("glasses"), blink, extra);

  const clipAt = { down: [12, 5], up: [3, 5], left: [10, 4] }[view];
  if (has("starClip")) hairClip(out, ...clipAt, "starlight", "cream");
  else if (has("flowerClip")) hairClip(out, ...clipAt, "petalPink", "beeYellow");

  return out.toCanvas();
}

function drawBackHair(b, look, view) {
  const hair = look.hairColor;
  const side = view === "left";
  switch (look.hairStyle) {
    case "long":
      b.ellipse(side ? 8.3 : 7, 14, side ? 5.6 : 6.9, 9, hair);
      break;
    case "bob":
      b.ellipse(side ? 7.8 : 7, 10.6, side ? 6.4 : 7, 6.6, hair);
      break;
    case "ponytail":
      if (side) b.ellipse(12, 12, 2, 4.8, hair);
      else if (view === "down") b.ellipse(12.6, 12.5, 1.4, 3.4, hair);
      break;
  }
}

function drawBody(b, look, view, step = 0, sitting = false, arms = null) {
  const o = look.outfit;
  const bottom = o.style === "dress" ? o.top : o.bottom;
  const side = view === "left";
  const legColor = o.style === "pants" ? bottom : look.skin;

  const swing = sitting ? 0 : step === 1 ? 1 : step === 2 ? -1 : 0;
  if (!side && arms === "up") {
    for (const s of [-1, 1]) {
      b.line(7 + s * 3.6, 19.2, 7 + s * 5.7, 15.6, 2.3, o.top, { flat: false });
      b.circle(7 + s * 6, 14.4, 1.1, look.skin, { flat: true });
    }
  } else if (!side && arms === "cheer") {
  } else if (!side) {
    [2.7, 11.3].forEach((ax, i) => {
      const s = i === 0 ? -1 : 1;
      if (arms === "clasp") return;
      if (arms && arms.raise === s) {
        const [hx, hy] = arms.level === 2 ? [7 + s * 6.2, 18.4] : [7 + s * 5.8, 20.4];
        b.line(ax, 18.4, hx, hy, 2.2, o.top, { flat: false });
        b.circle(hx, hy, 1.1, look.skin, { flat: true });
        return;
      }
      const dy = (i === 0 ? -swing : swing) * (view === "down" ? 1 : -1);
      b.ellipse(ax, 19.2 + dy * 0.6, 1.4, 2.3, o.top);
      b.circle(ax, 21.3 + dy, 1.1, look.skin, { flat: true });
    });
  }

  const body = [7, 20.2, side ? 3.8 : 4.4, 4.6];
  b.ellipse(...body, o.top);
  if (o.style === "pants") {
    b.ellipse(...body, bottom, { onlyFilled: true, clip: (x, y) => y >= 22, shadeAs: body });
  } else {
    const w = side ? 3.4 : 4;
    b.polygon([[7 - w, 21.2], [7 + w, 21.2], [7 + w + 1, 24.2], [7 - w - 1, 24.2]], bottom, { shadeAs: body });
    const R = rampFor(bottom);
    for (let x = 0; x < 14; x += 2) if (b.get(x, 23)) b.set(x, 23, R[0]);
  }
  if (view === "down" && o.collar) b.rect(5.5, 15.6, 3, 1, o.collar, { flat: true });
  if (view === "down" && arms === "clasp") {
    for (const s of [-1, 1]) b.rotEllipse(7 + s * 2.2, 19.4, 2, 1.2, s * 0.5, o.top, { shadeAs: body });
    b.ellipse(7, 20.3, 1.8, 1.2, look.skin);
  }

  if (sitting) {
    for (const lx of [4.6, 7.6]) b.rect(lx, 24, 1.8, 1.4, legColor, { flat: true });
    b.ellipse(5, 26.2, 1.9, 1.4, o.shoes);
    b.ellipse(9, 26.2, 1.9, 1.4, o.shoes);
    return;
  }
  if (side) {
    const [front, back] = step === 1 ? [4, 8.6] : step === 2 ? [4.6, 8] : [5, 7.4];
    const far = step === 2 ? front : back, near = step === 2 ? back : front;
    b.rect(far, 24, 1.8, 2.2, legColor, { flat: true });
    b.ellipse(far + 0.6, 27.3, 2, 1.5, RAMPS[o.shoes] ? RAMPS[o.shoes][2] : o.shoes, { flat: true });
    b.rect(near, 24, 1.8, 2.2, legColor, { flat: true });
    b.ellipse(near + 0.1, 27.3, 2.1, 1.5, o.shoes);
    if (typeof arms === "function") arms(b, look);
    else {
      b.ellipse(7.2 - swing * 2.5, 19.4, 1.4, 2.4, o.top);
      b.circle(7 - swing * 4.5, 21.5, 1.1, look.skin, { flat: true });
    }
  } else {
    const reach = view === "down" ? 1 : -1;       // facing away, the forward foot looks higher
    const lift = [[0, 0], [reach, -reach], [-reach, reach]][step];
    [[4.5, 5.3], [7.7, 8.7]].forEach(([lx, sx], i) => {
      const dy = lift[i];
      b.rect(lx, 24, 1.8, 2.2 + Math.max(0, dy), legColor, { flat: true });
      b.ellipse(sx, 27.3 + dy, 1.9, 1.5, o.shoes);
    });
  }
}

function drawHead(b, look, view) {
  const hair = look.hairColor;
  b.ellipse(...HEAD, look.skin);

  if (view === "up") {
    b.ellipse(...HEAD, hair, { onlyFilled: true });
  } else {
    const face = view === "left" ? FACE_SIDE : FACE_FRONT;
    const inFace = (x, y) => ((x + 0.5 - face[0]) / face[2]) ** 2 + ((y + 0.5 - face[1]) / face[3]) ** 2 <= 1;
    b.ellipse(...HEAD, hair, { onlyFilled: true, clip: (x, y) => !inFace(x, y) });
    b.ellipse(...face, look.skin, { onlyFilled: true, flat: true, clip: (x, y) => inFace(x, y) });
    b.ellipse(...face, RAMPS.skin[2], { onlyFilled: true, flat: true,
      clip: (x, y) => inFace(x, y) && !inFace(x + 1, y) && look.skin === "skin" });
    const bangs = view === "left"
      ? [[0, 5], [9.5, 5], [9.5, 9], [8, 8.2], [6.5, 9.4], [5, 8.2], [3.5, 9.6], [2, 8.2], [0, 9]]
      : [[0, 5], [14, 5], [14, 9], [12, 8.2], [10.5, 9.6], [9, 8.2], [7, 9.4], [5, 8.2], [3.5, 9.6], [2, 8.2], [0, 9]];
    b.polygon(bangs, hair, { onlyFilled: true, shadeAs: HEAD });
  }

  if (look.hairStyle === "buns") {
    if (view === "left") b.circle(10.2, 2.6, 2.3, hair);
    else for (const bx of [1.8, 12.2]) b.circle(bx, 2.8, 2.2, hair);
  }
}

function drawFrontFace(out, look, glasses, blink = false, extra = {}) {
  const E = rampFor(look.eyes) || RAMPS.plum;
  for (const ex of [3, 9]) {
    if (extra.eyes === "happy") {
      out.set(ex, 13, look.eyes); out.set(ex + 1, 12, look.eyes); out.set(ex + 2, 12, look.eyes); out.set(ex + 3, 13, look.eyes);
      continue;
    }
    if (blink) {
      out.set(ex + 1, 13, look.eyes); out.set(ex + 2, 13, look.eyes);
      out.set(ex === 3 ? ex : ex + 3, 12, look.eyes);
      continue;
    }
    for (let y = 10; y <= 12; y++) {
      out.set(ex + 1, y + 1, look.eyes);
      out.set(ex + 2, y + 1, look.eyes);
    }
    out.set(ex + 1, 11, "cream");               // shine, upper left
    out.set(ex + 2, 13, E[0]);                  // a lighter lower edge: the eye looks big and bright
    out.set(ex === 3 ? ex : ex + 3, 11, E[3] || look.eyes);   // a lash flick at the outer corner
  }
  const blushX = glasses ? [1, 12] : [2, 3, 10, 11];
  for (const bx of blushX) out.set(bx + 1, 14, "blush");
  out.set(6 + 1, 15, RAMPS.blush[3]);           // tiny mouth
  out.set(7 + 1, 15, RAMPS.blush[3]);
  if (extra.mouth === "o") {                     // (singing: a little "o", open below)
    out.set(6 + 1, 16, RAMPS.blush[3]);
    out.set(7 + 1, 16, RAMPS.blush[3]);
  }

  if (glasses) {
    const g = look.glassesColor || "plum";
    for (const [x0, x1] of [[2, 5], [8, 11]]) ring(out, x0 + 1, 9 + 1, x1 + 1, 13 + 1, g);
    out.set(6 + 1, 10 + 1, g);
    out.set(7 + 1, 10 + 1, g);
  }
}

function drawSideFace(out, look, glasses, blink = false, extra = {}) {
  const E = rampFor(look.eyes) || RAMPS.plum;
  if (extra.eyes === "happy") {
    out.set(2, 13, look.eyes); out.set(3, 12, look.eyes); out.set(4, 12, look.eyes); out.set(5, 13, look.eyes);
  } else if (extra.eyes === "kiss") {
    out.set(3, 13, look.eyes); out.set(4, 13, look.eyes); out.set(5, 12, look.eyes); out.set(2, 12, look.eyes);
    out.set(6, 11, E[3] || look.eyes);
    out.set(4, 15, "blush");
  } else if (blink) {
    out.set(3, 13, look.eyes); out.set(4, 13, look.eyes); out.set(5, 12, look.eyes);
  } else {
    for (let y = 10; y <= 12; y++) {
      out.set(2 + 1, y + 1, look.eyes);
      out.set(3 + 1, y + 1, look.eyes);
    }
    out.set(2 + 1, 11, "cream");
    out.set(4, 13, E[0]);
    out.set(5, 11, E[3] || look.eyes);
  }
  out.set(4 + 1, 14, "blush");
  out.set(5 + 1, 14, "blush");
  out.set(1 + 1, 15, RAMPS.blush[3]);
  if (extra.mouth === "o") out.set(1 + 1, 16, RAMPS.blush[3]);

  if (glasses) {
    const g = look.glassesColor || "plum";
    ring(out, 1 + 1, 9 + 1, 4 + 1, 13 + 1, g);
    for (let x = 5; x <= 8; x++) out.set(x + 1, 10 + 1, g);
  }
}

function ring(buf, x0, y0, x1, y1, color) {
  for (let x = x0; x <= x1; x++) { buf.set(x, y0, color); buf.set(x, y1, color); }
  for (let y = y0; y <= y1; y++) { buf.set(x0, y, color); buf.set(x1, y, color); }
}

function hairClip(buf, x, y, petal, center) {
  buf.set(x, y - 1, petal);
  buf.set(x - 1, y, petal);
  buf.set(x, y, center);
  buf.set(x + 1, y, petal);
  buf.set(x, y + 1, petal);
}

const tiltedCache = {};
function tiltedHeld(name, steps, dir = 1) {
  const key = `${name}/${steps}/${dir}`;
  if (tiltedCache[key]) return tiltedCache[key];
  if (window.ICONS && !ICONS[name] && /^seeds:/.test(name) && typeof seedIcon === "function") seedIcon(name.slice(6));   // (a seed packet: js/keepsakes.js)
  const icon = window.ICONS && ICONS[name];
  let out = null;
  if (icon) {
    const w = Math.max(...icon.grid.map((r) => r.length)), h = icon.grid.length;
    const raw = new PixelBuffer(w, h);
    icon.grid.forEach((row, y) => [...row].forEach((ch, x) => { if (icon.colors[ch]) raw.set(dir < 0 ? w - 1 - x : x, y, icon.colors[ch]); }));
    const turned = turnBuffer(raw, steps * 0.4 * dir);
    out = icon.bare ? turned : outline(turned);
  }
  let canvas = out ? out.toCanvas() : prop("wateringCan").canvas, spout = null, grip = null;
  if (!out && dir < 0) canvas = flipCanvas(canvas);
  if (out) {
    for (let i = 0; i < out.w && !spout; i++) {
      const x = dir > 0 ? out.w - 1 - i : i;
      for (let y = out.h - 1; y >= 0; y--) if (out.get(x, y)) { spout = { x, y: y + 1 }; break; }
    }
    const w = Math.max(...icon.grid.map((r) => r.length)), h = icon.grid.length, a = steps * 0.4 * dir;
    const ux = (dir > 0 ? w * 0.2 : w * 0.8) - w / 2, uy = 1 - h / 2, pad = icon.bare ? 0 : 1;
    const tw = steps ? Math.ceil(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) + 1 : w;
    const th = steps ? Math.ceil(Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) + 1 : h;
    grip = { x: ux * Math.cos(a) - uy * Math.sin(a) + tw / 2 + pad, y: ux * Math.sin(a) + uy * Math.cos(a) + th / 2 + pad };
  } else {
    spout = { x: dir > 0 ? canvas.width - 2 : 1, y: 3 };
    grip = { x: dir > 0 ? canvas.width * 0.2 : canvas.width * 0.8, y: 2 };
  }
  return (tiltedCache[key] = { canvas, spout, grip, w: canvas.width, h: canvas.height });
}

function turnBuffer(src, angle) {
  if (!angle) return src;
  const c = Math.cos(angle), s = Math.sin(angle);
  const W = Math.ceil(Math.abs(src.w * c) + Math.abs(src.h * s)) + 1, H = Math.ceil(Math.abs(src.w * s) + Math.abs(src.h * c)) + 1;
  const out = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
    const col = src.get(Math.floor(dx * c + dy * s + src.w / 2), Math.floor(-dx * s + dy * c + src.h / 2));
    if (col) out.set(x, y, col);
  }
  return out;
}

function drawPourWater(ctx, spout, to, time) {
  const { x: sx, y: sy } = spout, dir = spout.dir || 1;
  const cx = sx + (to.x - sx) * 0.6, cy = Math.min(sy, to.y) - 5;           // (the top of the arch)
  const n = Math.max(8, Math.ceil(Math.hypot(to.x - sx, to.y - sy) * 1.4));
  const run = Math.floor(time * 24), at = (u, spread) => [
    (1 - u) * (1 - u) * sx + 2 * u * (1 - u) * cx + u * u * (to.x + spread),
    (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * cy + u * u * to.y];
  const seen = new Set(), dot = (x, y, color) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (seen.has(k)) return;
    seen.add(k);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (let i = 1; i <= n; i++) {
    const [x, y] = at(i / n, 0);
    dot(x, y, (i + run) % 5 === 0 ? PALETTE.cream : RAMPS.pond[1]);
  }
  for (let i = 1; i <= n; i++) { const [x, y] = at(i / n, 0); dot(x + dir, y + 1, RAMPS.pond[2]); }
  for (const spread of [-2.5, 2.5]) {
    for (let i = 2; i <= n; i += 2) {
      if ((i / 2 + run) % 2) continue;
      const [x, y] = at(i / n, spread * (i / n));
      dot(x, y + 1, RAMPS.pond[i % 4 ? 1 : 0]);
    }
  }
  for (let j = 0; j < 3; j++) {
    const ph = (time * 2.4 + j / 3) % 1;
    ctx.fillStyle = j === 1 ? PALETTE.cream : RAMPS.pond[0];
    ctx.fillRect(Math.round(to.x + (j - 1) * 3 * ph), Math.round(to.y - Math.sin(ph * Math.PI) * 3), 1, 1);
  }
}

function drawPourSeeds(ctx, spout, to, time, kind = "flower", elapsed = 2) {
  const colors = kind === "bird" ? [PALETTE.beeYellow, RAMPS.beeYellow[2], PALETTE.path] : ["#6E4B37", PALETTE.seed, "#A77A58"];
  const { x: sx, y: sy } = spout;
  for (let i = 0; i < 7; i++) {
    const u = (time * 1.6 + i / 7) % 1;
    const x = sx + (to.x - sx) * u + Math.sin(i * 2.3) * u * 1.5, y = sy + (to.y - sy) * u * u;
    ctx.fillStyle = colors[i % 3];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  const landed = Math.min(6, Math.floor(Math.max(0, elapsed - 0.4) * 5));
  for (let i = 0; i < landed; i++) {
    ctx.fillStyle = colors[(i + 1) % 3];
    ctx.fillRect(Math.round(to.x + (hash2(i, 3, 51) - 0.5) * 7), Math.round(to.y + (hash2(i, 4, 52) - 0.5) * 3), 1, 1);
  }
}

function drawPourStream(ctx, item, spout, to, time, elapsed = 2) {
  if (/^seeds(:|$)/.test(item || "")) drawPourSeeds(ctx, spout, to, time, item === "seeds" ? "bird" : "flower", elapsed);
  else drawPourWater(ctx, spout, to, time);
}

const THROW = { swing: 0.2, release: 0.28, follow: 0.42, dur: 0.72 };   // seconds: when each frame starts, and the whole throw
const THROW_HAND = { x: 1, y: 21 };                                      // where her hand lets go (facing left, in her sprite)
const throwCache = new WeakMap();
function renderPlayerThrow(look = window.PLAYER_LOOK) {
  if (throwCache.has(look)) return throwCache.get(look);
  const top = look.outfit.top;
  const arm = (x0, y0, x1, y1, hx, hy) => (b) => {
    b.line(x0, y0, x1, y1, 2.4, top, { flat: false });
    b.circle(hx, hy, 1.15, look.skin, { flat: true });
  };
  const poses = [
    { arm: arm(7.2, 18, 10.8, 21, 11.6, 21.8), step: 2, pebble: [12, 22] },
    { arm: arm(7, 18.2, 6.6, 22, 6.4, 23), step: 0, pebble: [5, 23] },
    { arm: arm(6.6, 18.6, 2.2, 20.2, 1.2, 20.4), step: 1 },
    { arm: arm(6.8, 18.2, 2.8, 17.4, 1.6, 17), step: 1 },
  ];
  const left = poses.map(({ arm: drawArm, step, pebble }) => {
    const c = renderPlayerView(look, "left", step, false, false, { arms: drawArm });
    if (pebble) {
      const g = c.getContext("2d"), P = rampFor("#9E9AB0");
      g.fillStyle = P[1]; g.fillRect(pebble[0] + 1, pebble[1] + 1, 2, 1);
      g.fillStyle = P[0]; g.fillRect(pebble[0] + 1, pebble[1] + 1, 1, 1);
    }
    return c;
  });
  const frames = { left, right: left.map(flipCanvas) };
  throwCache.set(look, frames);
  return frames;
}

function throwStep(t) {
  return t < THROW.swing ? 0 : t < THROW.release ? 1 : t < THROW.follow ? 2 : 3;
}

function flipCanvas(src) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d");
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
