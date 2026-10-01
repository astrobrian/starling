
const WALK_SPEED = 5.625;    // tiles per second (90 game pixels: an even 1, 2, 1, 2 pixels a frame)
const RUN_SPEED = 7.5;       // on long walks she eases up to this (120 pixels: 2 a frame)

const player = {
  tx: WORLD.start.x, ty: WORLD.start.y,   // tile she is on (or leaving)
  nx: WORLD.start.x, ny: WORLD.start.y,   // tile she is walking to
  progress: 1,                            // 0..1 between the two tiles (1 = arrived)
  facing: "down",
  path: [],
  steps: 0,                               // counts steps, so her feet take turns
  interact: null,                         // the thing she's walking over to
  faceAt: null,                           // tile to face when she arrives
  sitting: null,                          // the bench she's sitting on
  seatDx: 0,                              // where on it, from its middle (at one end, with him at the other)
  still: 0,                             // seconds since she last moved
  speed: 0,                               // tiles per second right now (it eases)
  stepLen: 1,                             // this step's length in tiles (a diagonal is longer)
  carry: 0,                               // what's left over from the last step (no pause between steps)
  hop: null,                              // a little hop off the bench: { dx, dy, t }
  fishMoment: false,                      // the fish has jumped for her on this sit
  hidden: false,                          // asleep in bed
  act: null,                              // a short action she's playing (Player.act)
};

const PATHY = "=bo";
function stepCost(x, y) {
  return PATHY.includes(WORLD.tile(x, y)) ? 1 : 1.4;
}

function playerPixelPos() {
  const t = player.progress;
  const p = player.sitting ? { x: player.sitting.footX - 8 + (player.seatDx || 0), y: player.sitting.footY - TILE - 3 } : {
    x: (player.tx + (player.nx - player.tx) * t) * TILE,
    y: (player.ty + (player.ny - player.ty) * t) * TILE,
  };
  if (player.hop) {                       // a little hop onto the bench, or off it onto her tile
    const k = 1 - player.hop.t / (player.hop.dur || 0.25);
    p.x += player.hop.dx * (1 - k); p.y += player.hop.dy * (1 - k) - Math.sin(k * Math.PI) * 3;
  }
  return p;
}

function isMoving() {
  return player.progress < 1;
}

function faceToward(x, y) {
  const dx = x - player.nx, dy = y - player.ny;
  if (dx === 0 && dy === 0) return;
  if (Math.abs(dx) >= Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
  else player.facing = dy > 0 ? "down" : "up";
}

function stepTo(x, y) {
  if (!isWalkable(x, y)) return false;
  standUp();
  const dx = x - player.nx, dy = y - player.ny;
  const keeps = dx && dy && ((player.facing === "right" && dx > 0) || (player.facing === "left" && dx < 0) ||
    (player.facing === "down" && dy > 0) || (player.facing === "up" && dy < 0));
  if (!keeps) faceToward(x, y);
  player.tx = player.nx; player.ty = player.ny;
  player.nx = x; player.ny = y;
  if (!(player.carry > 0)) player.speed = WALK_SPEED * 0.6;
  player.stepLen = Math.hypot(dx, dy) || 1;
  player.progress = Math.min(0.99, (player.carry || 0) / player.stepLen);
  player.carry = 0;
  player.steps++;
  player.still = 0;
  companion.trail.push({ x: player.tx, y: player.ty });
  if (companion.trail.length > 6) companion.trail.shift();
  return true;
}

function walkToward(goal) {
  if (Story) Story.cancelPending();
  standUp();
  const from = { x: player.nx, y: player.ny };
  player.path = findPath(from, goal, MAP_W, MAP_H, isWalkable, stepCost);
  if (isMoving() && player.path.length && player.path[0].x === player.tx && player.path[0].y === player.ty) {
    [player.tx, player.nx] = [player.nx, player.tx];
    [player.ty, player.ny] = [player.ny, player.ty];
    player.progress = 1 - player.progress;
    player.path.shift();
    const dx = player.nx - player.tx, dy = player.ny - player.ty;
    player.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }
  const end = player.path.length ? player.path[player.path.length - 1] : from;
  tapMarker = { x: end.x, y: end.y, age: 0 };
}

function flowerAt(x, y) {
  return WORLD.things.some((t) => t.type === "flower" && t.x === x && t.y === y);
}

function hiddenBehind(x, y) {
  const feet = (y + 1) * TILE, cx = (x + 0.5) * TILE;
  return WORLD.things.some((t) => {
    if (t.footY < feet) return false;                          // drawn behind her
    const s = thingSprite(t, 1);
    if (s.canvas.height <= 22) return false;
    const left = t.footX - s.ax, top = t.footY - s.ay;
    return cx > left + 2 && cx < left + s.canvas.width - 2 && feet > top + 10;
  });
}

function walkToThing(thing, says = null) {
  const tiles = [];
  for (let y = thing.y; y < thing.y + thing.h; y++) for (let x = thing.x; x < thing.x + thing.w; x++) tiles.push({ x, y });
  const inside = new Set(tiles.map((t) => `${t.x},${t.y}`));
  const height = thingSprite(thing, 1).canvas.height;
  const tall = height > 22, low = height <= 20 || !!(THINGS[thing.type] && THINGS[thing.type].beside && WORLD.garden);
  const order = low ? { front: 2, side: 0, behind: 1 } : { front: 0, side: 1, behind: 2 };
  const mine = bankSide(player.nx, player.ny);
  let spots = [];
  for (const { x, y } of tiles) {
    for (const [dx, dy, where] of [[0, 1, "front"], [-1, 0, "side"], [1, 0, "side"], [0, -1, "behind"]]) {
      const nx = x + dx, ny = y + dy;
      if (inside.has(`${nx},${ny}`) || !isWalkable(nx, ny) || (where === "behind" && tall)) continue;
      if (thing.wet && bankSide(nx, ny) !== mine) continue;            // from her own bank
      spots.push({ x: nx, y: ny, g: order[where], d: Math.abs(nx - player.nx) + Math.abs(ny - player.ny),
        flower: flowerAt(nx, ny), hidden: hiddenBehind(nx, ny) });
    }
  }
  if (spots.some((p) => !p.hidden)) spots = spots.filter((p) => !p.hidden);
  if (spots.some((p) => !p.flower)) spots = spots.filter((p) => !p.flower);
  let goal = null;
  for (let g = 0; g < 3 && !goal; g++) {
    const group = spots.filter((p) => p.g === g);
    if (group.length) goal = group.reduce((a, b) => (b.d < a.d ? b : a));
  }
  if (!goal && thing.wet) goal = nearestBankOnHerSide(thing.x, thing.y);
  if (!goal) {
    for (const { x, y } of tiles) {
      const d = Math.abs(x - player.nx) + Math.abs(y - player.ny);
      if (!goal || d < goal.d) goal = { x, y, d };
    }
  }
  walkToward(goal);
  player.interact = thing;
  player.interactSays = says ? { thing, name: says } : null;
  lastTapped = thing;
  thing.bounce = Math.max(thing.bounce || 0, 0.25);
  const near = tiles.reduce((a, b) => (Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y) < Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y) ? b : a));
  player.faceAt = near;
}

function stepIntoView() {
  const end = player.path.length ? player.path[player.path.length - 1] : { x: player.nx, y: player.ny };
  if (!hiddenBehind(end.x, end.y)) return false;
  const mine = bankSide(end.x, end.y);
  let best = null;
  for (let y = end.y - 3; y <= end.y + 3; y++) for (let x = end.x - 3; x <= end.x + 3; x++) {
    if (!isWalkable(x, y) || hiddenBehind(x, y) || bankSide(x, y) !== mine) continue;
    const d = Math.abs(x - end.x) + Math.abs(y - end.y);
    if (!best || d < best.d) best = { x, y, d };
  }
  if (!best) return false;
  walkToward(best);
  return true;
}

function bankSide(x, y) {
  return Math.sign(WORLD.river.at(x + 0.5, y + 0.5).side) || 1;
}

function nearestBankOnHerSide(tx, ty) {
  const mine = bankSide(player.nx, player.ny);
  let best = null;
  for (let y = ty - 6; y <= ty + 6; y++) {
    for (let x = tx - 6; x <= tx + 6; x++) {
      if (!isWalkable(x, y) || "bo".includes(WORLD.tile(x, y)) || bankSide(x, y) !== mine) continue;
      const d = Math.hypot(x - tx, y - ty) + 0.25 * (Math.abs(x - player.nx) + Math.abs(y - player.ny)) + (hiddenBehind(x, y) ? 4 : 0);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}

function sitOn(bench) {
  const from = playerPixelPos();
  player.sitting = bench;
  player.seatDx = Husband.shareBench(bench);           // (with him: she takes one end, he sits at the other)
  const seat = playerPixelPos();
  player.hop = { dx: from.x - seat.x, dy: from.y - seat.y, t: 0.2, dur: 0.2 };
  player.facing = "down";
  player.path = [];
  player.still = 0;
  player.fishMoment = false;
  tapMarker = null;
}

function standUp() {
  if (!player.sitting) return;
  const seat = playerPixelPos();
  player.sitting = null;
  const tile = { x: player.nx * TILE, y: player.ny * TILE };
  player.hop = { dx: seat.x - tile.x, dy: seat.y - tile.y, t: 0.25, dur: 0.25 };
}

function updateStride(dt) {
  if (isMoving()) {
    const left = player.path.length + (1 - player.progress);             // steps still to go
    let want = WALK_SPEED + (RUN_SPEED - WALK_SPEED) * Math.max(0, Math.min(1, (left - 2) / 8));
    if (!player.path.length && player.progress > 0.5) want = WALK_SPEED * 0.7;
    const rate = player.speed < want ? (player.speed < WALK_SPEED ? 1 / 0.15 : 1 / 0.4) : 1 / 0.25;
    player.speed += (want - player.speed) * Math.min(1, rate * dt);
    player.progress += (player.speed * dt) / (player.stepLen || 1);
    if (player.progress >= 1) { player.carry = (player.progress - 1) * (player.stepLen || 1); player.progress = 1; }
  } else {
    player.still += dt;
  }
}

function benchFish(time) {
  if (!(player.sitting && !player.fishMoment && player.still > 3)) return;
  const b = player.sitting;
  let spot = null;
  const open = (x, y) => WORLD.river.at(x / TILE, y / TILE).d < -0.9;
  for (let dy = 20; dy <= 56 && !spot; dy += 4) {
    for (const dx of [0, -6, 6, -12, 12, -20, 20, -30]) {
      const x = b.footX + dx, y = b.footY + dy;
      if (open(x, y) && (open(x - 16, y) || open(x + 16, y))) { spot = { x, y, dir: open(x - 16, y) ? -1 : 1 }; break; }
    }
  }
  if (spot) {
    River.fishAt(spot.x, spot.y, time, 0.2, 3, spot.dir);
    setTimeout(() => {
      if (player.sitting !== b) return;
      showEmote("magpie", "exclaim");
      showEmote("player", "sparkles");
      Magpie.says(THINGS.fish.name);
    }, 450);
  }
  player.fishMoment = true;
}

function nextStep() {
  const arrivedNow = player.tx !== player.nx || player.ty !== player.ny;
  player.tx = player.nx; player.ty = player.ny;
  const key = lastKey || queuedKey;
  queuedKey = null;
  if (key) {
    const [dx, dy] = KEY_DIRS[key];
    if (!stepTo(player.nx + dx, player.ny + dy)) {
      player.facing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
      player.carry = 0;
    }
  } else if (player.path.length) {
    const next = player.path.shift();
    if (!stepTo(next.x, next.y)) { player.path = []; player.carry = 0; }
  } else {
    player.carry = 0;
    if (player.faceAt && !player.sitting) { faceToward(player.faceAt.x, player.faceAt.y); player.faceAt = null; }
    if (player.interact) { const t = player.interact; react(t); Husband.reached(t); player.interact = null; }
    if (arrivedNow && Story) Story.stopped();
  }
  return arrivedNow;
}
