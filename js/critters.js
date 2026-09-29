

const critterCache = {};
function critterSprite(key, draw) {
  return (critterCache[key] ||= draw());
}

function smallBee(frame) {
  return critterSprite(`bee/${frame}`, () => {
    const b = new PixelBuffer(8, 7);
    b.ellipse(4, 4.4, 3.6, 2.5, "beeYellow");
    b.rect(3, 2, 1, 5, "plum", { onlyFilled: true, flat: true });
    b.rect(5, 2, 1, 5, "plum", { onlyFilled: true, flat: true });
    b.set(7, 3, RAMPS.beeYellow[0]);
    if (frame === 0) { b.ellipse(3, 1.3, 1.4, 1.3, "snow", { flat: true }); b.ellipse(5.3, 1, 1.4, 1.2, "cream", { flat: true }); }
    else { b.ellipse(3.4, 2.4, 1.6, 0.9, "snow", { flat: true }); b.ellipse(5.4, 2.2, 1.4, 0.8, "cream", { flat: true }); }
    const out = outline(b);
    out.set(7, 4, "plum");
    return out.toCanvas();
  });
}

const BUTTERFLY_MARKS = {
  snow: { tip: "ink", spot: "ink", hind: "snow" },
  butter: { tip: "sunflower", spot: "seed", hind: "butter" },
  lilac: { tip: "duskLavender", spot: null, hind: "snow" },
  petalPink: { tip: "magenta", spot: null, hind: "cream" },
};

function smallButterfly(color, frame) {
  return critterSprite(`fly/${color}/${frame}`, () => {
    const m = BUTTERFLY_MARKS[color] || { tip: RAMPS[color] ? RAMPS[color][2] : color, spot: null, hind: color };
    const R = rampFor(color);
    const b = new PixelBuffer(9, 8);
    if (frame === 0) {
      b.ellipse(2.4, 2.6, 2.4, 2.3, color); b.ellipse(6.6, 2.6, 2.4, 2.3, color);
      b.ellipse(2.9, 5.6, 1.6, 1.5, m.hind); b.ellipse(6.1, 5.6, 1.6, 1.5, m.hind);
      b.set(0, 1, m.tip); b.set(1, 0, m.tip); b.set(8, 1, m.tip); b.set(7, 0, m.tip);
      if (m.spot) { b.set(2, 3, m.spot); b.set(6, 3, m.spot); }
    } else if (frame === 1) {
      b.ellipse(3.2, 2.6, 1.5, 2.4, R ? R[1] : color); b.ellipse(5.8, 2.6, 1.5, 2.4, R ? R[2] : color);
      b.ellipse(3.5, 5.4, 1, 1.3, m.hind); b.ellipse(5.5, 5.4, 1, 1.3, m.hind);
      b.set(2, 0, m.tip); b.set(6, 0, m.tip);
    } else {
      b.ellipse(4.5, 2.7, 1.3, 2.7, R ? R[2] : color);
      b.set(4, 0, m.tip);
    }
    b.rect(4, 2, 1, 5, "plum", { flat: true });
    const out = outline(b);
    out.set(4, 1, "plum"); out.set(6, 1, "plum");
    return out.toCanvas();
  });
}

function makeCritters(world) {
  const flowers = world.things.filter((t) => t.type === "flower");
  const pick = (seed) => flowers[Math.floor(hash2(seed, flowers.length, 7) * flowers.length) % flowers.length];
  const near = (from, seed) => {
    const close = flowers.filter((f) => Math.abs(f.footX - from.x) < 90 && Math.abs(f.footY - from.y) < 70);
    const list = close.length > 1 ? close : flowers;
    return list[Math.floor(hash2(seed, 3, 9) * list.length)];
  };
  const bees = [], flies = [];
  for (let i = 0; i < 5; i++) {
    const f = pick(i * 13 + 1);
    bees.push({ x: f.footX, y: f.footY - 12, target: f, rest: 0, seed: i * 100, n: 0 });
  }
  const colors = ["petalPink", "butter", "lilac", "snow"];
  for (let i = 0; i < 4; i++) {
    const f = pick(i * 17 + 5);
    flies.push({ x: f.footX, y: f.footY - 14, target: f, rest: 1 + i, seed: i * 200 + 50, n: 0, color: colors[i % colors.length] });
  }

  const petals = [], smoke = [];
  let petalTimer = 0, smokeTimer = 0;
  const house = world.things.find((t) => t.type === "house");

  function moveToward(c, speed, dt, rest, onPetals = false) {
    const sp = FLOWERS[c.target.species];
    const ring = onPetals && sp.shape === "sunflower";
    const tx = c.target.footX + (ring ? (Math.sin(c.seed + c.n) > 0 ? 6 : -6) : Math.sin(c.seed) * 3);
    const ty = c.target.footY - (ring ? 25 : sp.size === "tall" ? 26 : 12);
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d < 1.5) {
      if (c.rest <= 0) c.rest = rest();
      c.rest -= dt;
      if (c.rest <= 0) { c.n++; c.target = near(c, c.seed + c.n); }
      return true;
    }
    c.x += (dx / d) * Math.min(d, speed * dt);
    c.y += (dy / d) * Math.min(d, speed * dt);
    return false;
  }

  function update(dt, time, view) {
    for (const b of bees) {
      b.landed = moveToward(b, 26, dt, () => 0.8 + hash2(b.seed, b.n, 3) * 1.5);
    }
    for (const f of flies) {
      f.landed = moveToward(f, 16, dt, () => 2 + hash2(f.seed, f.n, 4) * 3, true);
    }

    petalTimer -= dt;
    if (petalTimer <= 0 && flowers.length) {
      petalTimer = 0.5;
      const inView = flowers.filter((f) => f.footX > view.x - 20 && f.footX < view.x + view.w + 20 && f.footY > view.y && f.footY < view.y + view.h + 30);
      if (inView.length) {
        const f = inView[Math.floor(hash2(Math.floor(time * 10), 1, 5) * inView.length)];
        petals.push({ x: f.footX, y: f.footY - 12, age: 0, color: f.color, seed: time });
      }
    }
    for (const p of petals) {
      p.age += dt;
      p.x += (7 + Math.sin(p.age * 2 + p.seed) * 5) * dt;
      p.y += (3 + Math.cos(p.age * 3 + p.seed) * 4) * dt;
    }
    while (petals.length && petals[0].age > 5) petals.shift();

    if (house) {
      smokeTimer -= dt;
      const morning = typeof Daylight === "undefined" || Daylight.phase() === "morning";
      if (smokeTimer <= 0 && morning) {
        smokeTimer = 1.1;
        const s = prop("house", typeof houseVariant === "function" ? houseVariant() : 0);
        const [sx, sy] = s.smoke || [67, 2];
        smoke.push({ x: house.footX - s.ax + sx, y: house.footY - s.ay + sy, age: 0 });
      }
      for (const s of smoke) { s.age += dt; s.y -= 1 * dt; s.x += (6 + s.age * 2) * dt + Math.sin(s.age * 2.4) * 3 * dt; }
      while (smoke.length && smoke[0].age > 3.2) smoke.shift();
    }
  }

  function draw(ctx, time) {
    for (const s of smoke) {
      const d = Math.round(s.age < 2.4 ? 2 + s.age * 2.3 : 2 + 2.4 * 2.3 - (s.age - 2.4) * 10);
      if (d < 2) continue;
      puff(ctx, Math.round(s.x - d / 2), Math.round(s.y - d / 2), d);
    }
    for (const p of petals) {
      ctx.fillStyle = RAMPS[p.color] ? RAMPS[p.color][p.age % 1 < 0.5 ? 1 : 2] : p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
    }
    for (const b of bees) {
      const frame = Math.floor(time * 16 + b.seed) % 2;
      const bob = Math.round(Math.sin(time * 5 + b.seed) * (b.landed ? 0.5 : 1.5));
      ctx.drawImage(smallBee(frame), Math.round(b.x - 4), Math.round(b.y - 4 + bob));
    }
    for (const f of flies) {
      const d = flyDrawn(f, time);
      ctx.drawImage(d.sprite, d.x, d.y);
    }
  }

  function flyDrawn(f, time) {
    const beat = f.landed ? (Math.sin(time * 1.5 + f.seed) > 0.3 ? 1 : 0) : [0, 1, 2, 1][Math.floor(time * 10 + f.seed) % 4];
    const lift = f.landed ? 0 : (beat === 2 ? -1 : 0) + Math.round(Math.sin(time * 3 + f.seed) * 2.5);
    const zig = f.landed ? 0 : Math.round(Math.sin(time * 5.3 + f.seed * 3) * 1.5);
    return { sprite: smallButterfly(f.color, beat), x: Math.round(f.x - 5 + zig), y: Math.round(f.y - 4 + lift) };
  }

  function flyAt(x, y, time) {
    for (let i = flies.length - 1; i >= 0; i--) {
      const d = flyDrawn(flies[i], time);
      if (isSolid(d.sprite, x - d.x, y - d.y)) return flies[i];
    }
    return null;
  }

  return { update, draw, bees, flies, flyAt };
}

function puff(ctx, x0, y0, d) {
  const inside = (n, i, j) => n <= 2 || (i + 0.5 - n / 2) ** 2 + (j + 0.5 - n / 2) ** 2 <= (n / 2) ** 2 - 0.6;
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
    if (!inside(d, i, j)) continue;
    ctx.fillStyle = i < d - 1 && j < d - 1 && inside(d - 1, i, j) ? RAMPS.cream[0] : RAMPS.cream[2];
    ctx.fillRect(x0 + i, y0 + j, 1, 1);
  }
}

function pixelDisc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) ctx.fillRect(x, y, 1, 1);
    }
  }
}
