

const keysDown = new Set();
const KEY_DIRS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};
let lastKey = null;
let queuedKey = null;        // so a quick key tap still moves one tile

window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (Sky.isOpen() && KEY_DIRS[k]) { e.preventDefault(); Sky.nudge(KEY_DIRS[k][0]); return; }     // looking around the sky
  if (!KEY_DIRS[k] || !started || Closeup.isOpen()) return;
  e.preventDefault();
  keysDown.add(k);
  lastKey = k;
  queuedKey = k;
  player.path = [];          // keyboard takes over from tap-walking
  player.interact = null;
  tapMarker = null;
});

window.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keysDown.delete(k);
  if (lastKey === k) lastKey = [...keysDown].pop() || null;
});

window.addEventListener("blur", () => { keysDown.clear(); lastKey = null; });

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (!started || changingPlace || player.hidden) return;
  if (Speech && Speech.isOpen()) { Speech.tap(); return; }
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) / rect.width * canvas.width;
  const sy = (e.clientY - rect.top) / rect.height * canvas.height;
  if (Sky.isOpen()) { Sky.press(sx, sy, e.pointerId); return; }
  if (Story && Story.busy()) {
    if (!Closeup.isOpen()) popTap(sx + camera.x, sy + camera.y);
    busyTap = { sx, sy, id: e.pointerId, at: performance.now() };
    return;
  }
  handleTap(sx, sy, e.pointerId);
});

let holdWalk = null;
canvas.addEventListener("pointermove", (e) => {
  if (Sky.isOpen()) {
    const rect = canvas.getBoundingClientRect();
    Sky.drag((e.clientX - rect.left) / rect.width * canvas.width, (e.clientY - rect.top) / rect.height * canvas.height, e.pointerId, (window.devicePixelRatio || 1) / scale);
    return;
  }
  if (!holdWalk || e.pointerId !== holdWalk.id) return;
  const rect = canvas.getBoundingClientRect();
  holdWalk.sx = (e.clientX - rect.left) / rect.width * canvas.width;
  holdWalk.sy = (e.clientY - rect.top) / rect.height * canvas.height;
  const perPoint = (window.devicePixelRatio || 1) / scale;          // game pixels per point
  if (Math.hypot(holdWalk.sx - holdWalk.sx0, holdWalk.sy - holdWalk.sy0) > 12 * perPoint) holdWalk.dragged = true;
});
const endHold = (e) => {
  if (Sky.isOpen()) {
    const rect = canvas.getBoundingClientRect();
    Sky.release((e.clientX - rect.left) / rect.width * canvas.width, (e.clientY - rect.top) / rect.height * canvas.height, e.pointerId, Math.max(8, minTap() / 2), canvas.width, canvas.height);
  }
  if (!holdWalk || e.pointerId !== holdWalk.id) return;
  const h = holdWalk;
  holdWalk = null;
  const held = performance.now() - h.since > 250;
  if (held && h.dragged && !player.interact && !player.sitting) { player.path = []; tapMarker = { x: player.nx, y: player.ny, age: 0 }; }
};
canvas.addEventListener("pointerup", endHold);
canvas.addEventListener("pointercancel", endHold);
canvas.addEventListener("pointerleave", endHold);

function followHeldFinger() {
  if (!holdWalk) return;
  const now = performance.now();
  if (now - holdWalk.since < 250 || now - holdWalk.last < 150) return;     // a tap, or just re-planned
  if (Closeup.isOpen() || (Speech && Speech.isOpen()) || (Story && Story.busy()) || player.sitting || changingPlace) { holdWalk = null; return; }
  if (!holdWalk.dragged) return;      // a finger held still means "go there", however long the press
  holdWalk.last = now;
  const tx = Math.floor((holdWalk.sx + camera.x) / TILE), ty = Math.floor((holdWalk.sy + camera.y) / TILE);
  const key = `${tx},${ty}`;
  if (key === holdWalk.tile || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
  holdWalk.tile = key;
  player.interact = null; player.faceAt = null;
  walkToward({ x: tx, y: ty });
}
