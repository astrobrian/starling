
const Moments = (() => {
  const M = {};
  const birdsOf = (s, K) => [].concat(s.birds || s.bird || []).map((id) => K.bird(id)).filter(Boolean);
  const goTo = (b, x, y) => {
    if (Math.hypot(x - b.x, y - b.y) > 20) Wildlife.flyTo(b, x, y, 0.5);
    else Wildlife.hopTo(b, x, y);
    b.home = { x, y };
  };

  M.fallenStar = async (s, K) => {
    const patch = FLOWER_PATCHES[s.patch || 0];
    companion.mode = "perch"; companion.px = K.px(patch.x + 3); companion.py = K.px(patch.y - 5);
    magpieFlyTo("perch", K.px(patch.x + 1.5), K.px(patch.y - 1.9) + 14, K.px(patch.y - 1.9) + 14);
    K.G.guide = () => (scene.name === "garden" && !Closeup.isOpen() ? { x: K.px(patch.x) + 8, y: K.px(patch.y) + 4 } : null);
    K.resetStar();
    await K.until(() => K.starFound());
    K.G.guide = null;
    await K.scripted(async () => {
      await K.wait(0.8);
      closeCloseup();
      K.hold(s.item || "star");
      showEmote("player", "sparkles");
      await K.wait(0.3);
      magpieFlyTo("follow");
      await K.wait(0.3);
    });
  };

  M.tummy = (s, K) => K.scripted(async () => {
    Sound.buzz();
    K.emote(s.on || "magpie", "sweat");
    await K.wait(0.7);
  });

  M.chirpDuet = (s, K) => K.scripted(async () => {
    const b = K.bird(s.bird);
    for (let i = 0; i < (s.times || 3); i++) {
      Sound.chirp("chatter", 1500, i); companion.joy = 0.35; await K.wait(0.2);
      if (b) { Sound.chirp(b.look.chirp || "tweet", b.look.chirpPitch || 3000, i); Wildlife.greet(b); }
      await K.wait(0.2);
    }
  });

  M.bushPoke = (s, K) => K.scripted(async () => {
    const bush = K.findThing({ thing: s.bush || "berryBush", near: s.near });
    if (!bush) return;
    magpieFlyTo("perch", bush.footX - 12, bush.footY - 2, bush.footY + 1);
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
    if (s.cheer && typeof magpieAct === "function") magpieAct("jump", 1.1);
    const n = s.pecks || 2;
    for (let i = 0; (i < n || !read) && i < 16; i++) {
      birds.forEach((b) => { b.pose = "peck"; });
      if (s.magpie) companion.pecking = true;
      const who = birds[0] ? birds[0].look : s.magpie ? BIRDS.magpie : null;
      if (who) Sound.chirp(who.chirp || "tweet", who.chirpPitch || 3000, i);
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      if (s.magpie) companion.pecking = false;
      await K.wait(i >= n - 1 && !read ? 0.5 : 0.2);
    }
    if (talk) await talk;
    bits.forEach((e) => K.removeEffect(e));
    if (s.magpie) { companion.joy = 0.35; showEmote("magpie", "heart"); }
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

  M.crowFeather = async (s, K) => {
    const icon = ICONS[s.icon || "crowFeather"] ? s.icon || "crowFeather" : "feather";
    const airIcon = s.airIcon && ICONS[s.airIcon] ? s.airIcon : icon;
    const f = K.herFeet();
    const him = typeof Husband !== "undefined" && Husband.state() !== "away" ? Husband.pos() : null;
    const side = him && him.x + 8 > f.x ? -1 : 1;
    const seat = player.sitting;
    const land = seat ? { x: f.x + side * 6, y: seat.footY + 10 } : { x: f.x + side * 16, y: f.y + 2 };
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
      magpieFlyTo("perch", land.x + side * 9, land.y, land.y + 0.5);
      companion.faceLeft = side > 0;
      await K.wait(1.0);
      K.removeEffect(e);
      companion.carry = icon;
      companion.joy = 0.35;
      Sound.pickup();
      await K.wait(0.6);
      await magpieAct("shake");                    // not its own: it shakes its head
      await K.wait(0.3);
      companion.faceLeft = !!s.pointLeft;         // its beak toward the river
      showEmote("magpie", "exclaim");
      await K.wait(0.5);
    });
    const line = s.lines && (s.lines.say || Object.values(s.lines).find((id) => id !== s.lines.seen));
    if (line) await K.say(line);
    magpieFlyTo("follow");
  };

  M.peckAt = (s, K) => K.scripted(async () => {
    const birds = birdsOf(s, K);
    const t = addThing({ ...s.bits, variant: 0 });
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
    birds.forEach((b, i) => {
      const [dx, dy] = spots[i % spots.length];
      Wildlife.flyTo(b, bath.footX + dx, bath.footY + dy, 0.8);
      b.sortY = bath.footY + 0.3;
      b.does = "perch";
    });
    await K.wait(1.0);
    birds.forEach((b, i) => { b.faceLeft = spots[i % spots.length][0] > 0; });
    await Promise.all(birds.map((b) => Wildlife.act(b, "drink", s.seconds || 2.6)));
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
      if (s.magpie) magpieFlyTo("perch", water.x + (birds.length ? 6 : 0), water.y + 1, bath.footY + 0.35);
      await K.wait(0.8);
      Sound.splash();
    });
    const secs = s.seconds || 3.2, line = s.lines && s.lines.during;
    birds.forEach((b) => Wildlife.act(b, "bathe", line ? 0 : secs));
    const splashing = s.magpie ? magpieAct("bathe", line ? 0 : secs) : null;
    if (line) {
      await Promise.all([K.wait(secs), K.say(line)]);
      birds.forEach((b) => Wildlife.stop(b));
      if (s.magpie) magpieAct(null);
    } else await Promise.all([K.wait(secs), splashing]);
    await K.scripted(async () => {
      birds.forEach((b, i) => {
        const side = i % 2 ? 1 : -1;
        goTo(b, bath.footX + side * 9, bath.footY - 13);
        b.faceLeft = side > 0;
      });
      if (s.magpie) magpieFlyTo("perch", bath.footX + 17, bath.footY + 3, bath.footY + 3.5);     // (out onto the grass beside it)
      await K.wait(0.5);
      K.bathing(null);
    });
  };

  M.bringFruit = async (s, K, ctx) => {
    const tree = K.findThing(s.tree || "persimmonTree");
    const to = K.pos(s.to) || K.herFeet();
    if (!tree) return;
    const [dx, dy] = s.fruit || [13, -28];
    await K.scripted(async () => {
      showEmote("magpie", "exclaim");
      companion.joy = 0.35;
      await K.wait(0.6);
      magpieFlyTo("perch", tree.footX + dx - 5, tree.footY + dy + 4, tree.footY + 0.5);
    });
    await K.until(() => !companion.flight);
    await K.scripted(async () => {
      await K.wait(0.4);
      K.applyWorld([{ thing: s.tree || "persimmonTree", variant: s.variant !== undefined ? s.variant : 2, glow: false }]);
      companion.carry = s.icon || "persimmon";
      tree.bounce = 0.3;
      Sound.pickup();
      await K.wait(0.5);
      magpieFlyTo("perch", to.x - 10, to.y, to.y + 0.5);
    });
    await K.until(() => !companion.flight);
    await K.scripted(async () => {
      companion.carry = null;
      ctx.fruit = K.addEffect({ kind: "fall", icon: s.icon || "persimmon", x: to.x, y: to.y - 4, vy: 0, ground: to.y, glow: true });
      Sound.tap(520);
      companion.joy = 0.35;
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
    if (s.magpie) magpieFlyTo("perch", fruit.x - 9, fruit.ground - 1, fruit.ground - 0.5);
    await K.wait(0.7);
    for (let i = 0; i < (s.pecks || 4); i++) {
      birds.forEach((b) => { b.faceLeft = b.x > fruit.x; b.pose = "peck"; });
      if (s.magpie) { companion.faceLeft = false; companion.pecking = true; }
      Sound.chirp(i % 2 ? "tweet" : "chatter", 2600 + i * 200, i);
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      companion.pecking = false;
      await K.wait(0.25);
    }
    K.removeEffect(fruit);
    ctx.fruit = null;
    birds.forEach((b, i) => setTimeout(() => Wildlife.celebrate(b), i * 120));
    if (s.magpie) { companion.joy = 0.35; showEmote("magpie", "heart"); }
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

  M.hideIn = async (s, K) => {
    const birds = birdsOf(s, K), bush = K.findThing(s.in);
    if (typeof Wildlife.hideIn === "function") return Wildlife.hideIn(birds, bush);
    birds.forEach((b) => { b.underwater = true; });       // (for now: out of sight)
    return null;
  };

  M.popOut = async (s, K) => {
    const birds = birdsOf(s, K), bush = K.findThing(s.from || s.in);
    if (typeof Wildlife.popOut === "function") return Wildlife.popOut(birds, bush);
    await K.scripted(async () => {
      birds.forEach((b, i) => {
        b.underwater = false;
        if (bush) { b.x = bush.footX; b.y = bush.footY - 6; Wildlife.flyTo(b, bush.footX + (i - (birds.length - 1) / 2) * 12, bush.footY + 10 + (i % 2) * 5, 0.6); }
      });
      Sound.chirp("tweet", 3200);
      await K.wait(0.8);
    });
    return null;
  };

  M.runTo = async (s, K) => {
    const birds = birdsOf(s, K), p = K.pos(s.to);
    if (!p) return null;
    if (typeof Wildlife.runTo === "function") return Wildlife.runTo(birds, p.x, p.y);
    birds.forEach((b, i) => { Wildlife.flyTo(b, p.x + (i - (birds.length - 1) / 2) * 10, p.y); b.home = { x: b.flight.to.x, y: b.flight.to.y }; });
    await K.wait(1.6);
    return null;
  };

  M.sleepInRow = async (s, K) => {
    const birds = birdsOf(s, K), p = K.pos(s.at);
    const sortY = s.sortAfter && p ? K.sortAfter(s.sortAfter, p) : null;
    if (p && typeof Wildlife.roost === "function") return Wildlife.roost(birds, p.x, p.y, { gap: s.gap || null, faceLeft: !!s.faceLeft, sortY });
    birds.forEach((b, i) => {
      if (p) { b.x = b.home.x = p.x + (i - (birds.length - 1) / 2) * 9; b.y = b.home.y = p.y; }
      if (sortY !== null) b.sortY = sortY;
      b.does = "perch";
      if (typeof Wildlife.act === "function") Wildlife.act(b, "sleep"); else Wildlife.showEmote(b, "zzz");
    });
    return null;
  };

  M.pour = async (s, K) => {
    const t = K.findThing(s.into || "birdBath");
    const to = t ? { x: t.footX + BATH_WATER.dx, y: t.footY + BATH_WATER.dy } : null;
    if (typeof Player !== "undefined" && Player && typeof Player.act === "function") {
      setTimeout(() => { Sound.splash(); if (t && s.variant !== undefined) { t.variant = s.variant; t.bounce = 0.4; } }, 1300);
      await Player.act("pour", to ? { to } : {});
    } else await K.wait(0.6);
    Sound.splash();
    if (t) { if (s.variant !== undefined) t.variant = s.variant; t.bounce = 0.4; }
    if (s.stepBack && t) {
      const [dx, dy] = s.stepBack, spot = { x: player.nx + dx, y: player.ny + dy };
      if (isWalkable(spot.x, spot.y) && !hiddenBehind(spot.x, spot.y)) {
        walkToward(spot);
        player.faceAt = { x: t.x, y: t.y };
        await K.until(() => !isMoving() && !player.path.length);
      }
    }
  };

  return M;
})();
