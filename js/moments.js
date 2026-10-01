
const Moments = (() => {
  const M = {};
  const birdsOf = (s, K) => [].concat(s.birds || s.bird || []).map((id) => K.bird(id)).filter(Boolean);
  const goTo = (b, x, y) => {
    if (Math.hypot(x - b.x, y - b.y) > 20) Wildlife.flyTo(b, x, y, 0.5);
    else Wildlife.hopTo(b, x, y);
    b.home = { x, y };
  };
  const stepBack = async (t, [dx, dy], K) => {
    const spot = { x: player.nx + dx, y: player.ny + dy };
    if (!t || !isWalkable(spot.x, spot.y) || hiddenBehind(spot.x, spot.y)) return;
    walkToward(spot);
    player.faceAt = { x: t.x, y: t.y };
    await K.until(() => !isMoving() && !player.path.length);
  };

  M.fallenStar = async (s, K) => {
    const patch = FLOWER_PATCHES[s.patch || 0];
    Magpie.from(K.px(patch.x + 3), K.px(patch.y - 5));
    const wait = { x: K.px(patch.x + patch.rx + 1), y: K.px(patch.y) + 14 };
    Magpie.flyTo("perch", wait.x, wait.y, wait.y);
    K.G.guide = () => (scene.name === "garden" && !Closeup.isOpen() ? { x: K.px(patch.x) + 8, y: K.px(patch.y) + 4 } : null);
    K.G.onMagpie = () => {
      Magpie.joy();
      Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
      walkToward({ x: Math.floor(patch.x), y: Math.floor(patch.y) });
      return true;
    };
    K.resetStar();
    K.G.closeupStar = true;
    await K.until(() => K.starFound());
    K.G.guide = null; K.G.onMagpie = null; K.G.closeupStar = false;
    await K.scripted(async () => {
      await K.wait(0.8);
      closeCloseup();
      K.hold(s.item || "star");
      showEmote("player", "sparkles");
      await K.wait(0.3);
      Magpie.flyTo("follow");
      await K.wait(0.3);
    });
  };

  M.tummy = (s, K) => K.scripted(async () => {
    Sound.buzz();
    K.emote(s.on || "magpie", "sweat");
    await K.wait(0.7);
  });

  M.hearts = (s, K) => K.scripted(async () => {
    const gap = s.gap || 0.7, hold = gap + 0.5;          // (each act outlasts the gap: it stays put, turning, not hopping off)
    for (const who of [].concat(s.on || [])) {
      if (who === "magpie") {
        Magpie.act("flap", hold);
        Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
      } else {
        const b = who === "her" ? null : K.bird(who);
        const at = who === "her" ? K.herFeet() : b && { x: b.x, y: b.y };
        if (!at) continue;
        const f = companionFoot();
        Magpie.faceToward(at.x);
        Magpie.act(at.y < f.y - 12 ? "lookUp" : "look", hold);
        if (b) Wildlife.greet(b); else Sound.tap(760);
      }
      K.emote(who, "heart");
      await K.wait(gap);
    }
    Magpie.act(null);
  });

  function roomToAct(K) {
    const f = K.herFeet(), m = companionFoot(), d = m.x < f.x ? -1 : 1;
    for (const [dx, dy] of [[28, 6], [28, 14], [36, 6], [36, 14], [26, 22], [16, 24], [34, 26], [0, 26], [44, 18]]) {
      for (const side of [d, -d]) {
        const x = f.x + side * dx, y = f.y + dy;
        if (!isWalkable(Math.floor(x / TILE), Math.floor((y - 2) / TILE))) continue;
        if (Wildlife.all().some((b) => !b.gone && Math.abs(b.x - x) < 16 && Math.abs(b.y - y) < 10)) continue;
        if (K.clearOfThings({ x: x - 13, y: y - 16, w: 26, h: 15 }, null, "garden", 6)) return { x, y };      // (its wings may brush a bush's edge)
      }
    }
    return null;
  }

  M.lookUpDown = (s, K) => K.scripted(async () => {
    const face = (x) => Magpie.faceToward(x);
    const room = companion.mode === "follow" && !companion.flight ? roomToAct(K) : null;
    if (room) await K.landed(Magpie.flyTo("perch", room.x, room.y, room.y + 0.5));
    const up = s.up && K.findThing(s.up), f = companionFoot();
    const down = birdsOf({ birds: s.down }, K).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
    if (up) { face(up.footX); await Magpie.act("lookUp", s.upSeconds || 0.9); await Magpie.act("big", 0.9); }
    if (down) { face(down.x); await Magpie.act("lookDown", s.downSeconds || 0.8); await Magpie.act("small", 0.9); }
    if (room) Magpie.flyTo("follow");
  });

  M.chirpDuet = (s, K) => K.scripted(async () => {
    const b = K.bird(s.bird);
    for (let i = 0; i < (s.times || 3); i++) {
      Sound.chirp("chatter", 1500, i); Magpie.joy(); await K.wait(0.2);
      if (b) { Sound.chirp(b.look.chirp || "tweet", b.look.chirpPitch || 3000, i); Wildlife.greet(b); }
      await K.wait(0.2);
    }
  });

  M.bushPoke = (s, K) => K.scripted(async () => {
    const bush = K.findThing({ thing: s.bush || "berryBush", near: s.near });
    if (!bush) return;
    Magpie.flyTo("perch", bush.footX - 12, bush.footY - 2, bush.footY + 1);
    await K.wait(0.8);
    bush.bounce = 0.4;
    Sound.tap(900);
    showEmote("magpie", "sweat");
    await K.wait(0.4);
  });

  M.fruitDrop = (s, K) => K.scripted(async () => {
    const tree = K.findThing(s.tree || "persimmonTree");
    const b = K.bird(s.bird);
    if (!tree) return;
    const [dx, dy] = s.fruit || [2, -26];
    const icon = s.icon || "persimmon";
    const fruit = K.addEffect({ kind: icon === "persimmon" ? "persimmon" : "fall", icon, x: tree.footX + dx, y: tree.footY + dy, vy: 0, ground: tree.footY + (s.ground || 7) });
    tree.variant = s.variant !== undefined ? s.variant : 1;
    Sound.tap(520);
    await K.wait(0.4);
    if (b) {
      b.thought = null;
      Wildlife.flyTo(b, fruit.x - 6, fruit.ground);
      b.sortY = null;
      await K.wait(0.6);
      for (let i = 0; i < (s.pecks || 2); i++) { b.pose = "peck"; Sound.chirp(b.look.chirp || "tweet", 2400, i); await K.wait(0.25); b.pose = "stand"; await K.wait(0.15); }
    }
    K.removeEffect(fruit);
    if (b) Wildlife.celebrate(b);
    await K.wait(0.6);
  });

  M.birdEats = (s, K) => K.scripted(async () => {
    const birds = birdsOf(s, K);
    const drop = (x, y, left, sortY = null) => K.addEffect({ kind: "fall", icon: s.item, x: x + (left ? -7 : 7), y: y - 6, vy: 0, ground: y + 1, sortY: sortY === null ? undefined : sortY + 0.01 });
    const bits = s.item && ICONS[s.item] ? birds.map((b) => drop(b.x, b.y, b.faceLeft, b.sortY)) : [];
    if (s.magpie && s.item && ICONS[s.item]) { const f = companionFoot(); bits.push(drop(f.x, f.y, companion.faceLeft)); }
    const line = s.lines && s.lines.during;
    let read = !line;
    const talk = line ? K.say(line).then(() => { read = true; }) : null;
    if (s.cheer) Magpie.act("jump", 1.1);
    const n = s.pecks || 2;
    for (let i = 0; (i < n || !read) && i < 16; i++) {
      birds.forEach((b) => { b.pose = "peck"; });
      if (s.magpie) Magpie.pecking(true);
      const who = birds[0] ? birds[0].look : s.magpie ? BIRDS.magpie : null;
      if (who) Sound.chirp(who.chirp || "tweet", who.chirpPitch || 3000, i);
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      if (s.magpie) Magpie.pecking(false);
      await K.wait(i >= n - 1 && !read ? 0.5 : 0.2);
    }
    if (talk) await talk;
    bits.forEach((e) => K.removeEffect(e));
    if (s.magpie) { Magpie.joy(); showEmote("magpie", "heart"); }
    if (s.celebrate !== false) birds.forEach((b, i) => setTimeout(() => Wildlife.celebrate(b), i * 150));
    await K.wait(s.celebrate !== false ? 1.0 : 0.3);
  });

  M.feederFill = (s, K) => K.scripted(async () => {
    const feeder = K.findThing(s.feeder || "birdFeeder");
    const b = K.bird(s.bird);
    if (!feeder) return;
    feeder.variant = s.variant !== undefined ? s.variant : 0;
    feeder.bounce = 0.4;
    Sound.pickup();
    if (b) b.thought = null;
    const back = s.stepBack ? stepBack(feeder, s.stepBack, K) : null;
    await K.wait(0.3);
    const flocks = [].concat(s.flock || { species: "sparrow", count: 3 });
    const total = flocks.reduce((n, f) => n + (f.count || 1), 0);
    let k = 0;
    for (const flock of flocks) {
      const count = flock.count || 1;
      for (let i = 0; i < count; i++, k++) {
        const id = flock.id ? (count === 1 ? flock.id : `${flock.id}${i}`) : undefined;
        const side = k % 2 ? 1 : -1, out = 17 + Math.floor(k / 2) * 12;
        const bird = Wildlife.add({ id, species: flock.species, x: feeder.footX + side * out, y: feeder.footY - 2 + (Math.floor(k / 2) % 2) * 6,
          does: "ground", range: 0.6, story: true, flyIn: true, shy: false });
        bird.faceLeft = side > 0;
        await K.wait(0.15);
      }
    }
    await K.wait(0.6);
    if (b) Wildlife.celebrate(b);
    await K.wait(0.8);
    if (back) await back;
  });

  M.nameTheMagpie = async (s, K) => {
    const name = K.S().magpieName || await K.nameTheMagpie();
    State.set("magpieName", name);
    Sound.hearts();
    if (s.lines && s.lines.named) await K.say(s.lines.named);
  };

  M.celebrate = (s, K) => K.scripted(async () => {
    const birds = s.birds === "all" ? Wildlife.all().filter((b) => b.story && !b.gone) : birdsOf(s, K);
    birds.forEach((b, i) => setTimeout(() => Wildlife.celebrate(b), i * 150));
    Sound.hearts();
    await K.wait(1.2);
  });

  function restingSpot(K, side) {
    const f = K.herFeet(), seat = player.sitting;
    const y0 = seat ? seat.footY + 10 : f.y + 2;
    const xs = seat ? [6, 0, 14, -6, 22] : [16, 24, 8, 32];
    const clear = (x, y) => K.clearOfThings({ x: x - 10, y: y - 6, w: 20, h: 8 });
    const room = (x, y, m) => K.clearOfThings(K.birdBox(x + m * 28, y)) && K.clearOfThings(K.birdBox(x + m * 20, y));
    for (const dy of [0, 6, 12]) for (const dx of xs) for (const m of [side, -side]) {
      const land = { x: f.x + side * dx, y: y0 + dy };
      if (clear(land.x, land.y) && room(land.x, land.y, m)) return { land, from: m };
    }
    return { land: { x: f.x + side * xs[0], y: y0 }, from: side };
  }

  M.crowFeather = async (s, K) => {
    const icon = ICONS[s.icon || "crowFeather"] ? s.icon || "crowFeather" : "feather";
    const airIcon = s.airIcon && ICONS[s.airIcon] ? s.airIcon : icon;
    const f = K.herFeet();
    const him = Husband.state() !== "away" ? Husband.pos() : null;
    const { land, from: side } = restingSpot(K, him && him.x + 8 > f.x ? -1 : 1);
    const top = camera.y + 10;
    const e = K.addEffect({ kind: "drift", icon, airIcon, glint: true, x0: land.x + 36, x1: land.x, x: land.x + 36, y: top, y0: top, ground: land.y, speed: s.speed || 22, sway: 7 });
    if (s.lines && s.lines.seen) {
      await K.wait(1.6);
      showEmote("magpie", "exclaim");
      Sound.tap(900);
      await K.say(s.lines.seen);
    }
    await K.until(() => e.landed);
    await K.scripted(async () => {
      Sound.tap(900);
      if (!(s.lines && s.lines.seen)) showEmote("magpie", "exclaim");
      await K.landed(Magpie.flyTo("perch", land.x + side * (side < 0 ? 28 : 27), land.y, land.y + 0.5));
      Magpie.face(side > 0);
      await Magpie.act("lookDown", 0.7);
      await K.landed(Magpie.flyTo("perch", land.x + side * 20, land.y, land.y + 0.5));
      Magpie.face(side > 0);
      await K.wait(0.2);
      K.removeEffect(e);
      Magpie.carry(icon);
      Magpie.joy();
      Sound.pickup();
      await K.wait(0.6);
      await Magpie.act("shake");                    // not its own: it shakes its head
      await K.wait(0.3);
      Magpie.face(s.pointLeft);         // its beak toward the river
      showEmote("magpie", "exclaim");
      await K.wait(0.5);
    });
    const line = s.lines && (s.lines.say || Object.values(s.lines).find((id) => id !== s.lines.seen));
    if (line) await K.say(line);
    Magpie.flyTo("follow");
  };

  M.peckAt = (s, K) => K.scripted(async () => {
    const birds = birdsOf(s, K);
    const t = addThing(K.placed({ ...s.bits, variant: 0 }));
    t.bounce = 0.3;
    Sound.pickup();
    await K.wait(0.2);
    birds.forEach((b, i) => {
      const side = (i % 2 ? 1 : -1) * (7 + Math.floor(i / 2) * 5);
      goTo(b, t.footX + side, t.footY - 1 + (i > 1 ? 3 : 0));
      b.faceLeft = side > 0;
    });
    await K.wait(0.45);
    const n = s.pecks || 3;
    for (let i = 0; i < n; i++) {
      birds.forEach((b, k) => { b.faceLeft = b.x > t.footX; b.pose = "peck"; if (k === 0) Sound.chirp(b.look.chirp || "tweet", b.look.chirpPitch || 3000, i); });
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      t.variant = Math.min(2, Math.floor(((i + 1) / n) * 3));
      await K.wait(0.25);
    }
    removeThing(t);
    birds.forEach((b, i) => setTimeout(() => Wildlife.celebrate(b), i * 150));
    await K.wait(1.0);
  });

  M.drinkAt = (s, K) => K.scripted(async () => {
    const birds = birdsOf(s, K), bath = K.findThing(s.at || "birdBath");
    if (!bath) return;
    const spots = s.spots || [[-9, -13], [9, -13]];
    const stagger = s.stagger !== undefined ? s.stagger : 1.0;
    await Promise.all(birds.map(async (b, i) => {
      const [dx, dy] = spots[i % spots.length];
      const flight = Wildlife.flyTo(b, bath.footX + dx, bath.footY + dy, 0.8);
      b.sortY = bath.footY + 0.3;
      b.does = "perch";
      if (!(await K.landed(flight))) return null;                         // (it went off instead)
      b.faceLeft = dx > 0;
      await K.wait(i * stagger);
      return b.flight || b.gone ? null : Wildlife.act(b, "drink", s.seconds || 2.6);
    }));
  });

  M.bathe = async (s, K) => {
    const birds = birdsOf(s, K), bath = K.findThing(s.in || "birdBath");
    if (!bath) return;
    K.bathing(bath);
    const water = { x: bath.footX + BATH_WATER.dx, y: bath.footY + BATH_WATER.dy - 2 };
    const spots = birds.length + (s.magpie ? 1 : 0) > 1 ? [-5, 5, 0] : [0];
    await K.scripted(async () => {
      birds.forEach((b, i) => {
        Wildlife.flyTo(b, water.x + spots[i % spots.length], water.y, 0.6);
        b.sortY = bath.footY + 0.3;
        b.does = "perch";
        b.faceLeft = spots[i % spots.length] < 0;
      });
      if (s.magpie) Magpie.flyTo("perch", water.x + (birds.length ? 6 : 0), water.y + 1, bath.footY + 0.35);
      await K.wait(0.8);
      Sound.splash();
    });
    const secs = s.seconds || 3.2, line = s.lines && s.lines.during;
    birds.forEach((b) => Wildlife.act(b, "bathe", line ? 0 : secs));
    const splashing = s.magpie ? Magpie.act("bathe", line ? 0 : secs) : null;
    if (line) {
      await Promise.all([K.wait(secs), K.say(line)]);
      birds.forEach((b) => Wildlife.stop(b));
      if (s.magpie) Magpie.act(null);
    } else await Promise.all([K.wait(secs), splashing]);
    await K.scripted(async () => {
      birds.forEach((b, i) => {
        const side = i % 2 ? 1 : -1;
        goTo(b, bath.footX + side * 9, bath.footY - 13);
        b.faceLeft = side > 0;
      });
      if (s.magpie) Magpie.flyTo("perch", bath.footX + 17, bath.footY + 3, bath.footY + 3.5);     // (out onto the grass beside it)
      await K.wait(0.5);
      K.bathing(null);
    });
  };

  M.bringFruit = async (s, K, ctx) => {
    const tree = K.findThing(s.tree || "persimmonTree");
    const to = K.pos(s.to) || K.herFeet();
    if (!tree) return;
    const [dx, dy] = s.fruit || [13, -28];
    let flight = null;
    await K.scripted(async () => {
      showEmote("magpie", "exclaim");
      Magpie.joy();
      await K.wait(0.6);
      flight = Magpie.flyTo("perch", tree.footX + dx - 5, tree.footY + dy + 4, tree.footY + 0.5);
    });
    await K.landed(flight);
    await K.scripted(async () => {
      await K.wait(0.4);
      K.applyWorld([{ thing: s.tree || "persimmonTree", variant: s.variant !== undefined ? s.variant : 2, glow: false }]);
      Magpie.carry(s.icon || "persimmon");
      tree.bounce = 0.3;
      Sound.pickup();
      await K.wait(0.5);
      flight = Magpie.flyTo("perch", to.x - 10, to.y, to.y + 0.5);
    });
    await K.landed(flight);
    await K.scripted(async () => {
      Magpie.carry(null);
      ctx.fruit = K.addEffect({ kind: "fall", icon: s.icon || "persimmon", x: to.x, y: to.y - 4, vy: 0, ground: to.y, glow: true });
      Sound.tap(520);
      Magpie.joy();
      await K.wait(0.5);
    });
  };

  M.peckTogether = (s, K, ctx) => K.scripted(async () => {
    const fruit = ctx.fruit, birds = birdsOf(s, K);
    if (!fruit) return;
    const places = birds.map((b) => ({ b, home: { ...b.home }, does: b.does, sortY: b.sortY, faceLeft: b.faceLeft }));
    birds.forEach((b, i) => {
      const a = Math.PI * (0.15 + 0.7 * (i + 0.5) / Math.max(1, birds.length));
      const side = i % 2 ? 1 : -1;
      b.sortY = null;                                  // (on the ground now: drawn by where it stands)
      goTo(b, fruit.x + side * (8 + Math.floor(i / 2) * 4), fruit.ground + 1 + Math.sin(a) * 4);
    });
    if (s.magpie) Magpie.flyTo("perch", fruit.x - 9, fruit.ground - 1, fruit.ground - 0.5);
    await K.wait(0.7);
    for (let i = 0; i < (s.pecks || 4); i++) {
      birds.forEach((b) => { b.faceLeft = b.x > fruit.x; b.pose = "peck"; });
      if (s.magpie) { Magpie.face(false); Magpie.pecking(true); }
      Sound.chirp(i % 2 ? "tweet" : "chatter", 2600 + i * 200, i);
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      Magpie.pecking(false);
      await K.wait(0.25);
    }
    K.removeEffect(fruit);
    ctx.fruit = null;
    birds.forEach((b, i) => setTimeout(() => Wildlife.celebrate(b), i * 120));
    if (s.magpie) { Magpie.joy(); showEmote("magpie", "heart"); }
    Sound.hearts();
    await K.wait(1.2);
    for (const p of places) {
      const { b, home } = p;
      const settle = () => { b.sortY = p.sortY; b.faceLeft = p.faceLeft; };
      if (Math.hypot(home.x - b.x, home.y - b.y) > 20) Wildlife.flyTo(b, home.x, home.y, 0.7, { then: settle });
      else { Wildlife.hopTo(b, home.x, home.y); settle(); }
      b.home = { ...home }; b.does = p.does;
    }
    await K.wait(0.8);
  });

  M.hideIn = async (s, K) => Wildlife.hideIn(birdsOf(s, K), K.findThing(s.in));

  M.popOut = async (s, K) => Wildlife.popOut(birdsOf(s, K));

  M.runTo = async (s, K) => {
    const birds = birdsOf(s, K), p = K.pos(s.to);
    return p ? Wildlife.runTo(birds, p.x, p.y) : null;
  };

  M.sleepInRow = async (s, K) => {
    const birds = birdsOf(s, K), p = K.pos(s.at);
    const sortY = s.sortAfter && p ? K.sortAfter(s.sortAfter, p) : null;
    if (p) return Wildlife.roost(birds, p.x, p.y, { gap: s.gap || null, faceLeft: !!s.faceLeft, sortY });
    birds.forEach((b) => { b.does = "perch"; Wildlife.act(b, "sleep"); });
    return null;
  };

  M.pour = async (s, K) => {
    const t = K.findThing(s.into || "birdBath");
    const to = t ? { x: t.footX + BATH_WATER.dx, y: t.footY + BATH_WATER.dy } : null;
    setTimeout(() => { Sound.splash(); if (t && s.variant !== undefined) { t.variant = s.variant; t.bounce = 0.4; } }, 1300);
    await Player.act("pour", to ? { to } : {});
    Sound.splash();
    if (t) { if (s.variant !== undefined) t.variant = s.variant; t.bounce = 0.4; }
    if (s.stepBack) await stepBack(t, s.stepBack, K);
  };

  return M;
})();
