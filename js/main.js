
const TILE = 16;
const WALK_SPEED = 5.625;    // tiles per second (90 game pixels: an even 1, 2, 1, 2 pixels a frame)
const RUN_SPEED = 7.5;       // on long walks she eases up to this (120 pixels: 2 a frame)
const TAP_POINTS = 44;       // the smallest tap area, in points, at any zoom

if (PARAMS.has("night")) Daylight.set("night", 0);
if (["morning", "noon", "sunset", "night"].includes(PARAMS.get("phase"))) Daylight.set(PARAMS.get("phase"), 0);
const saved = {
  get(key) { try { return JSON.parse(localStorage.getItem("starling." + key)); } catch (e) { return null; } },
  set(key, v) { try { localStorage.setItem("starling." + key, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

const SCENES = {};
function makeScene(name) {
  if (name === "hill" || name === "dome") {
    const world = name === "hill" ? buildHill() : buildDome();
    const ground = name === "hill" ? bakeHill(world, TILE) : bakeDome(world, TILE);
    return { name, world, ground, pixels: ground.getContext("2d"), critters: null, background: name === "hill" ? PALETTE.nightIndigo : name === "dome" ? RAMPS.plum[2] : RAMPS.plum[3] };
  }
  const world = name === "room" ? buildRoom() : buildWorld(window.GARDEN_MAP);
  if (name !== "room") world.garden = true;
  const ground = name === "room" ? bakeRoom(world, TILE) : bakeGround(world, TILE);
  return {
    name, world, ground, pixels: ground.getContext("2d"),
    critters: name === "room" ? null : makeCritters(world),
    background: name === "room" ? RAMPS.plum[3] : RAMPS.grass[3],
  };
}
let scene, WORLD, MAP_W, MAP_H, GROUND, GROUND_PIXELS, CRITTERS;
function ensureScene(name) {
  return SCENES[name] || (SCENES[name] = makeScene(name));
}
function useScene(name) {
  scene = ensureScene(name);
  WORLD = scene.world; GROUND = scene.ground; GROUND_PIXELS = scene.pixels; CRITTERS = scene.critters;
  MAP_W = WORLD.W; MAP_H = WORLD.H;
}
useScene("garden");

function isWalkable(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !WORLD.blocked[y * MAP_W + x];
}

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

const Player = (() => {
  const TIME = { sing: 2.6, drink: 1.6, pour: 2.2, throw: THROW.dur, kiss: 1.5 };
  const TURN = { down: "left", left: "up", up: "right", right: "down" };        // spinning round to her right
  const HOP = 0.3, JUMP = 0.42;

  function act(name, opts = {}) {
    stop();
    if (!name) return Promise.resolve();
    let wait = 0;
    if (player.sitting && !["sing", "drink"].includes(name)) { standUp(); wait = 0.25; }
    const a = { name, opts, t: -wait, n: 0, facing: player.sitting ? "down" : player.facing, resolve: null };
    a.dur = name === "jump" ? (opts.count || 2) * JUMP : name === "dance" ? 4 * HOP + 0.55 : opts.seconds || TIME[name] || 1.5;
    if ((name === "sing" || name === "drink") && a.facing === "up") a.facing = "down";      // (she turns to us)
    if (name === "kiss") a.facing = opts.face || (a.facing === "left" ? "left" : "right");
    const holding = typeof State !== "undefined" && State.get().holding;
    if (name === "drink") a.item = [opts.item, "cup", holding, "water", "berry"].find((i) => i && ICONS[i]);
    if (name === "pour") {
      const p = playerPixelPos();
      a.facing = opts.to ? (opts.to.x < p.x + 8 ? "left" : "right") : a.facing === "left" ? "left" : "right";
      a.item = opts.item || holding || "wateringCan";
      if (typeof Sound !== "undefined" && !/^seeds(:|$)/.test(a.item)) Sound.splash();
    }
    if (name === "throw") {
      const p = playerPixelPos();
      a.facing = opts.to ? (opts.to.x < p.x + 8 ? "left" : "right") : a.facing === "left" ? "left" : "right";
    }
    player.act = a;
    return new Promise((resolve) => { a.resolve = resolve; });
  }

  function stop() {
    const a = player.act;
    if (!a) return;
    player.act = null;
    if (a.resolve) a.resolve();
  }

  function update(dt) {
    const a = player.act;
    if (!a) return;
    if (a.t >= 0 && (isMoving() || player.path.length)) { stop(); return; }     // she walked off
    a.t += dt;
    if (a.name === "sing" && a.t >= 0 && a.t >= (a.nextNote || 0) && a.t < a.dur - 0.3) {
      const side = a.facing === "left" ? -1 : a.facing === "right" ? 1 : 0, dir = side || (a.n % 2 ? 1 : -1);
      (player.cueQueue || (player.cueQueue = [])).push({ kind: "note", dir, dx: side ? side * 3 : dir * 9 });
      if (typeof Sound !== "undefined" && Sound.note) Sound.note(a.n);
      a.n++;
      a.nextNote = a.t + 0.5;
    }
    if (a.name === "dance" && !a.hearted && a.t >= 4 * HOP) { a.hearted = true; showEmote("player", "heart"); }
    if (a.name === "throw" && !a.released && a.t >= THROW.release) {
      a.released = true;                                                          // the stone leaves her hand
      const p = playerPixelPos(), hx = a.facing === "left" ? THROW_HAND.x : 16 - 1 - THROW_HAND.x;
      if (a.opts.onRelease) a.opts.onRelease({ x: Math.round(p.x) + hx, y: Math.round(p.y) - TILE + THROW_HAND.y });
    }
    if (a.t >= a.dur) stop();
  }

  function frame() {
    const a = player.act;
    if (!a || a.t < 0) return null;
    const S = PLAYER_SPRITES, A = S.acts, t = a.t, f = a.facing;
    const ease = Math.max(0, Math.min(1, t / 0.25, (a.dur - t) / 0.3));        // lifting up, then down again
    if (a.name === "sing") {
      const k = Math.floor(t / 0.4) % 2;
      if (player.sitting) return { sprite: A.sing.sit[k], lift: 0, facing: "down" };
      return { sprite: (A.sing[f] || S[f])[k] || S[f][0], lift: 0, facing: f };
    }
    if (a.name === "dance") {
      const i = Math.floor(t / HOP);
      if (i < 4) {
        let face = f;
        for (let j = 0; j <= i; j++) face = TURN[face];
        const lift = Math.round(Math.sin(((t % HOP) / HOP) * Math.PI) * 3);
        return { sprite: lift > 0 ? S[face][1 + (i % 2)] : S[face][0], lift, facing: face };
      }
      return { sprite: A.cheer[f] || S[f][0], lift: 0, facing: f };
    }
    if (a.name === "jump") {
      const k = t % JUMP, lift = k < 0.34 ? Math.round(Math.sin((k / 0.34) * Math.PI) * 5) : 0;
      return { sprite: lift > 1 ? A.cheer[f] || S[f][1] : S[f][0], lift, facing: f };
    }
    if (a.name === "drink") {
      const closed = ease > 0.9;                                                    // (eyes closed while she sips)
      const sprite = player.sitting ? (closed ? S.blink.sit : S.sit) : (closed && S.blink[f]) || S[f][0];
      return { sprite, lift: 0, facing: player.sitting ? "down" : f, raise: ease };
    }
    if (a.name === "pour") return { sprite: (A.pour && A.pour[f]) || S[f][0], lift: 0, facing: f, tip: ease };
    if (a.name === "throw") return { sprite: renderPlayerThrow()[f][throwStep(t)], lift: 0, facing: f };
    if (a.name === "kiss") return { sprite: (t > 0.15 && A.kiss && A.kiss[f]) || S[f][0], lift: 0, facing: f };
    return null;
  }

  function drawHeld(ctx2, p, pose) {
    const a = player.act;
    if (!a || !pose || (a.name !== "drink" && a.name !== "pour")) return false;
    const side = pose.facing === "left" ? -1 : pose.facing === "right" ? 1 : 0;
    const herTop = Math.round(p.y) - TILE - pose.lift;
    if (a.name === "drink") {
      if (!a.item) return true;
      const name = a.item === "cup" && ICONS.cupSip ? "cupSip" : a.item, flip = name === "cupSip" && side > 0;
      const key = name + (flip ? "~flip" : "");
      const icon = heldIcons[key] || (heldIcons[key] = iconFromGrid(flip ? { ...ICONS[name], grid: ICONS[name].grid.map((r) => [...r].reverse().join("")) } : ICONS[name]).toCanvas());
      const y = herTop + 20 - Math.round(pose.raise * 4);                         // from her chest up to her lips
      ctx2.drawImage(icon, Math.round(p.x + 8 + side * 8 - icon.width / 2), Math.round(y - icon.height / 2));
      return true;
    }
    const dir = side || 1, steps = Math.round(pose.tip * 3);
    const can = tiltedHeld(a.item, steps, dir);
    const hx = Math.round(p.x) + (dir > 0 ? 16 - POUR_HAND.x : POUR_HAND.x), hy = herTop + POUR_HAND.y;
    const x = Math.round(hx - can.grip.x), y = Math.round(hy - can.grip.y);
    ctx2.drawImage(can.canvas, x, y);
    a.spout = steps >= 2 && can.spout ? { x: x + can.spout.x, y: y + can.spout.y, dir } : null;
    return true;
  }

  function drawOver(ctx2, time) {
    const a = player.act;
    if (!a || a.name !== "pour" || !a.spout) return;
    const p = playerPixelPos();
    const to = a.opts.to || { x: a.spout.x + a.spout.dir * 6, y: p.y + 13 };
    drawPourStream(ctx2, a.item, a.spout, { x: to.x, y: Math.max(to.y, a.spout.y + 4) }, time, a.t);
  }

  function drawCues(ctx2) {
    if (!(player.cues && player.cues.length) && !(player.cueQueue && player.cueQueue.length)) return;
    const p = playerPixelPos(), pose = playerPose(), f = pose.facing || player.facing;
    const mouth = { x: Math.round(p.x) + (f === "left" ? 2 : f === "right" ? 14 : 8), y: Math.round(p.y) - TILE + 14 - pose.lift };
    Wildlife.drawCues(ctx2, player, { mouth, head: { x: mouth.x, y: Math.round(p.y) - TILE } });
  }

  return { act, stop, update, frame, drawHeld, drawOver, drawCues, busy: () => !!player.act };
})();
window.Player = Player;

const MAGPIE_VOICE = { chirp: BIRDS.magpie.chirp || "chatter", pitch: BIRDS.magpie.chirpPitch || 1500 };

const companion = (() => {
  let sx = WORLD.start.x + 1, sy = WORLD.start.y + 1;
  if (!isWalkable(sx, sy)) { sx = WORLD.start.x - 1; sy = WORLD.start.y; }
  return {
    x: sx, y: sy,                 // tile it's on (or hopping to)
    fx: sx, fy: sy,               // tile it's hopping from
    t: 1,                         // hop progress
    flying: false,
    faceLeft: true,
    trail: [],                    // tiles she has just left
    joy: 0,                       // a happy hop when tapped
    nudge: 0,                     // pixels to stand a little farther out from her
    taps: 0,
    mode: "follow",
    px: 0, py: 0, sortY: 0,
    flight: null,                 // flying somewhere: { from, to, t, mode }
    pecking: false,               // tapping at the window
    time: 0,
  };
})();

function companionPose() {
  const c = companion;
  if (c.flight || (c.flying && c.t < 1)) return ["fly", "fly1", "fly2", "fly1"][Math.floor(performance.now() / 111) % 4];
  if (c.act) return c.actPose || "stand";
  if (c.pecking) return Math.floor(c.time * 5) % 3 === 0 ? "peck" : "stand";
  if (c.mode !== "follow" && Math.floor(c.time * 1.3) % 5 === 4) return "bob";
  return "stand";
}

let magpieBlinkAt = 0, magpieBlinkUntil = 0;
function companionSprite() {
  const pose = companionPose(), now = performance.now() / 1000;
  if (now > magpieBlinkAt) { magpieBlinkUntil = now + 0.12; magpieBlinkAt = now + 2.5 + Math.random() * 3; }
  return renderBird(BIRDS.magpie, pose, !pose.startsWith("fly") && pose !== "sleep" && now < magpieBlinkUntil);
}

function magpieAct(name, seconds) {
  const c = companion, was = c.act;
  c.act = null; c.actLift = 0;
  if (was && was.resolve) was.resolve();
  if (!name) return Promise.resolve();
  c.act = Wildlife.newAct(name, seconds);
  c.actPose = "stand";
  return new Promise((resolve) => { c.act.resolve = resolve; });
}

function magpieFlyTo(mode, x, y, sortY = null) {
  if (companion.act) magpieAct(null);                 // (flying off ends any act)
  const c = companion, from = companionFoot();
  if (mode === "follow") {
    const spot = followSpot([[1, 1], [-1, 1], [1, 0], [-1, 0], [0, 1]]);
    c.x = c.fx = spot.x; c.y = c.fy = spot.y; c.t = 1; c.trail = [];
    x = spot.x * TILE + 8; y = spot.y * TILE + 14;
  }
  if (mode === "head") { const p = playerPixelPos(); x = p.x + 8; y = p.y - TILE + 5; }
  const dist = Math.hypot(x - from.x, y - from.y);
  c.flight = { from, to: { x, y }, t: 0, dur: Math.min(1.6, 0.45 + dist / 160), mode, sortY };
  c.faceLeft = x < from.x;
  c.pecking = false;
}

function magpieAt(mode, x = 0, y = 0, sortY = null) {
  const c = companion;
  if (c.act) magpieAct(null);
  c.flight = null; c.mode = mode; c.px = x; c.py = y; c.sortY = sortY; c.pecking = false;
  if (mode === "follow") {
    const spot = followSpot([[1, 1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
    c.x = c.fx = spot.x; c.y = c.fy = spot.y; c.t = 1; c.trail = [];
  }
}

function followSpot(offsets) {
  const spots = offsets.map(([dx, dy]) => ({ x: player.nx + dx, y: player.ny + dy })).filter((p) => isWalkable(p.x, p.y));
  return spots.find((p) => !hiddenBehind(p.x, p.y)) || spots[0] || { x: player.nx, y: player.ny };
}

function companionPos() {
  const c = companion, t = c.t;
  const x = (c.fx + (c.x - c.fx) * t) * TILE, y = (c.fy + (c.y - c.fy) * t) * TILE;
  const hopHeight = c.flying ? 10 : 3;
  let lift = t < 1 ? Math.sin(t * Math.PI) * hopHeight : 0;
  if (c.joy > 0) lift += Math.sin((c.joy / 0.35) * Math.PI) * 4;
  return { x, y, lift };
}

function updateCompanion(dt) {
  const c = companion;
  c.joy = Math.max(0, c.joy - dt);
  c.time += dt;
  if (c.flight) {
    c.flight.t = Math.min(1, c.flight.t + dt / c.flight.dur);
    if (c.flight.t >= 1) {
      const f = c.flight;
      c.flight = null;
      c.mode = f.mode; c.px = f.to.x; c.py = f.to.y; c.sortY = f.sortY;
    }
    return;
  }
  if (c.act && (c.mode !== "follow" || c.t >= 1)) {
    if (c.mode === "follow" && (isMoving() || player.path.length)) magpieAct(null);   // (she walked on: it comes along)
    else {
      c.act.cueDir = companionHeadTop().x < playerPixelPos().x + 8 ? -1 : 1;            // (its notes float away from her, never over her face)
      const f = Wildlife.stepAct(c.act, dt, BIRDS.magpie, c);
      c.actPose = f.pose; c.actLift = f.lift;
      if (f.flip) c.faceLeft = !c.faceLeft;
      if (c.act.done) magpieAct(null);
      return;
    }
  }
  if (c.mode === "head" || c.mode === "window" || c.mode === "perch") {
    if (c.mode === "perch" && !c.pecking) c.faceLeft = playerPixelPos().x + 8 < c.px;
    return;
  }
  if (c.mode === "away") return;
  const level = c.t >= 1 && !player.sitting && c.y === player.ny && Math.abs(c.x - player.nx) === 1;
  const nudge = level ? (c.x < player.nx ? -4 : 4) : 0;
  c.nudge += (nudge - c.nudge) * Math.min(1, dt * 10);
  if (c.t < 1) {
    c.t = Math.min(1, c.t + dt * (c.flying ? 3 : Math.max(WALK_SPEED, player.speed || 0) * 1.2));
    return;
  }
  c.flying = false;
  let herTiles = [`${player.nx},${player.ny}`, `${player.tx},${player.ty}`];
  let target;
  if (player.sitting) {
    const b = player.sitting;
    herTiles = [];
    for (let x = b.x; x < b.x + b.w; x++) herTiles.push(`${x},${b.y}`);
    target = [{ x: b.x + b.w, y: b.y }, { x: b.x - 1, y: b.y }, { x: b.x, y: b.y + 1 }].find((p) => isWalkable(p.x, p.y));
  } else {
    target = [...c.trail].reverse().find((p) => !herTiles.includes(`${p.x},${p.y}`));
    if (!isMoving() && !player.path.length) {
      const d = c.x <= player.nx ? -1 : 1;
      let order = [[d, 1], [-d, 1], [d, 0], [-d, 0], [d, -1], [-d, -1]];
      if (Dolls.carried() && player.facing === "down") order = order.slice(0, 4).concat([[-1, -1], [1, -1]]);
      const spots = order.map(([dx, dy]) => ({ x: player.nx + dx, y: player.ny + dy }));
      const onTapped = (p) => lastTapped && p.x >= lastTapped.x && p.x < lastTapped.x + lastTapped.w && p.y >= lastTapped.y && p.y < lastTapped.y + lastTapped.h;
      const birdThere = (p) => WORLD.garden && Wildlife.all().some((b) => {
        const dy = b.y - (p.y * TILE + 14);                  // its feet on this tile, or one below (its head here)
        return !b.gone && !b.flight && Math.abs(b.x - (p.x * TILE + 8)) < 14 && dy > -10 && dy < 18;
      });
      const aboveHim = (p) => [-1, 0, 1].some((dx) => Husband.occupies(p.x + dx, p.y + 1) || Husband.occupies(p.x + dx, p.y + 2));
      const ok = (p) => isWalkable(p.x, p.y) && !hiddenBehind(p.x, p.y) && !onTapped(p) && !birdThere(p) && !Husband.occupies(p.x, p.y) && !Husband.occupies(p.x, p.y - 1) && !aboveHim(p);
      const good = (p) => ok(p) && !flowerAt(p.x, p.y);
      const here = spots.find((p) => p.x === c.x && p.y === c.y);
      if (here && good(here) && here.y > player.ny) target = here;            // already in a good spot by her feet: stay
      else target = spots.slice(0, 4).find(good) || spots.slice(0, 4).find(ok) || spots.find(good) || spots.find(ok) || spots.find((p) => isWalkable(p.x, p.y)) || target;
    }
  }
  const dist = Math.abs(c.x - player.nx) + Math.abs(c.y - player.ny);
  const settled = !target || (target.x === c.x && target.y === c.y);
  if (settled) {
    if (dist <= 3 && !isMoving()) {
      const p = playerPixelPos();
      c.faceLeft = p.x < c.x * TILE;        // close by and she's still: face her
    }
    return;
  }
  const hop = (x, y, flying) => {
    c.fx = c.x; c.fy = c.y; c.x = x; c.y = y; c.t = 0; c.flying = flying;
    if (x !== c.fx) c.faceLeft = x < c.fx;
  };
  if (dist > 7) {
    hop(target.x, target.y, true);       // fell behind: fly to catch up
    return;
  }
  const walkable = (x, y) => isWalkable(x, y) && !herTiles.includes(`${x},${y}`);
  const path = findPath({ x: c.x, y: c.y }, target, MAP_W, MAP_H, walkable);
  if (path.length) hop(path[0].x, path[0].y, false);
}

function companionFoot() {
  const c = companion;
  if (c.flight) {
    const k = c.flight.t, e = k * k * (3 - 2 * k), { from, to } = c.flight;
    const arc = Math.min(28, 8 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25);
    return { x: Math.round(from.x + (to.x - from.x) * e), y: Math.round(from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * arc) };
  }
  const acting = c.act ? c.actLift || 0 : 0;                        // (hopping in an act)
  if (c.mode === "head") {
    const p = playerPixelPos(), { lift } = playerPose();
    return { x: Math.round(p.x + 8), y: Math.round(p.y) - TILE + 5 - lift - Math.round(acting) };
  }
  if (c.mode === "window" || c.mode === "perch") {
    const lift = c.joy > 0 ? Math.sin((c.joy / 0.35) * Math.PI) * 4 : 0;
    return { x: Math.round(c.px), y: Math.round(c.py - lift - acting) };
  }
  const p = companionPos();
  return { x: Math.round(p.x + 8 + companion.nudge), y: Math.round(p.y + 14 - p.lift - acting) };
}

function companionSortY() {
  const c = companion;
  if (c.flight) return 1e6;
  if (c.mode === "head") return (player.sitting ? player.sitting.footY + 0.5 : playerPixelPos().y + TILE) + 0.2;
  if (c.mode === "window" || c.mode === "perch") return c.sortY !== null && c.sortY !== undefined ? c.sortY : c.py;
  return companionPos().y + TILE - 0.5;
}

function companionHeadTop() {
  const s = companionSprite(), f = companionFoot();
  return {
    x: companion.faceLeft ? f.x + s.footX - s.headX : f.x - s.footX + s.headX,
    y: f.y - s.footY + s.headY,
  };
}

function drawCompanion() {
  if (companion.mode === "away" && !companion.flight) return;
  const s = companionSprite(), f = companionFoot(), p = companionPos();
  if (companion.mode === "follow" && !companion.flight) drawShadow(p.x + 9 + companion.nudge, p.y + 15, 5, 1.5);
  ctx.save();
  if (companion.faceLeft) {
    ctx.translate(f.x + s.footX, f.y - s.footY);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(f.x - s.footX, f.y - s.footY);
  }
  ctx.drawImage(s.canvas, 0, 0);
  ctx.restore();
  drawCompanionCarry();
}

function drawCompanionCarry() {
  if (!companion.carry || (companion.mode === "away" && !companion.flight)) return;
  const f = companionFoot();
  drawInBeak(ctx, companion.carry, f.x, f.y, companion.faceLeft, companionPose(), BIRDS.magpie);
}

function companionBox() {
  const s = companionSprite(), f = companionFoot();
  const left = companion.faceLeft ? f.x + s.footX - s.canvas.width : f.x - s.footX;
  return { x: left, y: f.y - s.footY, w: s.canvas.width, h: s.canvas.height };
}

function magpieSays(text) {
  if (!text || (companion.mode === "away" && !companion.flight)) return;
  const h = companionHeadTop();
  if (!Closeup.isOpen() && (h.x < camera.x || h.x > camera.x + canvas.width || h.y < camera.y || h.y > camera.y + canvas.height + 8)) return;
  bubbleAt = null;
  if (Story && !Story.understands()) text = "♪ ♪";
  UI.say(text, MAGPIE_VOICE, "magpie");
}

function minTap() {
  return (TAP_POINTS * (window.devicePixelRatio || 1)) / scale;
}

function thingBox(t) {
  const s = thingSprite(t, 1);
  const x = t.footX - s.ax, y = t.footY - s.ay;
  const m = minTap();
  const w = Math.max(s.canvas.width, m), h = Math.max(s.canvas.height, m);
  return { x: x - (w - s.canvas.width) / 2, y: y - (h - s.canvas.height), w, h };
}

const solidCache = new WeakMap();
function isSolid(canvasEl, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= canvasEl.width || y >= canvasEl.height) return false;
  let a = solidCache.get(canvasEl);
  if (!a) {
    const d = canvasEl.getContext("2d").getImageData(0, 0, canvasEl.width, canvasEl.height).data;
    a = new Uint8Array(canvasEl.width * canvasEl.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    solidCache.set(canvasEl, a);
  }
  return a[y * canvasEl.width + x] === 1;
}

function thingAt(gx, gy, exact = false) {
  const lost = !exact && WORLD.things.find((t) => t.lost && t.tappable);
  if (lost) {
    const b = thingBox(lost);
    if (gx >= b.x && gy >= b.y && gx < b.x + b.w && gy < b.y + b.h) return lost;
  }
  let hit = null;
  for (const t of WORLD.things) {
    if (!t.tappable) continue;
    const s = thingSprite(t, 1);
    if (isSolid(s.canvas, gx - (t.footX - s.ax), gy - (t.footY - s.ay)) && (!hit || t.footY >= hit.footY)) hit = t;      // (a tie: the one drawn later, on top: her tray on the bench)
  }
  if (hit || exact) return hit;
  let near = null;
  const m = minTap();
  for (const t of WORLD.things) {
    if (!t.tappable) continue;
    const sprite = thingSprite(t, 1).canvas;
    if (sprite.width >= m && sprite.height >= m) continue;     // big things need a real hit
    const b = thingBox(t);
    if (gx < b.x || gy < b.y || gx >= b.x + b.w || gy >= b.y + b.h) continue;
    const d = Math.hypot(gx - (b.x + b.w / 2), gy - (b.y + b.h / 2));
    if (!near || d < near.d) near = { t, d };
  }
  return near && near.t;
}

function storyThingAt(gx, gy) {
  if (!Story || !Story.wants) return null;
  let near = null;
  for (const t of WORLD.things) {
    if (!t.tappable || !Story.wants(t)) continue;
    const b = thingBox(t);
    if (gx < b.x || gy < b.y || gx >= b.x + b.w || gy >= b.y + b.h) continue;
    const d = Math.hypot(gx - (b.x + b.w / 2), gy - (b.y + b.h / 2));
    if (!near || d < near.d) near = { t, d };
  }
  return near && near.t;
}

function housePart(house, gx, gy) {
  if (gy < house.footY - 2 * TILE) return "roof";
  if (Math.abs(gx - house.footX) <= 9) return "door";
  return "walls";
}

function react(thing) {
  thing.bounce = 0.4;
  Sound.tap(thing.type === "flower" ? 640 : 480);
  const name = player.interactSays && player.interactSays.thing === thing ? player.interactSays.name : thing.name;
  if (WORLD.indoors && companion.mode === "away" && !companion.flight) {
    if (name) sayAt(name, thing.footX, thing.footY - thingSprite(thing, 1).ay - 2);
  } else magpieSays(name);
  if (thing.type === "flower" && (!closeupSeen || (Story && Story.closeupOptions().star))) {
    const patch = patchNear(thing.x, thing.y);
    if (patch >= 0) pendingCloseup = { patch, at: performance.now() / 1000 + 1.6, here: true };
  }
  const trayHere = State.get().holding === "tray" || WORLD.things.some((o) => o.type === "breakfast" && o.y === thing.y && o.x >= thing.x && o.x < thing.x + thing.w);
  if (thing.type === "bench" && !trayHere) sitOn(thing);
  if (thing.type === "bigTelescope") setTimeout(lookThroughTelescope, 350);
  if (Story) Story.reached(thing);
  if (thing.type === "desk" && window.Diary) {
    const at = `${player.nx},${player.ny}`, held = State.get().holding;
    setTimeout(() => {
      if (`${player.nx},${player.ny}` !== at || isMoving() || State.get().holding !== held) return;
      if ((Speech && Speech.isOpen()) || (Story && Story.busy()) || Diary.isOpen() || Title.isOpen()) return;
      Diary.open();
    }, 700);
  }
  if (thing.type === "house") {
    const at = `${player.nx},${player.ny}`;
    setTimeout(() => { if (`${player.nx},${player.ny}` === at && !isMoving()) goTo("room"); }, 650);
  }
}

let changingPlace = false;
let nextOwlCall = 0;

function fadeTo(on, slow = false) {
  const el = document.getElementById("fade");
  el.classList.toggle("slow", slow);
  el.classList.toggle("on", on);
  return new Promise((done) => setTimeout(done, slow ? 950 : 380));
}

function arrivalSpot(name, from = null) {
  if (name === "room" || name === "dome") return { x: WORLD.door.x, y: WORLD.door.y - 1, facing: "up" };
  if (name === "hill") return from === "dome" ? { x: WORLD.door.x, y: WORLD.door.y + 1, facing: "down" } : { ...WORLD.start, facing: "up" };
  const house = WORLD.things.find((t) => t.type === "house");
  return { x: Math.floor(house.footX / TILE), y: house.y + house.h, facing: "down" };
}

function placeHer(name, spot, facing = "down") {
  useScene(name);
  resize();
  Husband.reset();
  player.tx = player.nx = spot.x; player.ty = player.ny = spot.y; player.progress = 1;
  player.path = []; player.interact = null; player.faceAt = null; player.sitting = null; player.hop = null;
  player.facing = facing;
  Player.stop();
  tapMarker = null; lastTapped = null; pendingCloseup = null;
  cameraGoal.x = null;
  updateCamera();
}

function addThing(o, world = SCENES.garden.world) {
  const kind = (world.indoors ? ROOM_THINGS[o.type] : THINGS[o.type]) || THINGS[o.type] || ROOM_THINGS[o.type];
  const [w, h] = kind.size;
  const t = {
    type: o.type, x: o.x, y: o.y, w, h, variant: o.variant || 0,
    name: kind.name, tappable: !!kind.name, blocks: kind.blocks, wet: !!kind.wet, flat: !!kind.flat, onWall: !!kind.onWall,
    korean: kind.korean || null,
    footX: (o.x + w / 2) * TILE, footY: (o.y + h) * TILE + (kind.onDesk ? 1 : 0), bounce: 0, phase: 0,   // (on the desk: drawn after it)
  };
  world.things.push(t);
  blockUnder(t, world);
  return t;
}
function removeThing(t, world = SCENES.garden.world) {
  world.things = world.things.filter((x) => x !== t);
  blockUnder(t, world);
}
function restoreThing(t, world = SCENES.garden.world) {
  if (!world.things.includes(t)) world.things.push(t);
  blockUnder(t, world);
}
function blockUnder(t, world) {
  if (!t.blocks) return;
  for (let y = t.y; y < t.y + t.h; y++) {
    for (let x = t.x; x < t.x + t.w; x++) {
      if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
      const ground = (world.indoors ? "#w" : "E~rH").includes(world.tile(x, y));
      const standing = world.things.some((o) => o.blocks && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
      world.blocked[y * world.W + x] = ground || standing ? 1 : 0;
    }
  }
}

async function goTo(name, spot = null, byStars = false) {
  if (changingPlace || scene.name === name) return;
  changingPlace = true;
  UI.hideBubble();
  if (byStars) await new Promise((ok) => Observatory.go(ok));
  else { Sound.door(); await fadeTo(true); }
  const from = scene.name;
  useScene(name);
  resize();
  const at = spot || arrivalSpot(name, from);
  player.tx = player.nx = at.x; player.ty = player.ny = at.y; player.progress = 1;
  player.path = []; player.interact = null; player.faceAt = null; player.sitting = null; player.hop = null;
  player.facing = at.facing || "down";
  tapMarker = null; lastTapped = null; pendingCloseup = null;
  if (companion.mode === "follow" || companion.flight) magpieAt("follow");
  else if (companion.mode === "window" || companion.mode === "head") magpieAt(companion.mode === "head" ? "head" : "away");
  if (Story) Story.changedPlace(from, name);
  Husband.changedPlace();
  if (name === "dome") telescopeLooked = false;
  cameraGoal.x = null;
  updateCamera();
  if (State) State.set("scene", name);
  if (WORLD.alwaysNight) Sound.playMusic("night");
  else if (from === "hill" || from === "dome") Sound.playMusic(Daylight.phase() === "night" ? "night" : "day");
  if (!byStars) await fadeTo(false);
  else await new Promise((ok) => setTimeout(ok, 700));
  changingPlace = false;
}

let homeSpot = null;
function visitObservatory() {
  if (changingPlace || WORLD.small || Closeup.isOpen() || Sky.isOpen()) return;
  homeSpot = { scene: scene.name, x: player.nx, y: player.ny, facing: player.facing };
  goTo("hill", null, true);
}
function goHome() {
  if (changingPlace || !WORLD.small || Sky.isOpen()) return;
  let back = homeSpot;
  if (!back) {
    const h = ensureScene("garden").world.things.find((t) => t.type === "house");
    back = { scene: "garden", x: Math.floor(h.footX / TILE), y: h.y + h.h, facing: "down" };
  }
  homeSpot = null;
  goTo(back.scene, { x: back.x, y: back.y, facing: back.facing }, true);
}

let sparkleIcon = null;
function drawTelescopeSparkle(time) {
  const t = WORLD.things.find((x) => x.type === "bigTelescope");
  if (!t) return;
  sparkleIcon = sparkleIcon || iconFromGrid(ICONS.sparkle, true).toCanvas();         // (twice as big: it's a cue)
  if (Math.sin(time * 2.2) < -0.2) return;
  const bob = Math.round(Math.sin(time * 3) * 2);
  ctx.drawImage(sparkleIcon, Math.round(t.footX - 26 - sparkleIcon.width / 2), Math.round(t.footY - 30 - sparkleIcon.height + bob));
}

let telescopeLooked = false, telescopeOpening = false;
function lookThroughTelescope() {
  if (Sky.isOpen() || telescopeOpening) return;
  telescopeLooked = true;
  const text = window.OBSERVATORY_TEXT || {};
  Husband.says(Object.keys(State.get().learned).length ? text.stars : text.noStars);
  telescopeOpening = true;
  setTimeout(() => {                        // (his line first, then the view tilts up, with its back arrow)
    telescopeOpening = false;
    UI.showBack(true);
    Sky.show(State.get().day, [], { review: true }).then(() => UI.showBack(false));
  }, 1500);
}

const keysDown = new Set();
const KEY_DIRS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};
let lastKey = null;
let queuedKey = null;        // so a quick key tap still moves one tile
let tapMarker = null;
let lastTapped = null;       // the thing she last walked over to
let started = false;

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

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

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

let busyTap = null;
function replayBusyTap() {
  if (!busyTap || (Story && Story.busy())) return;
  const t = busyTap;
  busyTap = null;
  if (performance.now() - t.at < 1000 && !(Speech && Speech.isOpen()) && !changingPlace) handleTap(t.sx, t.sy, t.id);
}

let tapPops = [];
function popTap(gx, gy) { tapPops.push({ x: gx, y: gy, age: 0 }); }
function drawTapPops() {
  for (const p of tapPops) {
    const r = (3 + Math.round((p.age / 0.25) * 6)) * CUE;
    for (const [rr, color] of [[r + 1, RAMPS.duskLavender[2]], [r, PALETTE.cream]]) {
      ctx.fillStyle = color;
      const n = 8 + r * 3;
      for (let a = 0; a < n; a++) {
        const ang = (a / n) * Math.PI * 2;
        ctx.fillRect(Math.round(p.x + Math.cos(ang) * rr), Math.round(p.y + Math.sin(ang) * rr * 0.6), 1, 1);
      }
    }
  }
}

function handleTap(sx, sy, pointerId) {
  if (Closeup.isOpen()) {
    const hit = Closeup.tap(sx, sy, minTap());
    if (hit && Story && Story.closeupTap(hit)) return;
    if (hit) {
      UI.say(Story && !Story.understands() ? "♪ ♪" : hit.name, MAGPIE_VOICE, "closeup-magpie");
      if (hit.critterSays) UI.tinySay(hit.critterSays, gameToScreen(hit.at.x, hit.at.y, false));
    }
    return;
  }

  const gx = sx + camera.x, gy = sy + camera.y;
  popTap(gx, gy);

  const target = storyThingAt(gx, gy);
  const wanted = WORLD.garden && Wildlife.wantedAt(gx, gy, minTap(), !target);
  if (wanted && Story && Story.tapBird(wanted)) return;

  const mb = companionBox();
  const pad = Math.max(0, (minTap() - Math.min(mb.w, mb.h)) / 2);
  const onMagpie = gx >= mb.x - pad && gx < mb.x + mb.w + pad && gy >= mb.y - pad && gy < mb.y + mb.h + pad;
  const onMagpiePixels = () => {
    const s = companionSprite(), u = Math.floor(gx - mb.x), v = Math.floor(gy - mb.y);
    return isSolid(s.canvas, companion.faceLeft ? s.canvas.width - 1 - u : u, v);
  };
  const drawnThing = onMagpie ? thingAt(gx, gy, true) : null;
  const inFront = drawnThing && !drawnThing.flat && companion.mode !== "head" && drawnThing.footY > companionSortY();
  const somethingElse = onMagpie && (inFront || (target && !Story.wants("magpie")) || (!onMagpiePixels() && ((WORLD.garden && Wildlife.birdAt(gx, gy, 0, !target)) || drawnThing)));
  if (companion.mode !== "away" && onMagpie && !somethingElse) {
    if (Story && Story.tapMagpie()) return;
    companion.joy = 0.35;
    showEmote("magpie", ["heart", "sparkles", "heart", "exclaim"][companion.taps++ % 4]);
    Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
    return;
  }

  if (!target && Husband.at(gx, gy, minTap())) { Husband.tap(); return; }

  const behindHer = !target && WORLD.garden && !player.hidden && thingAt(gx, gy, true);
  if (behindHer && behindHer.type === "house" && housePart(behindHer, gx, gy) === "door") {
    const at = playerPixelPos(), look = playerPose();
    if (isSolid(look.sprite, gx - Math.round(at.x), gy - (Math.round(at.y) - TILE - look.lift))) { walkToThing(behindHer, THINGS.door.name); return; }
  }

  const her = playerPixelPos(), pose = playerPose();
  if (!target && !player.hidden && isSolid(pose.sprite, gx - Math.round(her.x), gy - (Math.round(her.y) - TILE - pose.lift))) {
    showEmote("player", "sparkles");
    Sound.tap(760);
    const doll = Dolls.carried();
    if (doll) sayAt(dollText("tapped", doll), her.x + 8, her.y - TILE - 2);
    return;
  }

  if (scene.name === "room" && !target) {
    const doll = Dolls.at(gx, gy, minTap());
    if (doll) {
      Sound.tap(900);
      sayAt(dollText("tapped", doll.id), doll.x, doll.y);
      const bed = ["snuggled", "bed"].includes(Dolls.goingTo(doll.id)) && !player.hidden && WORLD.things.find((t) => t.type === "bed");
      if (bed) walkToThing(bed);
      return;
    }
  }

  const bird = WORLD.garden && !target && (Wildlife.birdAt(gx, gy, 0) || (!thingAt(gx, gy, true) && Wildlife.birdAt(gx, gy, minTap())));
  if (bird) {
    if (Story && Story.tapBird(bird)) return;
    Wildlife.greet(bird);
    magpieSays(bird.name);
    Husband.reached({ name: bird.name, footX: bird.x, footY: bird.y + 9 });          // (the one he's been staring at?)
    walkNear(bird);
    const doll = Dolls.carried();
    if (doll && Math.random() < 0.35) {
      const h = Wildlife.headTop(bird);
      setTimeout(() => UI.tinySay(dollText("greet", doll), gameToScreen(h.x, h.y)), 700);
    }
    return;
  }
  const flies = WORLD.garden && !target && CRITTERS && Daylight.nightAmount() < 0.5;
  const fly = flies && (CRITTERS.flyAt(gx, gy, performance.now() / 1000)
    || (!thingAt(gx, gy, true) && CRITTERS.flies.find((f) => Math.hypot(f.x - gx, f.y - gy) < Math.max(8, minTap() / 2))));
  if (fly) { magpieSays("butterfly"); Husband.reached({ name: "butterfly", footX: fly.x, footY: fly.y + 9 }); return; }

  if (Story && WORLD.garden && !target && Story.tapEffect(gx, gy)) return;

  const thing = target || thingAt(gx, gy);
  if (thing) {
    if (player.sitting && thing.wet) {
      thing.bounce = 0.4;
      Sound.tap(480);
      magpieSays(thing.name);
      return;
    }
    if (thing.type === "house") {
      const door = arrivalSpot("garden");
      const atDoor = Math.abs(player.nx - door.x) <= 1 && Math.abs(player.ny - door.y) <= 1 && !isMoving();
      const part = housePart(thing, gx, gy);
      if (part === "roof" && Story && Story.tapRoof(gx, gy)) { thing.bounce = 0.25; return; }
      if (part === "roof" && !atDoor) {
        walkToward({ x: door.x, y: door.y });
        player.interact = { type: "roof", name: THINGS.roof.name, bounce: 0 };
        player.faceAt = { x: door.x, y: door.y - 1 };
        thing.bounce = 0.25;
        return;
      }
      walkToThing(thing, part === "door" ? THINGS.door.name : null);
      return;
    }
    if (thing.type === "doormat") {
      player.interact = null; player.faceAt = null;
      walkToward(WORLD.door);
      return;
    }
    walkToThing(thing);
    return;
  }

  const tx = Math.max(0, Math.min(MAP_W - 1, Math.floor(gx / TILE))), ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(gy / TILE)));

  if (WORLD.isWater(tx, ty) && WORLD.river.at(gx / TILE, gy / TILE).d < 0) {
    const time = performance.now() / 1000;
    River.ripple(gx, gy, time);
    Sound.tap(420);
    const name = River.fishNear(gx, gy, time) ? THINGS.fish.name : THINGS.river.name;
    if (player.sitting) {
      if (name === THINGS.fish.name) showEmote("magpie", "exclaim");
      magpieSays(name);
      return;
    }
    if (name === THINGS.fish.name) { showEmote("magpie", "exclaim"); magpieSays(name); }
    const bank = nearestBankOnHerSide(tx, ty);
    walkToward(bank || { x: tx, y: ty });
    if (name !== THINGS.fish.name) player.interact = { name, bounce: 0, type: "river" };
    player.faceAt = { x: tx, y: ty };
    return;
  }
  player.interact = null;
  player.faceAt = isWalkable(tx, ty) ? null : { x: tx, y: ty };
  walkToward({ x: tx, y: ty });
  holdWalk = { id: pointerId, sx, sy, sx0: sx, sy0: sy, since: performance.now(), last: performance.now(), tile: `${tx},${ty}`, dragged: false };
}

function walkNear(bird) {
  const her = playerPixelPos(), fx = her.x + 8, fy = her.y + 14;
  const stop = (bird.shy ? 2.6 : 1.5) * TILE;
  const dx = bird.x - fx, dy = bird.y - fy, d = Math.hypot(dx, dy);
  if (d <= stop + TILE) return;
  const k = (d - stop) / d;
  let tx = Math.floor((fx + dx * k) / TILE), ty = Math.floor((fy + dy * k - 2) / TILE);
  if (!isWalkable(tx, ty) || hiddenBehind(tx, ty)) {
    const bx = bird.x / TILE, by = (bird.y - 2) / TILE, mine = bankSide(player.nx, player.ny);
    let best = null;
    for (let y = Math.floor(by) - 3; y <= Math.floor(by) + 3; y++) for (let x = Math.floor(bx) - 3; x <= Math.floor(bx) + 3; x++) {
      if (!isWalkable(x, y) || hiddenBehind(x, y) || bankSide(x, y) !== mine) continue;
      const reach = Math.hypot(x + 0.5 - bx, y + 0.9 - by) * TILE;
      if (reach < stop * 0.8) continue;
      const score = Math.abs(x - player.nx) + Math.abs(y - player.ny) + reach / TILE;
      if (!best || score < best.score) best = { x, y, score };
    }
    const bank = !best && WORLD.isWater(tx, ty) ? nearestBankOnHerSide(tx, ty) : null;
    if (best || bank) { tx = (best || bank).x; ty = (best || bank).y; }
  }
  player.interact = null;
  player.faceAt = { x: Math.floor(bird.x / TILE), y: Math.floor((bird.y - 2) / TILE) };
  walkToward({ x: tx, y: ty });
}

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

function sideIcon(el, source, points) {
  const dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round((points * dpr) / source.width));
  el.style.width = (source.width * k) / dpr + "px";
  el.style.height = (source.height * k) / dpr + "px";
}

let sideTapAt = 0;
const sideTapOk = () => { const now = performance.now(); if (now - sideTapAt < 700) return false; sideTapAt = now; return true; };

const husbandButton = document.getElementById("husband-button");
function sideIconCanvas(src, into = document.createElement("canvas")) {
  into.width = into.height = 20;
  const g = into.getContext("2d");
  g.clearRect(0, 0, 20, 20);
  g.drawImage(src, Math.floor((20 - src.width) / 2), Math.ceil((20 - src.height) / 2));
  into.className = "side-face";
  sideIcon(into, into, 34);
  return into;
}
husbandButton.prepend(sideIconCanvas(renderHusbandHead()));
husbandButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const kind = Husband.button();
  if (kind === "wait" || !sideTapOk()) return;
  if (kind === "call") Husband.call();
  else if (kind === "bye") Husband.bye();
  Sound.tap(700);
});
let husbandButtonKind = undefined;
const OVER_CARDS = ["doll-card", "sleep-card", "name-card", "day-card"].map((id) => document.getElementById(id)).filter(Boolean);
const cardOver = () => OVER_CARDS.some((el) => !el.classList.contains("hidden"));
function showHusbandButton() {
  const kind = cardOver() ? null : Husband.button();
  if (kind !== husbandButtonKind) {
    husbandButtonKind = kind;
    husbandButton.classList.toggle("hidden", !kind);
    husbandButton.classList.toggle("waiting", kind === "wait");
    if (kind) husbandButton.querySelector("span").textContent = kind === "call" ? UI_TEXT.callHusband : kind === "bye" ? UI_TEXT.byeForNow : "…";
  }
  const free = started && !changingPlace && !Closeup.isOpen() && !Sky.isOpen() && !(Speech && Speech.isOpen()) && !(Story && Story.busy()) && !player.hidden
    && !(Story && Story.inRoutine && Story.inRoutine()) && !cardOver();          // (our morning, our evening: they stay home)
  const visit = !free ? null : WORLD.small ? "home" : "visit";
  if (visit !== visitButtonKind) {
    visitButtonKind = visit;
    visitButton.classList.toggle("hidden", !visit);
    if (visit) {
      visitButton.querySelector("span").textContent = visit === "home" ? UI_TEXT.goHome : UI_TEXT.visitHusband;
      sideIconCanvas(visitIcons[visit], visitIcon);
    }
  }
  visitButton.classList.toggle("second", !!kind);
}
function showCornerButtons() {
  const playing = started && !(Title.isOpen && Title.isOpen()) && !cardOver();
  UI.showCornerButtons(playing, !Closeup.isOpen() && !Sky.isOpen() && !upCloseShown);
}
const visitButton = document.getElementById("visit-button");
const visitIcons = { visit: iconFromGrid(ICONS.observatory).toCanvas(), home: iconFromGrid(ICONS.cottage).toCanvas() };
const visitIcon = sideIconCanvas(visitIcons.visit);     // the observatory, or her cottage ("Go home")
visitButton.prepend(visitIcon);
let visitButtonKind = undefined;
visitButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!sideTapOk()) return;
  if (visitButtonKind === "visit") visitObservatory();
  else if (visitButtonKind === "home") goHome();
  Sound.tap(700);
});

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

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

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
  const normal = scaleFor(ZOOM_TILES.normal);
  scale = scaleFor(ZOOM_TILES[zoom] || ZOOM_TILES.normal);
  if (closeupShown || WORLD.indoors || WORLD.small || upCloseShown) scale = Math.max(scale, normal);
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

const cameraGoal = { x: null, y: null, lift: 0 };
function updateCamera(dt = 1) {
  const p = playerPixelPos();
  const mapPxW = MAP_W * TILE, mapPxH = MAP_H * TILE;
  const follow = (center, view, world) =>
    world <= view ? (world - view) / 2 : Math.max(0, Math.min(world - view, center - view / 2));
  const box = document.getElementById("speech");
  const talk = box && !box.classList.contains("hidden") ? (box.offsetHeight * (window.devicePixelRatio || 1)) / scale / 2 : 0;
  const gx = follow(p.x + TILE / 2, canvas.width, mapPxW);
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
  const clampTo = (v, view, world) => (world <= view ? (world - view) / 2 : Math.max(0, Math.min(world - view, v)));
  camera.x = Math.round(clampTo(Math.round(p.x) - Math.round(p.x - cameraGoal.x), canvas.width, mapPxW));
  camera.y = Math.round(clampTo(Math.round(p.y) - Math.round(p.y - cameraGoal.y - cameraGoal.lift), canvas.height, mapPxH + Math.max(2 * talk, cameraGoal.lift)));
}

function keepAboveBox(y) {
  const room = speechBoxTop() - 4 * CUE, top = 2;
  let lo = -Infinity, hi = Infinity;
  for (const [above, below] of inViewWhileTalking()) {
    const l = Math.max(lo, below - room), h = Math.min(hi, above - top);
    if (l <= h) { lo = l; hi = h; }
  }
  return Math.max(lo, Math.min(hi, y));
}

function speechBoxTop() {
  const box = document.getElementById("speech");
  if (!box || box.classList.contains("hidden")) return null;
  const r = canvas.getBoundingClientRect();
  return ((box.offsetTop - r.top) * canvas.height) / r.height;
}

function inViewWhileTalking() {
  const p = playerPixelPos(), spans = [[p.y - TILE - (playerPose().lift || 0) - 2, p.y + TILE]];
  const bubble = 17 * CUE + 4;                                        // (a thought bubble over a head)
  const near = (x, y) => Math.abs(x - (p.x + 8)) < canvas.width / 2 && Math.abs(y - (p.y + 8)) < canvas.height;
  const bubbles = WORLD.garden && Wildlife.thoughtBubbles ? Wildlife.thoughtBubbles() : [];
  const birdSpan = (b) => {
    const h = Wildlife.headTop(b), g = b.thought && bubbles.find((q) => q.birds.includes(b));
    return [g ? Math.min(g.box.y, h.y - 3) : h.y - (b.thought ? bubble : 3), b.y + 1];
  };
  const look = Story && Story.inView ? Story.inView() : { guides: [], birds: [], thought: false };
  const who = Speech.speaker();
  const birds = WORLD.garden ? Wildlife.all().filter((b) => !b.gone && !b.underwater && !b.flight && near(b.x, b.y)) : [];
  if (who === "magpie" && (companion.mode !== "away" || companion.flight)) {
    const b = companionBox();
    spans.push([(look.thought ? Math.min(b.y, companionHeadTop().y - bubble) : b.y) - 2, b.y + b.h]);
  } else if (who === "husband" && !["away", "atWork"].includes(Husband.state())) {
    const h = Husband.pos();
    spans.push([h.y - TILE - 2, h.y + TILE]);
  } else if (who && BIRDS[who]) {
    const kind = birds.filter((b) => b.species === who).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const story = kind.filter((b) => b.story);
    for (const b of story.length ? story : kind.slice(0, 1)) spans.push(birdSpan(b));
  }
  for (const g of look.guides) if (!!g.room === (scene.name === "room") && near(g.x, g.y)) spans.push([g.y - 14 * CUE, g.y]);   // (its sparkle, over it)
  const wanted = (b) => b.story && (b.thought || b.onTap || b.onReach || look.birds.includes(b.id));
  for (const b of birds) if (wanted(b)) spans.push(birdSpan(b));
  for (const b of birds) if (b.story && !wanted(b) && Math.hypot(b.x - (p.x + 8), b.y - (p.y + TILE)) < 6 * TILE) spans.push(birdSpan(b));
  return spans;
}

let currentPatch = -1;
let closeupSeen = !!saved.get("closeupSeen") || Number(PARAMS.get("day")) > 1;      // (?day=N: she saw it on Day 1)
function patchNear(x, y) {
  for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = WORLD.patchOf[(y + dy) * MAP_W + (x + dx)];
    if (p >= 0) return p;
  }
  return -1;
}
let pendingCloseup = null;   // opens by itself, once she's stopped and heard the name

let quickFading = false;
function quickFade(change) {
  if (quickFading) return;
  quickFading = true;
  const el = document.getElementById("fade");
  el.classList.remove("slow");
  el.classList.add("quick", "on");
  setTimeout(() => {
    change();
    el.classList.remove("on");
    setTimeout(() => { el.classList.remove("quick"); quickFading = false; }, 200);
  }, 180);
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
  const zoomedOut = scaleFor(ZOOM_TILES[zoom] || ZOOM_TILES.normal) < scaleFor(ZOOM_TILES.normal);
  if (!fade || !zoomedOut || !WORLD.garden || quickFading) change();
  else quickFade(change);
}

function openCloseup(patchIndex) {
  if (patchIndex < 0 && currentPatch < 0) return;
  pendingCloseup = null;
  quickFade(() => showCloseup(patchIndex));
}

function showCloseup(patchIndex) {
  closeupShown = true;
  resize();
  Closeup.open(patchIndex >= 0 ? patchIndex : currentPatch, canvas.width, canvas.height, Story ? Story.closeupOptions() : {});
  closeupSeen = true;
  if (!PARAMS.has("free")) saved.set("closeupSeen", true);       // (?free never writes her save)
  player.path = [];
  player.interact = null;
  tapMarker = null;
  UI.hideBubble();
  UI.showLook(null);
  UI.showBack(true);
}

let lookedPatch = -2;             // the patch she just looked at closely (no glass there until she leaves it)
function closeCloseup() {
  lookedPatch = currentPatch;
  quickFade(() => {
    Closeup.close();
    closeupShown = false;
    resize();
    cameraGoal.x = null;
    UI.hideBubble();
    UI.showBack(false);
  });
}

function update(dt, time) {
  updateEmotes(dt);
  Observatory.update(dt);
  Story.update(dt, time);
  for (const t of WORLD.things) {
    if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt);
    if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);           // (a bush rustling: js/wildlife.js)
  }

  if (Closeup.isOpen()) {
    Closeup.update(dt);
    UI.placeBubble(gameToScreen(...Object.values(Closeup.magpieHead()), false));
    showHusbandButton();
    showCornerButtons();
    return;
  }

  if (player.hop) { player.hop.t -= dt; if (player.hop.t <= 0) player.hop = null; }
  Player.update(dt);
  for (const p of tapPops) p.age += dt;
  tapPops = tapPops.filter((p) => p.age < 0.25);
  replayBusyTap();
  followHeldFinger();
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

  if (player.sitting && !player.fishMoment && player.still > 3) {
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
        magpieSays(THINGS.fish.name);
      }, 450);
    }
    player.fishMoment = true;
  }

  if (!isMoving()) {
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

    if (arrivedNow && WORLD.tile(player.nx, player.ny) === "D") {
      if (scene.name === "room") goTo("garden");
      else if (scene.name === "hill") goTo("dome");
      else if (scene.name === "dome") goTo("hill");
    }

    if (arrivedNow) currentPatch = WORLD.patchOf[player.ny * MAP_W + player.nx];
    const firstLook = !closeupSeen || (Story && Story.closeupOptions().star);
    if (firstLook && started && currentPatch >= 0 && !isMoving() && !player.path.length && !pendingCloseup) {
      pendingCloseup = { patch: currentPatch, at: time + (UI.bubbleShowing() ? 1.6 : 0.3) };
    }
  }
  if (pendingCloseup && time >= pendingCloseup.at) {
    if ((pendingCloseup.here || WORLD.patchOf[player.ny * MAP_W + player.nx] === pendingCloseup.patch) && !isMoving() && !player.path.length) openCloseup(pendingCloseup.patch);
    pendingCloseup = null;
    if (Closeup.isOpen()) return;
  }

  updateCompanion(dt);
  Husband.update(dt);
  const view = { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height };
  if (CRITTERS) CRITTERS.update(dt, time, view);
  if (WORLD.garden) Atmosphere.update(dt, time, view);
  if (WORLD.garden) River.update(dt, time, WORLD, view);
  Daylight.update(dt);
  Sky.update(dt);
  Sky.keepAbove(speechBoxTop());                 // (while the magpie talks under the sky, what it talks about stays above the box)
  if (Sky.isOpen() !== skyShown) { skyShown = Sky.isOpen(); resize(); cameraGoal.x = null; }
  Dolls.update(dt);
  if (WORLD.garden) Wildlife.update(dt, time);
  if (WORLD.garden && Daylight.phase() === "night" && time > nextOwlCall) {
    if (nextOwlCall > 0) Sound.owlCall();
    nextOwlCall = time + 9 + Math.random() * 9;
  }
  placeStarLabels();
  if (WORLD.garden && Daylight.nightAmount() > 0.3) Fireflies.update(dt, time, WORLD, view);

  if (tapMarker) {
    tapMarker.age += dt;
    if (tapMarker.age > 0.6 && !player.path.length && !isMoving()) tapMarker = null;
  }

  updateCamera(dt);

  const p = playerPixelPos();
  const patchHere = WORLD.patchOf[player.ny * MAP_W + player.nx];
  if (patchHere !== lookedPatch && !isMoving()) lookedPatch = -2;             // she left the patch she looked at
  const inPatch = patchHere >= 0 && patchHere !== lookedPatch && !isMoving() && closeupSeen && !player.sitting;
  const side = companion.x * TILE + 8 < p.x + 8 ? 1 : -1;
  showHusbandButton();
  showCornerButtons();
  const quiet = !UI.bubbleShowing() && !(Speech && Speech.isOpen()) && !(Story && Story.busy());
  UI.showLook(inPatch && started && quiet ? gameToScreen(p.x + 8 + side * 15, p.y - TILE + 2) : null);
  const anchor = bubbleAt && time < bubbleAt.until ? bubbleAt : companionHeadTop();
  const keepClear = anchor.avoid && (() => { const a = gameToScreen(anchor.avoid.x, anchor.avoid.y), b = gameToScreen(anchor.avoid.x + anchor.avoid.w, anchor.avoid.y + anchor.avoid.h); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, feet: gameToScreen(anchor.x, anchor.feet || anchor.y).y }; })();
  const feetY = anchor.feet !== undefined ? anchor.feet : anchor === bubbleAt ? null : companionFoot().y;
  UI.placeBubble(gameToScreen(anchor.x, anchor.y), herScreenBox(), anchor.lean, keepClear, feetY === null ? null : gameToScreen(anchor.x, feetY).y);
}

let bubbleAt = null;
function sayAt(text, x, y) {
  bubbleAt = { x, y, until: performance.now() / 1000 + 1.6 + text.split(" ").length * 0.4 };
  UI.say(text, { chirp: "plush", pitch: 900 }, "doll");
}

const SWAYING = ["flower", "tallGrass", "reeds", "willow"];

function thingSprite(t, frame) {
  if (t.type === "window") {
    const time = ["morning", "noon", "sunset", "night"].indexOf(Daylight.phase());
    return prop("window", (time < 0 ? 1 : time) + (t.variant & 4));     // (+4: the flower on the sill)
  }
  if (t.type === "house") return prop("house", houseVariant());
  if (t.type === "flower") {
    const f = renderFlower(t.species, t.color, t.variant);
    return { canvas: f.frames[frame], ax: 8, ay: f.h - 1 };
  }
  if (SWAYING.includes(t.type)) return prop(t.type, t.variant, frame);
  return prop(t.type, t.variant);
}

function swayFrame(t, time) {
  const speed = t.type === "willow" ? 0.9 : 1.7;
  let s = Math.sin(time * speed - t.footX * 0.035 + t.phase * 0.3);
  if (t.bounce > 0) s = Math.sin(t.bounce * 40);
  return s < -0.5 ? 0 : s > 0.5 ? 2 : 1;
}

function drawShadow(cx, cy, rx, ry) {
  ctx.fillStyle = shadowOf(groundColorAt(cx, cy));
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function groundColorAt(x, y) {
  x = Math.round(x); y = Math.round(y);
  for (const t of WORLD.things) {
    if (!t.flat) continue;
    const s = thingSprite(t, 1);
    const sx = x - (t.footX - s.ax), sy = y - (t.footY - s.ay);
    if (sx < 0 || sy < 0 || sx >= s.canvas.width || sy >= s.canvas.height) continue;
    const c = s.canvas;
    c._px = c._px || c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const i = (Math.floor(sy) * c.width + Math.floor(sx)) * 4;
    if (c._px[i + 3] > 0) return rgbToHex([c._px[i], c._px[i + 1], c._px[i + 2]]);
  }
  const px = GROUND_PIXELS.getImageData(x, y, 1, 1).data;
  return rgbToHex([px[0], px[1], px[2]]);
}

const PLAYER_SPRITES = renderPlayer();

let herBlinkAt = 0, herBlinkUntil = 0;
function playerPose() {
  const acting = Player.frame() || Quirks.herFrame();          // (an action, or one of their little moments: js/quirks.js)
  if (acting) return acting;
  const now = performance.now() / 1000;
  if (!isMoving() && now > herBlinkAt) { herBlinkUntil = now + 0.14; herBlinkAt = now + 3 + Math.random() * 3; }
  const blinking = !isMoving() && now < herBlinkUntil && PLAYER_SPRITES.blink;
  if (player.sitting) return { sprite: blinking ? PLAYER_SPRITES.blink.sit : PLAYER_SPRITES.sit, lift: 0 };
  const frames = PLAYER_SPRITES[player.facing];
  if (!isMoving()) return { sprite: (blinking && PLAYER_SPRITES.blink[player.facing]) || frames[0], lift: 0 };
  const stone = WORLD.tile(player.nx, player.ny) === "o" || WORLD.tile(player.tx, player.ty) === "o";
  const u = player.progress;
  if (stone) return { sprite: frames[1 + (player.steps % 2)], lift: Math.round(Math.sin(u * Math.PI) * 3) };
  return u < 0.5 ? { sprite: frames[1 + (player.steps % 2)], lift: 0 } : { sprite: frames[0], lift: 1 };
}

const heldIcons = {};
function drawPlayer() {
  if (player.hidden) return;
  const p = playerPixelPos();
  const pose = playerPose(), { sprite, lift } = pose;
  if (!player.sitting) drawShadow(p.x + 9, p.y + 16, 7, 2);
  const herTop = Math.round(p.y) - TILE, facing = pose.facing || (player.sitting ? "down" : player.facing);
  const bob = pose.facing ? lift + Math.max(-1, Math.min(1, Dolls.laggingLift() - lift)) : null;
  Dolls.drawOnHer(ctx, Math.round(p.x), herTop, facing, true, bob);
  Quirks.drawHair(ctx, Math.round(p.x), herTop - lift, facing, true, pose);        // (a flower he tucked behind her ear, on her far side)
  ctx.drawImage(sprite, Math.round(p.x) - (sprite.ox || 0), herTop - lift - (sprite.oy || 0));
  Dolls.drawOnHer(ctx, Math.round(p.x), herTop, facing, false, bob);
  Quirks.drawHair(ctx, Math.round(p.x), herTop - lift, facing, false, pose);
  const item = State && State.get().holding;
  if (Player.drawHeld(ctx, p, pose)) { /* (raised to drink, or tipped to pour) */ }
  else if (item && ICONS[item] && facing !== "up") {
    const icon = heldIcons[item] || (heldIcons[item] = iconFromGrid(ICONS[item]).toCanvas());
    const side = player.facing === "left" ? -5 : player.facing === "right" ? 5 : 0;
    ctx.drawImage(icon, Math.round(p.x + 8 + side - icon.width / 2), Math.round(p.y) - TILE + 21 - lift - Math.round(icon.height / 2));
  }
}

function drawThing(t, time) {
  const frame = SWAYING.includes(t.type) ? swayFrame(t, time) : 1;
  const s = thingSprite(t, frame);
  const lift = t.bounce > 0 ? Math.round(Math.sin((t.bounce / 0.4) * Math.PI) * 2) : 0;
  const shake = t.shake > 0 ? (Math.floor(t.shake * 22) % 2 ? 1 : -1) : 0;      // rustling: a pixel side to side
  ctx.drawImage(s.canvas, Math.round(t.footX - s.ax) + shake, Math.round(t.footY - s.ay) - lift);
}

const HER_POINTS = [[8, 6], [5, 10], [11, 10], [8, 14], [8, 19], [5, 21], [11, 21], [8, 25], [6, 28], [10, 28]];
function herHidden(inFront) {
  const p = playerPixelPos(), { lift } = playerPose();
  const x0 = Math.round(p.x), y0 = Math.round(p.y) - TILE - lift;
  const blockers = inFront.map((it) => it.thing).filter(Boolean);
  if (!blockers.length) return false;
  let hidden = 0;
  for (const [px, py] of HER_POINTS) {
    const x = x0 + px, y = y0 + py;
    if (blockers.some((t) => { const s = thingSprite(t, 1); return isSolid(s.canvas, x - (t.footX - s.ax), y - (t.footY - s.ay)); })) hidden++;
  }
  return hidden >= HER_POINTS.length * 0.4;
}

const outlineCache = new WeakMap();
function drawHerOutline() {
  const p = playerPixelPos(), { sprite, lift } = playerPose();
  let ring = outlineCache.get(sprite);
  if (!ring) {
    ring = document.createElement("canvas");
    ring.width = sprite.width; ring.height = sprite.height;
    const g = ring.getContext("2d");
    g.fillStyle = PALETTE.cream;
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if (!isSolid(sprite, x, y)) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isSolid(sprite, x + dx, y + dy));
        if (edge) g.fillRect(x, y, 1, 1);
      }
    }
    outlineCache.set(sprite, ring);
  }
  ctx.drawImage(ring, Math.round(p.x) - (sprite.ox || 0), Math.round(p.y) - TILE - lift - (sprite.oy || 0));
}

const starLabels = [];
const LABEL_SIDES = ["above", "below", "right", "left"];
const LABEL_ORIGIN = { above: "50% 100%", below: "50% 0", right: "0 50%", left: "100% 50%" };     // (it grows out of its star)
function placeStarLabels() {
  const spots = Sky.isOpen() ? Sky.labelSpots(canvas.width, canvas.height) : [];
  const avoid = placeSkyNames();                  // (the names first: the words keep clear of them)
  for (const id of ["sky-left", "sky-right", "menu-button", "back-button", "music-button"]) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    avoid.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const stars = spots.length ? Sky.visibleStars(canvas.width, canvas.height).map((s) => ({ ...gameToScreen(s.x, s.y, false), lit: s.lit })) : [];
  while (starLabels.length < spots.length) {
    const el = document.createElement("div");
    el.className = "star-label";
    document.getElementById("app").appendChild(el);
    starLabels.push(el);
  }
  starLabels.forEach((el, i) => {
    const s = spots[i];
    el.classList.toggle("hidden", !s);
    if (!s) return;
    const key = s.text + "|" + s.sub;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.dataset.side = "";
      el.textContent = s.text;
      if (s.sub) { const small = document.createElement("small"); small.textContent = s.sub; el.appendChild(small); }
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    }
    el.classList.toggle("unknown", !!s.unknown);
    const at = gameToScreen(s.sx, s.sy, false), gap = gameToScreen(s.sx, s.sy + s.r, false).y - at.y;
    if (at.x < -4 || at.x > window.innerWidth + 4) { el.classList.add("hidden"); return; }      // (its star is off the screen)
    const box = labelSpot(at, el.offsetWidth, el.offsetHeight, gap, stars, avoid, el.dataset.side);
    if (box.cost >= 100) { el.classList.add("hidden"); return; }          // (nowhere free: it doesn't cover a button or a name)
    el.dataset.side = box.side;
    el.style.left = `${Math.round(box.l)}px`;
    el.style.top = `${Math.round(box.t)}px`;
    el.style.transformOrigin = LABEL_ORIGIN[box.side];
    avoid.push(box);
  });
}
function labelSpot(at, w, h, gap, stars, avoid, was) {
  const safe = safeEdges();
  const minX = 8 + safe.left, maxX = window.innerWidth - 8 - safe.right, minY = 6 + safe.top, maxY = window.innerHeight - 6 - safe.bottom;
  const boxes = LABEL_SIDES.map((side) => {
    let l = side === "right" ? at.x + gap : side === "left" ? at.x - gap - w : at.x - w / 2;
    let t = side === "above" ? at.y - gap - h : side === "below" ? at.y + gap : at.y - h / 2;
    const l2 = Math.max(minX, Math.min(maxX - w, l)), t2 = Math.max(minY, Math.min(maxY - h, t));
    let cost = LABEL_SIDES.indexOf(side) + (l2 !== l || t2 !== t ? 0.5 : 0);
    l = l2; t = t2;
    const box = { l, t, r: l + w, b: t + h, side };
    if (w > maxX - minX || h > maxY - minY) cost += 1000;
    if (at.x > l - 4 && at.x < l + w + 4 && at.y > t - 4 && at.y < t + h + 4) cost += 50;         // (slid over its own star)
    for (const a of avoid) if (box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t) cost += 100;
    for (const s of stars) {
      if (Math.abs(s.x - at.x) < 1 && Math.abs(s.y - at.y) < 1) continue;          // (its own star)
      if (s.x > l - 6 && s.x < l + w + 6 && s.y > t - 6 && s.y < t + h + 6) cost += s.lit ? 20 : 4;
    }
    box.cost = cost;
    return box;
  });
  const kept = boxes.find((b) => b.side === was && b.cost < 20);
  const best = kept || boxes.reduce((a, b) => (b.cost < a.cost ? b : a));
  const dx = best.l < minX ? minX - best.l : best.r > maxX ? maxX - best.r : 0;
  const dy = best.t < minY ? minY - best.t : best.b > maxY ? maxY - best.b : 0;
  return { ...best, l: best.l + dx, r: best.r + dx, t: best.t + dy, b: best.b + dy };
}
function placeSkyNames() {
  const boxes = [];
  const names = Sky.isOpen() ? Sky.nameSpots(canvas.width, canvas.height) : [];
  while (nameLabels.length < names.length) {
    const el = document.createElement("button");
    el.className = "sky-name";
    const toSky = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * canvas.width, (e.clientY - r.top) / r.height * canvas.height]; };
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* (not a live pointer) */ }
      el._down = { x: e.clientX, y: e.clientY };
      Sky.press(...toSky(e), e.pointerId);
    });
    el.addEventListener("pointermove", (e) => { if (el._down) Sky.drag(...toSky(e), e.pointerId, (window.devicePixelRatio || 1) / scale); });
    el.addEventListener("pointerup", (e) => {
      const d = el._down;
      el._down = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) { Sky.release(...toSky(e), e.pointerId, 0, canvas.width, canvas.height); return; }
      Sky.cancelPress();
      Sky.openCard(el.dataset.id);
      Sound.tap(900);
    });
    document.getElementById("app").appendChild(el);
    nameLabels.push(el);
  }
  const avoid = [];
  for (const id of ["menu-button", "back-button", "music-button"]) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    avoid.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const pb = Sky.isOpen() && Sky.pairBox(canvas.width, canvas.height);
  const pair = pb && (() => { const a = gameToScreen(pb.x, pb.y, false), b = gameToScreen(pb.x + pb.w, pb.y + pb.h, false); return { l: a.x, t: a.y, r: b.x, b: b.y }; })();
  if (pair) { avoid.push(pair); boxes.push(pair); }
  const hits = (box) => avoid.some((a) => box.l < a.r && box.r > a.l && box.t < a.b && box.b > a.t);
  const skyStars = names.length ? Sky.visibleStars(canvas.width, canvas.height).map((s) => gameToScreen(s.x, s.y, false)) : [];
  const onStar = (b) => skyStars.some((s) => s.x > b.l - 6 && s.x < b.r + 6 && s.y > b.tapT - 6 && s.y < b.tapB + 6);
  nameLabels.forEach((el, i) => {
    const n = names[i];
    el.classList.toggle("hidden", !n);
    if (!n) return;
    if (el.dataset.id !== n.id) { el.dataset.id = n.id; el.textContent = n.text; }
    const w = el.offsetWidth, h = el.offsetHeight;
    const place = (x, y, above) => {
      const p = keepOnScreen({ x, y }, w, h, above), top = above ? p.y - h : p.y;
      return { x: p.x, y: p.y, above, l: p.x - w / 2, r: p.x + w / 2, t: above ? top + h - 24 : top, b: above ? top + h : top + 24, tapT: top, tapB: top + h };      // (t, b: its words, at the edge by its figure)
    };
    const beside = (x, y) => {
      const p = keepOnScreen({ x, y: y - h / 2 }, w, h, false);
      return { x: p.x, y: p.y, above: false, side: true, l: p.x - w / 2, r: p.x + w / 2, t: p.y + h / 2 - 12, b: p.y + h / 2 + 12, tapT: p.y, tapB: p.y + h };
    };
    const at = gameToScreen(n.x, n.y, false), alt = gameToScreen(n.x, n.altY, false);
    const tries = [place(at.x, at.y, n.above), place(alt.x, alt.y, !n.above)];
    for (const e of n.ends) { const p = gameToScreen(e.x, e.y, false), dx = w / 2 + 10; tries.push(beside(p.x - dx, p.y), beside(p.x + dx, p.y)); }
    const fig = { l: gameToScreen(n.box.l, 0, false).x, r: gameToScreen(n.box.r, 0, false).x };
    const near = (b) => b.l < fig.r + 12 && b.r > fig.l - 12;                   // (it still belongs to its figure)
    const ok = (b) => !hits(b) && !onStar(b) && near(b), was = tries[+el.dataset.pick];
    const moving = Sky.gliding();                   // (at rest, a name goes home to its own side when that's clear)
    const pick = (moving && was && el.dataset.for === n.id && ok(was) && was) || tries.find(ok);
    if (!pick) { el.classList.add("hidden"); el.dataset.pick = ""; return; }      // (nowhere by its figure: until the view moves)
    el.dataset.pick = tries.indexOf(pick);
    el.dataset.for = n.id;
    el.style.left = `${Math.round(pick.x)}px`;
    el.style.top = `${Math.round(pick.y)}px`;
    el.classList.toggle("above", !!pick.above);
    el.classList.toggle("side", !!pick.side);
    const box = { l: pick.l, t: pick.t, r: pick.r, b: pick.b };
    avoid.push(box);
    boxes.push(box);
  });
  const ed = Sky.isOpen() ? Sky.edges(canvas.width, canvas.height) : { left: false, right: false };
  const stars = ed.left || ed.right ? Sky.visibleStars(canvas.width, canvas.height).filter((s) => s.lit).map((s) => ({ ...gameToScreen(s.x, s.y, false), big: s.big })) : [];
  for (const [id, show] of [["sky-left", ed.left], ["sky-right", ed.right]]) {
    const el = document.getElementById(id);
    el.classList.toggle("hidden", !show);
    if (!show) continue;
    const icon = el.firstChild, dpr = window.devicePixelRatio || 1, k = Math.round(scale);          // (a doubled icon on the sky's pixel grid: a cue)
    if (icon && icon.dataset.k !== String(k)) { icon.dataset.k = k; icon.style.width = (icon.width * k) / dpr + "px"; icon.style.height = (icon.height * k) / dpr + "px"; }
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2;
    const clear = (f) => !stars.some((s) => Math.hypot(s.x - cx, s.y - window.innerHeight * f) < (s.big ? 48 : 44));
    const was = parseFloat(el.dataset.f) || 0.5;
    if (el.dataset.f && Sky.gliding()) continue;              // (it stays under her thumb while the sky glides from its tap)
    const f = clear(was) ? was : [0.5, 0.7, 0.3, 0.62, 0.38].find(clear) || was;
    if (f !== was || !el.dataset.f) { el.dataset.f = f; el.style.top = `${2 * Math.round((window.innerHeight * f) / 2)}px`; }       // (on an even point: the sky's grid)
  }
  return boxes;
}
const nameLabels = [];
function keepOnScreen(p, w, h, up) {
  const top = up ? p.y - h : p.y, corner = top < 64 ? 64 : 0, safe = safeEdges();
  const x = Math.max(w / 2 + 8 + corner, Math.min(window.innerWidth - w / 2 - 8 - corner, p.x));
  const y = up ? Math.max(h + safe.top, p.y) : Math.min(window.innerHeight - safe.bottom - h + 6, p.y);     // (clear of the home bar)
  return { x, y };
}
for (const [id, dir] of [["sky-left", -1], ["sky-right", 1]]) {
  const el = document.getElementById(id);
  el.textContent = "";
  const icon = iconFromGrid(dir < 0 ? ICONS.chevronLeft : ICONS.chevronRight, true).toCanvas();
  el.appendChild(icon);                       // (sized on the sky's pixel grid when it shows)
  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * canvas.width, sy = ((e.clientY - r.top) / r.height) * canvas.height;
    const reach = Math.max(8, minTap() / 2);
    const hit = Sky.starAt(sx, sy, reach, canvas.width, canvas.height);
    if (hit && (hit.lit || hit.real)) { Sky.tap(sx, sy, reach, canvas.width, canvas.height); return; }          // (not a faint dot)
    Sky.nudge(dir); Sound.tap(800);
  });
}

function drawHouseLights(amount) {
  const house = WORLD.things.find((t) => t.type === "house");
  if (!house) return;
  const s = thingSprite(house, 1);
  const ox = house.footX - s.ax, oy = house.footY - s.ay;    // the house drawing's corner
  ctx.globalAlpha = Math.min(1, amount);
  if (s.glow) ctx.drawImage(s.glow, ox, oy);
  ctx.globalAlpha = 1;
  for (const [x, y, w, h, r] of s.lights || []) Daylight.drawLight(ctx, ox + x + w / 2, oy + y + h / 2, r || 14, "butter", amount * 0.8);
}

function coveredBySomething(x, y, view) {
  for (const t of WORLD.things) {
    if (Math.abs(t.footX - x) > 40 || t.footY < y - 2 || t.footY - y > 70) continue;
    const s = thingSprite(t, 1);
    if (isSolid(s.canvas, x - (t.footX - s.ax), y - (t.footY - s.ay))) return true;
  }
  return false;
}

const emoteSprites = {};
const emoteSprite = (n) => emoteSprites[n + CUE] || (emoteSprites[n + CUE] = iconFromGrid(ICONS[n], CUE > 1).toCanvas());
const EMOTE_TIME = 1.8;      // seconds on screen
const EMOTE_TIMES = { heat: 3.2 };   // (so hot: the sweat beads and heat squiggles stay a while)
let emotes = [];             // { who: "player" | "magpie", name, age, life }

function showEmote(who, name) {
  emotes = emotes.filter((e) => e.who !== who);
  emotes.push({ who, name, age: 0, life: EMOTE_TIMES[name] || EMOTE_TIME });
}

function updateEmotes(dt) {
  emotes.forEach((e) => (e.age += dt));
  emotes = emotes.filter((e) => e.age < e.life);
}

function drawEmotes() {
  for (const e of emotes) {
    const icon = emoteSprite(e.name);
    let head;
    if (e.who === "magpie") head = companionHeadTop();
    else { const p = playerPixelPos(); head = { x: p.x + 8, y: p.y - TILE + 1 }; }
    const t = e.age;
    const lift = t < 0.12 ? 6 * (1 - t / 0.12) : t < 0.22 ? -2 * Math.sin(((t - 0.12) / 0.1) * Math.PI) : 0;
    if (t > e.life - 0.15 && Math.floor(t * 20) % 2) continue;
    const y = Math.round(head.y - icon.height - 1 + lift), room = y - camera.y;
    const dx = room < 1 ? Math.round(icon.width / 2 + 7) : 0;
    ctx.drawImage(icon, Math.round(head.x - icon.width / 2) + dx, room < 1 ? Math.round(camera.y + 1 + lift) : y);
  }
}

function drawActCues() {
  Player.drawCues(ctx);
  const c = companion;
  if (!(c.cues && c.cues.length) && !(c.cueQueue && c.cueQueue.length)) return;
  const s = companionSprite(), f = companionFoot(), X = (u) => (c.faceLeft ? f.x + s.footX - u : f.x - s.footX + u);
  Wildlife.drawCues(ctx, c, { mouth: { x: X(s.beakX), y: f.y - s.footY + s.beakY }, head: companionHeadTop() });
}

function drawTapMarker(time) {
  if (!tapMarker) return;
  const cx = tapMarker.x * TILE + 8, cy = tapMarker.y * TILE + 11;
  const r = (5 + Math.round(Math.sin(time * 6))) * CUE;
  for (const [rr, color] of [[r + 1, RAMPS.duskLavender[2]], [r, PALETTE.cream]]) {
    ctx.fillStyle = color;
    const n = 8 + rr * 3;
    for (let a = 0; a < n; a++) {
      const ang = (a / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr * 0.55), 1, 1);
    }
  }
}

function draw(time) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (Closeup.isOpen()) {
    Closeup.draw(ctx, time);
    return;
  }
  const skyShift = Math.round(Sky.amount() * canvas.height);
  if (skyShift < canvas.height) drawWorld(time, skyShift);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  Sky.draw(ctx, canvas.width, canvas.height, time);
  Observatory.drawTravel(ctx, canvas.width, canvas.height);
}

function drawMoonGlade(time) {
  const pool = (RIVER.pools || [])[0];
  if (!pool) return;
  const moon = typeof Moon !== "undefined" ? Moon.forDay(State.get().day) : { up: true, lit: 0.5 };
  if (!moon.up || moon.lit < 0.02) return;
  const n = Math.round(3 + 6 * Math.sqrt(moon.lit)), bright = moon.lit > 0.25 ? Math.round(1 + 3 * moon.lit) : 0;
  const cx = pool.x * TILE, cy = pool.y * TILE;
  for (let k = -n; k <= n; k++) {
    const y = Math.round(cy + k * 3);
    const w = Math.round(1 + Math.sqrt(moon.lit) * (1 + (1 - Math.abs(k) / (n + 1)) * 5) + Math.sin(time * 2 + k * 1.7) * 1.5);
    if (w < 1) continue;
    const x = Math.round(cx - w / 2 + Math.sin(time * 1.3 + k) * 1.2);
    if (WORLD.river.at(x / TILE, y / TILE).d > -0.5 || coveredBySomething(x, y)) continue;
    ctx.fillStyle = Math.abs(k) < bright ? PALETTE.cream : PALETTE.starlight;
    ctx.fillRect(x, y, w, 1);
  }
}

function marginWoods(view) {
  const out = [];
  if (view.x >= 0 && view.y >= 0 && view.x + view.w <= MAP_W * TILE && view.y + view.h <= MAP_H * TILE) return out;
  const x0 = Math.floor(view.x / TILE) - 2, x1 = Math.ceil((view.x + view.w) / TILE) + 2;
  const y0 = Math.floor(view.y / TILE) - 1, y1 = Math.ceil((view.y + view.h) / TILE) + 3;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) continue;             // inside the garden
      if ((((x + y) % 2) + 2) % 2) continue;
      const v = hash2(x, y, 43) < 0.3 ? 8 + Math.floor(hash2(x, y, 40) * 2) : 4 + Math.floor(hash2(x, y, 40) * 4);
      const s = prop("woodsTree", v);
      const fx = x * TILE + 8 + Math.round((hash2(x, y, 41) - 0.5) * 8), fy = y * TILE + 14 + Math.round((hash2(x, y, 42) - 0.5) * 6);
      out.push({ bottom: fy, draw: () => ctx.drawImage(s.canvas, fx - s.ax, fy - s.ay) });
    }
  }
  return out;
}

function drawWorld(time, skyShift = 0) {
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, -camera.x, -camera.y + skyShift);

  ctx.drawImage(GROUND, 0, 0);
  const view = { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height };
  if (WORLD.garden) { River.draw(ctx, WORLD, view, time, "water"); Atmosphere.drawUnder(ctx, time); }
  drawTapMarker(time);
  for (const t of WORLD.things) if (t.flat) drawThing(t, time);

  const items = [];
  for (const t of WORLD.things) {
    if (t.flat) continue;
    if (t.footX < view.x - 70 || t.footX > view.x + view.w + 70 || t.footY < view.y - 8 || t.footY > view.y + view.h + 80) continue;
    items.push({ bottom: t.footY, draw: () => drawThing(t, time), thing: t });
  }
  const p = playerPixelPos();
  const herItem = { bottom: player.sitting ? player.sitting.footY + 0.5 : p.y + TILE, draw: drawPlayer };
  items.push(herItem);
  items.push({ bottom: companionSortY(), draw: drawCompanion });
  items.push(...Husband.items());
  if (WORLD.indoors && companion.mode === "window" && !companion.flight) {
    const w = WORLD.things.find((t) => t.type === "window");
    if (w) { const ws = thingSprite(w, 1); items.push({ bottom: w.footY + 0.6, draw: () => { ctx.drawImage(ws.front, Math.round(w.footX - ws.ax), Math.round(w.footY - ws.ay)); drawCompanionCarry(); } }); }
  }
  if (WORLD.garden) items.push(...Wildlife.items(view), ...(Story ? Story.items() : []), ...marginWoods(view));
  else if (scene.name === "room") items.push(...Dolls.items());
  items.sort((a, b) => a.bottom - b.bottom).forEach((it) => it.draw());
  if (herHidden(items.slice(items.indexOf(herItem) + 1))) drawHerOutline();
  Player.drawOver(ctx, time);                   // (water pouring from her watering can)

  if (CRITTERS && Daylight.nightAmount() < 0.5) CRITTERS.draw(ctx, time);
  if (WORLD.garden && Daylight.nightAmount() < 0.5) Atmosphere.drawOver(ctx, time);
  if (Story && WORLD.garden) Story.drawWorld(ctx, time);

  Daylight.apply(ctx, view.x, view.y, view.w, view.h, !!WORLD.indoors, WORLD.alwaysNight ? (WORLD.indoors ? "redNight" : "night") : null);
  const night = WORLD.alwaysNight ? 1 : Daylight.nightAmount();
  if (WORLD.alwaysNight) Observatory.drawNight(ctx, view, time, (x, y) => coveredBySomething(x, y, view));
  else if (night > 0.01) {
    if (WORLD.garden) {
      River.draw(ctx, WORLD, view, time, "stars", (x, y) => coveredBySomething(x, y, view));
      drawHouseLights(night);
      Fireflies.draw(ctx, time, night);
      if (night > 0.9) drawMoonGlade(time);
    } else {
      const lamp = WORLD.things.find((t) => t.type === "nightstand");
      if (lamp) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(TILE, TILE, (MAP_W - 2) * TILE, (MAP_H - 2) * TILE);
        ctx.clip();
        Daylight.drawLight(ctx, lamp.footX, lamp.footY - 26, 26, "butter", night);
        ctx.restore();
      }
    }
  }
  drawEmotes();
  drawActCues();
  Husband.drawOverlay(ctx);
  if (WORLD.place === "dome" && !telescopeLooked && !(Speech && Speech.isOpen())) drawTelescopeSparkle(time);
  drawTapPops();                               // on top, so a tap on the woods or a roof still shows its ring
  if (WORLD.garden) Wildlife.drawOverlays(ctx, time);
  if (Story) Story.drawOverlay(ctx, time);
}

Backup.setup();
UI.setup({
  onMenu: () => Title.showMenu(),
  onBack: () => (Sky.isOpen() ? Sky.close() : closeCloseup()),
  onLookCloser: () => openCloseup(currentPatch),
  zoom: () => zoom,
  onZoom: setZoom,
});

if (Story && !PARAMS.has("free")) Story.prepare();

function startGame() {
  started = true;
  Sound.start();
  Sound.playMusic("day");
  if (Story && !PARAMS.has("free")) Story.start();
}

function hasProgress() {
  if (PARAMS.has("free")) return false;
  const s = State.get();
  return s.day > 1 || Object.keys(s.done).length > 0 || Object.keys(s.learned).length > 0;
}

function eraseProgress() {
  State.eraseProgress();
  State.reset();
  saved.set("closeupSeen", false);
  closeupSeen = false;
  if (Story && !PARAMS.has("free")) Story.prepare();
}

Title.setup({
  day: () => State.get().day,
  hasProgress,
  onUnlock: () => { Sound.start(); Backup.persist(); },       // (and ask the browser to keep her save for good)
  onTitleMusic: () => Sound.playMusic("night"),
  started: () => started,
  summary: () => ({ stars: Object.keys(State.get().learned).length, friends: State.get().friends || [] }),
  onContinue() {
    if (started) return;                             // (back from the menu: she just goes on)
    if (Intro && !Intro.seen() && !PARAMS.has("reset") && !PARAMS.has("free") && State.get().phase !== "night") Intro.play(startGame);
    else startGame();
  },
  storyNew: () => !!(Intro && !Intro.seen()),
  onNewGame() {
    if (started) {
      if (!PARAMS.has("free")) { State.eraseProgress(); State.reset(); saved.set("closeupSeen", false); }
      try { sessionStorage.setItem("starling.newGame", "1"); } catch (e) { /* private mode */ }     // (opened fresh, the story starts right away)
      location.href = location.pathname + (PARAMS.has("free") ? "?free" : "");
      return;
    }
    if (!PARAMS.has("free")) eraseProgress();
    if (Intro && !((PARAMS.has("reset") || PARAMS.has("free")) && !PARAMS.has("intro"))) Intro.play(startGame);
    else startGame();
  },
  onStory: Intro ? () => { Title.hide(); Intro.play(() => Title.reopen()); } : null,
  onSettings: () => UI.openSettings(),
  onBackToTitle() {
    State.save();
    Title.reopen();          // the game waits underneath; Continue goes on where she was
  },
});
try {
  if (sessionStorage.getItem("starling.newGame")) {
    sessionStorage.removeItem("starling.newGame");
    Title.hide();
    if (Intro) Intro.play(startGame); else startGame();
  }
} catch (e) { /* private mode */ }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (Title.isOpen() || (Intro && Intro.isOpen())) { requestAnimationFrame(frame); return; }     // they draw their own skies
  update(dt, now / 1000);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.STARLING_DEBUG = {
  locate() {
    const dpr = window.devicePixelRatio || 1;
    const pt = (x, y, inWorld = true) => {
      const s = gameToScreen(x, y, inWorld);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    };
    const out = {
      zoom,
      tilePoints: +(TILE * scale / dpr).toFixed(1),
      smallestTapPoints: Math.round(Math.max(TILE, minTap()) * scale / dpr),
      tilesTall: +(canvas.height / TILE).toFixed(2),
      tilesWide: +(canvas.width / TILE).toFixed(2),
      devicePixelsPerGamePixel: scale,
      started,
      closeup: Closeup.isOpen(),
    };
    out.story = Story.debug();
    if (Closeup.isOpen()) {
      out.targets = Closeup.targets().map((t) => ({ name: t.name, ...pt(t.x, t.y, false) }));
      return out;
    }
    const p = playerPixelPos();
    out.player = { ...pt(p.x + 8, p.y), tile: [player.nx, player.ny], facing: player.facing, moving: isMoving(),
      inPatch: currentPatch, sitting: !!player.sitting, onTile: WORLD.tile(player.nx, player.ny) };
    const mb = companionBox();
    out.magpie = { ...pt(mb.x + mb.w / 2, mb.y + mb.h / 2), tile: [companion.x, companion.y] };
    const seen = {};
    for (const t of WORLD.things) {
      if (!t.tappable) continue;
      const b = thingBox(t), c = pt(b.x + b.w / 2, b.y + b.h / 2);
      if (c.x < 0 || c.y < 0 || c.x > window.innerWidth || c.y > window.innerHeight) continue;
      const d = Math.hypot(c.x - out.player.x, c.y - out.player.y);
      if (!seen[t.name] || d < seen[t.name].d) seen[t.name] = { ...c, d: Math.round(d) };
    }
    out.things = seen;
    const look = document.getElementById("look-button");
    if (!look.classList.contains("hidden")) {
      const r = look.getBoundingClientRect();
      out.lookButton = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    out.emotes = emotes.map((e) => `${e.who}: ${e.name}`);
    out.scene = scene.name;
    out.story = Story.debug();
    out.birds = {};
    if (!WORLD.indoors) {
      for (const b of Wildlife.all()) {
        if (b.gone || b.underwater) continue;
        const h = Wildlife.headTop(b), c = pt(h.x, (h.y + b.y) / 2);
        if (c.x < 0 || c.y < 0 || c.x > window.innerWidth || c.y > window.innerHeight) continue;
        const d = Math.hypot(c.x - out.player.x, c.y - out.player.y);
        const key = b.id.replace(/-\d+$/, "");
        const cur = out.birds[key], story = !!b.story;
        if (!cur || (story && !cur.story) || (story === !!cur.story && d < cur.d)) out.birds[key] = { ...c, d: Math.round(d), name: b.name, story };
      }
    }
    const box = document.getElementById("speech");
    if (!box.classList.contains("hidden")) {
      const r = box.getBoundingClientRect();
      out.speech = {
        who: document.getElementById("speech-name").textContent, text: document.getElementById("speech-text").textContent,
        x: Math.round(r.right - 22), y: Math.round(r.bottom - 18),
        replies: [...document.querySelectorAll(".reply")].map((b) => { const q = b.getBoundingClientRect(); return { text: b.textContent, x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; }),
      };
    }
    if (!document.getElementById("name-card").classList.contains("hidden")) {
      const q = document.getElementById("name-ok").getBoundingClientRect();
      out.nameCard = { ok: { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) },
        choices: [...document.querySelectorAll("#name-choices button")].map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }) };
    }
    const bubble = document.getElementById("bubble");
    out.bubble = bubble.classList.contains("hidden") ? null : bubble.textContent;
    return out;
  },
  walkTo(x, y) { walkToward({ x, y }); },
  teleport(x, y, place = "garden") { if (scene.name !== place) { useScene(place); resize(); } player.hidden = false; player.tx = player.nx = x; player.ty = player.ny = y; player.progress = 1; player.path = []; standUp(); cameraGoal.x = null; },
};
