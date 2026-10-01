
const Effects = (() => {
  let list = [];                   // little things in the garden: a fallen persimmon, star candies, a drifting feather
  let glows = [];                  // soft lights on things (the saved persimmon): [{ t, dx, dy, r, color }]
  let bathing = null;              // the bird bath birds are splashing in (its front half is drawn over them)

  const add = (e) => { list.push(e); return e; };
  const remove = (e) => { list = list.filter((x) => x !== e); };
  const clear = () => { list = []; bathing = null; };
  const glow = (t, g) => { glows.push({ t, ...g }); };
  const unglow = (t) => { glows = glows.filter((g) => g.t !== t); };
  const clearGlows = () => { glows = []; };
  const setBathing = (b) => { bathing = b || null; };

  function update(dt, time) {
    for (const e of list) {
      if (e.kind === "persimmon" || e.kind === "candy" || e.kind === "fall") {
        if (e.y < e.ground || e.vy < 0) {
          e.vy += 260 * dt;
          e.y = Math.min(e.ground, e.y + e.vy * dt);
          if (e.vx) e.x += e.vx * dt;
          if (e.y >= e.ground && e.vy > 0) { e.vy = e.vy > 60 ? -e.vy * 0.3 : 0; e.vx = (e.vx || 0) * 0.5; }
        }
      } else if (e.kind === "drift" && !e.landed) {
        e.t = (e.t || 0) + dt;
        e.y = Math.min(e.ground, e.y + (e.speed || 14) * dt);
        const k = e.x1 === undefined ? 0 : Math.min(1, (e.y - (e.y0 || 0)) / Math.max(1, e.ground - (e.y0 || 0)));
        e.x = e.x0 + ((e.x1 === undefined ? e.x0 : e.x1) - e.x0) * k + Math.sin(e.t * 1.7) * (e.sway || 7) * (1 - k * 0.7);
        if (e.y >= e.ground) { e.landed = true; e.x = e.x1 === undefined ? e.x : e.x1; }
      }
    }
    list = list.filter((e) => e.kind !== "fishInBeak" || time < e.until);
  }

  function tap(gx, gy) {
    const c = list.find((e) => e.kind === "candy" && Math.abs(e.x - gx) < 7 && Math.abs(e.y - 2 - gy) < 7);
    if (!c) return false;
    if (c.y >= c.ground) c.vy = -40;
    Sound.tap(900);
    Magpie.says(THINGS.candy.name);
    return true;
  }

  function items() {
    const out = [];
    for (const e of list) {
      if (e.kind === "persimmon") out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(iconFromGridCached("persimmon"), Math.round(e.x - 3), Math.round(e.y - 6)) });
      if (e.kind === "candy") out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(candySprite(e.color), Math.round(e.x - 2), Math.round(e.y - 4)) });
      if (e.kind === "drift" && e.landed && e.icon === "crowFeather") {
        const f = prop("feather", 3);                     // (the crow's feather lying on the ground)
        out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(f.canvas, Math.round(e.x - f.ax), Math.round(e.y - f.ay)) });
        continue;
      }
      if (e.kind === "fall" || (e.kind === "drift" && e.landed)) {
        const c = iconFromGridCached(e.icon);
        if (c) out.push({ bottom: e.sortY !== undefined ? e.sortY : e.ground + 0.1, draw: () => ctx.drawImage(c, Math.round(e.x - c.width / 2), Math.round(e.y - c.height)) });
      }
    }
    const bath = bathing;
    if (bath && WORLD.things.includes(bath)) {
      out.push({ bottom: bath.footY + 0.45, draw: () => {
        drawBathFront(ctx, bath.footX, bath.footY, bath.variant & 1);
        const splashing = Wildlife.all().some((b) => b.act && b.act.name === "bathe" && Math.abs(b.x - bath.footX) < 14 && Math.abs(b.y - bath.footY) < 20)
          || (companion.act && companion.act.name === "bathe");
        if (splashing) drawBathSplash(ctx, bath.footX, bath.footY, Math.floor(performance.now() / 125));
      } });
    }
    return out;
  }

  function drawWorld(ctx, time) {
    for (const e of list) {
      if (e.kind === "fishInBeak" && !e.bird.gone) {
        const h = Wildlife.headTop(e.bird);
        const fish = iconFromGridCached("fish");
        ctx.save();
        const x = h.x + (e.bird.faceLeft ? -16 : 8), y = h.y + 4;
        if (e.bird.faceLeft) { ctx.translate(x + fish.width, y); ctx.scale(-1, 1); ctx.drawImage(fish, 0, 0); } else ctx.drawImage(fish, x, y);
        ctx.restore();
      }
    }
    if (scene.name === "garden") {
      for (const g of glows) Daylight.drawLight(ctx, g.t.footX + (g.dx || 0), g.t.footY + (g.dy || 0), (g.r || 5) + Math.round(Math.sin(time * 2) * 1), g.color || "starlight", g.amount || 0.8);
      for (const e of list) if (e.glow) Daylight.drawLight(ctx, e.x, e.y - 3, 5 + Math.round(Math.sin(time * 2) * 1), "starlight", 0.8);
      if (companion.carry === "persimmon" && !(companion.mode === "away" && !companion.flight)) {
        const h = companionHeadTop();
        Daylight.drawLight(ctx, h.x + (companion.faceLeft ? -8 : 8), h.y + 12, 5, "starlight", 0.7);
      }
    }
  }

  function drawOverlay(ctx, time) {
    if (scene.name === "garden") {
      for (const e of list) {
        if (e.kind !== "drift" || e.landed) continue;
        if (e.icon === "crowFeather") {
          drawCrowFeatherFalling(ctx, e.x, e.y - 4, time, Daylight.nightAmount() > 0.5);
          if (e.glint && Math.sin(time * 5) > 0.1) { const g = Cues.icon("sparkle"); ctx.drawImage(g, Math.round(e.x + 5 - g.width / 2), Math.round(e.y - 12 - g.height / 2)); }
          continue;
        }
        const c = iconFromGridCached(e.airIcon || e.icon);
        if (c) ctx.drawImage(c, Math.round(e.x - c.width / 2), Math.round(e.y - c.height));
      }
    }
  }

  function floatWords(words) {
    const app = document.getElementById("app");
    const p = playerPixelPos(), at = gameToScreen(p.x + 8, p.y - TILE - 4);
    const els = words.map((w) => {
      const el = document.createElement("div");
      el.className = "float-word";
      el.textContent = w;
      el.style.visibility = "hidden";
      el.style.animation = "none";              // (it starts when its turn comes)
      app.appendChild(el);
      return el;
    });
    const GAP = 10, EDGE = 8, ROW = 46;
    const widths = els.map((el) => el.offsetWidth), h = Math.max(...els.map((el) => el.offsetHeight));
    const room = window.innerWidth - 2 * EDGE;
    const total = (list) => list.reduce((a, b) => a + b, 0) + GAP * (list.length - 1);
    const rows = total(widths) <= room || els.length < 2 ? [els.map((_, i) => i)]
      : [els.map((_, i) => i).filter((i) => i % 2 === 0), els.map((_, i) => i).filter((i) => i % 2 === 1)];
    const base = Math.max(at.y, h + 40 + (rows.length - 1) * ROW);
    const aside = player.facing === "up" && !player.sitting ? (at.x < window.innerWidth / 2 ? 1 : -1) : 0;
    const clear = gameToScreen(TILE, 0, false).x - gameToScreen(0, 0, false).x;          // (a tile, in points)
    const layout = (dx) => rows.map((row, r) => {
      const width = total(row.map((i) => widths[i]));
      const from = (aside > 0 ? at.x + clear : aside < 0 ? at.x - clear - width : at.x - width / 2 + (r ? widths[row[0]] / 2 : 0)) + dx;
      return { row, r, width, x: Math.max(EDGE, Math.min(window.innerWidth - EDGE - width, from)) };
    });
    const avoid = floatAvoid();
    const covered = (L) => L.reduce((sum, { r, x, width }) => {
      const t = base - r * ROW - h - 34, b = base - r * ROW + 8;              // (from where they start to where they fade: css .float-word)
      return sum + avoid.reduce((s, a) => s + Math.max(0, Math.min(x + width, a.r) - Math.max(x, a.l)) * Math.max(0, Math.min(b, a.b) - Math.max(t, a.t)), 0);
    }, 0);
    const step = Math.max(...rows.map((row) => total(row.map((i) => widths[i])))) / 2 + GAP;
    let best = null;
    for (const k of [0, 1, -1, 2, -2, 3, -3]) {
      const L = layout(k * step), c = covered(L);
      if (!best || c < best.c) best = { L, c };
      if (!c) break;
    }
    for (const { row, r, x: left } of best.L) {
      let x = left;
      for (const i of row) {
        els[i].style.left = `${Math.round(x + widths[i] / 2)}px`;
        els[i].style.top = `${Math.round(base - r * ROW)}px`;
        x += widths[i] + GAP;
      }
    }
    els.forEach((el, i) => setTimeout(() => {
      el.style.visibility = "";
      el.style.animation = "";
      Sound.twinkle();
      setTimeout(() => el.remove(), 2000);
    }, i * 650));
  }

  function floatAvoid() {
    const out = [];
    const add = (b, pad = 4) => { const p = gameToScreen(b.x, b.y), q = gameToScreen(b.x + b.w, b.y + b.h); out.push({ l: p.x - pad, t: p.y - pad, r: q.x + pad, b: q.y + pad }); };
    if (companion.mode !== "away" || companion.flight) {
      const b = companionBox(), m = CUE, up = b.y + b.h < playerPixelPos().y - TILE, room = up ? 17 * m + 4 : 0;
      add(up ? { x: b.x - 18 * m, y: b.y - room, w: b.w + 36 * m, h: b.h + room } : b);
    }
    const thought = Cues.thoughtBox();
    if (thought) add(thought);
    if (WORLD.garden) for (const g of Wildlife.thoughtBubbles()) add(g.box);
    for (const r of buttonRects()) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });     // (and never under a button: js/side-buttons.js)
    return out;
  }

  const iconCache = {};
  function iconFromGridCached(name) {
    if (!ICONS[name]) return null;
    return iconCache[name] || (iconCache[name] = iconFromGrid(ICONS[name]).toCanvas());
  }
  const candyCache = {};
  function candySprite(color) {
    if (candyCache[color]) return candyCache[color];
    const b = new PixelBuffer(5, 5);
    for (const [x, y] of [[2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [1, 3], [3, 3]]) b.set(x, y, rampFor(color)[1]);
    b.set(2, 1, "cream");
    return (candyCache[color] = outline(b).toCanvas());
  }

  return { add, remove, clear, glow, unglow, clearGlows, setBathing, update, tap, items, drawWorld, drawOverlay, floatWords };
})();
