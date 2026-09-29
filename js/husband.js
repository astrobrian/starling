
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

const Husband = (() => {
  const H = {
    state: "away",            // away, fetching, coming, together, leaving, atWork (at the telescope)
    x: 0, y: 0,               // where he's drawn (like her: his feet at x + 8, y + 14)
    facing: "down",
    moving: false,
    walked: 0,                // pixels walked, for his steps
    path: [],                 // tiles to follow, coming or leaving
    timer: 0,
    pose: null,               // null, "point", "wave", "reach"
    lift: 0,                  // a hop across the stepping stones
    pointed: [],               // what he showed her lately (names), so he picks something new
    wonder: null,              // his "What's that?": { target, found, timer, said, farFor, binoculars }
    nextWonder: 0,             // not before this time (seconds)
    rejoin: false,             // walking back to take her hand
    lastLine: -1,
    trail: [],                // her feet, lately (for walking single file)
    together: "side",         // side (holding hands), file (single file), stones, bench (sitting beside her)
    seated: null,             // the bench he's sitting on, beside her
    emote: null,              // a heart above his head: { name, age }
    blinkAt: 0, blinkUntil: 0,
  };
  let sprites = null;
  const S = () => sprites || (sprites = renderHusband());
  const data = () => window.HUSBAND || {};
  const lines = () => data().lines || {};
  const voice = () => data().voice || { chirp: "hum", pitch: 330 };
  const pick = (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : "");
  const now = () => performance.now() / 1000;
  const present = () => H.state === "coming" || H.state === "together" || H.state === "leaving" || H.state === "atWork" || (H.state === "routine" && !H.hidden);
  const herFeet = () => { const p = playerPixelPos(); return { x: p.x + 8, y: p.y + 14, p }; };
  const tileOf = (fx, fy) => ({ x: Math.floor(fx / TILE), y: Math.floor((fy - 2) / TILE) });
  const open = (fx, fy) => { const t = tileOf(fx, fy); return isWalkable(t.x, t.y) && WORLD.tile(t.x, t.y) !== "o"; };
  const onStones = (x, y) => WORLD.tile(x, y) === "o";

  function towardWork() {
    const view = { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height };
    const goal = { x: view.x + view.w * 0.8, y: view.y - TILE * 2 };
    const her = { x: player.nx, y: player.ny };
    let best = null;
    const x0 = Math.max(0, Math.floor(view.x / TILE) - 2), x1 = Math.min(MAP_W - 1, Math.floor((view.x + view.w) / TILE) + 2);
    const y0 = Math.max(0, Math.floor(view.y / TILE) - 3), y1 = Math.min(MAP_H - 1, Math.floor((view.y + view.h) / TILE) + 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const inView = x * TILE + 16 > view.x && x * TILE < view.x + view.w && y * TILE + 16 > view.y && y * TILE < view.y + view.h;
      if (inView || !isWalkable(x, y) || (y > y0 && y < y1 && x > x0 && x < x1)) continue;       // just outside the view
      const d = Math.hypot(x * TILE - goal.x, y * TILE - goal.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    if (!best) return null;
    const path = findPath(best, her, MAP_W, MAP_H, isWalkable, stepCost);
    return path && path.length ? { start: best, path } : null;
  }

  let viaMagpie = false;
  function call() {
    if (H.state !== "away" || Closeup.isOpen() || Sky.isOpen() || changingPlace) return;
    H.state = "fetching";
    viaMagpie = !WORLD.indoors && companion.mode === "follow" && !companion.flight && !!(Story && Story.understands());
    H.timer = viaMagpie ? 2.4 : 1.6;
    if (viaMagpie) {
      const view = { x: camera.x, y: camera.y, w: canvas.width };
      magpieFlyTo("away", view.x + view.w * 0.8, view.y - 30);
      Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
    }
  }

  function arrive() {
    const h = herFeet();
    H.state = "coming";
    H.trail = [];
    if (WORLD.indoors) {
      const door = WORLD.door;
      H.x = door.x * TILE; H.y = door.y * TILE;
      H.path = (findPath({ x: door.x, y: door.y }, { x: player.nx, y: player.ny }, MAP_W, MAP_H, isWalkable, stepCost) || []).slice(0, -1);
      Sound.door();
      return;
    }
    const way = towardWork();
    if (way) {
      H.x = way.start.x * TILE; H.y = way.start.y * TILE;
      H.path = way.path.slice(0, -1);                // up to the tile before hers
    } else {
      H.x = h.p.x + 20; H.y = h.p.y; H.path = [];
    }
    if (viaMagpie) magpieFlyTo("follow");
  }

  function bye() {
    if (H.state !== "together" && H.state !== "coming") return;
    H.wonder = null; H.rejoin = false;
    Quirks.stop();
    if (H.seated) { H.y = H.seated.footY; H.seated = null; }         // (up off the bench, onto the ground in front of it)
    H.state = "leaving";
    H.pose = "wave";
    H.timer = 1.2;
    H.facing = "down";
    const away = H.x + 8 >= herFeet().x ? 1 : -1;
    H.waveSide = away > 0 ? "left" : "right";
    H.waveTo = isWalkable(tileOf(H.x + 8 + away * 12, H.y + 14).x, tileOf(H.x + 8 + away * 12, H.y + 14).y) ? H.x + away * 8 : null;
    say(pick(lines().bye));
  }

  function goodnight() {
    if (!present()) return;
    say(pick(lines().goodnight));
    reset();
  }

  function reset() {
    H.state = "away"; H.path = []; H.pose = null; H.trail = []; H.emote = null; H.wonder = null; H.rejoin = false; H.nextWonder = 0; H.seated = null;
    endRoutineBits();
    Quirks.left();
  }

  function changedPlace() {
    if (scene.name === "dome") {
      const post = window.HUSBAND_POST || { x: 5, y: 7 };
      H.state = "atWork"; H.x = post.x * TILE; H.y = post.y * TILE; H.facing = "right"; H.pose = null; H.path = []; H.trail = [];
      const text = window.OBSERVATORY_TEXT || {};
      setTimeout(() => { say(pick(text.welcome)); H.facing = "down"; }, 500);
      setTimeout(() => { if (H.state === "atWork" && !Sky.isOpen()) say(text.look); }, 3600);        // and what to do here
      setTimeout(() => { if (H.state === "atWork") H.facing = "right"; }, 6500);
      return;
    }
    if (H.state === "atWork") { reset(); return; }             // she left the dome: he stays at work
    if (H.state === "fetching") { H.state = "away"; return; }
    if (!present()) return;
    if (H.state === "leaving") { reset(); return; }
    const h = herFeet();
    H.x = h.p.x; H.y = h.p.y; H.state = "together"; H.path = []; H.trail = []; H.wonder = null; H.rejoin = false; H.pose = null;
    H.seated = null; Quirks.stop();
  }

  function say(text, lean = 0, avoid = null) {
    if (!text || !present() || offScreen()) return;                         // (never out of thin air)
    const lift = (H.wonder && !H.wonder.found) || H.emote ? emoteSprite("question").height + 2 : 0;
    bubbleAt = { x: H.x + 8, y: H.y - TILE - 2 - lift, until: now() + 1.6 + text.split(" ").length * 0.4, lean, husband: true, avoid, feet: H.y + 16 };
    UI.say(text, voice(), "husband");
  }

  function tap() {
    if (H.state === "together" && H.wonder && !H.wonder.found) { found(); return; }
    UI.hideBubble();
    const list = (H.state === "atWork" && lines().dome) || lines().tap || [];
    if (!list.length) return;
    const dim = (text) => (text.match(/[A-Za-z']+/g) || []).filter((w) => !Words.isBright(w)).length;
    const counts = list.map(dim);
    const others = list.map((_, i) => i).filter((i) => i !== H.lastLine || list.length === 1);
    const least = Math.min(...others.map((i) => counts[i]));
    const choices = others.filter((i) => counts[i] === least);
    const i = choices[Math.floor(Math.random() * choices.length)];
    H.lastLine = i;
    const h = herFeet();
    if (H.state === "together" && !H.moving && !H.seated && !Quirks.playing()) H.facing = Math.abs(h.x - (H.x + 8)) > Math.abs(h.y - (H.y + 14)) ? (h.x < H.x + 8 ? "left" : "right") : h.y > H.y + 14 ? "down" : "up";
    H.emote = { name: "heart", age: 0 };
    Speech.say(null, { who: "husband", text: list[i], face: Math.random() < 0.5 ? "joy" : "happy" });
  }

  function goal() {
    const h = herFeet();
    const next = player.path[0], moving = isMoving();
    if (onStones(player.tx, player.ty) || onStones(player.nx, player.ny) || (moving && next && onStones(next.x, next.y))) {
      let ahead = next || { x: player.nx + (player.nx - player.tx), y: player.ny + (player.ny - player.ty) };
      if (!isWalkable(ahead.x, ahead.y) || (ahead.x === player.nx && ahead.y === player.ny)) {
        const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing] || [1, 0];
        const tries = [[d[0], d[1]], [-d[0], -d[1]], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: player.nx + dx, y: player.ny + dy }));
        ahead = tries.find((t) => isWalkable(t.x, t.y)) || { x: player.nx + 1, y: player.ny };
      }
      return { x: ahead.x * TILE, y: ahead.y * TILE, mode: "stones", face: h.x < ahead.x * TILE + 8 ? "left" : "right" };
    }
    const f = player.sitting ? "down" : player.facing;
    const side = H.x + 8 >= h.x ? 1 : -1, dir = f === "right" ? 1 : -1;
    const clear = (s) => [0.25, 0.5, 0.75, 1].every((k) => open(h.x + (s.x + 8 - h.x) * k, h.y + (s.y + 14 - h.y) * k));
    const spots = f === "down" || f === "up"
      ? [{ x: h.p.x + side * 13, y: h.p.y }, { x: h.p.x - side * 13, y: h.p.y }]
      : [{ x: h.p.x + dir * 8, y: h.p.y - 3 }];
    const spot = spots[0];
    if (!player.sitting) for (const s of spots) if (clear(s)) return { ...s, mode: "side", face: f };
    if (player.sitting && player.sitting.w >= 2 && H.state === "together") {
      const b = player.sitting;
      if (!player.seatDx) scootOver(b);
      return { x: b.footX - 8 - player.seatDx, y: b.footY - TILE - 3, mode: "bench", face: "down" };
    }
    if (player.sitting) {
      const other = { x: h.p.x - side * 16, y: h.p.y + 6 };
      for (const s of [spot, other, { x: h.p.x + side * 18, y: h.p.y + 8 }]) if (open(s.x + 8, s.y + 14)) return { ...s, mode: "file", face: "down" };
    }
    let d = 0, prev = { x: h.x, y: h.y };
    for (let i = H.trail.length - 1; i >= 0; i--) {
      const t = H.trail[i];
      d += Math.hypot(t.x - prev.x, t.y - prev.y);
      prev = t;
      if (d >= 17) return { x: t.x - 8, y: t.y - 14, mode: "file", face: null };
    }
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1]]) {
      const s = { x: h.p.x + dx * 16, y: h.p.y + dy * 16 };
      if (clear(s)) return { ...s, mode: "file", face: null };
    }
    return { x: prev.x - 8, y: prev.y - 14, mode: "file", face: null };
  }

  function shareBench(bench) {
    if (H.state !== "together" || !bench || bench.w < 2) return 0;
    return H.x + 8 >= bench.footX ? -QUIRK_FIT.seat : QUIRK_FIT.seat;
  }
  function scootOver(bench) {
    const dx = H.x + 8 >= bench.footX ? -QUIRK_FIT.seat : QUIRK_FIT.seat;
    player.seatDx = dx;
    player.hop = { dx: -dx, dy: 0, t: 0.2, dur: 0.2 };
  }

  function moveToward(tx, ty, dt, speed) {
    const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy);
    if (d < 0.5) { H.x = tx; H.y = ty; H.moving = false; return; }
    const step = Math.min(d, speed * dt);
    H.x += (dx / d) * step; H.y += (dy / d) * step;
    H.walked += step;
    H.moving = step > speed * dt * 0.25 && d > 1.5;
    if (H.moving) H.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  function update(dt) {
    if (H.emote) { H.emote.age += dt; if (H.emote.age > 1.8) H.emote = null; }
    if (heart) { heart.age += dt; if (heart.age > 1.9) heart = null; }
    if (H.state === "routine") { updateRoutine(dt); return; }
    if (H.state === "away") return;
    if (H.state === "fetching") {
      H.timer -= dt;
      if (H.timer <= 0) arrive();
      return;
    }
    const h = herFeet(), last = H.trail[H.trail.length - 1];
    if (!last || Math.hypot(h.x - last.x, h.y - last.y) > 2) { H.trail.push({ x: h.x, y: h.y }); if (H.trail.length > 60) H.trail.shift(); }
    H.lift = 0;

    if (H.state === "coming") {
      const t = H.path[0];
      if (t) {
        moveToward(t.x * TILE, t.y * TILE, dt, 6.5 * TILE);
        if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      }
      if (!H.path.length || Math.hypot(H.x + 8 - h.x, H.y + 14 - h.y) < TILE * 1.4) {
        H.state = "together";
        H.emote = { name: "heart", age: 0 };
        Sound.hearts();
        say(pick(lines().hello));
      }
      return;
    }

    if (H.state === "leaving") {
      if (H.pose === "wave") {
        H.timer -= dt;
        H.moving = false;
        if (H.waveTo != null) H.x += Math.sign(H.waveTo - H.x) * Math.min(Math.abs(H.waveTo - H.x), 40 * dt);
        if (H.timer > 0) return;
        H.pose = null;
        const from = tileOf(H.x + 8, H.y + 14);
        const to = WORLD.indoors ? WORLD.door : (towardWork() || {}).start;
        H.path = to ? findPath(from, to, MAP_W, MAP_H, isWalkable, stepCost) || [] : [];
        H.timer = 8;
      }
      const t = H.path[0];
      if (t) {
        moveToward(t.x * TILE, t.y * TILE, dt, 5 * TILE);
        if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      }
      H.timer -= dt;
      const off = H.x + 16 < camera.x || H.x > camera.x + canvas.width || H.y + 16 < camera.y || H.y - TILE > camera.y + canvas.height;
      if (off || !H.path.length || H.timer <= 0) { if (WORLD.indoors) Sound.door(); reset(); }
      return;
    }

    if (H.state === "atWork") { H.moving = false; return; }

    if (H.wonder) { updateWonder(dt); return; }
    if (Quirks.playing()) { Quirks.update(dt); return; }
    keepUp(dt);
    const walking = isMoving() && player.path.length >= 1 && player.path.length <= 3;     // (she's about to stop, nearby: she'll see him)
    if (walking && Quirks.due("whatsThat") && now() > H.nextWonder && calm() && Math.random() < dt / 1.2 && !wonder()) H.nextWonder = now() + 8;   // (nothing to see here: soon)
    else if (!H.wonder) Quirks.maybe(dt);
  }

  function keepUp(dt) {
    const herSpeed = Math.max(player.speed || 0, WALK_SPEED) * TILE;
    const g = goal();
    H.together = g.mode;
    const d = Math.hypot(g.x - H.x, g.y - H.y);
    if (d > 6 * TILE && !H.rejoin) { H.x = g.x; H.y = g.y; }          // far behind (a new place): he's just there
    if (H.rejoin && d < 20) { H.rejoin = false; if (H.rejoinHappy) H.emote = { name: "heart", age: 0 }; }
    const fast = g.mode === "stones" ? herSpeed * 1.5 : Math.max(herSpeed * 1.15, d * 6);
    const pointing = H.pose === "point" && H.timer > 0;
    if (!pointing) moveToward(g.x, g.y, dt, fast);
    if (g.mode === "stones") {
      const t = tileOf(H.x + 8, H.y + 14);
      if (onStones(t.x, t.y) && H.moving) H.lift = Math.round(Math.abs(Math.sin(((H.x + 8) / TILE) * Math.PI)) * 3);
      if (!H.moving) { H.facing = g.face; H.pose = "reach"; }
    } else if (H.pose === "reach") H.pose = null;
    if (!H.moving && g.face && g.mode === "side" && !pointing) H.facing = g.face;
    H.seated = g.mode === "bench" && Math.hypot(g.x - H.x, g.y - H.y) < 0.5 ? player.sitting : null;
    if (H.seated) { H.facing = "down"; H.moving = false; }

    if (pointing) { H.timer -= dt; if (H.timer <= 0) H.pose = null; }
  }

  function calm() {
    if (!WORLD.garden || WORLD.indoors || WORLD.small || changingPlace || Closeup.isOpen() || Sky.isOpen()) return false;
    if ((Speech && Speech.isOpen()) || (Story && Story.busy()) || player.sitting || player.hidden) return false;
    if (H.together !== "side" || H.pose || State.get().holding) return false;      // (single file, the stones; carrying something for a bird)
    return !(typeof Story !== "undefined" && Story && Story.inFavor && Story.inFavor());
  }

  function spotSomething(only = null) {
    const f = { x: H.x + 8, y: H.y + 14 };
    const onScreen = (x, y) => x > camera.x + 12 && x < camera.x + canvas.width - 12 && y > camera.y + 12 && y < camera.y + canvas.height - 12;
    const near = (x, y) => onScreen(x, y) && Math.hypot(x - f.x, y - f.y) > TILE && Math.hypot(x - f.x, y - f.y) < 7 * TILE;
    const kinds = { bird: [], butterfly: [], feather: [], flower: [] };
    for (const b of Wildlife.all()) {
      if (b.gone || b.underwater || b.flight || b.favor || b.thought || !near(b.x, b.y)) continue;
      kinds.bird.push({ name: b.name.toLowerCase().replace("japanese", "Japanese"), react: () => Wildlife.greet(b), pos: () => (b.gone || b.flight || b.underwater || !Wildlife.all().includes(b) ? null : { x: b.x, y: b.y - 8 }) });
    }
    for (const fl of typeof CRITTERS !== "undefined" && CRITTERS ? CRITTERS.flies : []) {
      if (near(fl.x, fl.y)) kinds.butterfly.push({ name: "butterfly", pos: () => (onScreen(fl.x, fl.y) ? { x: fl.x, y: fl.y - 2 } : null) });
    }
    for (const t of WORLD.things) {
      if (t.lost || t.hidden || !near(t.footX, t.footY)) continue;
      if (t.type === "feather") kinds.feather.push({ name: "feather", react: () => { t.bounce = 0.4; }, pos: () => ({ x: t.footX, y: t.footY - 4 }) });
      if (t.type === "flower") kinds.flower.push({ name: t.name, react: () => { t.bounce = 0.4; }, pos: () => ({ x: t.footX, y: t.footY - 9 }) });
    }
    const h = herFeet(), herDir = { x: h.x - f.x, y: h.y - f.y }, herD = Math.hypot(herDir.x, herDir.y);
    for (const k of Object.keys(kinds)) kinds[k] = kinds[k].filter((c) => {
      const p = c.pos();
      if (!p || herD > 2 * TILE) return !!p;
      const dx = p.x - f.x, dy = p.y - f.y;
      return (dx * herDir.x + dy * herDir.y) / (Math.hypot(dx, dy) * herD || 1) < 0.5;
    });
    const weight = { bird: 3, butterfly: 2, feather: 2, flower: 1 };
    const fresh = (list) => list.filter((c) => !H.pointed.includes(c.name));
    if (only) for (const k of Object.keys(kinds)) if (k !== only) kinds[k] = [];          // (for tests: one kind)
    let pool = Object.keys(kinds).filter((k) => fresh(kinds[k]).length);
    if (!pool.length) pool = Object.keys(kinds).filter((k) => kinds[k].length);
    if (!pool.length) return null;
    let r = Math.random() * pool.reduce((n, k) => n + weight[k], 0), kind = pool[0];
    for (const k of pool) { r -= weight[k]; if (r <= 0) { kind = k; break; } }
    const list = fresh(kinds[kind]).length ? fresh(kinds[kind]) : kinds[kind];
    return list[Math.floor(Math.random() * list.length)];
  }

  function faceToward(p) {
    const dx = p.x - (H.x + 8), dy = p.y - (H.y + 14);
    if (H.wonder && H.wonder.binoculars) { H.facing = dx < 0 ? "left" : "right"; return; }
    H.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
  }

  function wonder(o = {}) {
    if (H.state !== "together") return false;
    const sideways = (t) => { const p = t && t.pos(); if (!p) return false; const dx = p.x - (H.x + 8), dy = p.y - (H.y + 8); return Math.abs(dx) >= 1.5 * Math.abs(dy) && Math.abs(dx) >= 2 * TILE; };
    const want = o.binoculars !== undefined ? o.binoculars : Math.random() < 0.45;
    let target = spotSomething(o.kind);
    for (let i = 0; want && i < 6 && target && !sideways(target); i++) target = spotSomething(o.kind) || target;      // (binoculars want something off to the side)
    if (!target) return false;
    const binoculars = want && sideways(target);
    H.wonder = { target, found: false, timer: 0, said: now(), since: now(), farFor: 0, binoculars, firstStop: true };
    H.pointed = [target.name, ...H.pointed.filter((n) => n !== target.name)].slice(0, 4);
    H.together = "wonder";
    H.moving = false;
    H.rejoin = false;
    faceToward(target.pos() || { x: H.x + 8, y: H.y });
    H.pose = binoculars ? "binoculars" : null;
    say(pick(lines().wonder));
    return true;
  }

  function fillThing(text, name) {
    const a = (/^[aeiou]/i.test(name) ? "an " : "a ") + name;
    return text.replace(/(^|[.!?]\s+)\{a thing\}/, (m, p) => p + a[0].toUpperCase() + a.slice(1)).replace(/\{a thing\}/g, a).replace(/\{thing\}/g, name);
  }

  let sparkle = null;
  const cueSprites = {};
  const cueSprite = (n) => cueSprites[n] || (cueSprites[n] = iconFromGrid(ICONS[n], true).toCanvas());
  function found() {
    const w = H.wonder;
    const inView = (q) => q && q.x > camera.x + 8 && q.x < camera.x + canvas.width - 8 && q.y > camera.y + 8 && q.y < camera.y + canvas.height - 8;
    if (!inView(w.target.pos())) { const other = spotSomething(); if (other && inView(other.pos())) w.target = other; }
    const p = w.target.pos();
    UI.hideBubble();
    w.found = true;
    if (!inView(p)) { H.pose = "wave"; H.facing = "down"; w.timer = 2.2; say(fillThing(pick(lines().gone), w.target.name)); return; }
    if (w.target.react) w.target.react();
    H.facing = p.x < H.x + 8 ? "left" : "right";
    H.pose = p.y > H.y + 1 ? "pointLow" : "point";          // (below his shoulders: he points down at it)
    w.timer = 2.6;
    sparkle = { target: w.target, at: now() };
    Sound.tap(1150);
    say(fillThing(pick(lines().found), w.target.name), p.x < H.x + 8 ? 1 : -1, { x: p.x - 13, y: p.y - 28, w: 26, h: 30 });
  }

  function updateWonder(dt) {
    const w = H.wonder;
    H.moving = false;
    H.together = "wonder";
    if (w.found) {
      w.timer -= dt;
      if (w.timer <= 0) endWonder(true);
      return;
    }
    if ((Story && Story.busy()) || Closeup.isOpen() || Sky.isOpen() || !WORLD.garden) { endWonder(false); return; }
    const off = offScreen();
    w.offFor = off ? (w.offFor || 0) + dt : 0;
    if (w.offFor > 6) { endWonder(false); return; }
    const p = w.target.pos();
    if (p) faceToward(p);
    if (w.answer && now() - w.answer.at > 1.2 && !UI.bubbleShowing()) { thanked(); return; }
    if (!w.counted && !off && now() - w.since > 1.5) { w.counted = true; State.addWonder(); }
    const moving = isMoving();
    if (w.herMoving && !moving) {
      const h = herFeet(), near = Math.hypot(h.x - (H.x + 8), h.y - (H.y + 14)) < 1.5 * TILE;
      if (near && !w.firstStop && now() - w.said > 2) { found(); return; }
      if (!w.firstStop || now() - w.said > 2) w.askAt = now() + 0.3;
      w.firstStop = false;
    }
    w.herMoving = moving;
    if (w.askAt && now() >= w.askAt && !UI.bubbleShowing() && !(Speech && Speech.isOpen()) && !w.answer) {
      w.askAt = null;
      if (!off && (w.asked || 0) < 3) { w.asked = (w.asked || 0) + 1; w.said = now(); say(pick(lines().wonder)); }
    }
  }

  function reached(thing) {
    const w = H.wonder;
    if (!w || w.found || w.answer || !thing) return;
    const p = w.target.pos();
    const same = (thing.name || "").toLowerCase() === w.target.name.toLowerCase() || (p && thing.footX !== undefined && Math.hypot(thing.footX - p.x, thing.footY - 9 - p.y) < TILE);
    if (same) w.answer = { at: now(), thing };
  }
  function thanked() {
    const w = H.wonder, h = herFeet();
    w.found = true;
    w.timer = 2.4;
    H.pose = null;
    H.facing = Math.abs(h.x - (H.x + 8)) * 2 >= Math.abs(h.y - (H.y + 14)) ? (h.x < H.x + 8 ? "left" : "right") : h.y > H.y + 14 ? "down" : "up";
    H.emote = { name: "heart", age: 0 };
    sparkle = { target: w.target, at: now() };
    Sound.hearts();
    const p = w.target.pos();
    say(fillThing(pick(lines().thanks), w.target.name), 0, p ? { x: p.x - 13, y: p.y - 28, w: 26, h: 30 } : null);
  }
  const offScreen = () => H.x + 16 < camera.x || H.x > camera.x + canvas.width || H.y + 16 < camera.y || H.y - TILE > camera.y + canvas.height;

  function endWonder(happy) {
    if (bubbleAt && bubbleAt.husband) UI.hideBubble();          // (his question doesn't linger)
    H.wonder = null;
    H.pose = null;
    H.rejoin = true;
    H.rejoinHappy = happy;
    H.nextWonder = 0;
    Quirks.happened("whatsThat");                             // (the next moment, of any kind, not for a few minutes)
  }

  let heart = null;                    // a heart between the two of them (a kiss): { x, y, age }
  function endRoutineBits() { H.hidden = false; H.holdHands = false; H.sortY = null; H.goal = null; }

  function routineAt(x, y, facing = "down", pose = null) {
    const was = H.goal;
    H.state = "routine"; H.x = x; H.y = y; H.facing = facing; H.pose = pose; H.path = []; H.trail = [];
    H.wonder = null; H.rejoin = false; H.moving = false; endRoutineBits();
    if (was && was.resolve) was.resolve();
  }
  function routineHere() { routineAt(H.x, H.y, H.facing, null); }
  function routinePose(pose, facing = null) { H.pose = pose; if (facing) H.facing = facing; H.moving = false; }
  function routineHide(hidden) { H.hidden = !!hidden; }
  function routineSit(x, y, sortY) { routineAt(x, y, "down", "sit"); H.sortY = sortY; H.holdHands = true; }

  function routineWalk(x, y, path = null, speed = 4.6) {
    if (H.goal && H.goal.resolve) H.goal.resolve();
    return new Promise((resolve) => {
      H.pose = null;
      H.path = path ? path.slice() : [];
      H.goal = { x, y, speed, resolve };
    });
  }
  function updateRoutine(dt) {
    const g = H.goal;
    if (!g) { H.moving = false; return; }
    const t = H.path[0];
    if (t) {
      moveToward(t.x * TILE, t.y * TILE, dt, g.speed * TILE);
      if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      if (g.near && g.near()) { H.path = []; g.x = H.x; g.y = H.y; }
      return;
    }
    moveToward(g.x, g.y, dt, g.speed * TILE);
    if (Math.hypot(H.x - g.x, H.y - g.y) < 0.5) {
      H.x = g.x; H.y = g.y; H.moving = false; H.goal = null;
      g.resolve();
    }
  }

  function comeHome() {
    const h = herFeet();
    let start, path;
    if (WORLD.indoors) {
      const door = WORLD.door;
      start = { x: door.x, y: door.y };
      path = findPath(start, { x: player.nx, y: player.ny }, MAP_W, MAP_H, isWalkable, stepCost) || [];
      Sound.door();
    } else {
      const way = towardWork();
      if (way) { start = way.start; path = way.path; } else { start = { x: player.nx + 1, y: player.ny }; path = []; }
    }
    routineAt(start.x * TILE, start.y * TILE, "down");
    const way = path.slice(0, -1), end = way[way.length - 1] || start;
    const p = routineWalk(end.x * TILE, end.y * TILE, way, 5.2);
    H.goal.near = () => Math.hypot(H.x + 8 - h.x, H.y + 14 - h.y) < TILE * 1.6;
    return p.then(() => { H.moving = false; });
  }

  function routineLeave() {
    const from = tileOf(H.x + 8, H.y + 14);
    let path = [];
    if (WORLD.indoors) path = findPath(from, WORLD.door, MAP_W, MAP_H, isWalkable, stepCost) || [];
    else { const way = towardWork(); if (way) path = findPath(from, way.start, MAP_W, MAP_H, isWalkable, stepCost) || []; }
    const end = path[path.length - 1] || from;
    return routineWalk(end.x * TILE, end.y * TILE, path, 4.6).then(() => {
      if (WORLD.indoors) Sound.door();
      reset();
    });
  }

  function heartBetween(x, y) { heart = { x, y, age: 0 }; Sound.hearts(); }

  function sprite() {
    const s = S(), t = now();
    const moment = Quirks.hisSprite();                    // (in one of their little moments: js/quirks.js)
    if (moment) return moment;
    if (H.state === "routine" && H.pose) {
      if (H.pose === "kiss" && s.kiss[H.facing]) return s.kiss[H.facing];
      if (H.pose === "sit") {
        if (t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
        return t < H.blinkUntil ? s.blink.sit : s.sit;
      }
      if (H.pose === "wave") return (H.waveSide === "right" ? s.waveRight : s.wave)[Math.floor(t * 4) % 2];
    }
    if (H.seated) {
      if (t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
      return t < H.blinkUntil ? s.blink.sit : s.sit;
    }
    if (H.pose === "binoculars" && s.binoculars[H.facing]) return s.binoculars[H.facing];
    if (H.pose === "wave" && (H.state === "leaving" || H.wonder)) return (H.waveSide === "right" ? s.waveRight : s.wave)[Math.floor(t * 4) % 2];
    if ((H.pose === "point" || H.pose === "pointLow") && (H.facing === "left" || H.facing === "right")) return s[H.pose][H.facing];
    if (H.pose === "reach" && (H.facing === "left" || H.facing === "right")) return s.reach[H.facing];
    const step = H.moving ? 1 + (Math.floor(H.walked / 8) % 2) : 0;
    const holdSide = H.state === "together" && H.together === "side" && (H.facing === "left" || H.facing === "right") && !Quirks.playing();
    if (holdSide) return s.hold[H.facing][step];
    if (!H.moving && t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
    if (!H.moving && t < H.blinkUntil && s.blink[H.facing]) return s.blink[H.facing];
    return s[H.facing][step];
  }

  function items() {
    if (!present() || H.state === "fetching") return [];
    const out = [];
    const fx = H.x + 8, fy = H.y + 14;
    const top = Math.round(H.y) - TILE - H.lift, x = Math.round(H.x);
    const bob = H.moving && Math.floor(H.walked / 8) % 2 ? 1 : 0;
    const doll = data().doll && data().doll.id;
    const peek = H.x < playerPixelPos().x ? "left" : "right";
    const seated = H.state === "routine" && H.pose === "sit";
    const lying = Quirks.hisDraw();                       // (lying on the bench, his head on her lap: js/quirks.js draws him)
    if (lying) out.push(lying);
    else out.push({ bottom: H.state === "routine" && H.sortY != null ? H.sortY : Quirks.inFront() ? playerPixelPos().y + TILE + 0.1 : H.seated ? H.seated.footY + 0.4 : fy - 0.2, draw: () => {
      if (!seated && !H.seated) drawShadow(fx + 1, fy + 2, 7, 2);
      if (doll) Dolls.drawOnBack(ctx, doll, x, top, H.facing, true, bob, peek);
      const spr = sprite();
      ctx.drawImage(spr, x - (spr.ox || 0), top);
      if (doll) Dolls.drawOnBack(ctx, doll, x, top, H.facing, false, bob, peek);
    } });
    if (seated && H.holdHands && player.sitting && !player.hidden) {
      const p = playerPixelPos(), herTop = Math.round(p.y) - TILE;
      const hx = Math.round(((H.x + 3) + (p.x + 12)) / 2) + 1, hy = Math.round((top + herTop) / 2) + 22;
      out.push({ bottom: Math.max(H.sortY || fy, player.sitting.footY + 0.5) + 0.3, draw: () => ctx.drawImage(handsSprite(), hx - 2, hy - 2) });
    }
    out.push(...Quirks.items());
    const onBench = H.seated && player.sitting === H.seated;
    if (H.state === "together" && ((H.together === "side" && !player.sitting) || onBench) && !player.hidden && !player.act && !Quirks.playing()) {        // (in an action she lets go: he watches)
      const p = playerPixelPos(), herTop = Math.round(p.y) - TILE;
      let hx, hy;
      if (H.facing === "down" || H.facing === "up") {
        const hisHand = H.x + 8 < p.x + 8 ? x + 12 : x + 3;
        const herHand = H.x + 8 < p.x + 8 ? Math.round(p.x) + 3 : Math.round(p.x) + 12;
        hx = Math.round((hisHand + herHand) / 2); hy = Math.round((top + herTop) / 2) + 22;
      } else {
        hx = Math.round(p.x) + (H.facing === "right" ? 13 : 2); hy = herTop + 22;
      }
      out.push({ bottom: onBench ? H.seated.footY + 0.8 : Math.max(fy, p.y + 14) + 0.3, draw: () => ctx.drawImage(handsSprite(), hx - 2, hy - 2) });
    }
    return out;
  }
  let hands = null;
  function handsSprite() {
    if (hands) return hands;
    const b = new PixelBuffer(4, 3);
    b.ellipse(2, 1.5, 2, 1.5, "skin", { flat: true });
    return (hands = outline(b).toCanvas());
  }

  function drawOverlay(ctx2) {
    if (heart) {
      const icon = emoteSprite("heart"), t = heart.age;
      if (!(t > 1.65 && Math.floor(t * 20) % 2)) {
        const lift = t < 0.15 ? 7 * (1 - t / 0.15) : -Math.min(4, (t - 0.15) * 3);
        ctx2.drawImage(icon, Math.round(heart.x - icon.width / 2), Math.round(heart.y - icon.height + lift));
      }
    }
    Quirks.drawOverlay(ctx2);                             // (their little moments' hearts, sparkles and Zzz)
    if (!present()) return;
    if (H.wonder && !H.wonder.found) {
      const q = emoteSprite("question"), bob = Math.round(Math.sin(now() * 3.5));
      ctx2.drawImage(q, Math.round(H.x + 8 - q.width / 2), Math.round(H.y - TILE - q.height - 1 + bob - H.lift));
      if (typeof Story !== "undefined" && Story.edgeCue) Story.edgeCue(ctx2, { x: H.x + 8, y: H.y - 8 }, "question", now());
    }
    if (sparkle) {
      const t = now() - sparkle.at, p = sparkle.target.pos();
      if (!H.wonder || !H.wonder.found || !p) sparkle = null;
      else if (!(H.wonder.timer < 0.25 && Math.floor(t * 20) % 2)) {
        const big = Math.floor(t * 4) % 2 === 0, icon = cueSprite(big ? "sparkles" : "sparkle"), lift = t < 0.12 ? 6 * (1 - t / 0.12) : 0;
        ctx2.drawImage(icon, Math.round(p.x - icon.width / 2 - (big ? 2 : 0)), Math.round(p.y - icon.height - 2 + lift));
      }
    }
    if (!H.emote) return;
    const icon = emoteSprite(H.emote.name), t = H.emote.age;
    if (t > 1.65 && Math.floor(t * 20) % 2) return;
    const lift = t < 0.12 ? 6 * (1 - t / 0.12) : 0;
    ctx2.drawImage(icon, Math.round(H.x + 8 - icon.width / 2), Math.round(H.y - TILE - icon.height - 1 + lift - H.lift));
  }

  function at(gx, gy, minTapPx) {
    if (!present()) return false;
    const cx = H.x + 8, cy = H.y - TILE + 16;
    const w = Math.max(16, minTapPx), h = Math.max(32, minTapPx);
    if (H.wonder && !H.wonder.found) {                               // (the "?" over his head counts as him)
      const q = emoteSprite("question").height + 4;
      return Math.abs(gx - cx) <= w / 2 && gy >= cy - h / 2 - q && gy <= cy + h / 2;
    }
    return Math.abs(gx - cx) <= w / 2 && Math.abs(gy - cy) <= h / 2;
  }

  function occupies(tx, ty) {
    if (!present()) return false;
    const t = tileOf(H.x + 8, H.y + 14);
    return t.x === tx && t.y === ty;
  }

  function button() {
    if (!started || changingPlace || Closeup.isOpen() || Sky.isOpen() || (Speech && Speech.isOpen()) || (Story && Story.busy())) return null;
    if (H.state === "routine" || (typeof Story !== "undefined" && Story.inRoutine && Story.inRoutine())) return null;     // (our morning, our evening)
    if (WORLD.small || H.state === "atWork") return null;
    if (H.state === "together" || H.state === "coming") return "bye";
    if (H.state === "fetching" || H.state === "leaving") return "wait";
    if (H.state !== "away" || player.hidden) return null;
    return "call";
  }

  return { call, bye, goodnight, reset, changedPlace, update, items, drawOverlay, at, occupies, button, tap, reached, says: say, state: () => H.state, pos: () => ({ x: H.x, y: H.y }),
    routine: { at: routineAt, here: routineHere, pose: routinePose, hide: routineHide, sit: routineSit, walk: routineWalk, comeHome, leave: routineLeave, heart: heartBetween,
      facing: (f) => { H.facing = f; }, moving: () => H.moving, lines: () => lines() },
    wonder: (o) => wonder(o), wonderSoon: () => { H.nextWonder = 0; Quirks.soon(); }, debugWonder: () => ({ wait: Math.round(Quirks.wait()), together: H.together, calm: calm(), moving: isMoving(), path: player.path.length, pose: H.pose, state: H.state }), wondering: () => (H.wonder ? { name: H.wonder.target.name, found: H.wonder.found, binoculars: H.wonder.binoculars } : null),
    shareBench, seated: () => H.seated, quirk: (name, o) => Quirks.start(name, o),
    body: () => ({ H, S, say, moveToward, keepUp, herFeet, open, handsSprite, pick, lines }) };
})();
