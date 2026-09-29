
const Quirks = (() => {
  const D = () => window.QUIRKS || { quirks: {}, says: {}, numbers: [] };
  const conf = (n) => (D().quirks || {})[n] || {};
  const says = (n) => (D().says || {})[n] || "";
  const now = () => performance.now() / 1000;
  const within = (r, d) => (Array.isArray(r) ? r[0] + Math.random() * (r[1] - r[0]) : d);
  const today = () => (typeof State !== "undefined" ? State.get().day : 1);
  const body = () => Husband.body();
  const him = () => body().H;
  let herSprites = null, hisSprites = null;
  const HER = () => herSprites || (herSprites = renderQuirkHer());
  const HIS = () => hisSprites || (hisSprites = renderQuirkHim());

  let next = 0;                // no moment before this (seconds)
  let since = null;            // when they got together (null: he isn't with her)
  let cur = null;              // the moment playing: { name, t, ... }
  const last = {}, count = {};  // when each last happened; how many times today

  function tick() {
    if (him().state !== "together") { since = null; return; }
    if (since === null) { since = now(); next = Math.max(next, since + within(D().firstAfter, 80)); }
  }
  function due(name) {
    tick();
    if (since === null || now() < next) return false;
    const c = conf(name), n = count[name];
    if (last[name] !== undefined && now() - last[name] < (c.cooldown || 0)) return false;
    return !(c.perDay && n && n.day === today() && n.n >= c.perDay);
  }
  function happened(name) {
    last[name] = now();
    const n = count[name], d = today();
    count[name] = { day: d, n: (n && n.day === d ? n.n : 0) + 1 };
    next = now() + within(D().between, 160);
  }

  function quiet() {
    const H = him();
    if (H.state !== "together" || H.wonder || H.rejoin || H.pose) return false;
    if (!WORLD.garden && scene.name !== "hill") return false;
    if (changingPlace || Closeup.isOpen() || Sky.isOpen() || (typeof Speech !== "undefined" && Speech.isOpen())) return false;
    if (Story && (Story.busy() || (Story.inFavor && Story.inFavor()))) return false;
    if (player.hidden || player.act || player.hop || State.get().holding || UI.bubbleShowing()) return false;
    return H.together !== "stones" && WORLD.tile(player.nx, player.ny) !== "o" && WORLD.tile(player.tx, player.ty) !== "o";
  }

  const herFeet = () => { const p = playerPixelPos(); return { x: p.x + 8, y: p.y + 14, p }; };
  const hisFeet = () => ({ x: him().x + 8, y: him().y + 14 });
  const hisSide = () => (him().x + 8 >= herFeet().x ? 1 : -1);           // he's on her right (1) or left (-1), on the screen
  const onScreen = (x, y, m = 12) => x > camera.x + m && x < camera.x + canvas.width - m && y > camera.y + m && y < camera.y + canvas.height - m;
  const onBench = () => player.sitting && him().seated === player.sitting && him().together === "bench" && player.still >= (D().sitFor || 5);
  const stopped = () => him().together === "side" && !player.sitting && !isMoving() && !player.path.length && !him().moving && player.still >= (D().stillFor || 1.2);
  function besideHer(gap) {
    const f = herFeet(), s = hisSide();
    for (const side of [s, -s]) {
      const x = f.x + side * gap, y = f.y;
      const ok = [0.5, 1].every((k) => body().open(f.x + side * gap * k, y));
      if (ok) return { x: x - 8, y: y - 14, side };
    }
    return null;
  }

  const pops = [];             // hearts and sparkles that pop up: { name, x, y, at }
  function pop(name, x, y) { pops.push({ name, x, y, at: now() }); }
  const heartBetween = () => {
    const f = herFeet(), H = him();
    pop("heart", Math.round((f.x + H.x + 8) / 2), Math.round(Math.min(f.p.y, H.y) - TILE - 2));
  };
  const cache = {};
  const sprite = (key, make) => cache[key] || (cache[key] = make());
  const flowerSprite = (color, center) => sprite(`flower/${color}/${center}`, () => renderHairFlower(color, center));
  const pebble = () => sprite("pebble", () => { const b = new PixelBuffer(3, 2); b.ellipse(1.5, 1, 1.5, 1, "stone"); return outline(b).toCanvas(); });
  const leafSprite = (color, tilt) => sprite(`leaf/${color}/${tilt}`, () => {
    const b = new PixelBuffer(7, 5);
    b.rotEllipse(3.5, 2.5, 3.2, 1.6, tilt, color);
    const R = rampFor(color);
    for (let i = -2; i <= 2; i++) if (b.get(3.5 + i, 2.5 + i * Math.sin(tilt) * 0.5)) b.set(3.5 + i, 2.5 + i * Math.sin(tilt) * 0.5, R[2]);
    return outline(b).toCanvas();
  });
  const herHand = () => sprite("hand", () => { const b = new PixelBuffer(3, 2); b.ellipse(1.5, 1, 1.5, 1, "skin", { flat: true }); return outline(b).toCanvas(); });

  let lastWord = null;
  function riseWord(text, x, y, dir) {
    if (!text) return;
    const el = document.createElement("div");
    el.className = "float-word small";
    el.textContent = text;
    const at = gameToScreen(x, y);
    document.getElementById("app").appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    let cx = at.x;
    if (lastWord && Math.abs(at.y - lastWord.y) < h + 12) {
      if (dir > 0) cx = Math.max(cx, lastWord.right + 4 + w / 2);
      else cx = Math.min(cx, lastWord.left - 4 - w / 2);
    }
    cx = Math.max(8 + w / 2, Math.min(window.innerWidth - 8 - w / 2, cx));
    el.style.left = `${Math.round(cx)}px`;
    el.style.top = `${Math.round(at.y)}px`;
    lastWord = { left: cx - w / 2, right: cx + w / 2, y: at.y };
    setTimeout(() => el.remove(), 2000);
  }
  function clearWords() { for (const el of document.querySelectorAll(".float-word.small")) el.remove(); }

  const MOMENTS = {};

  MOMENTS.shoulder = {
    bench: true,
    where: () => onBench() && {},
    begin: (q) => { q.side = hisSide(); },
    step: (q) => {
      if (q.t > 0.8 && !q.hearted) { q.hearted = true; heartBetween(); Sound.hearts(); }
      if (q.t > 4 && !q.again) { q.again = true; heartBetween(); }
      return q.t > 7;
    },
    her: (q) => ({ sprite: HER().lean[q.side > 0 ? "right" : "left"], lift: 0, facing: "down", hair: q.side }),
    him: (q) => HIS().lean[q.side > 0 ? "left" : "right"],
  };

  MOMENTS.lap = {
    bench: true,
    where: () => onBench() && {},
    begin: (q) => { q.side = hisSide(); Sound.tap(700); },
    step: (q) => {
      if (q.t > 1.2 && !q.hearted) { q.hearted = true; pop("heart", herFeet().x, herFeet().p.y - TILE - 2); Sound.hearts(); }
      if (q.t > 5 && !q.again) { q.again = true; pop("heart", herFeet().x + q.side * 8, herFeet().p.y - 2); }
      return q.t > 8.5;
    },
    her: () => ({ sprite: HER().sitHappy, lift: 0, facing: "down" }),
    him: (q) => HIS().lap[q.side > 0 ? "left" : "right"],
    lying: (q) => {
      const p = herFeet().p, top = Math.round(p.y) - TILE, x = Math.round(p.x), w = HIS().lap.left.width;
      return { x: q.side > 0 ? x + QUIRK_FIT.lap.x : x + 16 - QUIRK_FIT.lap.x - w, y: top + QUIRK_FIT.lap.y };
    },
    items: (q) => {
      const b = player.sitting, p = herFeet().p, top = Math.round(p.y) - TILE;
      const doll = window.HUSBAND && HUSBAND.doll && HUSBAND.doll.id;
      const pat = Math.floor(q.t / 0.7) % 2;                         // (her hand on his hair, patting)
      const hx = Math.round(p.x) + (q.side > 0 ? 4 : 9), hy = top + QUIRK_FIT.lap.y + 3 - pat;
      const out = [{ bottom: b.footY + 0.7, draw: () => ctx.drawImage(herHand(), hx, hy) }];
      if (doll) out.push({ bottom: b.footY + 0.55, draw: () => {
        const d = renderDoll(doll, "sit");
        ctx.drawImage(d.canvas, Math.round(b.footX - (player.seatDx || 0) - d.ax), Math.round(b.footY - 15 - d.ay));
      } });
      return out;
    },
  };

  MOMENTS.doze = {
    bench: true,
    where: () => onBench() && {},
    begin: (q) => { q.side = hisSide(); },
    step: (q) => {
      const H = him(), c = companion;
      if (q.t > 1.8 && !q.magpie && c.mode === "follow" && !c.flight && !c.act && Story.understands()) {
        q.magpie = { x: Math.round(H.x + 8 + q.side * 2), y: Math.round(H.y) - TILE + 6 };
        magpieFlyTo("perch", q.magpie.x, q.magpie.y, player.sitting.footY + 0.8);
      }
      if (q.t > 7.2 && !q.woke) {
        q.woke = true;
        H.emote = { name: "exclaim", age: 0 };
        Sound.tap(900);
        if (MOMENTS.doze.magpieThere(q)) { Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch); magpieFlyTo("follow"); }
      }
      return q.t > 8.6;
    },
    magpieThere: (q) => q.magpie && companion.mode === "perch" && !companion.flight && companion.px === q.magpie.x && companion.py === q.magpie.y,
    landed: (q) => q.magpie && !companion.flight && companion.mode === "perch",
    end: (q) => { if (!q.woke && MOMENTS.doze.magpieThere(q)) magpieFlyTo("follow"); },
    her: (q) => (MOMENTS.doze.landed(q) || q.woke ? { sprite: HER().sitHappy, lift: 0, facing: "down" } : null),
    him: (q) => {
      if (q.woke) return body().S().sit;
      if (q.t < 0.7) return body().S().blink.sit;
      const nod = Math.floor((q.t - 0.7) / 1.3) % 2;
      return (q.side > 0 ? HIS().doze : HIS().dozeOther)[nod];
    },
    overlay: (ctx2, q) => {
      if (q.t < 1 || q.woke) return;
      const H = him(), icon = emoteSprite("zzz"), k = ((q.t - 1) % 1.8) / 1.8;
      if (k > 0.85 && Math.floor(q.t * 20) % 2) return;
      ctx2.drawImage(icon, Math.round(H.x + 8 + q.side * 9 - icon.width / 2 + k * q.side * 3), Math.round(H.y - TILE - icon.height + 4 - k * 8));
    },
  };

  const SWING = 0.7;
  const swingLevel = (q) => { const k = (q.t % SWING) / SWING; return k < 0.2 ? 1 : k < 0.45 ? 2 : k < 0.65 ? 1 : 0; };
  const frontOrBack = (f) => f === "down" || f === "up";
  const sideBySide = () => { const p = playerPixelPos(), H = him(); return Math.abs(H.y - p.y) < 3 && Math.abs(Math.abs(H.x - p.x) - 13) < 3; };
  MOMENTS.swing = {
    walks: true,
    where: () => him().together === "side" && isMoving() && player.path.length >= 3 && frontOrBack(player.facing) && him().facing === player.facing && sideBySide() && {},
    begin: (q) => { q.side = hisSide(); },
    step: (q, dt) => {
      body().keepUp(dt);                       // (walking along beside her as usual)
      him().lift = swingLevel(q) === 2 ? 1 : 0;   // (a little skip at the top of each swing)
      if (him().together !== "side" || !frontOrBack(player.facing) || hisSide() !== q.side || !sideBySide()) return true;
      if (q.t > 3 * SWING && !q.hearted) { q.hearted = true; heartBetween(); Sound.hearts(); }
      return q.t > 3 * SWING;
    },
    her: (q) => {
      const level = swingLevel(q);
      if (!level) return null;
      const moving = isMoving(), u = player.progress, step = moving && u < 0.5 ? 1 + (player.steps % 2) : 0;
      return { sprite: HER().swing[player.facing][q.side][level][step], lift: (moving && u >= 0.5 ? 1 : 0) + (level === 2 ? 1 : 0), facing: player.facing };
    },
    him: (q) => {
      const level = swingLevel(q), H = him();
      if (!level || !frontOrBack(H.facing)) return null;
      const step = H.moving ? 1 + (Math.floor(H.walked / 8) % 2) : 0;
      return HIS().swing[H.facing][-q.side][level][step];
    },
    items: (q) => {
      const level = swingLevel(q), H = him(), p = playerPixelPos();
      const dx = [4.3, 5.8, 6.2][level], dy = [22.3, 21.4, 19.4][level];
      const herLift = MOMENTS.swing.her(q) ? MOMENTS.swing.her(q).lift : 0;
      const hx = Math.round((p.x + 8 + q.side * dx + H.x + 8 - q.side * dx) / 2);
      const hy = Math.round((Math.round(p.y) - TILE - herLift + Math.round(H.y) - TILE - H.lift) / 2 + dy);
      return [{ bottom: Math.max(H.y, p.y) + 14.3, draw: () => ctx.drawImage(body().handsSprite(), hx - 2, hy - 2) }];
    },
  };

  MOMENTS.flower = {
    where: () => {
      if (!WORLD.garden || !stopped()) return null;
      const f = herFeet(), h = hisFeet();
      let best = null;
      for (const t of WORLD.things) {
        if (t.type !== "flower" || t.species === "sunflower" || !onScreen(t.footX, t.footY - 8, 20)) continue;
        if (Math.hypot(t.footX - h.x, t.footY - h.y) > 2.5 * TILE || Math.hypot(t.footX - f.x, t.footY - f.y) > 3 * TILE) continue;
        for (const dx of [-1, 1]) {
          const tx = t.x + dx, ty = t.y;
          if (!isWalkable(tx, ty) || (tx === player.nx && Math.abs(ty - player.ny) <= 1)) continue;     // (not on her, nor just behind or in front of her)
          const sx = tx * TILE + 8, sy = ty * TILE + 14;
          if (![0.33, 0.66, 1].every((k) => body().open(h.x + (sx - h.x) * k, h.y + (sy - h.y) * k))) continue;
          const d = Math.hypot(sx - h.x, sy - h.y);
          if (!best || d < best.d) best = { flower: t, spot: { x: tx * TILE, y: ty * TILE }, face: dx < 0 ? "right" : "left", d };
        }
      }
      return best && besideHer(QUIRK_FIT.near) ? best : null;
    },
    begin: (q) => { q.phase = "go"; },
    step: (q, dt) => {
      const H = him(), B = body();
      if (q.phase === "go") {
        B.moveToward(q.spot.x, q.spot.y, dt, 4.5 * TILE);
        if (!H.moving || Math.hypot(H.x - q.spot.x, H.y - q.spot.y) < 0.6) { H.x = q.spot.x; H.y = q.spot.y; H.moving = false; q.phase = "pick"; q.at = q.t; }
      } else if (q.phase === "pick") {
        H.facing = q.face;
        if (q.t - q.at > 0.3 && !q.holding) { q.holding = true; q.flower.bounce = 0.4; Sound.pickup(); }
        if (q.t - q.at > 0.75) { q.phase = "back"; q.back = besideHer(QUIRK_FIT.near); if (!q.back) return true; }
      } else if (q.phase === "back") {
        B.moveToward(q.back.x, q.back.y, dt, 4.5 * TILE);
        if (!H.moving || Math.hypot(H.x - q.back.x, H.y - q.back.y) < 0.6) { H.x = q.back.x; H.y = q.back.y; H.moving = false; H.facing = "down"; player.facing = "down"; q.phase = "give"; q.at = q.t; }
      } else if (q.phase === "give") {
        if (q.t - q.at > 0.4 && q.holding) {
          q.holding = false;
          const t = q.flower, look = (window.FLOWERS || {})[t.species] || {};
          State.setHairFlower({ day: today(), color: t.color || "petalPink", center: look.center || "beeYellow", ear: q.back.side > 0 ? "left" : "right" });
          const f = herFeet();
          pop("sparkles", Math.round(f.x + q.back.side * 7), Math.round(f.p.y - TILE + 8));
          showEmote("player", "heart");
          Sound.hearts();
          B.say(says("flower"), q.back.side);                     // (his bubble leans away from her)
        }
        return q.t - q.at > 1.7;
      }
      return false;
    },
    her: (q) => (q.phase === "give" && !q.holding ? { sprite: HER().happy.down, lift: 0, facing: "down" } : null),
    front: (q) => q.phase === "give" && q.holding,                  // (his arm, reaching to her ear, in front of her; then the flower shows)
    him: (q) => {
      const S = body().S();
      if (q.phase === "pick") return S.pointLow[q.face];
      if (q.phase === "give") return q.holding || q.t - q.at < 1.1 ? HIS().ear[-q.back.side] : null;
      return null;
    },
    items: (q) => {
      if (!q.holding) return [];
      const H = him(), top = Math.round(H.y) - TILE, x = Math.round(H.x), s = flowerSprite(q.flower.color || "petalPink", ((window.FLOWERS || {})[q.flower.species] || {}).center || "beeYellow");
      let hx, hy;
      if (q.phase === "pick") { hx = q.face === "left" ? x - 1 : x + 17; hy = top + 23; }
      else if (q.phase === "give") { hx = q.back.side > 0 ? x + 0.5 : x + 15.5; hy = top + 12; }
      else { hx = x + 8 + (H.facing === "left" ? -5 : H.facing === "right" ? 5 : 4); hy = top + 21; }
      return [{ bottom: q.phase === "give" ? playerPixelPos().y + TILE + 0.2 : H.y + 14.4, draw: () => ctx.drawImage(s, Math.round(hx - s.width / 2), Math.round(hy - s.height / 2)) }];
    },
  };

  const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  MOMENTS.lift = {
    where: () => {
      if (!WORLD.garden || !stopped()) return null;
      const tree = WORLD.things.find((t) => t.type === "persimmonTree");
      if (!tree || player.ny !== tree.y + 1 || player.nx < tree.x - 1 || player.nx > tree.x + tree.w) return null;
      const s = thingSprite(tree, 1), left = tree.footX - s.ax, top = tree.footY - s.ay, f = herFeet();
      const head = { x: f.x, y: f.p.y - TILE + 8 - QUIRK_FIT.lift };
      let fruit = null;
      for (const [fx, fy] of persimmonFruits(tree.variant)) {
        const d = Math.hypot(left + fx - head.x, top + fy - head.y);
        if (d < 26 && (!fruit || d < fruit.d)) fruit = { x: left + fx, y: top + fy, d };
      }
      const spot = besideHer(QUIRK_FIT.liftGap);
      return fruit && spot ? { tree, fruit, spot } : null;
    },
    begin: (q) => { q.phase = "go"; player.facing = "down"; },
    step: (q, dt) => {
      const H = him();
      H.facing = q.spot.side > 0 ? "left" : "right";               // (turned to her)
      if (q.phase === "go") {
        body().moveToward(q.spot.x, q.spot.y, dt, 4 * TILE);
        H.facing = q.spot.side > 0 ? "left" : "right";
        if (!H.moving || Math.hypot(H.x - q.spot.x, H.y - q.spot.y) < 0.6) { H.x = q.spot.x; H.y = q.spot.y; H.moving = false; q.phase = "lift"; q.at = q.t; }
        return false;
      }
      const t = q.t - q.at;
      if (t > 0.75 && !q.touched) {
        q.touched = true;
        q.tree.bounce = 0.4;
        pop("sparkles", Math.round(q.fruit.x), Math.round(q.fruit.y - 2));
        Sound.tap(1400);
      }
      if (t > 1.1 && !q.hearted) { q.hearted = true; const f = herFeet(); pop("heart", f.x, f.p.y - TILE - QUIRK_FIT.lift - 2); Sound.hearts(); }
      return t > 3;
    },
    height: (q) => {
      if (q.phase !== "lift") return 0;
      const t = q.t - q.at;
      return Math.round(QUIRK_FIT.lift * (t < 2.6 ? ease(t / 0.4) : 1 - ease((t - 2.6) / 0.35)));
    },
    her: (q) => {
      const up = MOMENTS.lift.height(q);
      if (!up) return null;
      return { sprite: HER().lifted[Math.floor(q.t / 0.22) % 2], lift: up, facing: "down" };
    },
    him: (q) => (q.phase === "lift" ? HIS().lift[q.spot.side > 0 ? "left" : "right"] : null),
  };

  function skipsFrom(hand, dir) {
    const W = WORLD, wet = W.things.filter((t) => t.wet), birds = Wildlife.all().filter((b) => !b.gone);
    const clear = (x, y) => W.river.at(x / TILE, y / TILE).d < -0.45 && onScreen(x, y, 16)
      && !wet.some((t) => Math.hypot(t.footX - x, t.footY - 4 - y) < 11) && !birds.some((b) => Math.hypot(b.x - x, b.y - y) < 14);
    const hops = [24, 20, 17, 14, 11];
    const pts = [];
    let x = hand.x, y = hand.y + 9, n = 0;
    for (const len of hops) {
      x += dir.x * len; y += dir.y * len;
      if (!clear(x, y)) break;
      pts.push({ x, y });
      if (++n >= Math.max(3, (D().numbers || []).length)) break;
    }
    return pts;
  }
  MOMENTS.stones = {
    where: () => {
      if (!WORLD.garden || !stopped()) return null;
      const pool = ((window.RIVER || {}).pools || [])[0];
      const f = herFeet();
      if (!pool || Math.hypot(f.x / TILE - pool.x, f.y / TILE - pool.y) > pool.r + 3.5) return null;
      const mine = bankSide(player.nx, player.ny);
      let best = null;
      for (let ty = player.ny - 3; ty <= player.ny + 3; ty++) for (let tx = player.nx - 3; tx <= player.nx + 3; tx++) {
        if (!isWalkable(tx, ty) || "bo".includes(WORLD.tile(tx, ty)) || tx === player.nx || bankSide(tx, ty) !== mine) continue;     // (not in her column: he'd stand right behind her, or in front)
        const d = WORLD.river.at(tx + 0.5, ty + 0.5).d;
        if (d < 0 || d > 1.4) continue;                                  // (at the water's edge)
        const h = hisFeet(), sx = tx * TILE + 8, sy = ty * TILE + 14;
        if (![0.33, 0.66, 1].every((k) => body().open(h.x + (sx - h.x) * k, h.y + (sy - h.y) * k))) continue;
        const to = { x: pool.x * TILE - sx, y: pool.y * TILE - sy }, L = Math.hypot(to.x, to.y) || 1;
        for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
          const c = Math.cos(turn), s = Math.sin(turn);
          const dir = { x: (to.x * c - to.y * s) / L, y: (to.x * s + to.y * c) / L };
          if (Math.abs(dir.x) < 0.45) continue;                          // (side on, so his throw shows)
          const face = dir.x < 0 ? "left" : "right";
          const hand = { x: tx * TILE + (face === "left" ? 2 : 14), y: ty * TILE + 5 };
          const skips = skipsFrom(hand, dir);
          if (skips.length < 3) continue;
          const score = skips.length * 10 + Math.abs(dir.x) * 6 - Math.hypot(sx - h.x, sy - h.y) / TILE;     // (flat across the water reads best)
          if (!best || score > best.score) best = { spot: { x: tx * TILE, y: ty * TILE }, face, hand, skips, score };
        }
      }
      return best;
    },
    begin: (q) => { q.phase = "go"; },
    step: (q, dt) => {
      const H = him();
      if (q.phase === "go") {
        body().moveToward(q.spot.x, q.spot.y, dt, 4.5 * TILE);
        if (!H.moving || Math.hypot(H.x - q.spot.x, H.y - q.spot.y) < 0.6) {
          H.x = q.spot.x; H.y = q.spot.y; H.moving = false; H.facing = q.face; q.phase = "throw"; q.at = q.t;
          player.facing = q.face;                                          // (she turns to watch)
        }
        return false;
      }
      const t = q.t - q.at;
      H.facing = q.face;
      if (t > 0.3 && !q.pebble) { q.pebble = true; Sound.tap(600); }
      if (t > 1.2 && !q.flight) {
        q.flight = { at: q.t, pts: [{ x: q.hand.x, y: q.hand.y + 9, h: 9 }, ...q.skips.map((p) => ({ ...p, h: 0 }))], hit: 0 };
        lastWord = null;
        Sound.tap(1000);
      }
      if (q.flight) {
        const fl = q.flight, words = D().numbers || [];
        let k = q.t - fl.at, i = 0;
        while (i < fl.pts.length - 1 && k > MOMENTS.stones.hopTime(i)) { k -= MOMENTS.stones.hopTime(i); i++; }
        while (fl.hit < i) {
          fl.hit++;
          const p = fl.pts[fl.hit], last = fl.hit === fl.pts.length - 1;
          fl.ripples = (fl.ripples || []).concat({ x: p.x, y: p.y, at: q.t, big: last });
          riseWord(words[fl.hit - 1], p.x, p.y - 8, q.face === "left" ? -1 : 1);
          if (last) { Sound.splash(); q.sunkAt = q.t; } else Sound.tap(1500 + fl.hit * 120);
        }
        fl.now = i < fl.pts.length - 1 ? { i, k: k / MOMENTS.stones.hopTime(i) } : null;
      }
      if (q.sunkAt && !q.cheered && q.t - q.sunkAt > 0.3) {
        q.cheered = true;
        showEmote("player", "sparkles");
        H.emote = { name: "heart", age: 0 };
        Sound.hearts();
      }
      return q.sunkAt && q.t - q.sunkAt > 1.8;
    },
    hopTime: (i) => (i === 0 ? 0.34 : 0.3 - i * 0.02),
    end: () => {},
    her: (q) => (q.cheered ? { sprite: HER().happy[q.face], lift: 0, facing: q.face } : null),
    him: (q) => {
      if (q.phase !== "throw") return null;
      const t = q.t - q.at, S = body().S();
      if (t < 0.7) return S.pointLow[q.face];                            // (picking up a flat pebble)
      if (t < 1.2) return HIS().throwBack[q.face];                       // (winding up)
      if (t < 1.7) return S.reach[q.face];                               // (a low throw, out over the water)
      return null;
    },
    items: (q) => {
      const out = [], H = him();
      const t = q.phase === "throw" ? q.t - q.at : 0;
      if (q.pebble && !q.flight) {
        const x = Math.round(H.x) + (t < 0.7 ? (q.face === "left" ? -1 : 16) : t < 1.2 ? (q.face === "left" ? 13 : 2) : 8), y = Math.round(H.y) - TILE + (t < 0.7 ? 23 : 18);
        out.push({ bottom: H.y + 14.5, draw: () => ctx.drawImage(pebble(), x - 2, y - 1) });
      }
      const fl = q.flight;
      if (fl && fl.now) {
        const a = fl.pts[fl.now.i], b = fl.pts[fl.now.i + 1], k = fl.now.k;
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        const arc = fl.now.i === 0 ? a.h * (1 - k) + Math.sin(k * Math.PI) * 4 : Math.sin(k * Math.PI) * Math.max(1.5, 4 - fl.now.i);
        out.push({ bottom: y + 0.5, draw: () => ctx.drawImage(pebble(), Math.round(x - 2), Math.round(y - arc - 2)) });
      }
      for (const r of (fl && fl.ripples) || []) {
        const age = q.t - r.at;
        if (age > 0.9) continue;
        out.push({ bottom: r.y - 6, draw: () => ripple(r.x, r.y, age, r.big) });
      }
      return out;
    },
  };
  function ripple(x, y, age, big) {
    const rx = 2 + age * (big ? 9 : 7), ry = rx * 0.45;
    ctx.fillStyle = age < 0.45 ? PALETTE.cream : RAMPS.pond[0];
    const n = Math.max(8, Math.round(rx * 3));
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = Math.round(x + Math.cos(a) * rx), py = Math.round(y + Math.sin(a) * ry);
      if (seen.has(px + "," + py)) continue;
      seen.add(px + "," + py);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  MOMENTS.pat = {
    where: () => stopped() && player.facing === "down" && besideHer(QUIRK_FIT.near) ? {} : null,
    begin: (q) => { q.spot = besideHer(QUIRK_FIT.near); q.phase = "go"; },
    step: (q, dt) => {
      const H = him();
      if (q.phase === "go") {
        body().moveToward(q.spot.x, q.spot.y, dt, 3 * TILE);
        if (!H.moving || Math.hypot(H.x - q.spot.x, H.y - q.spot.y) < 0.6) { H.x = q.spot.x; H.y = q.spot.y; H.moving = false; H.facing = "down"; q.phase = "pat"; q.at = q.t; }
        return false;
      }
      if (q.t - q.at > 0.45 && !q.hearted) { q.hearted = true; showEmote("player", "heart"); Sound.hearts(); }
      return q.t - q.at > 1.8;
    },
    her: (q) => (q.phase === "pat" ? { sprite: HER().happy.down, lift: 0, facing: "down" } : null),
    front: (q) => q.phase === "pat",
    him: (q) => (q.phase === "pat" ? HIS().pat[-q.spot.side][Math.floor((q.t - q.at) / 0.24) % 2] : null),
  };

  const TREES = { bigTree: "leaf", persimmonTree: "leafGold", willow: "willow", tree: "leaf" };
  MOMENTS.leaf = {
    where: () => {
      if (!WORLD.garden || !stopped() || player.facing !== "down") return null;
      const f = herFeet();
      const tree = WORLD.things.find((t) => TREES[t.type] && f.y >= t.footY - 2 && f.y - t.footY < 2.5 * TILE && Math.abs(f.x - t.footX) < 2 * TILE);
      const spot = besideHer(QUIRK_FIT.near);
      return tree && spot ? { color: RAMPS[TREES[tree.type]] ? TREES[tree.type] : "leaf", spot } : null;
    },
    begin: (q) => { q.phase = "fall"; q.away = -q.spot.side; },
    step: (q, dt) => {
      const H = him();
      if (q.phase === "fall" && q.t > 2.8) { q.phase = "go"; H.facing = q.spot.side > 0 ? "left" : "right"; }
      if (q.phase === "go") {
        body().moveToward(q.spot.x, q.spot.y, dt, 3 * TILE);
        if (!H.moving || Math.hypot(H.x - q.spot.x, H.y - q.spot.y) < 0.6) { H.x = q.spot.x; H.y = q.spot.y; H.moving = false; H.facing = "down"; q.phase = "pick"; q.at = q.t; }
      } else if (q.phase === "pick" && q.t - q.at > 0.5) {
        q.phase = "show"; q.at = q.t; Sound.pickup();
        body().say(says("leaf"), q.spot.side);
      } else if (q.phase === "show" && q.t - q.at > 1.6) {
        q.phase = "go away"; q.at = q.t; q.from = MOMENTS.leaf.inHand(q);
      } else if (q.phase === "go away" && q.t - q.at > 1.6) return true;
      return false;
    },
    inHand: (q) => { const H = him(); return { x: Math.round(H.x) + (q.spot.side > 0 ? 18 : -2), y: Math.round(H.y) - TILE + 8 }; },
    her: (q) => (q.phase === "show" || q.phase === "go away" ? { sprite: HER().happy.down, lift: 0, facing: "down" } : null),
    front: (q) => q.phase === "pick",
    him: (q) => {
      const S = body().S();
      if (q.phase === "pick") return HIS().pat[-q.spot.side][0];
      if (q.phase === "show") return (q.spot.side > 0 ? S.waveRight : S.wave)[0];
      return null;
    },
    items: (q) => {
      const p = playerPixelPos(), top = Math.round(p.y) - TILE, x = Math.round(p.x);
      let lx, ly, tilt = 0.5, bottom = p.y + TILE + 0.3;
      const rest = { x: x + 8 + q.spot.side * 4, y: top + 3 };         // (on her hair, on his side)
      if (q.phase === "fall") {
        const k = Math.min(1, q.t / 2.2), sway = Math.sin(q.t * 5) * (1 - k) * 4;
        lx = rest.x - q.spot.side * (1 - k) * 10 + sway; ly = rest.y - (1 - k) * 34;
        tilt = Math.sin(q.t * 5) > 0 ? 0.5 : -0.5;
      } else if (q.phase === "go" || q.phase === "pick") {
        lx = rest.x; ly = rest.y;
      } else if (q.phase === "show") {
        const h = MOMENTS.leaf.inHand(q); lx = h.x; ly = h.y - 2;
      } else {
        const k = (q.t - q.at) / 1.6;
        if (k > 0.8 && Math.floor(q.t * 20) % 2) return [];
        lx = q.from.x + k * 26 * (q.spot.side > 0 ? 1 : -1) + Math.sin(q.t * 6) * 2; ly = q.from.y - 2 - Math.sin(k * Math.PI) * 6 + k * 10;
        tilt = Math.sin(q.t * 6) > 0 ? 0.5 : -0.5;
        bottom = 1e6;
      }
      const s = leafSprite(q.color, tilt);
      return [{ bottom, draw: () => ctx.drawImage(s, Math.round(lx - s.width / 2), Math.round(ly - s.height / 2)) }];
    },
  };

  MOMENTS.shootingStar = {
    where: () => {
      if (scene.name !== "hill" || !stopped()) return null;
      const f = herFeet();
      const y = camera.y + 14 + Math.random() * 10, x = f.x - 70 + Math.random() * 30;
      const spot = besideHer(QUIRK_FIT.near);
      return spot && x > camera.x + 10 && y < f.p.y - TILE - 30 ? { star: { x, y }, spot } : null;
    },
    begin: (q) => { q.side = q.spot.side; },
    step: (q, dt) => {
      const H = him();
      if (Math.hypot(H.x - q.spot.x, H.y - q.spot.y) > 0.6) body().moveToward(q.spot.x, q.spot.y, dt, 3 * TILE);
      else { H.x = q.spot.x; H.y = q.spot.y; H.moving = false; }
      if (q.t > 0.2 && !q.shot) { q.shot = true; Observatory.shoot(q.star.x, q.star.y); }
      if (q.t > 0.5 && !q.twinkled) { q.twinkled = true; pop("sparkle", Math.round(q.star.x + 48), Math.round(q.star.y + 21)); Sound.tap(1700); }
      if (q.t > 0.5 && !q.said) { q.said = true; body().say(says("shootingStar"), q.side); }
      if (q.t > 0.9 && !q.looked) { q.looked = true; player.facing = "up"; }
      if (q.t > 2.3 && !q.wished) { q.wished = true; player.facing = "down"; H.facing = "down"; showEmote("player", "sparkles"); Sound.tap(1300); }
      if (q.t > 3.9 && !q.hearted) { q.hearted = true; H.facing = "down"; H.emote = { name: "heart", age: 0 }; Sound.hearts(); }
      return q.t > 4.8;
    },
    her: (q) => (q.wished ? { sprite: HER().wish, lift: 0, facing: "down" } : null),
    him: (q) => {
      if (q.t < 0.35 || q.t > 2.3 || him().moving) return null;
      return body().S().point[q.star.x + 50 < him().x + 8 ? "left" : "right"];
    },
  };

  function begin(name, found) {
    const H = him();
    cur = { name, t: 0, ...(found || {}) };
    H.pose = null; H.moving = false;
    const m = MOMENTS[name];
    if (m.begin) m.begin(cur);
  }

  function maybe(dt) {
    tick();
    if (cur || now() < next || !quiet()) return;
    for (const name of Object.keys(MOMENTS)) {
      const c = conf(name);
      if (!c.odds || !due(name) || Math.random() >= 1 - Math.pow(1 - c.odds, dt)) continue;
      const found = MOMENTS[name].where();
      if (found) { begin(name, found); return; }
    }
  }

  function start(name, o = {}) {
    const m = MOMENTS[name];
    if (!m) return `no moment called ${name}`;
    if (cur) stop();
    if (!quiet()) return "not now (he isn't holding her hand, or something else is going on)";
    const found = m.where();
    if (!found) return `not here (${name} needs its place)`;
    begin(name, found);
    return true;
  }

  function interrupted(q, m) {
    if (him().state !== "together" || changingPlace || Closeup.isOpen() || Sky.isOpen()) return true;
    if ((typeof Speech !== "undefined" && Speech.isOpen()) || (Story && Story.busy())) return true;
    if (player.act || player.hidden || State.get().holding) return true;
    if (m.bench ? !player.sitting || him().seated !== player.sitting : player.sitting) return true;
    return !m.walks && !m.bench && (isMoving() || player.path.length > 0);
  }

  function update(dt) {
    const q = cur;
    if (!q) return;
    q.t += dt;
    const m = MOMENTS[q.name];
    if (interrupted(q, m)) { stop(); return; }
    if (m.step(q, dt)) finish(false);
  }

  function finish(early) {
    const q = cur;
    if (!q) return;
    cur = null;
    const m = MOMENTS[q.name], H = him();
    if (m.end) m.end(q, early);
    H.pose = null;
    if (!m.bench && H.state === "together") { H.rejoin = true; H.rejoinHappy = false; }
    if (early) clearWords();
    happened(q.name);
  }
  const stop = () => finish(true);

  function herFrame() {
    if (!cur) return null;
    const m = MOMENTS[cur.name];
    return m.her ? m.her(cur) : null;
  }
  function hisSprite() {
    if (!cur) return null;
    const m = MOMENTS[cur.name];
    return m.him ? m.him(cur) : null;
  }
  function inFront() {
    const m = cur && MOMENTS[cur.name];
    return !!(m && m.front && m.front(cur));
  }
  function hisDraw() {
    if (!cur || cur.name !== "lap") return null;
    const at = MOMENTS.lap.lying(cur), s = MOMENTS.lap.him(cur);
    return { bottom: player.sitting.footY + 0.6, draw: () => ctx.drawImage(s, at.x, at.y) };
  }
  function items() {
    if (!cur) return [];
    const m = MOMENTS[cur.name];
    return m.items ? m.items(cur) : [];
  }
  function drawOverlay(ctx2) {
    if (cur && MOMENTS[cur.name].overlay) MOMENTS[cur.name].overlay(ctx2, cur);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i], t = now() - p.at;
      if (t > 1.8) { pops.splice(i, 1); continue; }
      if (t > 1.65 && Math.floor(t * 20) % 2) continue;
      const icon = emoteSprite(p.name), lift = t < 0.12 ? 6 * (1 - t / 0.12) : t < 0.22 ? -2 * Math.sin(((t - 0.12) / 0.1) * Math.PI) : 0;
      ctx2.drawImage(icon, Math.round(p.x - icon.width / 2), Math.round(p.y - icon.height + lift));
    }
  }

  function hairFlower() {
    const f = typeof State !== "undefined" && State.get().hairFlower;
    return f && f.day === today() && HAIR_FLOWER_AT[f.ear] ? f : null;
  }
  function drawHair(ctx2, x, top, facing, behind, pose) {
    const f = hairFlower();
    if (!f || player.hidden) return;
    const at = HAIR_FLOWER_AT[f.ear][facing];
    if (!at || at[2] !== behind) return;
    const s = flowerSprite(f.color, f.center), dx = (pose && pose.hair) || 0;
    ctx2.drawImage(s, Math.round(x + at[0] + dx - s.width / 2), Math.round(top + at[1] - s.height / 2));
  }

  return {
    maybe, update, start, stop, due, happened, playing: () => !!cur,
    herFrame, hisSprite, hisDraw, inFront, items, drawOverlay, drawHair, hairFlower,
    left: () => { stop(); since = null; },                // (he went back to work: the first moment waits again when he comes)
    soon: () => { next = now() + 1; },
    wait: () => next - now(),
    names: () => Object.keys(MOMENTS),
    debug: () => ({ playing: cur && { name: cur.name, t: Math.round(cur.t * 10) / 10, phase: cur.phase }, wait: Math.round(next - now()), since: since === null ? null : Math.round(now() - since), quiet: quiet() }),
  };
})();
