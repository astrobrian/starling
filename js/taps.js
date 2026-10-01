

const TAP_POINTS = 44;       // the smallest tap area, in points, at any zoom

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
  const waited = !!(Story && Story.wants(thing));
  const nameIt = () => {
    if (Story && (Story.busy() || (Speech && Speech.isOpen()) || (waited && !Story.wants(thing)))) return;
    if (WORLD.indoors && companion.mode === "away" && !companion.flight) {
      if (name) sayAt(name, thing.footX, thing.footY - thingSprite(thing, 1).ay - 2);
    } else Magpie.says(name);
  };
  if (waited) setTimeout(nameIt, 0); else nameIt();
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

let tapMarker = null;
let lastTapped = null;       // the thing she last walked over to

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

  const cue = Cues.edgeAt(sx, sy, minTap());
  if (cue) { followCue(cue.g); return; }

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
    Magpie.tapped();
    return;
  }

  if (target) { tapThing(target, gx, gy); return; }

  if (Husband.at(gx, gy, minTap())) { Husband.tap(); return; }

  const behindHer = WORLD.garden && !player.hidden && thingAt(gx, gy, true);
  if (behindHer && behindHer.type === "house" && housePart(behindHer, gx, gy) === "door") {
    const at = playerPixelPos(), look = playerPose();
    if (isSolid(look.sprite, gx - Math.round(at.x), gy - (Math.round(at.y) - TILE - look.lift))) { walkToThing(behindHer, THINGS.door.name); return; }
  }

  const her = playerPixelPos(), pose = playerPose();
  if (!player.hidden && isSolid(pose.sprite, gx - Math.round(her.x), gy - (Math.round(her.y) - TILE - pose.lift))) {
    showEmote("player", "sparkles");
    Sound.tap(760);
    const doll = Dolls.carried();
    if (doll) sayAt(dollText("tapped", doll), her.x + 8, her.y - TILE - 2);
    return;
  }

  if (scene.name === "room") {
    const doll = Dolls.at(gx, gy, minTap());
    if (doll) {
      Sound.tap(900);
      sayAt(dollText("tapped", doll.id), doll.x, doll.y);
      const bed = ["snuggled", "bed"].includes(Dolls.goingTo(doll.id)) && !player.hidden && WORLD.things.find((t) => t.type === "bed");
      if (bed) walkToThing(bed);
      return;
    }
  }

  const bird = WORLD.garden && (Wildlife.birdAt(gx, gy, 0) || (!thingAt(gx, gy, true) && Wildlife.birdAt(gx, gy, minTap())));
  if (bird) {
    if (Story && Story.tapBird(bird)) return;
    Wildlife.greet(bird);
    sayName(bird.name, Wildlife.headTop(bird));
    Husband.reached({ name: bird.name, footX: bird.x, footY: bird.y + 9 });          // (the one he's been staring at?)
    walkNear(bird);
    const doll = Dolls.carried();
    if (doll && Math.random() < 0.35) {
      const h = Wildlife.headTop(bird);
      setTimeout(() => UI.tinySay(dollText("greet", doll), gameToScreen(h.x, h.y)), 700);
    }
    return;
  }
  const flies = WORLD.garden && CRITTERS && Daylight.nightAmount() < 0.5;
  const fly = flies && (CRITTERS.flyAt(gx, gy, performance.now() / 1000)
    || (!thingAt(gx, gy, true) && CRITTERS.flies.find((f) => Math.hypot(f.x - gx, f.y - gy) < Math.max(8, minTap() / 2))));
  if (fly) {
    sayName("butterfly", fly);
    Husband.reached({ name: "butterfly", footX: fly.x, footY: fly.y + 9 });
    walkNear({ x: fly.x, y: fly.y + 14 });                 // (over the flower it visits: the flower's foot)
    return;
  }

  if (Story && WORLD.garden && Story.tapEffect(gx, gy)) return;

  const thing = thingAt(gx, gy);
  if (thing) { tapThing(thing, gx, gy); return; }

  const tx = Math.max(0, Math.min(MAP_W - 1, Math.floor(gx / TILE))), ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(gy / TILE)));

  if (WORLD.isWater(tx, ty) && WORLD.river.at(gx / TILE, gy / TILE).d < 0) {
    const time = performance.now() / 1000;
    River.ripple(gx, gy, time);
    Sound.tap(420);
    const name = River.fishNear(gx, gy, time) ? THINGS.fish.name : THINGS.river.name;
    if (player.sitting) {
      if (name === THINGS.fish.name) showEmote("magpie", "exclaim");
      Magpie.says(name);
      return;
    }
    if (name === THINGS.fish.name) { showEmote("magpie", "exclaim"); Magpie.says(name); }
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

function tapThing(thing, gx, gy) {
  if (player.sitting && thing.wet) {
    thing.bounce = 0.4;
    Sound.tap(480);
    Magpie.says(thing.name);
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
}

function sayName(name, at) {
  if (Magpie.says(name)) return;
  const doll = Dolls.carried(), her = playerPixelPos();
  if (doll) sayAt(name, her.x + 8, her.y - TILE - 2);
  else UI.tinySay(name, gameToScreen(at.x, at.y));
}

function followCue(g) {
  const bird = WORLD.garden && g.bottom !== undefined && Wildlife.all().find((b) => !b.gone && !b.flight && Math.abs(b.x - g.x) < 4 && Math.abs(b.y - g.bottom) < 4);
  if (bird) {
    if (!(Story && Story.tapBird(bird))) walkNear(bird);
    return;
  }
  player.interact = null;
  player.faceAt = null;
  walkToward(g.walk || { x: Math.floor(g.x / TILE), y: Math.floor(g.y / TILE) });
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
