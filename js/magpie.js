

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
  endFlight(false);
  c.flight = { from, to: { x, y }, t: 0, dur: Math.min(1.6, 0.45 + dist / 160), mode, sortY };
  c.faceLeft = x < from.x;
  c.pecking = false;
  return new Promise((ok) => { c.flight.landed = ok; });
}
function endFlight(landed) {
  const f = companion.flight;
  companion.flight = null;
  if (f && f.landed) f.landed(landed);
}

function magpieAt(mode, x = 0, y = 0, sortY = null) {
  const c = companion;
  if (c.act) magpieAct(null);
  endFlight(false);
  c.mode = mode; c.px = x; c.py = y; c.sortY = sortY; c.pecking = false;
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
      c.mode = f.mode; c.px = f.to.x; c.py = f.to.y; c.sortY = f.sortY;
      endFlight(true);
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

let bubbleAt = null;
function sayAt(text, x, y) {
  bubbleAt = { x, y, until: performance.now() / 1000 + 1.6 + text.split(" ").length * 0.4 };
  UI.say(text, { chirp: "plush", pitch: 900 }, "doll");
}

let sceneWasPlaying = false;
function placeTheBubble(time) {
  const playing = !!(Story && Story.busy());
  if (playing && !sceneWasPlaying && UI.bubbleShowing() && UI.bubbleAnchor() === "magpie") UI.hideBubble();
  sceneWasPlaying = playing;
  const anchor = bubbleAt && time < bubbleAt.until ? bubbleAt : companionHeadTop();
  const keepClear = anchor.avoid && (() => { const a = gameToScreen(anchor.avoid.x, anchor.avoid.y), b = gameToScreen(anchor.avoid.x + anchor.avoid.w, anchor.avoid.y + anchor.avoid.h); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, feet: gameToScreen(anchor.x, anchor.feet || anchor.y).y }; })();
  const feetY = anchor.feet !== undefined ? anchor.feet : anchor === bubbleAt ? null : companionFoot().y;
  UI.placeBubble(gameToScreen(anchor.x, anchor.y), herScreenBox(), anchor.lean, keepClear, feetY === null ? null : gameToScreen(anchor.x, feetY).y);
}

function magpieSays(text) {
  if (!text || (companion.mode === "away" && !companion.flight)) return false;
  const h = companionHeadTop();
  if (!Closeup.isOpen() && (h.x < camera.x || h.x > camera.x + canvas.width || h.y < camera.y || h.y > camera.y + canvas.height + 8)) return false;
  bubbleAt = null;
  if (Story && !Story.understands()) text = "♪ ♪";
  UI.say(text, MAGPIE_VOICE, "magpie");
  return true;
}

const Magpie = {
  flyTo: magpieFlyTo,          // (mode, x, y, sortY): "follow", "head", "perch", "window", "away"; a promise: landed
  at: magpieAt,                // the same, there at once
  act: magpieAct,              // (name, seconds): sing, dance, jump, flap, fan, pant, shake, bathe, look...; null stops
  says: magpieSays,            // a word or a name in its speech bubble (false: it can't be seen)
  joy() { companion.joy = 0.35; },                                   // a happy hop
  face(left) { companion.faceLeft = !!left; },
  faceToward(x) { const f = companionFoot(); if (Math.abs(x - f.x) > 2) companion.faceLeft = x < f.x; },
  pecking(on) { companion.pecking = !!on; },                         // tapping at her window, pecking at a fruit
  carry(item) { companion.carry = item || null; },                    // in its beak: "flower", "persimmon", an icon; null
  from(x, y) { companion.mode = "perch"; companion.px = x; companion.py = y; },
  away() { companion.mode = "away"; endFlight(false); },
  awayAt(x, y) { companion.px = x; companion.py = y; },
  tapped() {
    companion.joy = 0.35;
    showEmote("magpie", ["heart", "sparkles", "heart", "exclaim"][companion.taps++ % 4]);
    Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
  },
};

