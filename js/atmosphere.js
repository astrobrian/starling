
const Atmosphere = (() => {
  let motes = [], fluff = [], leaves = [], flies = [], fish = [], leafTimer = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inWater = (x, y, m = 0.4) => WORLD.river && WORLD.river.at(x / TILE, y / TILE).d < -m;
  const inView = (t, view, below = 20) => t.footX > view.x && t.footX < view.x + view.w && t.footY > view.y && t.footY < view.y + view.h + below;

  function dragonflySprite(frame) {
    const b = new PixelBuffer(10, 7);
    b.rect(1, 3, 6, 1, "coral", { flat: true });
    b.set(1, 3, RAMPS.coral[2]);
    b.set(6, 3, RAMPS.coral[2]);
    for (const y of [2, 4]) { b.set(7, y, RAMPS.coral[3]); b.set(8, y, RAMPS.coral[3]); }
    b.set(7, 3, "coral"); b.set(8, 3, RAMPS.coral[0]);
    const out = outline(b);
    const len = frame === 0 ? 3 : 2;
    for (const x of [5, 7]) for (let i = 0; i < len; i++) { out.set(x, 3 - i, "snow"); out.set(x, 5 + i, "snow"); }
    return out.toCanvas();
  }
  let dragonfly = null;

  function update(dt, time, view) {
    const phase = Daylight.phase(), day = phase === "morning" || phase === "noon";

    const flowers = WORLD.things.filter((t) => t.type === "flower" && inView(t, view));
    if (day && motes.length < 16 && flowers.length) {
      const f = flowers[Math.floor(Math.random() * flowers.length)];
      motes.push({ x: f.footX + rnd(-6, 6), y: f.footY - rnd(8, 18), age: 0, life: rnd(3, 6), s: Math.random() * 6 });
    }
    for (const m of motes) { m.age += dt; m.y -= 3 * dt; m.x += Math.sin(m.age * 1.7 + m.s) * 3 * dt + 1.2 * dt; }
    motes = motes.filter((m) => m.age < m.life);

    if (day && fluff.length < 3) fluff.push({ x: view.x - 10, y: view.y + rnd(20, view.h - 20), age: 0, s: Math.random() * 6 });
    for (const f of fluff) { f.age += dt; f.x += 9 * dt; f.y += Math.sin(f.age * 1.3 + f.s) * 5 * dt; }
    fluff = fluff.filter((f) => f.x < view.x + view.w + 10 && f.x > view.x - 40);

    leafTimer -= dt;
    const trees = WORLD.things.filter((t) => ["bigTree", "persimmonTree", "woodsTree"].includes(t.type) && (t.type !== "woodsTree" || t.variant % 16 < 4) &&
      t.footX > view.x - 20 && t.footX < view.x + view.w + 20 && t.footY > view.y && t.footY < view.y + view.h + 60);
    if (leafTimer <= 0 && trees.length) {
      leafTimer = rnd(0.8, 2);
      const t = trees[Math.floor(Math.random() * trees.length)], s = prop(t.type, t.variant);
      leaves.push({
        x: t.footX + rnd(-s.canvas.width * 0.35, s.canvas.width * 0.35), y: t.footY - s.canvas.height * rnd(0.3, 0.6), ground: t.footY + rnd(-4, 10),
        color: t.type === "persimmonTree" || Math.random() < 0.3 ? "leafGold" : "leaf", age: 0, rest: 0, s: Math.random() * 6,
      });
    }
    for (const l of leaves) {
      l.age += dt;
      if (l.y < l.ground) { l.y += 7 * dt; l.x += Math.sin(l.age * 3 + l.s) * 7 * dt; } else l.rest += dt;
    }
    leaves = leaves.filter((l) => l.rest < 5);

    if (day && !flies.length) for (let i = 0; i < 3; i++) flies.push({ x: 0, y: 0, tx: 0, ty: 0, wait: 0, placed: false });
    if (!day) flies = [];
    for (const f of flies) {
      if (!f.placed || Math.abs(f.x - (view.x + view.w / 2)) > view.w || Math.abs(f.y - (view.y + view.h / 2)) > view.h) {
        f.placed = false;
        for (let k = 0; k < 20; k++) {
          const x = view.x + rnd(0, view.w), y = view.y + rnd(0, view.h);
          if (inWater(x, y, 0.2)) { f.x = f.tx = x; f.y = f.ty = y; f.placed = true; break; }
        }
      }
      f.wait -= dt;
      if (f.wait <= 0) {
        for (let k = 0; k < 10; k++) {
          const x = f.x + rnd(-30, 30), y = f.y + rnd(-18, 18);
          if (inWater(x, y, 0.1)) { f.tx = x; f.ty = y; break; }
        }
        f.wait = rnd(0.8, 2.4);
      }
      f.x += (f.tx - f.x) * Math.min(1, dt * 7);
      f.y += (f.ty - f.y) * Math.min(1, dt * 7);
    }

    if (!fish.length) for (let i = 0; i < 4; i++) fish.push({ x: 0, y: 0, a: Math.random() * 6, placed: false });
    for (const f of fish) {
      if (!f.placed || Math.abs(f.x - (view.x + view.w / 2)) > view.w * 1.2 || Math.abs(f.y - (view.y + view.h / 2)) > view.h * 1.2) {
        f.placed = false;
        for (let k = 0; k < 30; k++) {
          const x = view.x + rnd(0, view.w), y = view.y + rnd(0, view.h);
          if (inWater(x, y, 1.1)) { f.x = x; f.y = y; f.placed = true; break; }
        }
      }
      f.a += Math.sin(time * 0.3 + f.x) * 0.4 * dt;
      const nx = f.x + Math.cos(f.a) * 4 * dt, ny = f.y + Math.sin(f.a) * 2 * dt;
      if (inWater(nx, ny, 0.9)) { f.x = nx; f.y = ny; } else f.a += Math.PI * 0.6;
    }
  }

  function drawUnder(ctx, time) {
    for (const f of fish) if (f.placed) drawFish(ctx, Math.round(f.x), Math.round(f.y), Math.cos(f.a) > 0 ? 1 : -1, Math.floor(time * 4) % 2);
  }

  function drawOver(ctx, time) {
    for (const l of leaves) {
      if (l.rest > 4 && Math.floor(l.rest * 10) % 2) continue;
      drawLeaf(ctx, Math.round(l.x), Math.round(l.y), l.color, l.rest > 0 ? 0 : Math.floor(l.age * 5 + l.s) % 2);
    }
    for (const f of fluff) drawFluff(ctx, Math.round(f.x), Math.round(f.y));
    if (!dragonfly) dragonfly = [dragonflySprite(0), dragonflySprite(1)];
    for (const f of flies) {
      if (!f.placed) continue;
      const s = dragonfly[Math.floor(time * 20) % 2];
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(f.y - 6));
      if (f.tx < f.x) ctx.scale(-1, 1);
      ctx.drawImage(s, -6, -4);
      ctx.restore();
    }
    for (const m of motes) {
      if (m.age > m.life - 1 && Math.floor(m.age * 8) % 2) continue;
      ctx.fillStyle = Math.floor(m.age * 3 + m.s) % 2 ? PALETTE.cream : PALETTE.starlight;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
  }

  function drawFish(ctx, x, y, dir, flick) {
    ctx.fillStyle = RAMPS.pond[3];
    ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x - 1, y + 1, 3, 1);
    ctx.fillRect(x - 3 * dir, y - flick, 1, 1);
  }

  function drawLeaf(ctx, x, y, color, flip) {
    const R = RAMPS[color];
    ctx.fillStyle = R[1]; ctx.fillRect(x, y, flip ? 1 : 2, flip ? 2 : 1);
    ctx.fillStyle = R[2]; ctx.fillRect(x + (flip ? 0 : 1), y + (flip ? 1 : 0), 1, 1);
  }

  function drawFluff(ctx, x, y) {
    ctx.fillStyle = RAMPS.cream[0]; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1);
    ctx.fillStyle = RAMPS.cream[1]; ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = RAMPS.cream[3]; ctx.fillRect(x, y + 1, 1, 1);
  }

  function sprite(draw, w, h, background) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (background) { g.fillStyle = background; g.fillRect(0, 0, w, h); }
    draw(g);
    return c;
  }
  const sprites = {
    dragonfly: (frame) => dragonflySprite(frame),
    fish: (flick) => sprite((g) => drawFish(g, 4, 2, 1, flick), 8, 5, RAMPS.pond[1]),
    leaf: (color, flip) => sprite((g) => drawLeaf(g, 1, 1, color, flip), 4, 4, PALETTE.grass),
    fluff: () => sprite((g) => drawFluff(g, 2, 2), 5, 5, PALETTE.grass),
  };

  return { update, drawUnder, drawOver, sprites };
})();
