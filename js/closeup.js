
const Closeup = (() => {
  let scene = null;

  const cache = {};
  const once = (key, fn) => (cache[key] ||= fn());

  function bigBee(frame) {
    return once(`bee/${frame}`, () => {
      const b = new PixelBuffer(18, 15);
      if (frame === 0) {
        b.ellipse(6.5, 3, 2.8, 2.8, "cream", { flat: true });
        b.ellipse(10.5, 2.6, 2.8, 2.8, "cream", { flat: true });
        b.rect(6, 2, 1, 1, RAMPS.pond[0], { flat: true });
        b.rect(10, 1.6, 1, 1, RAMPS.pond[0], { flat: true });
      }
      b.triangle(0.5, 9, 3.5, 7.5, 3.5, 10.5, "plum", { flat: true });      // stinger
      const body = [9, 9, 7, 5];
      b.ellipse(...body, "beeYellow");
      for (const x of [5, 8]) b.rect(x, 3, 2, 12, "plum", { onlyFilled: true, shadeAs: body });
      b.line(13, 4.5, 15.5, 1.5, 1, "plum");                                  // antenna
      if (frame === 1) b.ellipse(8.5, 5, 3.4, 1.6, "cream", { flat: true });
      const out = outline(b);
      out.set(14, 8, "cream"); out.set(15, 8, "plum");
      out.set(14, 9, "plum"); out.set(15, 9, "plum");
      out.set(16, 11, "blush");
      out.set(15, 12, RAMPS.blush[3]);
      return out.toCanvas();
    });
  }

  function bigButterfly(color, frame) {
    return once(`fly/${color}/${frame}`, () => {
      const b = new PixelBuffer(20, 16);
      const spread = [1, 0.6, 0.35][frame];
      for (const side of [-1, 1]) {
        const cx = 10 + side * 5 * spread;
        b.ellipse(cx, 5.5, Math.max(1.2, 4.8 * spread), 4.6, color);
        b.ellipse(10 + side * 3.6 * spread, 11, Math.max(1, 3.2 * spread), 3.2, color);
        if (frame < 2) b.circle(cx + side * 0.8 * spread, 4.5, 1.2, "cream", { flat: true });
      }
      if (frame < 2) for (let x = 0; x < 20; x++) if (x < 9 || x > 10) b.set(x, 9, null);   // notch between the wings
      b.rect(9, 3, 2, 11, "plum");
      b.line(9.5, 3, 7, 0.3, 1, "plum");
      b.line(10.5, 3, 13, 0.3, 1, "plum");
      return outline(b).toCanvas();
    });
  }

  function ladybug() {
    return once("ladybug", () => {
      const b = new PixelBuffer(11, 8);
      b.circle(9, 4.6, 2, "plum");
      b.ellipse(5, 4.4, 4.6, 3.6, "coral");
      b.rect(5, 1, 1, 7, "plum", { onlyFilled: true, flat: true });
      for (const [x, y] of [[3, 3], [3, 6], [7, 5]]) b.set(x, y, "plum");
      b.set(3, 2, "cream");
      const out = outline(b);
      out.set(10, 4, "cream");                                                 // eye shine
      return out.toCanvas();
    });
  }

  function petalSprite(color) {
    return once(`petal/${color}`, () => {
      const b = new PixelBuffer(7, 4);
      b.ellipse(3.5, 2, 3.4, 1.7, color);
      return outline(b).toCanvas();
    });
  }

  function bigFlower(species, color, r, height, seed) {
    return once(`flower/${species}/${color}/${r}/${height}/${seed}`, () => {
      const sp = FLOWERS[species];
      const w = Math.round(r * 2 + 26), cx = w / 2, headY = r + 2;
      const lean = Math.round((hash2(seed, 0, 1) - 0.5) * 9);      // where the stem meets the ground
      const stemAt = (y) => cx + lean * ((y - headY) / (height - headY));
      const count = 1 + Math.floor(hash2(seed, 0, 2) * 3);
      const leaves = [];
      for (let i = 0; i < count; i++) {
        const y = headY + r + 6 + hash2(seed, i, 3) * (height - headY - r - 14);
        const side = hash2(seed, i, 4) > 0.5 ? 1 : -1;
        const rx = 6 + hash2(seed, i, 5) * 3;
        leaves.push({ x: stemAt(y) + side * (rx - 1), y, side, rx });
      }
      const frames = [-1, 0, 1].map((sway) => {
        const b = new PixelBuffer(w, height);
        b.line(stemAt(height), height, cx + sway, headY, species === "sunflower" ? 3 : 2, "leaf", { flat: false });
        for (const lf of leaves) {
          b.rotEllipse(lf.x, lf.y, lf.rx, lf.rx * 0.4, lf.side * -0.45, "leaf");
          b.line(stemAt(lf.y), lf.y + 1, lf.x + lf.side * (lf.rx - 2), lf.y - lf.side * lf.side * 2, 1, RAMPS.leaf[2], { onlyFilled: true });
        }
        drawBloom(b, sp, color, cx + sway, headY, r);
        return outline(b).toCanvas();
      });
      return { frames, w, h: height + 2, headX: cx + 1, headY: headY + 1, leaves: leaves.map((l) => ({ ...l, x: l.x + 1, y: l.y + 1 })) };
    });
  }

  function clover(seed) {
    return once(`clover/${seed}`, () => {
      const b = new PixelBuffer(16, 14);
      for (const [x, y] of [[5, 5], [11, 5], [8, 9]]) b.circle(x, y, 3.6, "meadowGreen");
      b.line(8, 9, 9, 14, 1.4, "leaf");
      return outline(b).toCanvas();
    });
  }

  const BIG = { sunflower: 13, cosmos: 11, tulip: 10, zinnia: 10, rose: 10, daisy: 10, balsam: 10, mossRose: 9 };

  function bigStar() {
    return once("bigStar", () => {
      const b = new PixelBuffer(23, 23);
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.8 : 11;
        pts.push([11.5 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
      }
      b.polygon(pts, "starlight", { flat: true });
      for (const [x, y] of [[11, 10], [10, 11], [11, 11], [12, 11], [11, 12], [11, 13], [10, 12], [12, 12]]) b.set(x, y, "cream");
      const out = outline(b);
      return out.toCanvas();
    });
  }

  function build(patchIndex, W, H, opts = {}) {
    const patch = FLOWER_PATCHES[patchIndex] || { flowers: [["daisy", "snow"], ["zinnia", "petalPink"]] };
    const seed = patchIndex * 31 + 7;

    const bg = new PixelBuffer(W, H);
    bg.rect(0, 0, W, H, RAMPS.pond[0], { flat: true });
    for (let i = 0; i < 3; i++) {
      const x = W * (0.15 + i * 0.33) + hash2(seed, i, 2) * 30, y = H * 0.1 + hash2(seed, i, 3) * 10;
      bg.ellipse(x, y, 16, 5, "cream", { flat: true });
      bg.ellipse(x + 8, y - 3, 9, 4, "cream", { flat: true });
      bg.rect(x - 14, y + 2, 28, 2, RAMPS.cream[2], { flat: true, onlyFilled: true });
    }
    const hill = (x, base, amp, s) => Math.round(base + (fractalNoise(x / 40, 0, s) - 0.5) * amp);
    for (let x = 0; x < W; x++) {
      for (let y = hill(x, H * 0.34, 20, seed); y < H; y++) bg.set(x, y, RAMPS.grass[0]);
      for (let y = hill(x, H * 0.58, 14, seed + 1); y < H; y++) bg.set(x, y, RAMPS.grass[1]);
      for (let y = hill(x, H * 0.84, 8, seed + 2); y < H; y++) bg.set(x, y, RAMPS.grass[2]);
    }
    for (let c = 0; c < Math.max(4, W / 60); c++) {
      const cx = hash2(seed, c, 4) * W, cy = H * 0.4 + hash2(seed, c, 5) * H * 0.14;
      const [, col] = patch.flowers[c % patch.flowers.length];
      for (let k = 0; k < 7; k++) {
        const x = Math.round(cx + (hash2(c, k, 6) - 0.5) * 22), y = Math.round(cy + (hash2(c, k, 7) - 0.5) * 7);
        bg.set(x, y - 1, rampFor(col)[1]); bg.set(x - 1, y, rampFor(col)[1]);
        bg.set(x + 1, y, rampFor(col)[1]); bg.set(x, y, "beeYellow"); bg.set(x, y + 1, rampFor(col)[2]);
      }
    }
    const background = bg.toCanvas();

    const kinds = [patch.flowers[0], ...patch.flowers];
    const pick = (i) => kinds[(i + Math.floor(hash2(seed, 0, 8) * kinds.length)) % kinds.length];
    const flowers = [];
    const addRow = (count, size, top, bottom, spread) => {
      for (let i = 0; i < count; i++) {
        const [species, color] = pick(flowers.length);
        const r = Math.round(BIG[species] * size + (hash2(seed, flowers.length, 9) - 0.5) * 2);
        const headTop = Math.round(H * (top + hash2(seed, flowers.length, 10) * (bottom - top)));
        const sprite = bigFlower(species, color, r, H - headTop + r + 2, seed + flowers.length * 7);
        const slot = W / count;
        const x = Math.round(slot * (i + 0.5) - sprite.w / 2 + (hash2(seed, flowers.length, 11) - 0.5) * slot * spread);
        flowers.push({
          species, color, r, sprite, x, y: headTop - r - 2, name: flowerName(species, color),
          phase: hash2(seed, flowers.length, 12) * 6, bounce: 0, wiggle: 0, row: size < 1 ? "back" : "front",
        });
      }
    };
    addRow(Math.max(4, Math.round(W / 30)), 0.6, 0.3, 0.45, 0.8);      // a row of small flowers behind
    addRow(Math.max(3, Math.round(W / 75)), 1.25, 0.2, 0.62, 0.8);      // big ones in front

    const mid = new PixelBuffer(W, H);
    for (let x = -14; x < W + 24; x += 24) {
      const cx = x + hash2(seed, x, 20) * 12, rx = 17 + hash2(seed, x, 21) * 10, ry = 13 + hash2(seed, x, 22) * 7;
      const cy = H * 0.8 - hash2(seed, x, 23) * H * 0.12;
      leafBall(mid, cx, cy, rx, ry, hash2(seed, x, 24) > 0.5 ? "leaf" : "meadowGreen", 300 + x);
    }
    for (let y = Math.round(H * 0.84); y < H; y++) {
      const c = y < H * 0.92 ? RAMPS.leaf[2] : RAMPS.leaf[3];
      for (let x = 0; x < W; x++) if (!mid.get(x, y)) mid.set(x, y, c);
    }
    const midground = outline(mid).toCanvas();

    const heads = flowers.map((f) => ({ x: f.x + f.sprite.headX, y: f.y + f.sprite.headY, r: f.r }));
    const front = flowers.map((f, i) => i).filter((i) => flowers[i].row === "front");
    const pickHead = (k) => front[Math.floor(hash2(seed, k, 13) * front.length)];

    const bees = [0, 1].map((k) => { const at = pickHead(k); return { at, x: heads[at].x, y: heads[at].y - 8, rest: 0.5, n: 0, loop: 0, s: k * 10 }; });
    const flyColors = ["butter", "lilac", "petalPink", "snow"].filter((c) => !patch.flowers.some(([, pc]) => pc === c));
    const flies = [0, 1].map((k) => ({
      at: pickHead(k + 5), x: W * (0.2 + k * 0.6), y: H * 0.2, landed: false, rest: 0, n: 0, s: k * 20 + 3,
      color: flyColors[k % flyColors.length] || "butter", flee: 0,
    }));

    const frontFlowers = flowers.filter((f) => f.row === "front");
    const leafSpot = (f, lf) => ({ x: f.x + lf.x, y: f.y + lf.y - 1 });
    const bugFlower = frontFlowers[Math.floor(frontFlowers.length / 2)];
    const bug = { base: leafSpot(bugFlower, bugFlower.sprite.leaves[0]), t: 0, hop: 0 };
    const dew = [];
    frontFlowers.forEach((f, i) => {
      f.sprite.leaves.forEach((lf, j) => {
        if (f === bugFlower && j === 0) return;
        if ((i + j) % 2 === 0) dew.push({ ...leafSpot(f, lf), phase: i * 1.7 + j, flash: 0 });
      });
    });

    const fore = [];
    for (let x = -4; x < W + 4; x += 3) fore.push({ kind: "blade", x, h: 10 + hash2(seed, x, 16) * 9, lean: (hash2(seed, x, 17) - 0.5) * 5 });
    for (let k = 0; k < 3; k++) fore.push({ kind: "clover", x: W * (0.12 + k * 0.36) + hash2(seed, k, 18) * 30, y: H - 12, s: k });

    const petals = [0, 1, 2].map((k) => {
      const [, c] = patch.flowers[k % patch.flowers.length];
      return { x: W * (0.25 + k * 0.28) + hash2(seed, k, 14) * 20, y: H - 22 - hash2(seed, k, 15) * 8, color: c, lift: 0 };
    });

    const fg = new PixelBuffer(W, H);
    for (const f of fore) {
      if (f.kind !== "blade") continue;
      const c = [RAMPS.grass[2], RAMPS.grass[3], RAMPS.leaf[1]][Math.floor(hash2(seed, f.x, 19) * 3)];
      fg.line(f.x, H + 1, f.x + f.lean, H - f.h, 1.3, c);
      fg.set(Math.round(f.x + f.lean), Math.round(H - f.h), RAMPS.grass[0]);
    }
    const foreground = fg.toCanvas();
    const fgx = foreground.getContext("2d");
    for (const f of fore) if (f.kind === "clover") fgx.drawImage(clover(f.s), Math.round(f.x), Math.round(f.y));

    let star = null;
    if (opts.star) {
      const stems = flowers.filter((f) => f.row === "front").map((f) => f.x + f.sprite.w / 2);
      let bestX = W * 0.56, bestGap = -1;
      for (let x = W * 0.3; x <= W * 0.7; x += 3) {
        const gap = Math.min(...stems.map((sx) => Math.abs(sx - x)));
        if (gap > bestGap) { bestGap = gap; bestX = x; }
      }
      star = { x: Math.round(bestX), y: Math.round(H * 0.68), taken: false, rise: 0, jiggle: 0 };
      bees[0].star = { phase: "go", t: 0 };
    }

    const magpie = renderBird(BIRDS.magpie);
    return { W, H, background, midground, flowers, heads, bees, flies, bug, dew, petals, foreground, magpie, star, time: 0 };
  }

  function freeHead(s, k) {
    const taken = new Set([...s.bees.map((b) => b.at), ...s.flies.map((f) => f.at)]);
    const choices = s.heads.map((h, i) => i).filter((i) => !taken.has(i) && s.flowers[i].row === "front");
    const list = choices.length ? choices : s.heads.map((h, i) => i);
    return list[Math.floor(hash2(k, list.length, 5) * list.length)];
  }

  function update(dt) {
    if (!scene) return;
    const s = scene;
    s.time += dt;
    for (const f of s.flowers) { f.bounce = Math.max(0, f.bounce - dt); f.wiggle = Math.max(0, f.wiggle - dt); }

    if (s.star) {
      s.star.jiggle = Math.max(0, s.star.jiggle - dt);
      if (s.star.taken) s.star.rise = Math.min(1.2, s.star.rise + dt);
    }
    for (const b of s.bees) {
      if (b.loop > 0) { b.loop -= dt; continue; }
      if (b.star && s.star && !s.star.taken) {
        const st = b.star;
        st.t += dt;
        if (st.phase === "go") {
          const tx = s.star.x - 4, ty = s.star.y - 13, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
          if (d < 1.5) { st.phase = "bump"; st.t = 0; s.star.jiggle = 0.3; Sound.buzz(); }
          else { const v = Math.min(d, 30 * dt); b.x += (dx / d) * v; b.y += (dy / d) * v; }
        } else if (st.phase === "bump") {
          b.x -= 26 * dt; b.y -= 30 * dt;
          if (st.t > 0.35) { st.phase = "wait"; st.t = 0; }
        } else if (st.t > 1.4) {
          st.phase = "go"; st.t = 0;
        }
        continue;
      }
      const h = s.heads[b.at], tx = h.x + Math.sin(b.s) * 4, ty = h.y - 10;
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
      if (d < 1) {
        b.rest -= dt;
        if (b.rest <= 0) { b.n++; b.at = freeHead(s, b.s * 7 + b.n); b.rest = 1 + hash2(b.s, b.n, 2) * 2; }
      } else {
        const v = Math.min(d, 38 * dt);
        b.x += (dx / d) * v; b.y += (dy / d) * v;
      }
    }

    for (const f of s.flies) {
      const h = s.heads[f.at];
      const fl = s.flowers[f.at];
      const tx = h.x, ty = h.y - fl.r - 4;
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
      if (d < 1 && f.flee <= 0) {
        f.landed = true;
        f.rest -= dt;
        if (f.rest <= 0) { f.n++; f.landed = false; f.at = freeHead(s, f.s * 11 + f.n); }
      } else {
        f.landed = false;
        f.flee = Math.max(0, f.flee - dt);
        const v = Math.min(d, 24 * dt);
        f.x += (dx / d) * v + Math.cos(s.time * 4 + f.s) * 10 * dt;
        f.y += (dy / d) * v + Math.sin(s.time * 5 + f.s) * 14 * dt - (f.flee > 0 ? 30 * dt : 0);
        if (d < 1.5) f.rest = 4 + hash2(f.s, f.n, 4) * 3;
      }
    }

    s.bug.t += dt;
    s.bug.hop = Math.max(0, s.bug.hop - dt);
    for (const d of s.dew) d.flash = Math.max(0, d.flash - dt);
    for (const p of s.petals) p.lift = Math.max(0, p.lift - dt);
  }

  const SPARKLE = () => once("sparkle", () => iconFromGrid(ICONS.sparkle).toCanvas());

  function draw(ctx) {
    const s = scene, t = s.time;
    ctx.drawImage(s.background, 0, 0);

    const drawFlower = (f) => {
      const sway = Math.sin(t * 1.2 + f.phase) + (f.wiggle > 0 ? Math.sin(f.wiggle * 30) * 1.5 : 0);
      const frame = sway < -0.45 ? 0 : sway > 0.45 ? 2 : 1;
      const lift = f.bounce > 0 ? Math.round(Math.sin((f.bounce / 0.4) * Math.PI) * 3) : 0;
      ctx.drawImage(f.sprite.frames[frame], f.x, f.y - lift);
    };
    s.flowers.filter((f) => f.row === "back").forEach(drawFlower);
    ctx.drawImage(s.midground, -1, -1);
    s.flowers.filter((f) => f.row === "front").forEach(drawFlower);

    const bx = s.bug.base.x + Math.round(Math.sin(t * 0.5) * 3), by = s.bug.base.y - 3 - (s.bug.hop > 0 ? 2 : 0);
    ctx.save();
    if (Math.cos(t * 0.5) < 0) { ctx.translate(Math.round(bx) * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(ladybug(), Math.round(bx) - 6, Math.round(by) - 5);
    ctx.restore();

    for (const d of s.dew) {
      pixelDisc(ctx, d.x, d.y, 1.2, RAMPS.pond[0]);
      ctx.fillStyle = PALETTE.cream;
      ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 1, 1, 1);
      if (d.flash > 0 || Math.sin(t * 1.7 + d.phase * 3) > 0.96) {
        const sp = SPARKLE();
        ctx.drawImage(sp, Math.round(d.x - sp.width / 2), Math.round(d.y - sp.height / 2 - 1));
      }
    }

    for (const p of s.petals) ctx.drawImage(petalSprite(p.color), Math.round(p.x), Math.round(p.y - (p.lift > 0 ? 3 : 0)));

    if (s.star && s.star.rise < 1.2) {
      const st = s.star, img = bigStar();
      const jig = st.jiggle > 0 ? Math.round(Math.sin(st.jiggle * 40)) : 0;
      const x = st.x + jig, y = Math.round(st.y - st.rise * 40);
      const pulse = (Math.sin(t * 2.4) + 1) / 2;
      const glow = st.taken ? 1.4 - st.rise : 1;
      Daylight.drawLight(ctx, x, y, 18 + Math.round(pulse * 5), "starlight", glow);
      Daylight.drawLight(ctx, x, y, 12 + Math.round(pulse * 2), "starlight", glow * (0.35 + pulse * 0.65));
      ctx.drawImage(img, x - 12, y - 12);
      if (Math.sin(t * 3) > 0.7 || st.taken) {
        const sp = SPARKLE();
        ctx.drawImage(sp, x + 6, y - 11);
        if (st.taken) ctx.drawImage(sp, x - 12, y - 4);
      }
    }

    for (const f of s.flies) {
      let frame;
      if (f.landed) {
        const c = (Math.sin(t * 1.2 + f.s) + 1) / 2;             // slow open and close
        frame = c > 0.5 ? 0 : 1;
      } else {
        frame = [0, 1, 2, 1][Math.floor(t * 14 + f.s) % 4];
      }
      ctx.drawImage(bigButterfly(f.color, frame), Math.round(f.x - 11), Math.round(f.y - 9));
    }

    for (const b of s.bees) {
      let x = b.x, y = b.y + Math.sin(t * 4 + b.s) * 1.5;
      if (b.loop > 0) {                                           // a happy loop when tapped
        const a = (1 - b.loop / 0.9) * Math.PI * 2;
        x += Math.sin(a) * 8; y += -Math.cos(a) * 8 + 8;
      }
      const sprite = bigBee(Math.floor(t * 18 + b.s) % 2);
      ctx.drawImage(sprite, Math.round(x - 10), Math.round(y - 8));
    }

    ctx.drawImage(s.foreground, 0, 0);

    const m = s.magpie;
    ctx.drawImage(m.canvas, 4, s.H - m.canvas.height + 5);
  }

  function magpieHead() {
    const m = scene.magpie;
    return { x: 4 + m.headX, y: scene.H - m.canvas.height + 5 + m.headY };
  }

  function tap(x, y, minTap = 18) {
    if (!scene) return null;
    const s = scene;
    const half = minTap / 2;
    const within = (cx, cy, rx, ry) => Math.abs(x - cx) <= Math.max(rx, half) && Math.abs(y - cy) <= Math.max(ry, half);

    if (s.star && !s.star.taken && within(s.star.x, s.star.y, 12, 12)) {
      s.star.taken = true;
      Sound.twinkle();
      return { name: "star", star: true, at: { x: s.star.x, y: s.star.y } };
    }
    for (const b of s.bees) {
      if (within(b.x, b.y, 10, 8)) { b.loop = 0.9; Sound.buzz(); return { name: "bee", critterSays: UI_TEXT.bee, at: { x: b.x, y: b.y - 8 } }; }
    }
    for (const f of s.flies) {
      if (within(f.x, f.y, 11, 9)) {
        f.flee = 0.8; f.landed = false; f.n++; f.at = freeHead(s, f.s * 13 + f.n);
        Sound.tap(880);
        return { name: "butterfly" };
      }
    }
    const bx = s.bug.base.x + Math.sin(s.time * 0.5) * 3, by = s.bug.base.y - 3;
    if (within(bx, by, 6, 5)) { s.bug.hop = 0.3; Sound.tap(760); return { name: "ladybug" }; }
    for (const d of s.dew) if (Math.hypot(x - d.x, y - d.y) <= 5) { d.flash = 0.8; Sound.twinkle(); return { name: "dew" }; }
    for (const p of s.petals) if (within(p.x + 3, p.y + 2, 4, 3)) { p.lift = 0.4; Sound.tap(700); return { name: "petal" }; }

    for (const f of [...s.flowers].reverse()) {
      const hx = f.x + f.sprite.headX, hy = f.y + f.sprite.headY;
      if (Math.hypot(x - hx, y - hy) <= f.r + 3) { f.bounce = 0.4; Sound.tap(620); return { name: f.name }; }
      for (const lf of f.sprite.leaves) {
        if (Math.abs(x - (f.x + lf.x)) <= lf.rx + 1 && Math.abs(y - (f.y + lf.y)) <= 5) { f.wiggle = 0.5; Sound.tap(480); return { name: "leaf" }; }
      }
      const stemX = f.x + f.sprite.w / 2;
      if (Math.abs(x - stemX) <= 5 && y > hy && y < s.H) { f.bounce = 0.4; Sound.tap(620); return { name: f.name }; }
    }
    return null;
  }

  function targets() {
    if (!scene) return [];
    const s = scene, out = [];
    if (s.star && !s.star.taken) out.push({ name: "star", x: s.star.x, y: s.star.y });
    s.bees.forEach((b) => out.push({ name: "bee", x: b.x, y: b.y }));
    s.flies.forEach((f) => out.push({ name: "butterfly", x: f.x, y: f.y }));
    out.push({ name: "ladybug", x: s.bug.base.x, y: s.bug.base.y - 3 });
    s.dew.forEach((d) => out.push({ name: "dew", x: d.x, y: d.y }));
    s.petals.forEach((p) => out.push({ name: "petal", x: p.x + 3, y: p.y + 2 }));
    s.flowers.forEach((f) => out.push({ name: f.name, x: f.x + f.sprite.headX, y: f.y + f.sprite.headY }));
    s.flowers.forEach((f) => f.sprite.leaves.slice(0, 1).forEach((lf) => out.push({ name: "leaf", x: f.x + lf.x, y: f.y + lf.y })));
    return out;
  }

  return {
    open: (patchIndex, w, h, opts = {}) => { scene = build(patchIndex, w, h, opts); scene.patch = patchIndex; scene.opts = opts; },
    close: () => { scene = null; },
    isOpen: () => !!scene,
    resize: (w, h) => { if (scene) scene = { ...build(scene.patch, w, h, scene.star && !scene.star.taken ? scene.opts : {}), patch: scene.patch, opts: scene.opts }; },
    starTaken: () => !!(scene && scene.star && scene.star.taken),
    update, draw, tap, magpieHead, targets,
    sprites: { bee: bigBee, butterfly: bigButterfly, ladybug, clover, star: bigStar },
  };
})();
