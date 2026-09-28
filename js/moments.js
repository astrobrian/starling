
const Moments = (() => {
  const M = {};
  const birdsOf = (s, K) => [].concat(s.birds || s.bird || []).map((id) => K.bird(id)).filter(Boolean);

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
    const bits = s.item && ICONS[s.item] ? birds.map((b) => K.addEffect({ kind: "fall", icon: s.item, x: b.x + (b.faceLeft ? -7 : 7), y: b.y - 6, vy: 0, ground: b.y + 1 })) : [];
    for (let i = 0; i < (s.pecks || 2); i++) {
      birds.forEach((b) => { b.pose = "peck"; });
      if (birds[0]) Sound.chirp(birds[0].look.chirp || "tweet", birds[0].look.chirpPitch || 3000, i);
      await K.wait(0.3);
      birds.forEach((b) => { b.pose = "stand"; });
      await K.wait(0.2);
    }
    bits.forEach((e) => K.removeEffect(e));
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
    const flock = s.flock || { species: "sparrow", count: 3 };
    for (let i = 0; i < (flock.count || 3); i++) {
      const bird = Wildlife.add({ id: flock.id ? `${flock.id}${i}` : undefined, species: flock.species, x: feeder.footX + (i - 1) * 14, y: feeder.footY + 6 + (i % 2) * 5,
        does: "ground", range: 1.2, story: true, flyIn: true, shy: false });
      bird.faceLeft = i === 2;
      await K.wait(0.15);
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
    const land = { x: f.x + side * 16, y: f.y + 2 };
    const e = K.addEffect({ kind: "drift", icon, airIcon, x0: land.x, x: land.x, y: camera.y - 12, ground: land.y, speed: s.speed || 22, sway: 7 });
    await K.until(() => e.landed);
    await K.scripted(async () => {
      Sound.tap(900);
      showEmote("magpie", "exclaim");
      magpieFlyTo("perch", land.x - side * 9, land.y, land.y + 0.5);
      companion.faceLeft = side < 0;
      await K.wait(1.0);
      K.removeEffect(e);
      companion.joy = 0.35;
      Sound.pickup();
      await K.wait(0.4);
    });
    const line = s.lines && (s.lines.say || Object.values(s.lines)[0]);
    if (line) await K.say(line);
    magpieFlyTo("follow");
  };

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
    if (typeof Wildlife.sleepInRow === "function") {
      const r = await Wildlife.sleepInRow(birds, p && p.x, p && p.y);
      if (sortY !== null) birds.forEach((b) => { b.sortY = sortY; });
      return r;
    }
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
    if (typeof Player !== "undefined" && Player && typeof Player.act === "function") await Player.act("pour");
    else await K.wait(0.6);
    Sound.splash();
    if (t) { if (s.variant !== undefined) t.variant = s.variant; t.bounce = 0.4; }
  };

  return M;
})();
