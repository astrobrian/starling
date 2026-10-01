
function husbandLook() {
  const H = window.HUSBAND || {};
  const looks = H.looks || {};
  const asked = typeof PARAMS !== "undefined" ? PARAMS.get("husband") : null;     // (?husband=b, js/dev.js)
  return looks[asked] || looks[H.style] || Object.values(looks)[0];
}

const HIS_FACE_FRONT = [7, 11.4, 5.9, 5.4];
const BINOCULARS = "giwa";                  // his binoculars: slate, so they stand off his dark hair (a palette name, or "#rrggbb")
const HIS_FACE_SIDE = [5.2, 11.4, 4.9, 5.4];

function renderHusband(look = husbandLook()) {
  const frames = (view, pose = null) => [0, 1, 2].map((step) => renderHusbandView(look, view, step, pose));
  const left = frames("left"), holdLeft = frames("left", "holdBack");
  const leftBlink = renderHusbandView(look, "left", 0, null, true);
  const pointLeft = renderHusbandView(look, "left", 0, "point"), reachLeft = renderHusbandView(look, "left", 0, "reach");
  const lookLeft = renderHusbandView(look, "left", 0, "binoculars"), pointLowLeft = renderHusbandView(look, "left", 0, "pointLow");
  const kissLeft = renderHusbandView(look, "left", 0, "kiss");
  const all = {
    down: frames("down"),
    up: frames("up"),
    left,
    right: left.map(flipCanvas),
    hold: { left: holdLeft, right: holdLeft.map(flipCanvas) },
    sit: renderHusbandView(look, "down", 0, "sit"),
    blink: {
      down: renderHusbandView(look, "down", 0, null, true),
      left: leftBlink,
      right: flipCanvas(leftBlink),
      sit: renderHusbandView(look, "down", 0, "sit", true),
    },
    point: { left: pointLeft, right: flipWide(pointLeft) },
    pointLow: { left: pointLowLeft, right: flipWide(pointLowLeft) },
    reach: { left: reachLeft, right: flipCanvas(reachLeft) },
    wave: [renderHusbandView(look, "down", 0, "wave0"), renderHusbandView(look, "down", 0, "wave1")],
    binoculars: { left: lookLeft, right: flipWide(lookLeft) },
    kiss: { left: kissLeft, right: flipCanvas(kissLeft) },
  };
  all.waveRight = all.wave.map(flipWide);
  return all;
}

function renderHusbandHead(look = husbandLook()) {
  const s = renderHusband(look).down[0];
  const c = document.createElement("canvas");
  c.width = s.width; c.height = 19;
  c.getContext("2d").drawImage(s, 0, 0);
  return c;
}

function flipWide(src) {
  const c = flipCanvas(src);
  c.ox = src.width - 16 - (src.ox || 0);
  return c;
}

function renderHusbandView(look, view, step = 0, pose = null, blink = false) {
  let b = new PixelBuffer(14, 30);
  const looking = pose === "binoculars";
  drawHisBody(b, look, view, step, pose);
  drawHisHead(b, look, view);
  const H = rampFor(look.hairColor);
  for (let y = 1; y < 8; y++) {
    for (let x = 0; x < 14; x++) {
      const d = ((x + 0.5 - 7) / 5.6) ** 2 + ((y + 0.5 - 8.4) / 6.2) ** 2;
      const c = b.get(x, y);
      if (!c || d < 0.62 || d > 0.8 || x > (view === "up" ? 11 : 9)) continue;
      if (H.includes(c)) b.set(x, y, H[0]);
    }
  }
  if (pose === "kiss" && view === "left") b = leanIn(b, rampFor(look.hairColor) || []);
  let wide = b, ox = 0;
  if (pose === "wave0" || pose === "wave1" || pose === "point" || pose === "pointLow" || (looking && view === "left")) {
    ox = pose === "point" || pose === "pointLow" || looking ? 3 : 4;
    wide = new PixelBuffer(14 + ox, 30);
    wide.stamp(b, ox, 0);
    if (looking) {
      wide.rect(0, 10, 2, 4.4, BINOCULARS);
      wide.rect(1.6, 10.6, 6.4, 3.2, BINOCULARS);
      wide.rotEllipse(ox + 3.6, 16.4, 2.7, 1.25, 0.9, look.shirt);
    } else if (pose === "pointLow") {
      wide.rotEllipse(ox + 2.6, 20.4, 3.6, 1.3, -0.8, look.shirt);
      wide.circle(1.2, 22.5, 1.15, look.skin, { flat: true });
    } else if (pose === "point") {
      wide.rotEllipse(ox + 3.2, 15.4, 3.6, 1.3, 0.62, look.shirt);
      wide.circle(0.9, 12.6, 1.15, look.skin, { flat: true });
    } else {
      wide.rotEllipse(ox / 2 + 1.5, 12.4, 5, 1.3, 1.16, look.shirt);
      wide.circle(pose === "wave0" ? 1.2 : 2.4, pose === "wave0" ? 7.4 : 6.6, 1.25, look.skin, { flat: true });
    }
  }
  const out = outline(wide);
  const shifted = { set: (x, y, c) => out.set(x + ox, y, c) };
  drawShirtDetails(shifted, look, view, pose);
  if (looking) {
    const G = RAMPS.noonGlass;
    out.set(1, 12, "cream"); out.set(1, 13, G[1]); out.set(1, 14, G[2]);
    const fist = new PixelBuffer(2, 2);
    fist.rect(0, 0, 2, 2, look.skin, { flat: true });
    out.stamp(outline(fist), 4, 13);
    if (look.glasses) for (let x = 7; x <= 9; x++) shifted.set(x, 11, look.glasses.color);
    shifted.set(5, 14, "blush"); shifted.set(6, 14, "blush");
    shifted.set(2, 16, RAMPS.blush[3]);
  } else {
    if (view === "down") drawHisFrontFace(shifted, look, blink);
    if (view === "left") drawHisSideFace(shifted, look, blink, pose === "kiss");
  }
  const canvas = out.toCanvas();
  canvas.ox = ox;                     // draw it this many pixels to the left
  return canvas;
}

function drawHisBody(b, look, view, step, pose) {
  const side = view === "left", sitting = pose === "sit", waving = pose === "wave0" || pose === "wave1";
  const swing = sitting || (pose && pose !== "holdBack") ? 0 : step === 1 ? 1 : step === 2 ? -1 : 0;
  const looking = pose === "binoculars";
  if (!side) {
    [2.7, 11.3].forEach((ax, i) => {
      if (waving && i === 1) return;
      const dy = (i === 0 ? -swing : swing) * (view === "down" ? 1 : -1);
      b.ellipse(ax, 19.2 + dy * 0.6, 1.4, 2.3, look.shirt);
      b.circle(ax, 21.3 + dy, 1.1, look.skin, { flat: true });
    });
  }
  const body = [7, 20.2, side ? 3.8 : 4.4, 4.6];
  b.ellipse(...body, look.shirt);
  b.ellipse(...body, look.pants, { onlyFilled: true, clip: (x, y) => y >= 22, shadeAs: body });
  if (sitting) {
    for (const lx of [4.6, 7.6]) b.rect(lx, 24, 1.8, 1.4, look.pants, { flat: true });
    b.ellipse(5, 26.2, 1.9, 1.4, look.shoes);
    b.ellipse(9, 26.2, 1.9, 1.4, look.shoes);
    return;
  }
  if (side) {
    const [front, back] = step === 1 ? [4, 8.6] : step === 2 ? [4.6, 8] : [5, 7.4];
    const far = step === 2 ? front : back, near = step === 2 ? back : front;
    b.rect(far, 24, 1.8, 2.2, look.pants, { flat: true });
    b.ellipse(far + 0.6, 27.3, 2, 1.5, rampFor(look.shoes)[2], { flat: true });
    b.rect(near, 24, 1.8, 2.2, look.pants, { flat: true });
    b.ellipse(near + 0.1, 27.3, 2.1, 1.5, look.shoes);
    if (looking) {
      b.rotEllipse(3.6, 15.6, 2.6, 1.3, 1.05, look.shirt);
    } else if (pose === "pointLow") {
      b.rotEllipse(4.6, 18.8, 2.9, 1.3, -0.3, look.shirt);
    } else if (pose === "point") {
      b.rotEllipse(4.8, 17, 2.9, 1.3, 0.5, look.shirt);
      b.circle(2, 15.4, 1.15, look.skin, { flat: true });
    } else if (pose === "reach") {
      b.rotEllipse(4.6, 19.9, 2.9, 1.3, 0.05, look.shirt);
      b.circle(1.5, 20.1, 1.15, look.skin, { flat: true });
    } else if (pose === "holdBack") {
      b.rotEllipse(9.4, 19.9, 2.9, 1.3, -0.05, look.shirt);
      b.circle(12.5, 20.1, 1.15, look.skin, { flat: true });
    } else {
      b.ellipse(7.2 - swing * 2.5, 19.4, 1.4, 2.4, look.shirt);
      b.circle(7 - swing * 4.5, 21.5, 1.1, look.skin, { flat: true });
    }
  } else {
    const reach = view === "down" ? 1 : -1;
    const lift = [[0, 0], [reach, -reach], [-reach, reach]][step];
    [[4.5, 5.3], [7.7, 8.7]].forEach(([lx, sx], i) => {
      const dy = lift[i];
      b.rect(lx, 24, 1.8, 2.2 + Math.max(0, dy), look.pants, { flat: true });
      b.ellipse(sx, 27.3 + dy, 1.9, 1.5, look.shoes);
    });
  }
}

function drawHisHead(b, look, view) {
  const hair = look.hairColor;
  b.ellipse(...HEAD, look.skin);
  if (view === "up") {
    b.ellipse(...HEAD, hair, { onlyFilled: true, clip: (x, y) => y < 13.6 || Math.abs(x + 0.5 - 7) > 3.6 });
    if (look.hairStyle === "tousled") b.line(8, 1.4, 10.6, -0.6, 1.2, hair);
    return;
  }
  const face = view === "left" ? HIS_FACE_SIDE : HIS_FACE_FRONT;
  const inFace = (x, y) => ((x + 0.5 - face[0]) / face[2]) ** 2 + ((y + 0.5 - face[1]) / face[3]) ** 2 <= 1;
  b.ellipse(...HEAD, hair, { onlyFilled: true, clip: (x, y) => !inFace(x, y) && y < 13.4 });
  b.ellipse(...face, look.skin, { onlyFilled: true, flat: true, clip: (x, y) => inFace(x, y) });
  b.ellipse(...face, RAMPS.skin[2], { onlyFilled: true, flat: true, clip: (x, y) => inFace(x, y) && !inFace(x + 1, y) && look.skin === "skin" });
  const fringes = {
    neat: view === "left"
      ? [[0, 5], [9.6, 5], [9.6, 7.6], [7.5, 8.4], [5, 8.8], [2.5, 9.4], [0, 9.2]]
      : [[0, 5], [14, 5], [14, 8.2], [11.5, 7.4], [8.5, 7.6], [6, 8.6], [3.5, 9.4], [1, 9.6], [0, 9.2]],
    tousled: view === "left"
      ? [[0, 5], [9.6, 5], [9.6, 8.6], [8.2, 8], [6.8, 9.4], [5.2, 8.2], [3.8, 9.6], [2, 8.4], [0, 9.2]]
      : [[0, 5], [14, 5], [14, 9], [12.4, 8], [11, 9.4], [9.4, 8.2], [7.8, 9.6], [6, 8.2], [4.4, 9.4], [2.8, 8.2], [1.4, 9.2], [0, 9]],
    swept: view === "left"
      ? [[0, 5], [9.6, 5], [9.6, 6.6], [7, 7], [4.4, 7.4], [2, 8], [0, 8.4]]
      : [[0, 5], [14, 5], [14, 7.4], [11.5, 6.8], [9, 6.6], [6.5, 6.6], [4, 7], [1.6, 7.6], [0, 8]],
  };
  b.polygon(fringes[look.hairStyle] || fringes.neat, hair, { onlyFilled: true, shadeAs: HEAD });
  if (look.hairStyle === "neat") {
    for (let y = 2; y < 6; y++) b.set(view === "left" ? 7 : 4, y, rampFor(hair)[3]);
  } else if (look.hairStyle === "tousled") {
    b.line(8, 2, 10.6, -0.2, 1.2, hair);
    b.set(10, 0, rampFor(hair)[1]);
  } else if (look.hairStyle === "swept") {
    b.ellipse(view === "left" ? 4.6 : 7, 3, view === "left" ? 4.4 : 6, 1.6, hair, { shadeAs: HEAD });
  }
}

function drawShirtDetails(out, look, view, pose) {
  const S = rampFor(look.shirt), button = RAMPS.snow[1];
  const put = (x, y, c) => out.set(x + 1, y + 1, c);
  if (view === "down") {
    put(5, 16, S[0]); put(6, 16, S[0]); put(6, 17, button);
    put(9, 16, S[0]); put(8, 16, S[0]); put(8, 17, button);
    put(7, 16, look.skin === "skin" ? RAMPS.skin[1] : look.skin);
    if (pose !== "sit") { put(7, 19, button); put(7, 21, button); }
    else put(7, 19, button);
  } else if (view === "left") {
    put(3, 16, S[0]); put(4, 16, S[0]); put(3, 17, button);
    put(3, 19, button);
  } else if (view === "up") {
    for (let x = 5; x <= 9; x++) put(x, 16, S[0]);                   // the collar band at the back
    put(7, 16, button);                                             // its little button
  }
}

function drawHisFrontFace(out, look, blink = false) {
  const E = rampFor(look.eyes) || RAMPS.plum;
  for (const ex of [3, 9]) {
    if (blink) { out.set(ex + 1, 13, look.eyes); out.set(ex + 2, 13, look.eyes); continue; }
    for (let y = 10; y <= 12; y++) { out.set(ex + 1, y + 1, look.eyes); out.set(ex + 2, y + 1, look.eyes); }
    out.set(ex + 1, 11, "cream");
    out.set(ex + 2, 13, E[0]);
  }
  const g = look.glasses;
  for (const bx of [2, 3, 10, 11]) out.set(bx + 1, g ? 15 : 14, "blush");
  out.set(6 + 1, 15, RAMPS.blush[3]);
  out.set(7 + 1, 15, RAMPS.blush[3]);
  if (g) {
    for (const [x0, x1] of [[2, 5], [8, 11]]) glassesFrame(out, x0 + 1, 10, x1 + 1, 14, g.color, g.shape === "round");
    out.set(7, 11, g.color);
    out.set(8, 11, g.color);
  }
}

function drawHisSideFace(out, look, blink = false, kiss = false) {
  const E = rampFor(look.eyes) || RAMPS.plum;
  if (kiss) {
    out.set(3, 13, look.eyes); out.set(4, 13, look.eyes);
    if (!look.glasses) { out.set(2, 12, look.eyes); out.set(5, 12, look.eyes); }
    out.set(4, 15, "blush");
  } else if (blink) {
    out.set(3, 13, look.eyes); out.set(4, 13, look.eyes);
  } else {
    for (let y = 10; y <= 12; y++) { out.set(3, y + 1, look.eyes); out.set(4, y + 1, look.eyes); }
    out.set(3, 11, "cream");
    out.set(4, 13, E[0]);
  }
  out.set(5, 14, "blush");
  out.set(6, 14, "blush");
  out.set(2, 15, RAMPS.blush[3]);
  const g = look.glasses;
  if (g) {
    glassesFrame(out, 2, 10, 5, 14, g.color, g.shape === "round");
    for (let x = 6; x <= 9; x++) out.set(x, 11, g.color);
  }
}

function glassesFrame(buf, x0, y0, x1, y1, color, round) {
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (!round || (x > x0 && x < x1)) buf.set(x, y, color);
  for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if (!round || (y > y0 && y < y1)) buf.set(x, y, color);
}

const husbandPortraits = {};
function renderHusbandPortrait(face = "happy", look = husbandLook()) {
  const key = face + JSON.stringify(look);
  if (husbandPortraits[key]) return husbandPortraits[key];
  const b = new PixelBuffer(62, 62);
  const S = rampFor(look.shirt), K = rampFor(look.skin), hair = look.hairColor, HR = rampFor(hair);
  const cx = 31;
  const body = [cx, 66, 28, 18];
  b.ellipse(...body, look.shirt);
  b.rect(cx - 5, 38, 10, 10, look.skin, { shadeAs: [cx - 2, 42, 8, 8] });
  b.polygon([[cx - 5, 46], [cx + 5, 46], [cx, 53]], look.skin, { flat: true });
  for (const s of [-1, 1]) {
    b.polygon([[cx + s * 7, 43], [cx + s * 1, 48], [cx + s * 4, 56], [cx + s * 11, 52]], S[0], { flat: true });
    b.line(cx + s * 1.5, 48.5, cx + s * 4.2, 55.5, 1, S[2]);                      // the collar's edge
  }
  b.rect(cx - 1.5, 53, 3, 10, S[1], { flat: true });
  b.rect(cx - 2.5, 53, 1, 10, S[2], { flat: true });
  b.rect(cx + 1.5, 53, 1, 10, S[2], { flat: true });
  for (const s of [-1, 1]) b.ellipse(cx + s * 19.5, 27, 3.2, 4, look.skin);
  const head = [cx, 24, 20, 18.5];
  b.ellipse(...head, look.skin);
  const faceOval = [cx, 29, 16.5, 15];
  const inFace = (x, y) => ((x + 0.5 - faceOval[0]) / faceOval[2]) ** 2 + ((y + 0.5 - faceOval[1]) / faceOval[3]) ** 2 <= 1;
  b.ellipse(...head, hair, { onlyFilled: true, clip: (x, y) => !inFace(x, y) && y < 30, shadeAs: head });
  const fringe = {
    neat: [[8, 4], [54, 4], [54, 18], [44, 14], [34, 15], [26, 18], [18, 21], [10, 23], [8, 22]],
    tousled: [[8, 4], [54, 4], [54, 20], [50, 16], [46, 21], [42, 16], [37, 21], [32, 16], [27, 21], [22, 16], [17, 21], [13, 17], [8, 21]],
    swept: [[8, 4], [54, 4], [54, 15], [45, 12], [37, 11], [29, 11], [21, 12], [13, 14], [8, 16]],
  }[look.hairStyle] || [];
  b.polygon(fringe, hair, { onlyFilled: true, shadeAs: head });
  if (look.hairStyle === "neat") b.line(19, 8, 22, 17, 1.2, HR[3], { onlyFilled: true });           // the side part
  if (look.hairStyle === "tousled") { b.line(35, 7, 41, -1, 2.2, hair); b.set(40, 0, HR[1]); }        // the cowlick
  if (look.hairStyle === "swept") b.ellipse(cx - 1, 8, 18, 4.5, hair, { shadeAs: head });              // swept up
  const out = outline(b);
  const button = RAMPS.snow[1], dark = RAMPS.snow[3];
  for (const [x, y] of [[cx - 4, 54], [cx + 3, 54], [cx - 1, 57], [cx - 1, 61]]) {
    out.set(x + 1, y + 1, button); out.set(x + 2, y + 1, button);
    out.set(x + 1, y + 2, button); out.set(x + 2, y + 2, dark);
  }
  const eyeY = 26, eyes = [cx - 10, cx + 5];
  for (const ex of eyes) {
    if (face === "joy") {
      for (const [dx, dy] of [[0, 2], [1, 1], [2, 0], [3, 0], [4, 1], [5, 2]]) out.set(ex + 1 + dx, eyeY + 1 + dy + 2, look.eyes);
      continue;
    }
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 5; dx++) {
      if ((dy === 0 || dy === 6) && (dx === 0 || dx === 4)) continue;
      out.set(ex + 1 + dx, eyeY + 1 + dy, look.eyes);
    }
    for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2]]) out.set(ex + 1 + dx, eyeY + 1 + dy, "cream");
    out.set(ex + 1 + 3, eyeY + 1 + 4, "cream");
    for (let dx = 1; dx < 4; dx++) out.set(ex + 1 + dx, eyeY + 1 + 5, mix(paletteColor(look.eyes), PALETTE.cream, 0.3));
  }
  for (const ex of eyes) for (let dx = 1; dx < 4; dx++) out.set(ex + 1 + dx, eyeY - 2, HR[2]);
  for (const bx of [cx - 13, cx + 8]) for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 2; dy++) out.set(bx + 1 + dx, eyeY + 10 + dy, "blush");
  const smile = face === "joy" ? [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]] : [[-1, 0], [0, 1], [1, 0]];
  for (const [dx, dy] of smile) out.set(cx + 1 + dx, eyeY + 11 + dy, RAMPS.blush[3]);
  const g = look.glasses;
  if (g) {
    for (const ex of eyes) glassesFrame(out, ex - 1, eyeY - 1, ex + 7, eyeY + 9, g.color, g.shape === "round");
    for (let x = cx - 2; x <= cx + 4; x++) out.set(x, eyeY + 2, g.color);
  }
  if (face === "joy") { stampIcon(out, "sparkle", 2, 3); stampIcon(out, "heart", 53, 4); }
  return (husbandPortraits[key] = out.toCanvas());
}
