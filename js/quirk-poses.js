
const QUIRK_FIT = {
  seat: 7,                      // on a bench together: each sits this far from its middle
  lap: { x: 0, y: 17 },         // his head on her lap: the lying sprite (head to the left) from her sprite's top left
  lift: 18,                     // how high he lifts her (her shoes above his glasses)
  liftGap: 13,                  // how far apart they stand for the lift (her middle to his)
  near: 13,                     // for a pat, a flower to her ear, a leaf out of her hair (side by side, as they walk)
};

function withLight(light, draw) {
  const was = SHADE_LIGHT;
  SHADE_LIGHT = light;
  try { return draw(); } finally { SHADE_LIGHT = was; }
}

function shearCanvas(src, shiftOf) {
  let lo = 0, hi = 0;
  for (let y = 0; y < src.height; y++) { const s = shiftOf(y); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  const c = document.createElement("canvas");
  c.width = src.width + hi - lo; c.height = src.height;
  const g = c.getContext("2d");
  for (let y = 0; y < src.height; y++) g.drawImage(src, 0, y, src.width, 1, shiftOf(y) - lo, y, src.width, 1);
  c.ox = (src.ox || 0) - lo;
  return c;
}

function paintPixels(canvas, pixels) {
  const g = canvas.getContext("2d");
  for (const [x, y, color] of pixels) { g.fillStyle = paletteColor(color); g.fillRect(x, y, 1, 1); }
  return canvas;
}

function turnQuarter(src, clockwise) {
  const out = new PixelBuffer(src.h, src.w);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.get(x, y);
    if (!c) continue;
    if (clockwise) out.set(src.h - 1 - y, x, c);
    else out.set(y, src.w - 1 - x, c);
  }
  return out;
}

function renderQuirkHer(look = window.PLAYER_LOOK) {
  const view = (v, step, sitting, blink, extra) => renderPlayerView(look, v, step, sitting, blink, extra);
  const sitHappy = view("down", 0, true, false, { eyes: "happy" });
  const lean = (side) => shearCanvas(sitHappy, (y) => side * (y <= 4 ? 3 : y <= 9 ? 2 : y <= 13 ? 1 : 0));
  const happyLeft = view("left", 0, false, false, { eyes: "happy" });
  const swing = {};
  for (const v of ["down", "up"]) {
    swing[v] = {};
    for (const side of [-1, 1]) {
      swing[v][side] = {};
      for (const level of [1, 2]) swing[v][side][level] = [0, 1, 2].map((step) => view(v, step, false, false, { arms: { raise: side, level } }));
    }
  }
  return {
    sitHappy,
    lean: { left: lean(-1), right: lean(1) },
    happy: { down: view("down", 0, false, false, { eyes: "happy" }), left: happyLeft, right: flipCanvas(happyLeft) },
    lifted: [1, 2].map((step) => view("down", step, false, false, { arms: "up", eyes: "happy" })),
    wish: view("down", 0, false, true, { arms: "clasp" }),
    swing,
  };
}

function renderHairFlower(color = "petalPink", center = "beeYellow") {
  const b = new PixelBuffer(5, 5);
  b.circle(2.5, 2.5, 2.4, color);
  b.set(2, 2, center);
  b.set(0, 0, null); b.set(4, 0, null); b.set(0, 4, null); b.set(4, 4, null);
  return outline(b).toCanvas();
}

const HAIR_FLOWER_AT = {
  right: { down: [1.5, 11, false], up: [14.5, 11, false], left: [15.5, 9.5, true], right: [5.5, 11.5, false] },
  left: { down: [14.5, 11, false], up: [1.5, 11, false], left: [10.5, 11.5, false], right: [0.5, 9.5, true] },
};

function hisQuirkFrame(look, view, step, { base = null, arm = null, ox = 0, wr = 0, blink = false } = {}) {
  const b = new PixelBuffer(14, 30);
  drawHisBody(b, look, view, step, base);
  if (base === "bare") {
    const body = [7, 20.2, 3.8, 4.6];
    b.ellipse(...body, look.shirt, { clip: (x, y) => y < 24 });
    b.ellipse(...body, look.pants, { onlyFilled: true, clip: (x, y) => y >= 22 && y < 24, shadeAs: body });
  }
  drawHisHead(b, look, view);
  hisHairShine(b, look, view);
  const wide = new PixelBuffer(14 + ox + wr, 30);          // (wr: room on the right, for an arm)
  wide.stamp(b, ox, 0);
  if (arm) arm(wide, ox);
  const out = outline(wide);
  const shifted = { set: (x, y, c) => out.set(x + ox, y, c) };
  drawShirtDetails(shifted, look, view, base === "bare" ? null : base);
  if (view === "down") drawHisFrontFace(shifted, look, blink);
  if (view === "left") drawHisSideFace(shifted, look, blink);
  const canvas = out.toCanvas();
  canvas.ox = ox;
  return canvas;
}

function hisHairShine(b, look, view) {
  const H = rampFor(look.hairColor);
  for (let y = 1; y < 8; y++) for (let x = 0; x < 14; x++) {
    const d = ((x + 0.5 - 7) / 5.6) ** 2 + ((y + 0.5 - 8.4) / 6.2) ** 2;
    const c = b.get(x, y);
    if (!c || d < 0.62 || d > 0.8 || x > (view === "up" ? 11 : 9)) continue;
    if (H.includes(c)) b.set(x, y, H[0]);
  }
}

const LYING_BODY_AT = [-4, 6];      // where the turned body goes (its collar under his head's lower right)
function hisLying(look) {
  const up = withLight([0.85, -0.5], () => {
    const b = new PixelBuffer(14, 30);
    drawHisBody(b, look, "down", 0, null);
    return b;
  });
  const body = turnQuarter(up, false);                      // (30x14: his collar on the left, his shoes on the right)
  const head = new PixelBuffer(14, 17);
  drawHisHead(head, look, "down");
  hisHairShine(head, look, "down");
  const [bx, by] = LYING_BODY_AT;
  const b = new PixelBuffer(26, 20);
  b.stamp(body, bx, by);
  b.stamp(head, 0, 0);
  const out = outline(b);
  const shirt = rampFor(look.shirt);
  for (let y = 18; y <= 23; y++) if (shirt.includes(out.get(y + bx, 7 + by))) out.set(y + bx, 7 + by, shirt[0]);
  out.set(21 + bx, 7 + by, RAMPS.snow[1]);
  drawHisFrontFace(out, look, true);
  return out.toCanvas();
}

function renderQuirkHim(look = husbandLook()) {
  const skin = look.skin, shirt = look.shirt;
  const side = (arm, ox = 0, blink = false) => hisQuirkFrame(look, "left", 0, { base: "bare", arm, ox, blink });
  const lift = side((b, ox) => {
    b.line(ox + 6, 17.8, ox + 1.4, 12.4, 2.3, shirt, { flat: false });
    b.line(ox + 1.4, 12.4, ox - 0.6, 7.2, 2.2, shirt, { flat: false });
    b.circle(ox - 0.8, 6.2, 1.15, skin, { flat: true });
  }, 3);
  const reachUp = (hy) => hisQuirkFrame(look, "down", 0, { base: "wave0", wr: 3, arm: (b) => {
    b.line(11.2, 18.2, 13.9, hy + 2, 2.2, shirt, { flat: false });
    b.circle(14.5, hy, 1.15, skin, { flat: true });
  } });
  const pat = [9.6, 10.6].map(reachUp), ear = reachUp(12.4);
  const throwBack = side((b, ox) => {
    b.rotEllipse(ox + 9.8, 18.6, 3, 1.3, -0.35, shirt);
    b.circle(ox + 12.6, 17.6, 1.15, skin, { flat: true });
  });
  const swing = {};
  for (const v of ["down", "up"]) {
    swing[v] = { 1: {}, "-1": {} };
    for (const level of [1, 2]) {
      const frames = [0, 1, 2].map((step) => hisQuirkFrame(look, v, step, { base: "wave0", arm: (b) => {
        const [hx, hy] = level === 2 ? [13.2, 18.4] : [12.8, 20.4];
        b.line(11.3, 18.4, hx, hy, 2.2, shirt, { flat: false });
        b.circle(hx, hy, 1.1, skin, { flat: true });
      } }));
      swing[v][1][level] = frames;
      swing[v][-1][level] = frames.map(flipCanvas);
    }
  }
  const sleepy = paintPixels(renderHusbandView(look, "down", 0, "sit", true), [[7, 16, RAMPS.blush[3]], [8, 16, RAMPS.blush[3]]]);
  const doze = [1, 2].map((k) => shearCanvas(sleepy, (y) => (y <= 6 ? k : y <= 13 && k > 1 ? 1 : 0)));
  const lying = hisLying(look);
  const content = renderHusbandView(look, "down", 0, "sit", true);
  const lean = (side) => shearCanvas(content, (y) => (y <= 7 ? side : 0));
  return {
    lean: { left: lean(-1), right: lean(1) },
    lift: { left: lift, right: flipWide(lift) },
    pat: { 1: pat, "-1": pat.map(flipWide) },
    ear: { 1: ear, "-1": flipWide(ear) },
    throwBack: { left: throwBack, right: flipWide(throwBack) },
    swing,
    doze,
    dozeOther: doze.map(flipWide),
    lap: { left: lying, right: flipCanvas(lying) },
  };
}
