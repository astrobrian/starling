
const Story = (() => {
  let busyCount = 0;               // while a little scene plays, her taps wait
  let waiters = [];                // things the story is waiting for
  let pending = null;              // walking over to a bird: what to do on arrival
  const G = {
    hint: null,                    // the line the magpie says again when she taps it
    guide: null,                   // a sparkle over where to go next: () => { x, y, room, soft, edgeOnly }
    thought: null,                 // the magpie's thought bubble (an icon name)
    onMagpie: null,                // she tapped the magpie: () => true if the story took the tap
    onRoof: null,                  // she tapped the roof of her house: () => true if the story took the tap
    alone: false,                  // going out alone (Day 1): the magpie isn't waiting outside her door
    closeupStar: false,            // the fallen star waits in the flower close-up (Day 1: js/moments.js fallenStar)
  };
  let listeners = [];              // she reached a thing: [{ type, fn }]
  let placeWatchers = [];          // she went somewhere else: [fn(from, to)]
  let touched = new Map();         // things the world state changed, and how they were built
  let takenAway = [];              // things the world state took away: [{ t, place }]
  let added = [];                  // things the world state added: [{ t, place }]
  let starFound = false;           // Day 1: she picked up the star in the close-up
  let started = false;
  let current = null;              // the favor (or morning) being played: { day, id, key, taken, engaged }
  let epoch = 0;                   // which chain of the story is alive (ending a day early starts a new one)
  let evening = null;              // the day is ending: { day, from, skippable }
  let morning = false;             // their morning together is playing
  let activity = 0;                // how many things she has tapped (the story's sense of her playing)

  const S = () => State.get();
  const done = (step) => State.isDone(step);
  const mark = (step) => State.markDone(step);
  const NEVER = new Promise(() => {});
  const STOP = Object.assign(new Error("(the day ended: this part of the story stops here)"), { stop: true });
  const caught = (e) => { if (!(e && e.stop)) setTimeout(() => { throw e; }); };
  const wait = (seconds) => { const e = epoch; return new Promise((ok) => setTimeout(() => { if (e === epoch) ok(); }, seconds * 1000)); };
  const waitOrTap = (seconds) => {
    const e = epoch, world = document.getElementById("world");
    return new Promise((ok) => {
      let timer = null;
      const done = () => { clearTimeout(timer); world.removeEventListener("pointerdown", done); if (e === epoch) ok(); };
      timer = setTimeout(done, seconds * 1000);
      world.addEventListener("pointerdown", done);
    });
  };
  const frame = (part) => { const v = (window.DAY_FRAME || {})[part]; return v ?? {}; };
  const until = (test) => new Promise((ok) => { if (test()) ok(); else waiters.push({ test, ok }); });
  const px = (tiles) => tiles * TILE;
  const garden = () => SCENES.garden.world;
  const roomWorld = () => ensureScene("room").world;
  const worldOf = (place) => (place === "room" ? roomWorld() : garden());
  const herFeet = () => { const p = playerPixelPos(); return { x: p.x + 8, y: p.y + 14 }; };
  const near = (x, y, tiles, place = "garden") => scene.name === place && Math.hypot(herFeet().x - x, herFeet().y - y) <= tiles * TILE;
  const DAY = (n) => (window.DAYS || {})[n] || null;
  const morningOf = (d) => (Array.isArray(d.morning) ? { steps: d.morning } : d.morning || { steps: [] });

  async function speak(id, words = null) {
    const inline = id && typeof id === "object";
    const line = inline ? id : LINES[id];
    if (!line) { console.warn(`Starling: there's no line "${id}" in data/dialogue.js`); return null; }
    const shown = inline ? Speech.say(null, line) : Speech.say(id);
    if (words && words.length) {
      const n = ((line.text || "").match(/[A-Za-z']+/g) || []).length;
      await wait(0.3 + n * 0.15);
      learn(...words);
    }
    return shown;
  }
  async function say(id, words = null) {
    const reply = await speak(id, words);
    const line = (id && typeof id === "object" ? id : LINES[id]) || {};
    if (reply === "?" && line.explain) await speak(line.explain);
    return reply;
  }

  async function scripted(fn) {
    const e = epoch;
    busyCount++;
    try { return await fn(); } finally { if (e === epoch) busyCount = Math.max(0, busyCount - 1); }
  }

  function learn(...words) {
    const fresh = [];
    for (const w of words) {
      const m = Speech.met(w);                     // (the line she met it in, and who said it)
      if (!Words.learn(w, m.who || Speech.speaker(), m.text)) continue;
      Speech.lightUp(w);
      fresh.push(w);
    }
    if (!fresh.length) return;
    Effects.floatWords(fresh);
    showEmote("player", "sparkles");
  }

  function friend(species, { quiet = false, id = null } = {}) {
    State.friend(species, id || (current && current.key));
    if (!quiet) Sound.hearts();
  }

  function setPhase(phase, glide = 3, music = null) {
    State.set("phase", phase);
    Daylight.set(phase, glide);
    Wildlife.schedule(S().day, phase, garden(), glide === 0);
    Sound.playMusic(music || (phase === "night" ? "night" : "day"));
  }

  function hold(item) {
    State.set("holding", item);
    if (item) Sound.pickup();
  }
  const holding = () => S().holding;

  const placeOf = (ref, place = null) => (ref && typeof ref === "object" && !Array.isArray(ref) && ref.place) || place || "garden";
  const refOf = (ref) => (typeof ref === "string" ? { thing: ref } : ref || {});

  function kindFits(ref, t) {
    const r = refOf(ref);
    if (!t || t.type !== r.thing) return false;
    if (r.color !== undefined && COLOR_WORDS[t.color] !== r.color && t.color !== r.color) return false;
    if (r.species !== undefined && t.species !== r.species) return false;
    if (r.patch !== undefined && t.patch !== r.patch) return false;
    return true;
  }
  function thingsOf(ref, place = null) {
    return worldOf(placeOf(ref, place)).things.filter((t) => kindFits(ref, t));
  }
  function findThing(ref, place = null, from = null) {
    const r = refOf(ref), where = placeOf(r, place);
    const all = thingsOf(r, where);
    const spot = r.near || r.at ? pos(r.near || r.at, where) : from;
    if (!spot) return all[0] || null;
    return all.reduce((a, t) => (!a || Math.hypot(t.footX - spot.x, t.footY - spot.y) < Math.hypot(a.footX - spot.x, a.footY - spot.y) ? t : a), null);
  }
  function fits(ref, t) {
    const r = refOf(ref);
    if (!kindFits(r, t)) return false;
    return r.near || r.at ? findThing(r) === t : true;
  }

  function pos(ref, place = null) {
    if (!ref) return null;
    if (Array.isArray(ref)) return { x: ref[0] * TILE, y: ref[1] * TILE };
    if (ref === "her") return herFeet();
    if (ref === "door") return placeOf(null, place) === "room" || (!place && scene.name === "room") ? doorSpot() : houseDoor();
    if (typeof ref === "string") { const t = findThing(ref, place); return t && { x: t.footX, y: t.footY }; }
    const where = placeOf(ref, place);
    let p = null;
    if (ref.tile) p = { x: ref.tile[0] * TILE, y: ref.tile[1] * TILE };
    else if (ref.thing) { const t = findThing(ref, where); p = t && { x: t.footX, y: t.footY }; }
    else if (ref.bird) { const b = Wildlife.get(ref.bird); p = b && { x: b.x, y: b.y }; }
    else if (ref.patch !== undefined) { const f = FLOWER_PATCHES[ref.patch]; p = f && { x: f.x * TILE + 8, y: f.y * TILE + 8 }; }
    else if (ref.her) p = herFeet();
    else if (ref.magpie) p = companionFoot();
    else if (ref.door) p = where === "room" ? doorSpot() : houseDoor();
    return p && { x: p.x + (ref.dx || 0), y: p.y + (ref.dy || 0) };
  }

  function placed(o, place = "garden") {
    if (!o.at) return o;
    const p = pos(o.at, place), [w, h] = thingKind(o.type, worldOf(place)).size;
    const { at, ...rest } = o;
    return { ...rest, x: p.x / TILE - w / 2, y: p.y / TILE - h };
  }

  function sortAfter(ref, spot) {
    const t = findThing(ref, null, spot);
    return t ? t.footY + 0.5 : null;
  }

  function clearOfThings(box, except = null, place = "garden", slack = 0) {
    const w = worldOf(place);
    let touching = 0;
    for (const t of w.things) {
      if (t.flat || (except && except(t))) continue;
      const kind = thingKind(t.type, w);
      if (kind && kind.name === null) continue;
      const s = thingSprite(t, 1), x0 = t.footX - s.ax, y0 = t.footY - s.ay;
      if (box.x + box.w <= x0 || box.x >= x0 + s.canvas.width || box.y + box.h <= y0 || box.y >= y0 + s.canvas.height) continue;
      for (let y = box.y; y < box.y + box.h; y += 2) {
        for (let x = box.x; x < box.x + box.w; x += 2) if (isSolid(s.canvas, Math.floor(x - x0), Math.floor(y - y0)) && ++touching > slack) return false;
      }
    }
    return true;
  }
  const birdBox = (x, y) => ({ x: x - 7, y: y - 13, w: 14, h: 12 });

  function guideTo(ref, o = {}) {
    const place = placeOf(ref, o.place);
    const since = performance.now();
    const opts = { ...(typeof ref === "object" && !Array.isArray(ref) ? ref : {}), ...o };
    return () => {
      if (opts.delay && performance.now() - since < opts.delay * 1000) return null;
      if (Closeup.isOpen() || (opts.unlessHolding && holding())) return null;
      if (scene.name !== place) {
        if (opts.stay) return null;
        if (place === "room" && scene.name === "garden") return houseDoor();
        if (place === "garden" && scene.name === "room") return { ...doorSpot(), room: true };
        return null;
      }
      const isBird = typeof ref === "object" && ref && ref.bird, b = isBird ? Wildlife.get(ref.bird) : null;
      if (isBird && (!b || b.gone)) return null;
      const p = pos(ref, place);
      const span = b ? { top: Wildlife.headTop(b).y, bottom: b.y } : {};
      return p && { x: p.x, y: p.y, room: place === "room", soft: !!opts.soft, edgeOnly: !!opts.edgeOnly, talking: !!opts.talking, ...span };
    };
  }

  function touch(t) { if (!touched.has(t)) touched.set(t, t.variant); }
  function takeAway(t, place = "garden") {
    const w = worldOf(place);
    if (!w.things.includes(t)) return;
    removeThing(t, w);
    takenAway.push({ t, place });
  }
  function resetWorld() {
    for (const [t, v] of touched) t.variant = v;
    touched = new Map();
    for (const { t, place } of takenAway) restoreThing(t, worldOf(place));
    takenAway = [];
    for (const { t, place } of added) removeThing(t, worldOf(place));
    added = [];
    Effects.clearGlows();
  }
  function applyWorld(entries, today = true) {
    for (const e of [].concat(entries || [])) {
      if (!e || (e.today && !today)) continue;
      if (e.unlessHolding && holding() === e.unlessHolding) continue;      // (not while she carries it: her breakfast tray)
      const place = e.place || "garden";
      if (e.thing) {
        const t = findThing({ thing: e.thing, near: e.near, at: e.at, color: e.color, place }, place);
        if (t) {
          if (e.variant !== undefined) { touch(t); t.variant = e.variant; }
          if (e.glow) Effects.glow(t, e.glow);
          if (e.glow === false) Effects.unglow(t);       // (its glow goes out: the saved persimmon, eaten)
          if (e.remove) takeAway(t, place);
        }
      }
      if (e.add) added.push({ t: addThing(placed(e.add, place), worldOf(place)), place });
      if (e.birds) for (const b of e.birds) storyBird(b);
    }
  }
  function applyAllWorld() {
    resetWorld();
    const day = S().day;
    for (let n = 1; n <= day; n++) {
      const d = DAY(n);
      if (!d) continue;
      const parts = [{ key: `d${n}_wake`, world: morningOf(d).world }, ...(d.favors || []).map((f) => ({ key: `d${n}_${f.id}`, world: f.world }))];
      for (const p of parts) {
        if (!p.world) continue;
        if (done(p.key)) applyWorld(p.world.after, n === day);
        else if (n === day) applyWorld(p.world.during, true);
      }
    }
  }

  function setUpWorld() {
    Wildlife.clear();
    Wildlife.schedule(S().day, S().phase, garden(), true);
    Effects.clear();
    perchedOutside = null;
    Magpie.carry(null);                                      // (nothing in the magpie's beak on a new day)
    for (const k of Object.keys(PORTRAIT_LOOKS)) setPortraitLook(k, null);
    applyAllWorld();
  }

  function lookWith(base, over) {
    const out = { ...base };
    for (const [k, v] of Object.entries(over || {})) out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? { ...base[k], ...v } : v;
    return out;
  }

  function storyBird(spec) {
    const have = Wildlife.get(spec.id);
    if (have) return have;
    if (!BIRDS[spec.species]) { console.warn(`Starling: no bird "${spec.species}" in data/birds.js`); return null; }
    if (spec.portrait && spec.look) setPortraitLook(spec.species, spec.look);
    const at = pos(spec.at || "her") || herFeet();
    if (spec.borrow) {
      const mine = Wildlife.all().filter((b) => !b.story && !b.gone && b.species === spec.species)
        .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
      if (mine) {
        mine.id = spec.id; mine.story = true; mine.favor = spec.favor !== false;
        if (spec.thought !== undefined) mine.thought = spec.thought;
        if (spec.greets) mine.greets = spec.greets;
        return mine;
      }
    }
    const b = Wildlife.add({
      id: spec.id, story: true, favor: spec.favor !== false, species: spec.species, x: at.x, y: at.y,
      does: spec.does || "perch", range: spec.range, faceLeft: spec.faceLeft, thought: spec.thought, shy: spec.shy, pose: spec.pose, flyIn: spec.flyIn,
      sortY: spec.sortAfter ? sortAfter(spec.sortAfter, at) : spec.sortY,
      look: spec.look ? lookWith(BIRDS[spec.species], spec.look) : undefined,
    });
    if (spec.greets) b.greets = spec.greets;
    if (spec.lag) b.lag = spec.lag;
    if (spec.act) Wildlife.act(b, spec.act, 0);     // (asleep: the parrotbills in their bush)
    return b;
  }

  const STAND_BY = 1.2;
  function talkTo(bird, close = 0) {
    return new Promise((ok) => {
      let over = false;
      const reach = () => { if (over) return; over = true; ok("tap"); };
      bird.onReach = reach;
      if (!close) return;
      const ground = () => ({ x: bird.x, y: bird.sortY !== null && bird.sortY !== undefined ? Math.max(bird.y, bird.sortY) : bird.y });
      const near = () => {
        if (over || bird.onReach !== reach) return over;
        if (scene.name !== "garden" || changingPlace || isMoving() || player.path.length || pending || bird.flight || bird.gone || bird.hiddenIn) return false;
        if (player.still < STAND_BY || Speech.isOpen() || busyCount) return false;
        const g = ground(), f = herFeet();
        return Math.hypot(f.x - g.x, f.y - g.y) <= close * TILE;
      };
      waiters.push({ test: near, ok: () => {
        if (over) return;
        over = true;
        if (bird.onReach === reach) bird.onReach = null;
        faceToward(Math.floor(bird.x / TILE), Math.floor((bird.y - 2) / TILE));
        Wildlife.greet(bird);
        ok("near");
      } });
    });
  }

  function approach(point, then, wet = false, bird = null) {
    const her = herFeet();
    const tx = point.x / TILE, ty = point.y / TILE;
    const close = Math.hypot(her.x - point.x, her.y - point.y) <= 2.3 * TILE;
    const faceSpot = { x: Math.floor(tx), y: Math.floor(ty - 0.2) };
    const bubble = bird && bird.thought ? (() => { const h = Wildlife.headTop(bird); return { l: h.x - 2 * CUE, r: h.x + 18 * CUE, t: h.y - 17 * CUE - 3, b: h.y }; })() : null;
    const underBubble = (x, y) => !!bubble && x * TILE < bubble.r && (x + 1) * TILE > bubble.l && (y - 1) * TILE < bubble.b && (y + 1) * TILE > bubble.t;
    if (close && !isMoving() && !underBubble(player.nx, player.ny)) { faceToward(faceSpot.x, faceSpot.y); then(); return; }
    let best = null;
    const mine = bankSide(player.nx, player.ny);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.floor(tx) + dx, y = Math.floor(ty - 0.2) + dy;
        if (!isWalkable(x, y) || "bo".includes(WORLD.tile(x, y))) continue;
        if (wet && bankSide(x, y) !== mine) continue;
        const reach = Math.hypot(x + 0.5 - tx, y + 0.9 - ty);
        if (reach > 2.2 || reach < 0.6) continue;
        const cx = (x + 0.5) * TILE, feet = (y + 1) * TILE;
        const underIt = Math.abs(point.x - cx) < 20 && point.y > feet - 40 && point.y < feet;
        const d = Math.abs(x - player.nx) + Math.abs(y - player.ny) + (hiddenBehind(x, y) ? 4 : 0) + (underIt ? 4 : 0) + (underBubble(x, y) ? 4 : 0);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (!best && wet) best = nearestBankOnHerSide(Math.floor(tx), Math.floor(ty));
    if (!best) best = { x: Math.floor(tx), y: Math.floor(ty) };
    walkToward(best);
    player.interact = null;
    if (!player.path.length && !isMoving()) { faceToward(faceSpot.x, faceSpot.y); then(); return; }
    player.faceAt = faceSpot;
    pending = then;
  }

  function walkThere(ref, place = "garden") {
    const t = refOf(ref).thing ? findThing(ref, place) : null;
    if (t) { walkToThing(t); player.interact = null; return true; }
    const p = pos(ref, place);
    if (p) walkToward({ x: Math.floor(p.x / TILE), y: Math.floor((p.y - 2) / TILE) });
    return true;
  }

  const WINDOW_SILL = () => { const w = findThing("window", "room"); return { x: w.footX, y: w.footY - 8, sortY: w.footY + 0.5 }; };

  async function magpieToWindow() {
    const sill = WINDOW_SILL();
    Magpie.from(sill.x + 90, sill.y - 60);
    Magpie.face(true);
    Magpie.flyTo("window", sill.x, sill.y, sill.sortY);
    await wait(0.8);
  }

  async function tapTapTap(soft = false) {
    Magpie.pecking(true);
    for (let i = 0; i < 3; i++) { Sound.tap(1150, soft ? 0.08 : undefined); await wait(0.2); }
    Magpie.pecking(false);
  }

  const flyingAway = () => companion.flight && companion.flight.mode === "away";
  async function magpieFliesOff() {
    if (flyingAway() || (companion.mode === "away" && !companion.flight)) return;
    const f = companionFoot();
    Magpie.flyTo("away", f.x + 120, f.y - 90);
    await wait(1);
  }

  async function magpieJoins() {
    const f = herFeet();
    Magpie.from(f.x - 110, f.y - 70);
    Magpie.flyTo("follow");
    await wait(0.9);
  }

  function magpieDo(m) {
    if (m === "follow" || m === "head") Magpie.flyTo(m);
    else if (m === "away") magpieFliesOff();
    else if (m === "nest") Magpie.flyTo("away", px(10), px(18));
    else if (m === "joy") Magpie.joy();
    else if (m && typeof m === "object") {
      const spot = m.perch || m.fly;
      const p = spot && pos(spot, m.place);
      const sortOf = (q) => (m.sortAfter ? sortAfter(m.sortAfter, q) : m.sortY !== undefined ? m.sortY : q.y + 0.5);
      if (p) Magpie.flyTo("perch", p.x, p.y, sortOf(p));
      const at = m.sit && pos(m.sit, m.place);
      if (at) Magpie.at("perch", at.x, at.y, sortOf(at));
      if (m.face) Magpie.face(m.face === "left");
      if (m.joy) Magpie.joy();
      if ("carry" in m) Magpie.carry(m.carry);
    }
  }

  function emote(on, name) {
    if (on === "her" || on === "player") showEmote("player", name);
    else if (on === "magpie" || !on) showEmote("magpie", name);
    else { const b = Wildlife.get(on); if (b) Wildlife.showEmote(b, name); }
  }

  function doorSpot() {
    const d = roomWorld().door;
    return { x: d.x * TILE + 8, y: d.y * TILE - 2 };
  }
  const houseDoor = () => { const h = findThing("house"); return { x: h.footX, y: h.footY - 4 }; };
  const bedSpot = () => { const b = findThing("bed", "room"); return { x: b.footX, y: b.footY - 22, room: true }; };

  async function outside(o = {}) {
    const day = S().day;
    if (done(`d${day}_sky`)) return;             // back at night after the stars: straight to bed
    const d = DAY(day);
    const alone = !!o.alone && !(d && (d.favors || []).some((f) => done(`d${day}_${f.id}`)));
    G.alone = alone;
    if (scene.name !== "garden") {
      const since = performance.now(), delay = (o.delay !== undefined ? o.delay : 2.3) * 1000;
      G.guide = () => (scene.name === "room" && performance.now() - since > delay ? { ...doorSpot(), room: true } : null);
      await until(() => scene.name === "garden" && !changingPlace);
      G.guide = null;
    }
    G.alone = false;
    if (o.learn) learn(...o.learn);
    if (!alone && companion.mode === "away") await magpieJoins();
  }

  const bedFront = (bed) => ({ x: bed.x, y: bed.y + bed.h });
  const hisSpot = (bed) => ({ x: bed.x * TILE + 18, y: (bed.y + bed.h) * TILE });
  const pick = (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : "");

  async function wakeUp(day) {
    const bed = findThing("bed", "room");
    const night = done(`d${day}_sky`);
    const both = !!S().slept && !night;
    placeHer("room", bedFront(bed), "right");
    player.hidden = true;
    bed.variant = both ? 2 : 1;
    if (both) { const h = hisSpot(bed); Husband.routine.at(h.x, h.y, "left"); Husband.routine.hide(true); }
    Magpie.away();
    const picked = S().dollDay === day ? S().doll : null;
    if (picked) Dolls.reset(picked); else Dolls.ids().forEach((id) => Dolls.set(id, "snuggled"));
    const d = DAY(day), knock = both && !!d && d.wakeUp === "magpie" && !done(`d${day}_wake`);
    const knocking = knock ? scripted(async () => { await wait(0.3); await magpieToWindow(); await tapTapTap(true); }) : null;
    if (!night) await showDayCard(day);
    if (knocking) await knocking;
    if (both) { await ourMorning(day, bed); return true; }
    bed.variant = 0;
    player.hidden = false;
    Sound.pickup();
    if (!picked && !night) Dolls.ids().forEach((id, i) => Dolls.hopTo(id, "bench", 0.3 + i * 0.2));
    await wait(picked ? 0.3 : 0.6);
    return false;
  }

  async function ourMorning(day, bed) {
    morning = true;
    try {
      await scripted(async () => {
        bed.variant = 0;
        player.hidden = false;
        Husband.routine.hide(false);
        Sound.pickup();
        const picked = S().dollDay === day ? S().doll : null;
        if (!picked) Dolls.ids().forEach((id, i) => Dolls.hopTo(id, "bench", 0.3 + i * 0.2));
        await wait(1.0);
        const L = Husband.routine.lines();
        await Speech.say(null, { who: "husband", text: pick(L.morning), face: "joy", replies: LINES[FRAME_LINES.morningReply].replies });
        const watching = companion.mode === "window" && !companion.flight;
        if (watching) wait(0.9).then(() => { if (companion.mode === "window") { Magpie.joy(); showEmote("magpie", "heart"); } });
        await kiss();
        await wait(0.3);
        Husband.routine.pose("wave", "down");
        Husband.says(pick(L.goodDay));
        await wait(1.8);
        await Husband.routine.leave();
      });
    } finally { morning = false; }
    S().slept = false;
    State.save();
  }

  async function kiss() {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    const her = playerPixelPos(), him = Husband.pos();
    let side = him.x >= her.x ? 1 : -1;
    if (!isWalkable(player.nx + side, player.ny) && isWalkable(player.nx - side, player.ny)) side = -side;
    await Husband.routine.walk(Math.round(her.x) + side * 13, Math.round(her.y)); live();
    player.facing = side > 0 ? "right" : "left";
    Husband.routine.facing(side > 0 ? "left" : "right");
    await wait(0.35); live();
    const leaning = Player.act("kiss", { face: player.facing, seconds: 1.7 });
    Husband.routine.pose("kiss");
    await wait(0.35); live();
    Husband.routine.heart(Math.round(her.x) + 8 + side * 6.5, Math.round(her.y) - TILE + 1);
    await wait(1.25); live();
    Husband.routine.pose(null);
    await Promise.race([leaning, wait(0.6)]); live();          // (her lean ends, or soon)
  }

  async function chooseDoll(day) {
    if (S().dollDay === day && S().doll) return;
    const id = await Cards.doll();
    State.set("doll", id);
    State.set("dollDay", day);
    (async () => {
      Dolls.hopTo(id, "back");
      await wait(0.6);
      Dolls.waveGoodbye(1.6);
      await wait(1.7);
      Dolls.ids().filter((x) => x !== id).forEach((x, i) => Dolls.hopTo(x, "bed", i * 0.3));
    })();
    await wait(0.3);
  }

  async function morningAtWindow(day, d, woke = false) {
    const atWindow = () => companion.mode === "window" || (companion.flight && companion.flight.mode === "window");
    if (done(`d${day}_wake`)) {
      if (woke && S().again) {
        if (understands()) await friendsWaiting(day, d);
        else {
          await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
          const m = morningOf(d);
          await playSteps(day, { id: "wake", steps: m.steps }, false);
          if (atWindow()) magpieFliesOff();
        }
      }
      await againAtWindow(day, d);
      if (atWindow()) magpieFliesOff();
      return;
    }
    if (!atWindow()) await scripted(async () => { await magpieToWindow(); await tapTapTap(); });      // (on Day 1 it's on the sill already)
    const m = morningOf(d);
    await playSteps(day, { id: "wake", steps: m.steps, world: m.world });
    if (atWindow()) magpieFliesOff();
  }

  async function friendsWaiting(day, d) {
    await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
    G.thought = waitingThought(day, d);
    await say(FRAME_LINES.friendsWaiting);
    G.thought = null;
  }

  async function againAtWindow(day, d) {
    if (!d.again || !understands()) return;
    if (!(companion.mode === "window" || (companion.flight && companion.flight.mode === "window"))) {
      await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
    }
    await playSteps(day, { id: "again", steps: d.again }, false);
    applyAllWorld();
  }

  function waitingThought(day, d) {
    const f = (d.favors || []).find((x) => !done(`d${day}_${x.id}`));
    if (!f) return null;
    const left = Favors.stepsLeft(f, done, `d${day}_${f.id}`);
    let found = null;
    const birds = () => { for (const b of f.birds || []) if (!found && typeof b.thought === "string") found = b.thought; };
    const scan = (steps) => {
      for (const st of [].concat(steps || [])) {
        if (found || !st || typeof st !== "object") continue;
        if (typeof st.thought === "string") { found = st.thought; return; }
        for (const k of ["steps", "scene", "then", "else"]) if (st[k]) scan(st[k]);
      }
    };
    if (left.resumed) { scan(left.steps); birds(); } else { birds(); scan(left.steps); }
    return found && ICONS[found] ? found : null;
  }

  function skyBridge(since = State.sinceDawn()) {
    const s = S();
    return {
      birds: (s.bridge || []).map((b) => ({ species: b.species, day: b.day, fresh: since.bridge.includes(b.id) })),
      friends: (s.friends || []).map((sp) => ({ species: sp, day: (s.friendDay || {})[sp] || 1, fresh: since.friends.includes(sp) })),
    };
  }

  function nightLines(night, words) {
    const stars = words.filter((w) => Sky.conOf(w)).length;
    const F = FRAME_LINES, look = stars === 1 && F.newStar ? F.newStar : F.newStars;
    if (night.lines) return [].concat(night.lines).filter((id) => id !== F.newStars || words.length).map((id) => (id === F.newStars ? look : id));
    if (night.tomorrow) return [night.tomorrow];
    return words.length ? [look] : [];
  }
  async function nightLine(line) {
    if (line && typeof line === "object") {
      if (line.look) { Sky.lookAt(line.look); await wait(1.2); }
      if (line.say) await say(line.say);
      return;
    }
    if ((line === FRAME_LINES.newStars || line === FRAME_LINES.newStar) && Sky.lookAtNew()) await wait(1.2);
    await say(line);
  }

  function storyDone(day) {
    const d = DAY(day);
    if (!d) return true;
    return done(`d${day}_wake`) && (d.favors || []).every((f) => done(`d${day}_${f.id}`));
  }

  let askingHome = false;
  async function headHome() {
    G.hint = null; G.guide = null;
    const T = frame("goHome");
    let asked = false, since = null;
    G.onMagpie = () => { if (scene.name !== "garden") return false; asked = true; askHome(); return true; };
    await until(() => {
      const free = scene.name === "garden" && !changingPlace && companion.mode !== "away" && !companion.flight
        && !busyCount && !Speech.isOpen() && !Closeup.isOpen() && !Sky.isOpen() && !UI.bubbleShowing()
        && !Quirks.playing() && !Husband.wondering();
      if (!free) since = null;
      else if (since === null) since = performance.now();
      return asked || (since !== null && performance.now() - since >= T.freeFor * 1000 && player.still >= T.stillFor);
    });
    if (!asked) askHome();
    await NEVER;                                   // (the evening takes over from here: endDay)
  }
  async function askHome() {
    if (askingHome || evening || Speech.isOpen() || scene.name !== "garden" || changingPlace) return;
    const e = epoch;
    askingHome = true;
    const reply = await speak(FRAME_LINES.headHome);
    askingHome = false;
    if (e !== epoch || evening) return;
    const yes = LINES[FRAME_LINES.headHome].replies[0];
    if (reply === yes) endDay("garden");
    else if (reply && FRAME_LINES.headHomeLater) say(FRAME_LINES.headHomeLater);
  }

  function askSleep() {
    if (!started || evening || morning || busyCount || Speech.isOpen() || scene.name !== "room" || player.hidden) return;
    Cards.sleep(() => endDay("room"));
  }

  function stopChains() {
    epoch++;
    waiters = []; listeners = []; placeWatchers = []; pending = null; busyCount = 0;
    if (current) restoreTaken(current);
    current = null;
    Object.assign(G, { hint: null, guide: null, thought: null, onMagpie: null, onRoof: null, alone: false, closeupStar: false });
    freeVisit = null; askingHome = false;
    for (const b of Wildlife.all()) { b.onReach = null; b.onTap = null; }
    if (holding()) State.set("holding", null);
    Player.stop();
    if (companion.act) Magpie.act(null);
    if (Speech.isOpen()) { if (Speech.typing()) Speech.tap(); Speech.close(); }
  }

  function endDay(from) {
    if (evening || !started) return;
    const day = S().day;
    stopChains();
    evening = { day, from, skippable: true };
    theEvening(day, from).catch(caught);
  }

  async function theEvening(day, from) {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    const d = DAY(day) || {};
    const finished = storyDone(day);
    const night = finished ? d.night || {} : {};
    evening.skippable = d.skipEvening !== false && !(finished && (night.hook || night.chapterEnd || night.card || night.learn));
    await carryHome(); live();
    if (Husband.state() !== "together") Husband.reset();
    if (Daylight.phase() !== "sunset" && Daylight.phase() !== "night") setPhase("sunset");
    if (from === "garden") {
      G.hint = FRAME_LINES.sunset;
      G.guide = () => (scene.name === "garden" ? { ...houseDoor() } : null);
      if (scene.name === "garden" && companion.mode !== "away" && !nearHome()) {
        if (FRAME_LINES.headHomeFollow) { await say(FRAME_LINES.headHomeFollow); live(); }
        const eave = porchPerch(porchBench());
        Magpie.flyTo("perch", eave.x, eave.y, eave.sortY);
      }
      await until(() => !changingPlace && ((scene.name === "garden" && nearHome()) || scene.name === "room")); live();
      G.guide = null; G.hint = null;
    }
    const kissInRoom = scene.name === "room";
    await scripted(async () => {
      player.path = []; player.interact = null;
      UI.hideBubble();
      if (player.sitting) { standUp(); await wait(0.3); live(); }        // (she stands up to greet him)
      await until(() => !isMoving()); live();
      const together = Husband.state() === "together";
      if (together) Husband.routine.here();                 // (walking with her already: he's home)
      else { await Husband.routine.comeHome(frame("evening").homeIn); live(); }     // (he hurries home: DAY_FRAME.evening.homeIn)
      showSkip();
      if (!together) { Husband.says(pick(Husband.routine.lines().home)); await wait(1.3); live(); }
      if (kissInRoom) { await kiss(); live(); await wait(0.3); live(); }
    });
    await porch(day, finished, night, !kissInRoom); live();
    await bedtime(day);
  }
  const nearHome = () => { const f = herFeet(), dr = houseDoor(); return Math.hypot(f.x - dr.x, f.y - dr.y) < 4.5 * TILE; };
  async function carryHome() {
    if (scene.name === "garden" || scene.name === "room") return;
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    if (Sky.isOpen()) Sky.close();
    await until(() => !Sky.isOpen() && !changingPlace); live();
    goHome();
    await until(() => (scene.name === "garden" || scene.name === "room") && !changingPlace); live();
  }
  const porchBench = () => findThing({ thing: "bench", near: "door" }, "garden");
  const porchMusic = () => frame("evening").music;

  async function porch(day, finished, night, kissFirst = false) {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    const bench = porchBench(), eave = porchPerch(bench);
    const T = frame("evening");
    const onEave = () => companion.mode === "perch" && !companion.flight && Math.hypot(companion.px - eave.x, companion.py - eave.y) < 2;
    const sitDown = () => {
      const from = playerPixelPos();
      player.sitting = bench; player.seatDx = -8; player.facing = "down"; player.fishMoment = true; player.still = 0;
      const p = playerPixelPos();
      if (kissFirst) player.hop = { dx: from.x - p.x, dy: from.y - p.y, t: 0.2, dur: 0.2 };
      Husband.routine.sit(Math.round(p.x) + 16, Math.round(p.y), bench.footY + 0.5);
    };
    await scripted(async () => {
      await fadeTo(true, true); live();
      upClose(true, false);
      UI.hideBubble();
      const waiting = onEave();
      for (const t of garden().things.filter((o) => o !== bench && !o.blocks && o.y === bench.y && o.x < bench.x + bench.w && o.x + o.w > bench.x)) takeAway(t);
      placeHer("garden", { x: bench.x, y: bench.y + 1 }, "down");
      if (kissFirst) {
        const side = isWalkable(player.nx + 1, player.ny) || !isWalkable(player.nx - 1, player.ny) ? 1 : -1, p = playerPixelPos();
        player.facing = side > 0 ? "right" : "left";
        Husband.routine.at(Math.round(p.x) + side * 13, Math.round(p.y), side > 0 ? "left" : "right");
      } else sitDown();
      if (waiting && understands()) { Magpie.at("perch", eave.x, eave.y, eave.sortY); Magpie.face(false); }
      else { Magpie.away(); }
      Dolls.ids().filter((id) => Dolls.where(id) === "bed").forEach((id) => Dolls.set(id, "snuggled"));
      await fadeTo(false, true); live();
      if (kissFirst) { await kiss(); live(); await wait(0.3); live(); sitDown(); }
      if (Daylight.phase() !== "night") { await wait(T.sunsetFor); live(); setPhase("night", T.nightFalls, porchMusic()); await waitOrTap(T.nightWait); live(); }
      else Sound.playMusic(porchMusic());
      if (!understands()) { await wait(2.4); live(); return; }      // (Day 1 before the star: the magpie isn't hers yet)
      if (!onEave()) {
        Magpie.from(eave.x + 48, eave.y - 36);
        Magpie.flyTo("perch", eave.x, eave.y, eave.sortY);
        Magpie.face(false);
        await wait(T.magpieFlies); live();
      }
      Magpie.act("lookUp", 2.6);          // (it points its beak up as it says it)
      await say(night.lookUp || FRAME_LINES.lookUp); live();
      if (night.learn) learn(...night.learn);
      const since = State.sinceDawn();
      const closed = Sky.show(day, since.words, { bridge: skyBridge(since), porch: true });
      await until(() => Sky.settled()); live();
      await wait(0.6); live();
      for (const line of nightLines(night, since.words)) { await nightLine(line); live(); }
      Sky.close();
      await closed; live();
    });
    if (night.hook) {
      hideSkip();
      await nightHook(day, night.hook); live();
    }
    mark(`d${day}_sky`);
    if (understands()) {
      await say(FRAME_LINES.porchNight); live();
      Magpie.flyTo("away", px(10), px(18));                   // (off to roost in the big tree)
      await wait(0.8); live();
    }
    await scripted(async () => { await nightCards(night); live(); });
  }
  function porchPerch(bench) {
    const house = findThing("house");
    const x = house ? Math.min(house.x + house.w, bench.x + 1) * TILE - 12 : bench.footX - 20;
    const y = house ? house.footY - 34 : bench.footY - 30;
    return { x, y, sortY: house ? house.footY + 0.4 : bench.footY + 1 };
  }

  async function afterTheSky(day) {
    const bed = findThing("bed", "room");
    if (scene.name === "room") { const h = hisSpot(bed); Husband.routine.at(h.x, h.y, "left"); }
    evening = { day, from: "room", skippable: false };
    G.guide = () => (scene.name === "room" ? bedSpot() : { ...houseDoor() });
    await new Promise((ok) => { const stop = listen("bed", () => { stop(); ok(); }); });
    G.guide = null;
    await bedtime(day);
  }

  function showSkip() {
    const b = document.getElementById("evening-skip");
    if (!b || !evening || !evening.skippable) return;
    b.textContent = UI_TEXT.skipEvening;
    b.classList.remove("hidden");
  }
  function hideSkip() { const b = document.getElementById("evening-skip"); if (b) b.classList.add("hidden"); }
  function skipEvening() {
    const b = document.getElementById("evening-skip");
    if (!evening || !b || b.classList.contains("hidden")) return;
    const day = evening.day;
    hideSkip();
    stopChains();
    document.getElementById("day-card").classList.add("hidden");
    if (Sky.isOpen()) Sky.close();
    UI.hideBubble();
    Magpie.at("away");
    const night = storyDone(day) ? (DAY(day) || {}).night || {} : {};
    if (night.learn) learn(...night.learn);
    if (!done(`d${day}_sky`)) mark(`d${day}_sky`);
    Sound.tap(700);
    bedtime(day).catch(caught);
  }
  if (document.getElementById("evening-skip")) {
    document.getElementById("evening-skip").addEventListener("click", (ev) => { ev.stopPropagation(); skipEvening(); });
  }

  async function nightCards(night) {
    const more = night.chapterEnd && UI_TEXT.toBeContinued;
    if (night.card || night.chapterEnd) await showCard(UI_TEXT[night.card || "theEnd"] || night.card, night.chapterEnd && !more ? UI_TEXT.moreDays : "", night.chapterEnd && !more ? 5 : 3.5, "star", 1.5, true);
    if (more) await showCard(UI_TEXT.toBeContinued, UI_TEXT.moreDays || "", 4, "star", 1.5, true);
  }

  async function nightHook(day, hook) {
    const steps = typeof hook === "string" ? [{ moment: hook }] : Array.isArray(hook) ? hook : [hook];
    await playSteps(day, { id: "hook", key: `d${day}_sky`, steps }, false);        // (marked with the night sky)
  }

  async function diaryPage(day) {
    try { await Diary.bedtime(day); } catch (e) { setTimeout(() => { throw e; }); }
  }

  const nextDay = (day) => (DAY(day) || DAY(day + 1) ? day + 1 : day);

  async function bedtime(day, skipped = false) {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    hideSkip();
    await scripted(async () => {
      await fadeTo(true, true); live();
      upClose(false, false);    // (the porch was up close: tomorrow the garden is as she likes it)
      if (Sky.isOpen()) Sky.close();
      UI.hideBubble();
      const bed = findThing("bed", "room");
      placeHer("room", bedFront(bed), "right");
      const h = hisSpot(bed);
      Husband.routine.at(h.x, h.y, "left");
      Magpie.away();
      State.set("phase", "night");
      Daylight.set("night", 0);
      if (Sound.musicStatus().name !== porchMusic()) Sound.playMusic("night");     // (the porch's love theme carries on to bed)
      const mine = Dolls.carried();
      Dolls.ids().filter((id) => id !== mine).forEach((id) => Dolls.set(id, "snuggled"));
      if (mine) State.keepDiaryDoll(day, mine);
      await fadeTo(false, true); live();
      if (!skipped) {
        await diaryPage(day); live();
        Husband.says(pick(Husband.routine.lines().goodnight));
        await wait(1.5); live();
      }
      player.hidden = true;
      Husband.routine.hide(true);
      bed.variant = 2;
      if (mine) Dolls.hopTo(mine, "snuggled", 0.15);
      Sound.sleep();
      await wait(1.6); live();
      if (storyDone(day) && ((DAY(day) || {}).night || {}).chapterEnd) { await Backup.offer(); live(); }
      await fadeTo(true, true); live();                         // the light goes out
      const again = !storyDone(day) && !!DAY(day);
      const next = again ? day : nextDay(day);
      if (!again && next === day) State.clearDay(day);          // (a free day comes again: fresh)
      State.nextMorning(next, again);
      evening = null;
      Daylight.set("morning", 0);
      Sound.playMusic("day");
      setUpWorld();
      await wait(0.4); live();
      await fadeTo(false, true); live();
    });
    run();
  }

  async function showDayCard(day) {
    await showCard(`${UI_TEXT.day} ${day}`, "", 1.5, "sun", 0.3, true);
  }

  const showCard = (title, sub = "", seconds = 3, icon = "star", tapAfter = 1.5, low = false) => Cards.show(title, sub, seconds, icon, tapAfter, low, wait);

  async function playSteps(day, f, keep = true) {
    const key = f.key || `d${day}_${f.id}`;
    if (keep && done(key)) return;
    const k = liveK();
    const ctx = { day, id: f.id, key, favor: f, taken: [], engaged: false, round: 0 };
    current = ctx;
    for (const b of f.birds || []) storyBird(b);
    await Favors.play(f, k, ctx);
    if (k.stale()) throw STOP;                  // (the day ended while she was in it: it waits for tomorrow)
    restoreTaken(ctx);
    G.hint = null; G.guide = null; G.thought = null; G.onMagpie = null; G.onRoof = null;
    current = null;
    if (!keep) return;
    mark(key);
    applyAllWorld();
    if (f.phase || f.noon) setPhase(f.phase || "noon");
    else if (S().again && Daylight.phase() === "morning") setPhase("noon");   // (a day that goes on: noon after her first favor today)
  }

  function restoreTaken(ctx) {
    for (const { t, place } of (ctx && ctx.taken) || []) {
      const w = worldOf(place);
      if (!w.things.includes(t)) restoreThing(t, w);
    }
    if (ctx) ctx.taken = [];
  }

  async function playDay(day, d, woke) {
    if (done(`d${day}_sky`)) return afterTheSky(day);
    const next = (d.favors || []).find((f) => !done(`d${day}_${f.id}`));
    const carried = next && Favors.holdingAt(next, done, `d${day}_${next.id}`);
    if (carried) State.set("holding", carried);
    await morningAtWindow(day, d, woke);
    await chooseDoll(day);
    const k = liveK();
    await Favors.run(d.out || [{ outside: {} }], k, { day, id: "out", key: `d${day}_out`, taken: [], engaged: false });
    if (k.stale()) throw STOP;
    let played = null;
    for (const f of d.favors || []) {
      if (done(`d${day}_${f.id}`)) continue;
      if (played && leadsOff(f)) await breath();
      await playSteps(day, f);
      favorBeat(f);
      played = f;
    }
    await headHome();
  }

  function favorBeat(f) {
    const b = (f.birds || []).map((x) => Wildlife.get(x.id)).find((x) => x && !x.gone && !x.act && !x.hiddenIn && !x.flight);
    if (b) Wildlife.celebrate(b);
    if (companion.mode !== "away" && !companion.flight && !companion.act) Magpie.joy();
  }
  const QUIET_STEPS = ["bird", "thought", "emote", "guide", "world", "wait", "sound", "hint", "magpie"];
  function leadsOff(f) {
    if (f.breath !== undefined) return !!f.breath;
    const first = (f.steps || []).find((s) => !(s && typeof s === "object" && QUIET_STEPS.some((k) => k in s) && !("meet" in s) && !("near" in s)));
    return !!(first && typeof first === "object" && (first.meet || first.near) && first.lead);
  }
  async function breath() {
    const secs = frame("breath"), since = performance.now();
    let tapped = false;
    G.onMagpie = () => { tapped = true; return true; };
    await until(() => tapped || isMoving() || player.path.length > 0 || performance.now() - since > secs * 1000);
    G.onMagpie = null;
  }

  async function freeDay(day, woke) {
    if (done(`d${day}_sky`)) return afterTheSky(day);
    let last = null;
    for (let n = day - 1; n >= 1 && !last; n--) last = DAY(n);
    const thought = ((last || {}).night || {}).thought;
    const keep = thought && ICONS[thought] ? thought : null;
    await morningAtWindow(day, { morning: [...(keep ? [{ thought: keep }] : []), FRAME_LINES.freeMorning] }, woke);
    await chooseDoll(day);
    await outside();
    G.hint = FRAME_LINES.freeDay;
    G.thought = keep;
    let visits = 0;
    const counted = new Set();
    freeVisit = (key) => { if (!counted.has(key)) { counted.add(key); visits++; } };
    await until(() => visits >= 6);
    setPhase("noon");
    await until(() => visits >= 12);
    freeVisit = null;
    G.hint = null;
    await headHome();
  }
  let freeVisit = null;

  async function dayLoop() {
    const day = S().day;
    setUpWorld();
    Daylight.set(S().phase || "morning", 0);
    Sound.playMusic(S().phase === "night" ? "night" : "day");
    const woke = await wakeUp(day);
    const d = DAY(day);
    if (d) await playDay(day, d, woke); else await freeDay(day, woke);
  }
  function run() { dayLoop().catch(caught); }

  function listen(type, fn) {
    const l = { type, fn };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }
  function onPlace(fn) {
    placeWatchers.push(fn);
    return () => { placeWatchers = placeWatchers.filter((x) => x !== fn); };
  }

  const K = {
    G, S, done, mark, wait, until, scripted, speak, say, learn, hold, holding, friend, setPhase, px,
    garden, room: roomWorld, worldOf, placeOf, herFeet, near, pos, placed, findThing, thingsOf, fits, sortAfter, guideTo,
    storyBird, lookWith, bird: (id) => Wildlife.get(id), talkTo, walkThere, emote, magpieDo, magpieFliesOff, outside,
    walkToBird: (b) => tapBird(b),
    clearOfThings, birdBox,
    isFriend: (species) => (S().friends || []).includes(species) || (S().bridge || []).some((x) => x.species === species),
    listen, onPlace, takeAway, applyWorld, applyAllWorld, restoreTaken, nameTheMagpie: () => Cards.nameMagpie(), showCard, greetBird: (b) => greetBird(b),
    landed: (p) => { const e = epoch; return new Promise((ok) => Promise.resolve(p).then((v) => { if (e === epoch) ok(v); })); },
    bathing: (b) => Effects.setBathing(b),
    addEffect: (e) => Effects.add(e),
    removeEffect: (e) => Effects.remove(e),
    starFound: () => starFound,
    resetStar: () => { starFound = false; },
    current: () => current,
    busy: () => busyCount > 0,
    stale: () => false,
  };

  const QUIET = ["speak", "say", "wait", "until", "landed", "scripted", "learn", "hold", "friend", "setPhase", "mark", "magpieDo", "magpieFliesOff",
    "outside", "emote", "nameTheMagpie", "showCard", "talkTo", "walkThere", "applyWorld", "applyAllWorld", "restoreTaken", "takeAway"];
  function liveK(e = epoch) {
    const k = Object.create(K);
    const dead = () => e !== epoch;
    for (const name of QUIET) { const f = K[name]; k[name] = (...a) => (dead() ? NEVER : f(...a)); }
    k.listen = (type, fn) => (dead() ? () => {} : K.listen(type, fn));
    k.onPlace = (fn) => (dead() ? () => {} : K.onPlace(fn));
    k.stale = dead;
    return k;
  }

  function prepare() {
    Favors.check();                      // (the days' data: warnings in the console)
    State.load();
    const bed = findThing("bed", "room");
    placeHer("room", { x: bed.x + 2, y: bed.y + 2 }, "down");
    player.hidden = true;
    bed.variant = 1;
    Magpie.away();
    Dolls.ids().forEach((id) => Dolls.set(id, "snuggled"));
    Daylight.set(State.get().phase === "night" ? "night" : "morning", 0);
  }

  function start() {
    if (started) return;
    started = true;
    const s = S(), d = DAY(s.day);
    let phase = "morning";
    if (done(`d${s.day}_sky`)) phase = "night";
    else if (d && !s.slept) for (const f of d.favors || []) if (done(`d${s.day}_${f.id}`) && (f.phase || f.noon)) phase = f.phase || "noon";
    s.phase = phase;
    s.holding = null;
    State.save();
    run();
  }

  function update(dt, time) {
    waiters = waiters.filter((w) => { if (w.test()) { w.ok(); return false; } return true; });
  }

  function reached(t) {
    activity++;
    const waited = listeners.some((l) => l.type === t.type);
    for (const l of listeners.slice()) if (l.type === t.type) l.fn(t);
    if (freeVisit) freeVisit(`thing:${t.type}`);
    if (t.type === "bed" && !waited) setTimeout(() => { if (!isMoving()) askSleep(); }, 450);
  }

  function tapRoof(gx, gy) {
    activity++;
    return !!(G.onRoof && G.onRoof(gx, gy));
  }

  function greetBird(bird) {
    Wildlife.greet(bird);
    Wildlife.showEmote(bird, "heart");
    Sound.hearts();
    const doll = Dolls.carried(), h = Wildlife.headTop(bird);
    UI.tinySay(doll ? dollText("greet", doll) : bird.name, gameToScreen(h.x, h.y));
  }

  function tapBird(bird) {
    const greets = bird.greets === true || (bird.greets === "sunset" && Daylight.phase() === "sunset");
    if (greets && !bird.onTap && !bird.onReach) {
      activity++;
      greetBird(bird);
      return true;
    }
    activity++;
    if (bird.onTap) { bird.onTap(); return true; }
    if (freeVisit) freeVisit(`bird:${bird.species}`);
    if (!bird.onReach) return false;
    const wet = ["swim", "wade", "still"].includes(bird.does);
    approach({ x: bird.x, y: bird.y - 2 }, () => { Wildlife.greet(bird); const f = bird.onReach; if (f) { bird.onReach = null; f(); } }, wet, bird);
    return true;
  }

  function tapMagpie() {
    activity++;
    if (G.onMagpie && G.onMagpie()) return true;
    if (G.hint && !Speech.isOpen()) { say(G.hint); return true; }
    return false;
  }

  function stopped() {
    if (pending && !isMoving() && !player.path.length) {
      const then = pending;
      pending = null;
      then();
    }
  }

  function cancelPending() { pending = null; }

  function tapEffect(gx, gy) {
    if (!Effects.tap(gx, gy)) return false;
    activity++;
    return true;
  }

  function closeupTap(hit) {
    if (hit && hit.star) { starFound = true; return true; }
    return false;
  }

  let perchedOutside = null;
  function changedPlace(from, to) {
    if (from === "garden" && to !== "garden" && companion.mode === "perch" && !companion.flight) {
      perchedOutside = { x: companion.px, y: companion.py, sortY: companion.sortY, faceLeft: companion.faceLeft };
      Magpie.away();
    } else if (to === "garden" && perchedOutside) {
      const p = perchedOutside;
      perchedOutside = null;
      if (companion.mode === "away" && !companion.flight) { Magpie.at("perch", p.x, p.y, p.sortY); Magpie.face(p.faceLeft); }
    }
    if (to === "garden" && from === "room" && companion.mode === "away" && !G.alone && understands()) {
      const f = herFeet();
      Magpie.awayAt(f.x - 110, f.y - 70);
    }
    for (const fn of placeWatchers.slice()) fn(from, to);
  }

  let understandFavor;
  function understands() {
    if (!started) return true;
    if (understandFavor === undefined) {
      understandFavor = null;
      for (const n of Object.keys(window.DAYS || {}).map(Number).sort((a, b) => a - b)) {
        const f = (DAY(n).favors || []).find((x) => x.understand);
        if (f) { understandFavor = { day: n, key: `d${n}_${f.id}` }; break; }
      }
    }
    const u = understandFavor;
    return !u || S().day > u.day || done(u.key);
  }

  const closeupOptions = () => ({ star: started && !!G.closeupStar && !starFound });

  const inFavor = () => !!(current && current.engaged);

  function drawOverlay(ctx, time) {
    Effects.drawOverlay(ctx, time);                 // (something drifting down through the air: js/effects.js)
    if (G.thought && companion.mode !== "away" && !companion.flight) Cues.thought(ctx, G.thought, time);
    Cues.guides(ctx, [].concat((G.guide && G.guide()) || []), time);
  }

  return {
    prepare, start, update, reached, tapBird, tapMagpie, tapRoof, tapEffect, stopped, cancelPending, closeupTap, changedPlace,
    understands, closeupOptions, inFavor, drawOverlay,
    busy: () => busyCount > 0,
    wants: (what) => (what === "magpie" ? !!G.onMagpie : !!what && listeners.some((l) => l.type === what.type)),
    inRoutine: () => !!evening || morning,
    evening: () => (evening ? { ...evening } : null),
    endDay: (from = scene.name === "room" ? "room" : "garden") => endDay(from),
    frame,
    skip: () => skipEvening(),
    play: (steps) => Favors.run(steps, K, { day: S().day, id: "test", key: "test", taken: [], engaged: false }),
    inView: () => ({ guides: [].concat((G.guide && G.guide()) || []), birds: ((current && current.favor && current.favor.birds) || []).map((b) => b.id), thought: !!G.thought }),
    debug: () => ({ day: S().day, phase: S().phase, done: Object.keys(S().done), learned: Object.keys(S().learned), holding: holding(), hint: G.hint, thought: G.thought, busy: busyCount, friends: S().friends,
      waitingFor: [...new Set(listeners.map((l) => l.type))], magpie: companion.mode,
      favor: current ? current.key : null, inFavor: inFavor(), bridge: State.bridgeBirds() }),
  };
})();
