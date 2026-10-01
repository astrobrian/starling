
const TILE = 16;

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

let changingPlace = false;

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

function thingKind(type, world = SCENES.garden.world) {
  return (world.indoors ? ROOM_THINGS[type] : THINGS[type]) || THINGS[type] || ROOM_THINGS[type];
}
function addThing(o, world = SCENES.garden.world) {
  const kind = thingKind(o.type, world);
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
  if (companion.mode === "follow" || companion.flight) Magpie.at("follow");
  else if (companion.mode === "window" || companion.mode === "head") Magpie.at(companion.mode === "head" ? "head" : "away");
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

function throughTheDoor(arrivedNow) {
  if (!arrivedNow || WORLD.tile(player.nx, player.ny) !== "D") return;
  if (scene.name === "room") goTo("garden");
  else if (scene.name === "hill") goTo("dome");
  else if (scene.name === "dome") goTo("hill");
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

function intoAPatch(arrivedNow, time) {
  if (arrivedNow) currentPatch = WORLD.patchOf[player.ny * MAP_W + player.nx];
  const firstLook = !closeupSeen || (Story && Story.closeupOptions().star);
  if (firstLook && started && currentPatch >= 0 && !isMoving() && !player.path.length && !pendingCloseup) {
    pendingCloseup = { patch: currentPatch, at: time + (UI.bubbleShowing() ? 1.6 : 0.3) };
  }
}

function openPendingCloseup(time) {
  if (!pendingCloseup || time < pendingCloseup.at) return false;
  if ((pendingCloseup.here || WORLD.patchOf[player.ny * MAP_W + player.nx] === pendingCloseup.patch) && !isMoving() && !player.path.length) openCloseup(pendingCloseup.patch);
  pendingCloseup = null;
  return Closeup.isOpen();
}

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

function showLookButton() {
  const p = playerPixelPos();
  const patchHere = WORLD.patchOf[player.ny * MAP_W + player.nx];
  if (patchHere !== lookedPatch && !isMoving()) lookedPatch = -2;             // she left the patch she looked at
  const inPatch = patchHere >= 0 && patchHere !== lookedPatch && !isMoving() && closeupSeen && !player.sitting;
  const quiet = !UI.bubbleShowing() && !(Speech && Speech.isOpen()) && !(Story && Story.busy()) && !Quirks.playing();
  if (!(inPatch && started && quiet)) { UI.showLook(null); return; }
  const away = companion.x * TILE + 8 < p.x + 8 ? 1 : -1;
  const spot = (side) => gameToScreen(p.x + 8 + side * 15, p.y - TILE + 2);
  const underAButton = (q) => buttonRects().some((b) => q.x + 26 > b.left && q.x - 22 < b.right && q.y + 4 > b.top && q.y - 44 < b.bottom);
  UI.showLook([away, -away].map(spot).find((q) => !underAButton(q)) || spot(away));
}
