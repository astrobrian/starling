
const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
let touchY = null;
document.addEventListener("touchstart", (e) => { touchY = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
document.addEventListener("touchmove", (e) => {
  const y = e.touches && e.touches[0] ? e.touches[0].clientY : touchY, dy = y !== null && touchY !== null ? y - touchY : 0;
  touchY = y;
  const box = (!e.touches || e.touches.length < 2) && scrollerAt(e.target);
  if (box && (dy < 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : dy > 0 ? box.scrollTop > 0 : true)) return;
  e.preventDefault();
}, { passive: false });
function scrollerAt(el) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}

const ZOOM_TILES = { close: 9, normal: 12, far: 18, wide: 24 };
let zoom = saved.get("zoom") || (window.GAME_SETTINGS && GAME_SETTINGS.zoom) || "normal";
if (PARAMS.get("zoom") in ZOOM_TILES) zoom = PARAMS.get("zoom");
if (!(zoom in ZOOM_TILES)) zoom = "normal";
let scale = 1;               // device pixels per game pixel
let skyShown = false;        // the word sky is open (the game is at normal zoom for it)
let closeupShown = false;    // the flower close-up is open (or opening)
let upCloseShown = false;    // a tender moment plays up close (see upClose)

function scaleFor(tiles) {
  const vh = window.innerHeight * (window.devicePixelRatio || 1);
  const ideal = vh / (tiles * TILE);
  const lo = Math.max(1, Math.floor(ideal)), hi = Math.max(1, Math.ceil(ideal));
  const tilesAt = (s) => vh / (s * TILE);
  return Math.abs(tilesAt(lo) - tiles) <= Math.abs(tilesAt(hi) - tiles) ? lo : hi;
}

function zoomCounts() {
  return !WORLD.indoors && !WORLD.small && !closeupShown && !skyShown;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
  const normal = scaleFor(ZOOM_TILES.normal);
  scale = scaleFor(ZOOM_TILES[zoom] || ZOOM_TILES.normal);
  if (!zoomCounts() || upCloseShown) scale = Math.max(scale, normal);
  if (skyShown) scale = normal;                                   // (the night sky is always seen at normal zoom)
  CUE = scale < normal ? 2 : 1;
  canvas.width = Math.ceil(vw / scale);
  canvas.height = Math.ceil(vh / scale);
  canvas.style.width = (canvas.width * scale) / dpr + "px";
  canvas.style.height = (canvas.height * scale) / dpr + "px";
  ctx.imageSmoothingEnabled = false;
  Closeup.resize(canvas.width, canvas.height);
}
window.addEventListener("resize", () => { resize(); cameraGoal.x = null; });
window.addEventListener("orientationchange", () => setTimeout(() => { resize(); cameraGoal.x = null; }, 200));
resize();

function setZoom(z) {
  zoom = z;
  saved.set("zoom", z);
  resize();
  cameraGoal.x = null;
}

let insetProbe = null, safeCache = null, safeAt = 0;
function safeEdges() {
  const now = performance.now();
  if (safeCache && now - safeAt < 1000) return safeCache;    // measured once a second at most
  safeAt = now;
  if (!insetProbe) {
    insetProbe = document.createElement("div");
    insetProbe.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(insetProbe);
  }
  const s = getComputedStyle(insetProbe), r = canvas.getBoundingClientRect();
  const px = (v) => parseFloat(v) || 0;
  return (safeCache = {
    top: Math.max(0, px(s.paddingTop) - r.top), bottom: Math.max(0, px(s.paddingBottom) - (window.innerHeight - r.bottom)),
    left: Math.max(0, px(s.paddingLeft) - r.left), right: Math.max(0, px(s.paddingRight) - (window.innerWidth - r.right)),
  });
}

function gameToScreen(x, y, inWorld = true) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  const ox = inWorld ? camera.x : 0, oy = inWorld ? camera.y : 0;
  return { x: r.left + (x - ox) * scale / dpr, y: r.top + (y - oy) * scale / dpr };
}

function herScreenBox() {
  const p = playerPixelPos();
  const a = gameToScreen(p.x, p.y - TILE), b = gameToScreen(p.x + TILE, p.y + TILE);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

const camera = { x: 0, y: 0 };

const cameraGoal = { x: null, y: null, lift: 0, past: 0 };
function updateCamera(dt = 1) {
  const p = playerPixelPos();
  const mapPxW = MAP_W * TILE, mapPxH = MAP_H * TILE;
  const follow = (center, view, world, past = 0) =>
    world <= view ? (world - view) / 2 : Math.max(0, Math.min(world - view + past, center - view / 2));
  const box = document.getElementById("speech");
  const talk = box && !box.classList.contains("hidden") ? (box.offsetHeight * (window.devicePixelRatio || 1)) / scale / 2 : 0;
  const past = mapPxW > canvas.width ? pastRightEdge(p) : 0;
  cameraGoal.past = cameraGoal.x === null ? past : cameraGoal.past + (past - cameraGoal.past) * Math.min(1, dt * 6);
  const gx = follow(p.x + TILE / 2, canvas.width, mapPxW, cameraGoal.past);
  let gy = follow(p.y + TILE / 2, canvas.height, mapPxH);
  if (WORLD.small && !talk && mapPxH > canvas.height && mapPxH - canvas.height < TILE) gy = Math.max(0, Math.min(mapPxH - canvas.height, p.y + TILE + 6 - canvas.height));
  const house = WORLD.things.find((t) => t.type === "house");
  if (house) {
    const k01 = (v) => Math.max(0, Math.min(1, v));
    const rows = (p.y - house.footY) / TILE, side = Math.abs(p.x + 8 - house.footX) / TILE;
    const w = k01((4 - rows) / 2) * k01((5 - side) / 2);       // full within 2 rows of her door, gone by 4
    const want = Math.max(0, house.footY - 104, p.y + TILE - 0.8 * canvas.height);      // (room above the chimney for its smoke)
    gy += (Math.min(gy, want) - gy) * w;
  }
  const lift = talk ? keepAboveBox(gy) - gy : 0;
  if (cameraGoal.x === null || Math.hypot(gx - cameraGoal.x, gy - cameraGoal.y) > 80) { cameraGoal.x = gx; cameraGoal.y = gy; cameraGoal.lift = lift; }
  const k = Math.min(1, dt * 12);
  cameraGoal.x += (gx - cameraGoal.x) * k;
  cameraGoal.y += (gy - cameraGoal.y) * k;
  cameraGoal.lift += (lift - cameraGoal.lift) * Math.min(1, dt * 8);
  const clampTo = (v, view, world, past = 0) => (world <= view ? (world - view) / 2 : Math.max(0, Math.min(world - view + past, v)));
  camera.x = Math.round(clampTo(Math.round(p.x) - Math.round(p.x - cameraGoal.x), canvas.width, mapPxW, cameraGoal.past));
  camera.y = Math.round(clampTo(Math.round(p.y) - Math.round(p.y - cameraGoal.y - cameraGoal.lift), canvas.height, mapPxH + Math.max(2 * talk, cameraGoal.lift)));
}

function pastRightEdge(p) {
  if (!sideColumn || !WORLD.garden) return 0;
  const k = (window.devicePixelRatio || 1) / scale, r = canvas.getBoundingClientRect();      // k: game pixels per point
  const left = (window.innerWidth - sideColumn.fromRight - r.left) * k;
  const top = (sideColumn.top - r.top) * k, bottom = (sideColumn.bottom - r.top) * k;
  const herTop = p.y - TILE - 50 * k - camera.y, herBottom = p.y + TILE - camera.y;           // (from the glass over her head to her feet, on the screen)
  if (herBottom < top || herTop > bottom) return 0;
  let right = p.x + TILE;
  const him = Husband.state() === "together" && Husband.pos();
  if (him && Math.abs(him.x - p.x) < 3 * TILE && Math.abs(him.y - p.y) < 2 * TILE) right = Math.max(right, him.x + TILE);
  const onScreen = right + 4 - (MAP_W * TILE - canvas.width);                                 // (with the camera at the map's edge)
  return Math.max(0, Math.min(sideColumn.fromRight * k, onScreen - left));
}

function keepAboveBox(y) {
  const room = speechBoxTop() - 4 * CUE, spans = inViewWhileTalking(), buttons = buttonBoxes();
  const topFor = ([, , x0, x1]) => Math.max(2, ...buttons.filter((b) => x0 !== undefined && x1 > b.x && x0 < b.x + b.w).map((b) => b.y + b.h - camera.y + 2));
  const fit = (tops) => {
    let lo = -Infinity, hi = Infinity, n = 0;
    for (const s of spans) {
      for (const top of tops(s)) {
        const l = Math.max(lo, s[1] - room), h = Math.min(hi, s[0] - top);
        if (l <= h) { lo = l; hi = h; n++; break; }
      }
    }
    return { lo, hi, n };
  };
  const plain = fit(() => [2]), clear = fit((s) => [topFor(s), 2]);
  const f = clear.n >= plain.n ? clear : plain;
  return Math.max(f.lo, Math.min(f.hi, y));
}

function speechBoxTop() {
  const box = document.getElementById("speech");
  if (!box || box.classList.contains("hidden")) return null;
  const r = canvas.getBoundingClientRect();
  return ((box.offsetTop - r.top) * canvas.height) / r.height;
}

function inViewWhileTalking() {
  const p = playerPixelPos(), spans = [[p.y - TILE - (playerPose().lift || 0) - 2, p.y + TILE, p.x, p.x + TILE]];
  const bubble = 17 * CUE + 4, wide = 20 * CUE + 2;                   // (a thought bubble over a head, up and to one side)
  const near = (x, y) => Math.abs(x - (p.x + 8)) < canvas.width / 2 && Math.abs(y - (p.y + 8)) < canvas.height;
  const bubbles = WORLD.garden && Wildlife.thoughtBubbles ? Wildlife.thoughtBubbles() : [];
  const birdSpan = (b) => {
    const h = Wildlife.headTop(b), g = b.thought && bubbles.find((q) => q.birds.includes(b));
    if (g) return [Math.min(g.box.y, h.y - 3), b.y + 1, Math.min(g.box.x, b.x - 8), Math.max(g.box.x + g.box.w, b.x + 8)];
    return [h.y - (b.thought ? bubble : 3), b.y + 1, b.x - (b.thought ? wide : 8), b.x + (b.thought ? wide : 8)];
  };
  const look = Story && Story.inView ? Story.inView() : { guides: [], birds: [], thought: false };
  const who = Speech.speaker();
  const birds = WORLD.garden ? Wildlife.all().filter((b) => !b.gone && !b.underwater && !b.flight && near(b.x, b.y)) : [];
  if (who === "magpie" && (companion.mode !== "away" || companion.flight)) {
    const b = companionBox(), t = look.thought && Cues.thoughtBox();
    spans.push([(look.thought ? Math.min(b.y, companionHeadTop().y - bubble) : b.y) - 2, b.y + b.h,
      t ? Math.min(b.x, t.x) : b.x - (look.thought ? wide : 0), t ? Math.max(b.x + b.w, t.x + t.w) : b.x + b.w + (look.thought ? wide : 0)]);
  } else if (who === "husband" && !["away", "atWork"].includes(Husband.state())) {
    const h = Husband.pos();
    spans.push([h.y - TILE - 2, h.y + TILE, h.x, h.x + TILE]);
  } else if (who && BIRDS[who]) {
    const kind = birds.filter((b) => b.species === who).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const story = kind.filter((b) => b.story);
    for (const b of story.length ? story : kind.slice(0, 1)) spans.push(birdSpan(b));
  }
  for (const g of look.guides) if (!!g.room === (scene.name === "room") && near(g.x, g.y)) spans.push([g.y - 14 * CUE, g.y, g.x - 8 * CUE, g.x + 8 * CUE]);   // (its sparkle, over it)
  const wanted = (b) => b.story && (b.thought || b.onTap || b.onReach || look.birds.includes(b.id));
  for (const b of birds) if (wanted(b)) spans.push(birdSpan(b));
  for (const b of birds) if (b.story && !wanted(b) && Math.hypot(b.x - (p.x + 8), b.y - (p.y + TILE)) < 6 * TILE) spans.push(birdSpan(b));
  return spans;
}

let upCloseWanted = false;
function upClose(on, fade = true) {
  upCloseWanted = !!on;
  if (upCloseWanted === upCloseShown) return;
  const change = () => {
    if (upCloseWanted === upCloseShown) return;
    upCloseShown = upCloseWanted;
    resize();
    cameraGoal.x = null;
  };
  const zoomedOut = zoomCounts() && scaleFor(ZOOM_TILES[zoom] || ZOOM_TILES.normal) < scaleFor(ZOOM_TILES.normal);
  if (!fade || !zoomedOut || quickFading) change();
  else if (Daylight.nightAmount() < 0.5) crossDissolve(change);
  else quickFade(change);
}

function crossDissolve(change) {
  const shot = document.createElement("canvas");
  shot.width = canvas.width;
  shot.height = canvas.height;
  shot.getContext("2d").drawImage(canvas, 0, 0);
  shot.className = "dissolve";
  shot.style.cssText = `position:absolute;left:0;top:0;width:${canvas.style.width};height:${canvas.style.height};` +
    "image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none;transition:opacity 0.3s ease";
  canvas.after(shot);
  change();
  requestAnimationFrame(() => requestAnimationFrame(() => { shot.style.opacity = "0"; }));     // (once the new view is drawn under it)
  setTimeout(() => shot.remove(), 450);
}
