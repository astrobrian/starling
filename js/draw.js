
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

function drawThing(t, time) {
  const frame = SWAYING.includes(t.type) ? swayFrame(t, time) : 1;
  const s = thingSprite(t, frame);
  const lift = t.bounce > 0 ? Math.round(Math.sin((t.bounce / 0.4) * Math.PI) * 2) : 0;
  const shake = t.shake > 0 ? (Math.floor(t.shake * 22) % 2 ? 1 : -1) : 0;      // rustling: a pixel side to side
  ctx.drawImage(s.canvas, Math.round(t.footX - s.ax) + shake, Math.round(t.footY - s.ay) - lift);
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
  const moon = Moon.forDay(State.get().day);
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
  if (WORLD.garden) items.push(...Wildlife.items(view), ...Effects.items(), ...marginWoods(view));
  else if (scene.name === "room") items.push(...Dolls.items());
  items.sort((a, b) => a.bottom - b.bottom).forEach((it) => it.draw());
  if (herHidden(items.slice(items.indexOf(herItem) + 1))) drawHerOutline();
  Player.drawOver(ctx, time);                   // (water pouring from her watering can)

  if (CRITTERS && Daylight.nightAmount() < 0.5) CRITTERS.draw(ctx, time);
  if (WORLD.garden && Daylight.nightAmount() < 0.5) Atmosphere.drawOver(ctx, time);
  if (WORLD.garden) Effects.drawWorld(ctx, time);

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
  if (night > 0.5 && companion.carry && !(companion.mode === "away" && !companion.flight)) {
    const f = companionFoot();
    drawInBeak(ctx, companion.carry, f.x, f.y, companion.faceLeft, companionPose(), BIRDS.magpie, { night: true });
  }
  drawEmotes();
  drawActCues();
  Husband.drawOverlay(ctx);
  if (WORLD.place === "dome" && !telescopeLooked && !(Speech && Speech.isOpen())) drawTelescopeSparkle(time);
  drawTapPops();                               // on top, so a tap on the woods or a roof still shows its ring
  if (WORLD.garden) Wildlife.drawOverlays(ctx, time);
  if (Story) Story.drawOverlay(ctx, time);
}
