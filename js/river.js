
const River = (() => {
  const LEAP = 1.1, HEIGHT = 15;          // seconds in the air, pixels high
  let fish = null, nextFish = 6, splashes = [], wish = null, lastFish = null;

  function leapDir(world, x, y, prefer) {
    const wet = (d) => world.river.at((x + d * 16) / TILE, y / TILE).d < -0.6;
    if (wet(prefer)) return prefer;
    if (wet(-prefer)) return -prefer;
    return 0;
  }

  function tilesInView(world, view, fn) {
    const x0 = Math.max(0, Math.floor(view.x / TILE)), x1 = Math.min(world.W - 1, Math.ceil((view.x + view.w) / TILE));
    const y0 = Math.max(0, Math.floor(view.y / TILE)), y1 = Math.min(world.H - 1, Math.ceil((view.y + view.h) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty);
  }

  const inWater = (world, x, y, margin = 0.15) => world.river.at(x / TILE, y / TILE).d < -margin;

  function update(dt, time, world, view) {
    if (!fish && wish && time >= wish.at) {
      const dir = leapDir(world, wish.x, wish.y, wish.dir);
      if (dir) {
        fish = { x: wish.x, y: wish.y, dir, start: time };
        splashes.push({ x: fish.x, y: fish.y, start: time });
      }
      wish.leaps--;
      wish = wish.leaps > 0 ? { ...wish, x: wish.x + (dir || 1) * 16, at: time + LEAP + 0.9, dir: -(dir || 1) } : null;
      nextFish = time + 14;
    }
    if (!fish && time > nextFish) {
      const spots = [];
      tilesInView(world, view, (tx, ty) => {
        if (world.tile(tx, ty) === "~" && world.river.at(tx + 0.5, ty + 0.5).d < -0.7) spots.push([tx, ty]);
      });
      if (spots.length) {
        const [tx, ty] = spots[Math.floor(hash2(Math.floor(time), spots.length, 3) * spots.length)];
        const dir = leapDir(world, tx * TILE + 8, ty * TILE + 10, hash2(tx, ty, Math.floor(time)) > 0.5 ? 1 : -1);
        if (dir) {
          fish = { x: tx * TILE + 8, y: ty * TILE + 10, dir, start: time };
          splashes.push({ x: fish.x, y: fish.y, start: time });
        }
      }
      nextFish = time + 7 + hash2(Math.floor(time), 7, 1) * 8;
    }
    if (fish && time - fish.start > LEAP) {
      splashes.push({ x: fish.x + fish.dir * 16, y: fish.y, start: time });
      Sound.tap(900);
      lastFish = { ...fish, until: time + 1.5 };
      fish = null;
    }
    splashes = splashes.filter((s) => time - s.start < 0.6);
  }

  function draw(ctx, world, view, time, mode = "water", covered = () => false) {
    const night = mode === "stars";
    const pond = RAMPS.pond, cream = PALETTE.cream;
    tilesInView(world, view, (tx, ty) => {
      const t = world.tile(tx, ty);
      const f = world.flow[ty * world.W + tx];
      if (t === "o" && !night) {
        const w = Math.floor(time * 6 + tx) % 3;
        ctx.fillStyle = cream;
        ctx.fillRect(tx * TILE + 3 + w, ty * TILE + 2, 2, 1);
        ctx.fillRect(tx * TILE + 10 - w, ty * TILE + 13, 2, 1);
        return;
      }
      if (!f || t === "b") return;
      if (!night) {
      const glints = t === "r" ? 3 : 2;
      const still = f.speed < 0.5, gx = still ? 1 : f.fx, gy = still ? 0 : f.fy;   // in the still bend, glints lie flat
      for (let k = 0; k < glints; k++) {
        const speed = 7 * f.speed;
        const run = (time * speed + hash2(tx, ty, 200 + k) * 16) % 16 - 8;
        const x = tx * TILE + 3 + hash2(tx, ty, 210 + k) * 10 + gx * run;
        const y = ty * TILE + 3 + hash2(tx, ty, 220 + k) * 10 + gy * run;
        if (!inWater(world, x, y, 0.2)) continue;
        ctx.fillStyle = t === "r" && k === 0 ? cream : pond[0];
        const len = t === "r" ? 2 : 3;
        for (let j = 0; j < len; j++) ctx.fillRect(Math.round(x + gx * j), Math.round(y + gy * j), 1, 1);
      }
      const h = hash2(tx, ty, 230);
      if (Math.sin(time * 2.2 + h * 40) > 0.985) {
        const x = Math.round(tx * TILE + 4 + h * 8), y = Math.round(ty * TILE + 4 + hash2(tx, ty, 231) * 8);
        ctx.fillStyle = cream;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
      }
      }
      if (night && f.speed < 1.5) {
        for (let k = 0; k < 1; k++) {
          const sh = hash2(tx, ty, 240 + k);
          if (sh > 0.32) continue;
          const x = tx * TILE + 2 + hash2(tx, ty, 250 + k) * 12 + Math.round(Math.sin(time * 1.3 + sh * 9) * 0.7);
          const y = ty * TILE + 2 + hash2(tx, ty, 260 + k) * 12;
          if (!inWater(world, x, y, 0.25) || covered(x, y)) continue;
          const twinkle = Math.sin(time * (1.5 + sh) + sh * 20);
          if (twinkle < -0.3) continue;
          ctx.fillStyle = twinkle > 0.7 ? PALETTE.cream : PALETTE.starlight;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
          if (Math.sin(time * 3 + sh * 30) > 0) {
            ctx.fillStyle = RAMPS.starlight[2];
            ctx.fillRect(Math.round(x), Math.round(y) + 2, 1, 1);
          }
        }
      }
    });

    if (night) return;
    for (const s of splashes) {
      const u = (time - s.start) / 0.6, r = 3 + u * 4;
      ctx.fillStyle = u < 0.5 ? cream : pond[0];
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        if (r < 4 && Math.abs(Math.sin(ang)) > 0.8) continue;
        ctx.fillRect(Math.round(s.x + Math.cos(ang) * r), Math.round(s.y + Math.sin(ang) * r * 0.45), 1, 1);
      }
    }
    if (fish) {
      const u = (time - fish.start) / LEAP;
      const frame = u < 0.38 ? 0 : u < 0.62 ? 1 : 2;
      const s = prop("fish", 0, frame);
      const x = fish.x + fish.dir * u * 16, y = fish.y - Math.sin(u * Math.PI) * HEIGHT;
      ctx.save();
      if (fish.dir < 0) { ctx.translate(Math.round(x) * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(s.canvas, Math.round(x - s.ax), Math.round(y - s.ay));
      ctx.restore();
    }
  }

  function ripple(x, y, time) {
    splashes.push({ x, y, start: time });
  }

  function fishAt(x, y, time, delay = 0.6, leaps = 3, dir = -1) {
    wish = { x, y, dir, at: time + delay, leaps };
  }

  function fishNear(x, y, time, reach = 14) {
    const f = fish || (lastFish && time < lastFish.until ? lastFish : null);
    if (!f) return false;
    const u = fish ? (time - f.start) / LEAP : 1;
    const fx = f.x + f.dir * u * 16, fy = f.y - Math.sin(u * Math.PI) * HEIGHT;
    return Math.hypot(x - fx, y - fy) <= reach;
  }

  return { update, draw, ripple, fishAt, fishNear };
})();
