
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
  };
  let listeners = [];              // she reached a thing: [{ type, fn }]
  let placeWatchers = [];          // she went somewhere else: [fn(from, to)]
  let effects = [];                // little things in the garden: a fallen persimmon, star candies, a drifting feather
  let glows = [];                  // soft lights on things (the saved persimmon): [{ t, dx, dy, r, color }]
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
    floatWords(fresh);
    showEmote("player", "sparkles");
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
    rows.forEach((row, r) => {
      const width = total(row.map((i) => widths[i]));
      let x = Math.max(EDGE, Math.min(window.innerWidth - EDGE - width, at.x - width / 2 + (r ? widths[row[0]] / 2 : 0)));
      for (const i of row) {
        els[i].style.left = `${Math.round(x + widths[i] / 2)}px`;
        els[i].style.top = `${Math.round(base - r * ROW)}px`;
        x += widths[i] + GAP;
      }
    });
    els.forEach((el, i) => setTimeout(() => {
      el.style.visibility = "";
      el.style.animation = "";
      Sound.twinkle();
      setTimeout(() => el.remove(), 2000);
    }, i * 650));
  }

  function friend(species, { quiet = false, id = null } = {}) {
    State.friend(species, id || (current && current.key));
    if (!quiet) Sound.hearts();
  }

  function setPhase(phase, glide = 3) {
    State.set("phase", phase);
    Daylight.set(phase, glide);
    Wildlife.schedule(S().day, phase, garden(), glide === 0);
    Sound.playMusic(phase === "night" ? "night" : "day");
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

  function sortAfter(ref, spot) {
    const t = findThing(ref, null, spot);
    return t ? t.footY + 0.5 : null;
  }

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
      if (typeof ref === "object" && ref && ref.bird) { const b = Wildlife.get(ref.bird); if (!b || b.gone) return null; }
      const p = pos(ref, place);
      return p && { x: p.x, y: p.y, room: place === "room", soft: !!opts.soft, edgeOnly: !!opts.edgeOnly };
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
    glows = [];
  }
  function applyWorld(entries, today = true) {
    for (const e of [].concat(entries || [])) {
      if (!e || (e.today && !today)) continue;
      const place = e.place || "garden";
      if (e.thing) {
        const t = findThing({ thing: e.thing, near: e.near, at: e.at, color: e.color, place }, place);
        if (t) {
          if (e.variant !== undefined) { touch(t); t.variant = e.variant; }
          if (e.glow) glows.push({ t, ...e.glow });
          if (e.remove) takeAway(t, place);
        }
      }
      if (e.add) added.push({ t: addThing(e.add, worldOf(place)), place });
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
    effects = [];
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
    const at = pos(spec.at || "her") || herFeet();
    if (spec.borrow) {
      const mine = Wildlife.all().filter((b) => !b.story && !b.gone && b.species === spec.species)
        .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
      if (mine) {
        mine.id = spec.id; mine.story = true; mine.favor = spec.favor !== false;
        if (spec.thought !== undefined) mine.thought = spec.thought;
        if (spec.greets) mine.greets = true;
        return mine;
      }
    }
    const b = Wildlife.add({
      id: spec.id, story: true, favor: spec.favor !== false, species: spec.species, x: at.x, y: at.y,
      does: spec.does || "perch", range: spec.range, faceLeft: spec.faceLeft, thought: spec.thought, shy: spec.shy, pose: spec.pose, flyIn: spec.flyIn,
      sortY: spec.sortAfter ? sortAfter(spec.sortAfter, at) : spec.sortY,
      look: spec.look ? lookWith(BIRDS[spec.species], spec.look) : undefined,
    });
    if (spec.greets) b.greets = true;
    if (spec.lag) b.lag = spec.lag;
    return b;
  }

  function talkTo(bird) {
    return new Promise((ok) => { bird.onReach = ok; });
  }

  function approach(point, then, wet = false) {
    const her = herFeet();
    const tx = point.x / TILE, ty = point.y / TILE;
    const close = Math.hypot(her.x - point.x, her.y - point.y) <= 2.3 * TILE;
    const faceSpot = { x: Math.floor(tx), y: Math.floor(ty - 0.2) };
    if (close && !isMoving()) { faceToward(faceSpot.x, faceSpot.y); then(); return; }
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
        const d = Math.abs(x - player.nx) + Math.abs(y - player.ny) + (hiddenBehind(x, y) ? 4 : 0) + (underIt ? 4 : 0);
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
    companion.px = sill.x + 90; companion.py = sill.y - 60;
    companion.mode = "perch"; companion.faceLeft = true;
    magpieFlyTo("window", sill.x, sill.y, sill.sortY);
    await wait(0.8);
  }

  async function tapTapTap() {
    companion.pecking = true;
    for (let i = 0; i < 3; i++) { Sound.tap(1150); await wait(0.2); }
    companion.pecking = false;
  }

  const flyingAway = () => companion.flight && companion.flight.mode === "away";
  async function magpieFliesOff() {
    if (flyingAway() || (companion.mode === "away" && !companion.flight)) return;
    const f = companionFoot();
    magpieFlyTo("away", f.x + 120, f.y - 90);
    await wait(1);
  }

  async function magpieJoins() {
    const f = herFeet();
    companion.mode = "perch"; companion.px = f.x - 110; companion.py = f.y - 70;
    magpieFlyTo("follow");
    await wait(0.9);
  }

  function magpieDo(m) {
    if (m === "follow" || m === "head") magpieFlyTo(m);
    else if (m === "away") magpieFliesOff();
    else if (m === "nest") magpieFlyTo("away", px(10), px(18));
    else if (m === "joy") companion.joy = 0.35;
    else if (m && typeof m === "object") {
      const spot = m.perch || m.fly;
      const p = spot && pos(spot, m.place);
      if (p) magpieFlyTo("perch", p.x, p.y, m.sortAfter ? sortAfter(m.sortAfter, p) : m.sortY !== undefined ? m.sortY : p.y + 0.5);
      if (m.face) companion.faceLeft = m.face === "left";
      if (m.joy) companion.joy = 0.35;
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
    companion.mode = "away"; companion.flight = null;
    const picked = S().dollDay === day ? S().doll : null;
    if (picked) Dolls.reset(picked); else Dolls.ids().forEach((id) => Dolls.set(id, "snuggled"));
    if (!night) await showDayCard(day);
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
        await Speech.say(null, { who: "husband", text: pick(L.morning) || "Good morning!", face: "joy", replies: (LINES.morning_reply || {}).replies || ["Good morning!"] });
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
    const id = await dollCard();
    State.set("doll", id);
    State.set("dollDay", day);
    S().dollOf = { ...(S().dollOf || {}), [day]: id };
    State.save();
    (async () => {
      Dolls.hopTo(id, "back");
      await wait(0.6);
      Dolls.waveGoodbye(1.6);
      await wait(1.7);
      Dolls.ids().filter((x) => x !== id).forEach((x, i) => Dolls.hopTo(x, "bed", i * 0.3));
    })();
    await wait(0.3);
  }

  function dollCard() {
    return new Promise((ok) => {
      const $ = (x) => document.getElementById(x);
      const card = $("doll-card"), choices = $("doll-choices"), picked = $("doll-picked");
      $("doll-ask").textContent = DOLL_TEXT.ask;
      choices.innerHTML = "";
      choices.classList.remove("chosen");
      picked.classList.add("hidden");
      let chosen = null;
      for (const d of DOLLS) {
        const btn = document.createElement("button");
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const sp = renderDoll(d.id, "sit");
        c.getContext("2d").drawImage(sp.canvas, Math.round(12 - sp.canvas.width / 2), 24 - sp.canvas.height);
        const label = document.createElement("span");
        label.textContent = d.name;
        btn.append(c, label);
        btn.addEventListener("click", () => {
          if (chosen) return;
          chosen = d.id;
          btn.classList.add("picked");
          choices.classList.add("chosen");
          picked.textContent = dollText("picked", d.id);
          picked.classList.remove("hidden");
          Sound.hearts();
          let closed = false;
          const close = () => { if (closed) return; closed = true; card.onpointerdown = null; card.classList.add("hidden"); ok(d.id); };
          setTimeout(close, 1200);
          setTimeout(() => { if (!closed) card.onpointerdown = close; }, 250);      // a tap goes on at once
        });
        choices.appendChild(btn);
      }
      card.classList.remove("hidden");
    });
  }

  async function morningAtWindow(day, d, woke = false) {
    if (done(`d${day}_wake`)) {
      if (woke && S().again) {
        if (understands()) await friendsWaiting(day, d);
        else {
          await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
          const m = morningOf(d);
          await playSteps(day, { id: "wake", steps: m.steps }, false);
          if (companion.mode === "window" || (companion.flight && companion.flight.mode === "window")) magpieFliesOff();
        }
      }
      return;
    }
    await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
    const m = morningOf(d);
    await playSteps(day, { id: "wake", steps: m.steps, world: m.world });
    if (companion.mode === "window" || (companion.flight && companion.flight.mode === "window")) magpieFliesOff();
  }

  async function friendsWaiting(day, d) {
    await scripted(async () => { await magpieToWindow(); await tapTapTap(); });
    G.thought = waitingThought(day, d);
    await say("friends_waiting");
    G.thought = null;
    if (companion.mode === "window" || (companion.flight && companion.flight.mode === "window")) magpieFliesOff();
  }

  function waitingThought(day, d) {
    const f = (d.favors || []).find((x) => !done(`d${day}_${x.id}`));
    if (!f) return null;
    let found = null;
    for (const b of f.birds || []) if (!found && typeof b.thought === "string") found = b.thought;
    const scan = (steps) => {
      for (const st of [].concat(steps || [])) {
        if (found || !st || typeof st !== "object") continue;
        if (typeof st.thought === "string") { found = st.thought; return; }
        for (const k of ["steps", "scene", "then", "else"]) if (st[k]) scan(st[k]);
      }
    };
    scan(f.steps);
    return found && ICONS[found] ? found : null;
  }

  function skyBridge(since = State.sinceDawn()) {
    const s = S();
    return {
      birds: (s.bridge || []).map((b) => ({ species: b.species, day: b.day, fresh: since.bridge.includes(b.id) })),
      friends: (s.friends || []).map((sp) => ({ species: sp, day: (s.friendDay || {})[sp] || 1, fresh: since.friends.includes(sp) })),
    };
  }

  function storyDone(day) {
    const d = DAY(day);
    if (!d) return true;
    return done(`d${day}_wake`) && (d.favors || []).every((f) => done(`d${day}_${f.id}`));
  }

  let askingHome = false;
  async function headHome() {
    G.hint = null; G.guide = null;
    await until(() => scene.name === "garden" && !changingPlace && companion.mode !== "away" && !companion.flight
      && !busyCount && !Speech.isOpen() && !Closeup.isOpen() && !Sky.isOpen());
    await wait(1.2);
    G.onMagpie = () => { askHome(); return true; };
    if (!Speech.isOpen() && !busyCount) askHome();
    await NEVER;                                   // (the evening takes over from here: endDay)
  }
  async function askHome() {
    if (askingHome || evening || Speech.isOpen()) return;
    const e = epoch;
    askingHome = true;
    const reply = await speak("head_home");
    askingHome = false;
    if (e !== epoch || evening) return;
    const yes = ((LINES.head_home && LINES.head_home.replies) || ["Yes!"])[0];
    if (reply === yes) endDay("garden");
  }

  function askSleep() {
    if (!started || evening || morning || busyCount || Speech.isOpen() || scene.name !== "room" || player.hidden) return;
    const $ = (x) => document.getElementById(x);
    const card = $("sleep-card");
    if (!card || !card.classList.contains("hidden")) return;
    $("sleep-card-text").textContent = UI_TEXT.sleepAsk || "Go to sleep?";
    $("sleep-yes").textContent = UI_TEXT.sleepYes || "Yes";
    $("sleep-no").textContent = UI_TEXT.sleepNo || "Not yet";
    const box = $("sleep-card-icon");
    box.innerHTML = "";
    const c = iconFromGrid(ICONS.zzz || ICONS.star).toCanvas();
    const img = document.createElement("img");
    img.src = c.toDataURL(); img.className = "pixel-icon"; img.width = c.width * 4; img.height = c.height * 4;
    box.appendChild(img);
    const close = () => { card.classList.add("hidden"); $("sleep-yes").onclick = null; $("sleep-no").onclick = null; };
    $("sleep-no").onclick = () => { close(); Sound.tap(700); };
    $("sleep-yes").onclick = () => { close(); Sound.tap(900); endDay("room"); };
    card.classList.remove("hidden");
    Sound.tap(600);
  }

  function stopChains() {
    epoch++;
    waiters = []; listeners = []; placeWatchers = []; pending = null; busyCount = 0;
    if (current) restoreTaken(current);
    current = null;
    Object.assign(G, { hint: null, guide: null, thought: null, onMagpie: null, onRoof: null, alone: false });
    freeVisit = null; askingHome = false;
    for (const b of Wildlife.all()) { b.onReach = null; b.onTap = null; }
    if (holding()) State.set("holding", null);
    Player.stop();
    if (companion.act) magpieAct(null);
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
    evening.skippable = !(finished && (night.hook || night.chapterEnd));
    if (Husband.state() !== "together") Husband.reset();
    if (Daylight.phase() !== "sunset" && Daylight.phase() !== "night") setPhase("sunset");
    if (from === "garden") {
      G.hint = "sunset";
      G.guide = () => (scene.name === "garden" ? { ...houseDoor() } : null);
      await until(() => !changingPlace && ((scene.name === "garden" && nearHome()) || scene.name === "room")); live();
      G.guide = null; G.hint = null;
    }
    await scripted(async () => {
      player.path = []; player.interact = null;
      UI.hideBubble();
      if (player.sitting) { standUp(); await wait(0.3); live(); }        // (she stands up to greet him)
      await until(() => !isMoving()); live();
      const together = Husband.state() === "together";
      if (together) Husband.routine.here();                 // (walking with her already: he's home)
      else { await Husband.routine.comeHome(); live(); }
      showSkip();
      if (!together) { Husband.says(pick(Husband.routine.lines().home)); await wait(1.3); live(); }
      await kiss(); live();
      await wait(0.3); live();
    });
    await porch(day, finished, night); live();
    await bedtime(day);
  }
  const nearHome = () => { const f = herFeet(), dr = houseDoor(); return Math.hypot(f.x - dr.x, f.y - dr.y) < 4.5 * TILE; };
  const porchBench = () => findThing({ thing: "bench", near: "door" }, "garden");

  async function porch(day, finished, night) {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    const bench = porchBench();
    await scripted(async () => {
      await fadeTo(true, true); live();
      UI.hideBubble();
      placeHer("garden", { x: bench.x, y: bench.y + 1 }, "down");
      player.sitting = bench; player.seatDx = -8; player.facing = "down"; player.fishMoment = true; player.still = 0;
      const p = playerPixelPos();
      Husband.routine.sit(Math.round(p.x) + 16, Math.round(p.y), bench.footY + 0.5);
      companion.mode = "away"; companion.flight = null;
      Dolls.ids().filter((id) => Dolls.where(id) === "bed").forEach((id) => Dolls.set(id, "snuggled"));
      await fadeTo(false, true); live();
      if (Daylight.phase() !== "night") { await wait(0.6); live(); setPhase("night", 4); await wait(4.4); live(); }
      if (!understands()) { await wait(2.4); live(); return; }      // (Day 1 before the star: the magpie isn't hers yet)
      const eave = porchPerch(bench);
      companion.px = eave.x + 100; companion.py = eave.y - 70; companion.mode = "perch";
      magpieFlyTo("perch", eave.x, eave.y, eave.sortY);
      companion.faceLeft = false;
      await wait(1.3); live();
      await say(night.lookUp || "d1_look_up"); live();
      if (night.learn) learn(...night.learn);
      const since = State.sinceDawn();
      const closed = Sky.show(day, since.words, { bridge: skyBridge(since), porch: true });
      await until(() => Sky.settled()); live();
      await wait(0.6); live();
      const line = night.tomorrow || (since.words.length ? "new_stars" : null);
      if (line) { await say(line); live(); }
      if (!night.hook) { await nightCards(night); live(); }
      Sky.close();
      await closed; live();
    });
    if (night.hook) {
      hideSkip();
      await nightHook(day, night.hook); live();
      await scripted(async () => { await nightCards(night); live(); });
    }
    mark(`d${day}_sky`);
    if (understands()) {
      await say("porch_night"); live();
      magpieFlyTo("away", px(10), px(18));                   // (off to its nest in the big tree)
      await wait(0.8); live();
    }
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
    b.textContent = UI_TEXT.skipEvening || "Skip";
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
    magpieAt("away");
    if (!done(`d${day}_sky`)) mark(`d${day}_sky`);
    Sound.tap(700);
    bedtime(day, true).catch(caught);
  }
  if (document.getElementById("evening-skip")) {
    document.getElementById("evening-skip").addEventListener("click", (ev) => { ev.stopPropagation(); skipEvening(); });
  }

  async function nightCards(night) {
    const more = night.chapterEnd && UI_TEXT.toBeContinued;
    if (night.card || night.chapterEnd) await showCard(UI_TEXT[night.card || "theEnd"] || night.card, night.chapterEnd && !more ? UI_TEXT.moreDays : "", night.chapterEnd && !more ? 5 : 3.5);
    if (more) await showCard(UI_TEXT.toBeContinued, UI_TEXT.moreDays || "", 4, "star");
    if (night.chapterEnd && typeof Backup !== "undefined") await Backup.offer();
  }

  async function nightHook(day, hook) {
    const steps = typeof hook === "string" ? [{ moment: hook }] : Array.isArray(hook) ? hook : [hook];
    await playSteps(day, { id: "hook", key: `d${day}_sky`, steps }, false);        // (marked with the night sky)
  }

  async function diaryPage(day) {
    if (typeof Diary === "undefined" || !Diary || !Diary.bedtime) return;
    try { await Diary.bedtime(day); } catch (e) { setTimeout(() => { throw e; }); }
  }

  const nextDay = (day) => (DAY(day) || DAY(day + 1) ? day + 1 : day);

  async function bedtime(day, skipped = false) {
    const e = epoch, live = () => { if (e !== epoch) throw STOP; };
    hideSkip();
    await scripted(async () => {
      await fadeTo(true, true); live();
      if (Sky.isOpen()) Sky.close();
      UI.hideBubble();
      const bed = findThing("bed", "room");
      placeHer("room", bedFront(bed), "right");
      const h = hisSpot(bed);
      Husband.routine.at(h.x, h.y, "left");
      companion.mode = "away"; companion.flight = null;
      State.set("phase", "night");
      Daylight.set("night", 0);
      Sound.playMusic("night");
      const mine = Dolls.carried();
      Dolls.ids().filter((id) => id !== mine).forEach((id) => Dolls.set(id, "snuggled"));
      if (mine) { const s2 = S(); s2.diaryDolls = { ...(s2.diaryDolls || {}), [day]: (s2.diaryDolls || {})[day] || mine }; }
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

  async function showCard(title, sub = "", seconds = 3, icon = "star", tapAfter = 1.5, low = false) {
    const el = document.getElementById("day-card");
    el.classList.toggle("low", Sky.isOpen() || low);
    document.getElementById("day-card-text").textContent = title;
    document.getElementById("day-card-sub").textContent = sub;
    const iconBox = document.getElementById("day-card-icon");
    iconBox.innerHTML = "";
    const c = iconFromGrid(ICONS[icon] || ICONS.star).toCanvas();
    const img = document.createElement("img");
    img.src = c.toDataURL(); img.className = "pixel-icon"; img.width = c.width * 5; img.height = c.height * 5;
    iconBox.appendChild(img);
    el.classList.remove("hidden");
    let skip = null, over = false;
    const tapped = new Promise((ok) => { skip = ok; });
    const onTap = () => skip();
    setTimeout(() => { if (!over) window.addEventListener("pointerdown", onTap, { once: true }); }, tapAfter * 1000);
    await Promise.race([wait(seconds), tapped]);
    over = true;
    window.removeEventListener("pointerdown", onTap);
    el.classList.add("hidden");
  }

  function nameTheMagpie() {
    return new Promise((ok) => {
      const card = document.getElementById("name-card");
      const input = document.getElementById("name-input");
      const choices = document.getElementById("name-choices");
      const portrait = document.getElementById("name-portrait");
      Speech.sizePortrait(portrait);
      const g = portrait.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 64, 64);
      g.drawImage(renderPortrait("magpie", "curious"), 0, 0);
      input.value = "";
      choices.innerHTML = "";
      for (const n of MAGPIE_NAMES) {
        const b = document.createElement("button");
        b.textContent = n;
        b.addEventListener("click", () => { input.value = n; Sound.tap(700); });
        choices.appendChild(b);
      }
      const okButton = document.getElementById("name-ok");
      okButton.textContent = "✓";
      const finish = () => {
        const name = input.value.trim().slice(0, 12) || MAGPIE_NAMES[0];
        card.classList.add("hidden");
        okButton.onclick = null;
        input.blur();
        ok(name);
      };
      okButton.onclick = finish;
      input.onkeydown = (e) => { if (e.key === "Enter") finish(); };
      card.classList.remove("hidden");
    });
  }

  async function playSteps(day, f, keep = true) {
    const key = f.key || `d${day}_${f.id}`;
    if (keep && done(key)) return;
    const k = liveK();
    const ctx = { day, id: f.id, key, favor: f, taken: [], engaged: false, round: 0 };
    current = ctx;
    for (const b of f.birds || []) storyBird(b);
    await Favors.run(f.steps || [], k, ctx);
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
    await morningAtWindow(day, d, woke);
    await chooseDoll(day);
    const k = liveK();
    await Favors.run(d.out || [{ outside: {} }], k, { day, id: "out", key: `d${day}_out`, taken: [], engaged: false });
    if (k.stale()) throw STOP;
    for (const f of d.favors || []) await playSteps(day, f);
    await headHome();
  }

  async function freeDay(day, woke) {
    if (done(`d${day}_sky`)) return afterTheSky(day);
    await morningAtWindow(day, { morning: ["free_morning"] }, woke);
    await chooseDoll(day);
    await outside();
    G.hint = "free_day";
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
    garden, room: roomWorld, worldOf, placeOf, herFeet, near, pos, findThing, thingsOf, fits, sortAfter, guideTo,
    storyBird, lookWith, bird: (id) => Wildlife.get(id), talkTo, walkThere, emote, magpieDo, magpieFliesOff, outside,
    listen, onPlace, takeAway, applyWorld, applyAllWorld, restoreTaken, nameTheMagpie, showCard,
    addEffect: (e) => { effects.push(e); return e; },
    removeEffect: (e) => { effects = effects.filter((x) => x !== e); },
    starFound: () => starFound,
    resetStar: () => { starFound = false; },
    current: () => current,
    busy: () => busyCount > 0,
    stale: () => false,
  };

  const QUIET = ["speak", "say", "wait", "until", "scripted", "learn", "hold", "friend", "setPhase", "mark", "magpieDo", "magpieFliesOff",
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
    companion.mode = "away";
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
    for (const e of effects) {
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
        e.x = e.x0 + Math.sin(e.t * 1.7) * (e.sway || 7);
        if (e.y >= e.ground) e.landed = true;
      }
    }
    effects = effects.filter((e) => e.kind !== "fishInBeak" || time < e.until);
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

  function tapBird(bird) {
    const greets = bird.greets || (Daylight.phase() === "sunset" && bird.id && bird.id.startsWith("f-"));
    if (greets && !bird.onTap && !bird.onReach) {
      activity++;
      Wildlife.greet(bird);
      Wildlife.showEmote(bird, "heart");
      Sound.hearts();
      const doll = Dolls.carried(), h = Wildlife.headTop(bird);
      UI.tinySay(doll ? dollText("greet", doll) : bird.name, gameToScreen(h.x, h.y));
      return true;
    }
    activity++;
    if (bird.onTap) { bird.onTap(); return true; }
    if (freeVisit) freeVisit(`bird:${bird.species}`);
    if (!bird.onReach) return false;
    const wet = ["swim", "wade", "still"].includes(bird.does);
    approach({ x: bird.x, y: bird.y - 2 }, () => { Wildlife.greet(bird); const f = bird.onReach; if (f) { bird.onReach = null; f(); } }, wet);
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
    const c = effects.find((e) => e.kind === "candy" && Math.abs(e.x - gx) < 7 && Math.abs(e.y - 2 - gy) < 7);
    if (!c) return false;
    activity++;
    if (c.y >= c.ground) c.vy = -40;
    Sound.tap(900);
    magpieSays(THINGS.candy.name);
    return true;
  }

  function closeupTap(hit) {
    if (hit && hit.star) { starFound = true; return true; }
    return false;
  }

  function changedPlace(from, to) {
    if (to === "garden" && from === "room" && companion.mode === "away" && !G.alone && (done("d1_star") || S().day > 1)) {
      const f = herFeet();
      companion.px = f.x - 110; companion.py = f.y - 70;
    }
    for (const fn of placeWatchers.slice()) fn(from, to);
  }

  const understands = () => !started || S().day > 1 || done("d1_star");

  const closeupOptions = () => ({ star: started && S().day === 1 && !done("d1_star") && !starFound });

  const inFavor = () => !!(current && current.engaged);

  function items() {
    const out = [];
    for (const e of effects) {
      if (e.kind === "persimmon") out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(iconFromGridCached("persimmon"), Math.round(e.x - 3), Math.round(e.y - 6)) });
      if (e.kind === "candy") out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(candySprite(e.color), Math.round(e.x - 2), Math.round(e.y - 4)) });
      if (e.kind === "fall" || (e.kind === "drift" && e.landed)) {
        const c = iconFromGridCached(e.icon);
        if (c) out.push({ bottom: e.ground + 0.1, draw: () => ctx.drawImage(c, Math.round(e.x - c.width / 2), Math.round(e.y - c.height)) });
      }
    }
    return out;
  }

  function drawWorld(ctx, time) {
    for (const e of effects) {
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
    }
  }

  function drawOverlay(ctx, time) {
    if (scene.name === "garden") {
      for (const e of effects) {
        if (e.kind !== "drift" || e.landed) continue;
        const c = iconFromGridCached(e.airIcon || e.icon);
        if (c) ctx.drawImage(c, Math.round(e.x - c.width / 2), Math.round(e.y - c.height));
      }
    }
    if (G.thought && companion.mode !== "away" && !companion.flight) {
      const h = companionHeadTop(), her = playerPixelPos();
      Wildlife.drawThoughtAt(ctx, h.x, h.y, G.thought, time, h.x < her.x + 8 ? -1 : 1);
    }
    const g = G.guide && G.guide();
    if (g && (scene.name === "room" || scene.name === "garden") && (scene.name === "room") === !!g.room && !Speech.isOpen() && !Sky.isOpen()) {
      const icon = cueIcon("sparkle");
      const bob = Math.round(Math.sin(time * 3) * 2) * CUE;
      if (edgeCue(ctx, g, "sparkle", time)) return;
      if (g.edgeOnly) return;
      const blink = g.soft ? Math.sin(time * 2.2) > -0.2 : true;
      if (blink) ctx.drawImage(icon, Math.round(g.x - icon.width / 2), Math.round(g.y - icon.height - 4 * CUE + bob));
    }
  }

  function edgeCue(ctx, g, name, time) {
    const icon = cueIcon(name);
    const bob = Math.round(Math.sin(time * 3) * 2) * CUE;
    const m = 12 * CUE, safe = safeEdges(), k = (window.devicePixelRatio || 1) / scale;   // k: game pixels per point
    const x0 = camera.x + m + safe.left * k, x1 = camera.x + canvas.width - m - safe.right * k;
    const y0 = camera.y + m + icon.height + safe.top * k, y1 = camera.y + canvas.height - m - safe.bottom * k;
    const off = g.x < camera.x - 6 || g.x > camera.x + canvas.width + 6 || g.y < camera.y - 6 || g.y > camera.y + canvas.height + 12;
    if (!off) return false;
    const x = Math.max(x0, Math.min(x1, g.x));
    let y = Math.max(y0, Math.min(y1, g.y));
    if (x === x0 || x === x1) y = Math.max(camera.y + canvas.height * 0.3, Math.min(camera.y + canvas.height * 0.7, y));   // (the middle of a side edge)
    const gear = document.getElementById("menu-button").getBoundingClientRect();
    const side = document.getElementById("husband-button");
    const box = side && !side.classList.contains("hidden") ? side.getBoundingClientRect() : null;
    const left = box ? Math.min(gear.left, box.left) : gear.left, bottom = box ? Math.max(gear.bottom, box.bottom) : gear.bottom;
    const at = gameToScreen(x, y - icon.height);
    if (at.x > left - 12 && at.y < bottom + 6) y += (bottom + 6 - at.y) * (window.devicePixelRatio || 1) / scale;
    const a = Math.atan2(g.y - y, g.x - x), dir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    const arrow = arrowSprite(dir);
    const sx = Math.round(x - icon.width / 2), sy = Math.round(y - icon.height);
    ctx.drawImage(icon, sx, sy + bob);
    const ax = Math.round(x + Math.cos(dir * Math.PI / 4) * 8 * CUE - arrow.width / 2);
    const ay = Math.round(y - icon.height / 2 + Math.sin(dir * Math.PI / 4) * 8 * CUE - arrow.height / 2);
    ctx.drawImage(arrow, ax, ay + bob);
    return true;
  }

  const ARROW_STRAIGHT = ["X...", "XX..", "XXX.", "XXXX", "XXX.", "XX..", "X..."];   // pointing right
  const ARROW_SLANT = ["....X", "...XX", "..XXX", ".XXXX", "XXXXX"];                  // pointing down-right
  const arrowCache = {};
  function arrowSprite(dir) {
    const key = dir + "/" + CUE;
    if (arrowCache[key]) return arrowCache[key];
    const turn = (g) => [...g[0]].map((_, x) => g.map((row) => row[x]).reverse().join(""));
    let grid = dir % 2 ? ARROW_SLANT : ARROW_STRAIGHT;
    for (let i = 0; i < Math.floor(dir / 2); i++) grid = turn(grid);
    if (CUE > 1) grid = scale2xGrid(grid);
    const b = new PixelBuffer(grid[0].length, grid.length);
    grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") b.set(x, y, "starlight"); }));
    return (arrowCache[key] = outline(b).toCanvas());
  }

  const iconCache = {};
  const cueIcon = (name) => iconCache[name + "/cue" + CUE] || (iconCache[name + "/cue" + CUE] = iconFromGrid(ICONS[name], CUE > 1).toCanvas());
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

  return {
    prepare, start, update, reached, tapBird, tapMagpie, tapRoof, tapEffect, stopped, cancelPending, closeupTap, changedPlace,
    understands, closeupOptions, inFavor, items, drawWorld, drawOverlay, edgeCue,
    busy: () => busyCount > 0,
    inRoutine: () => !!evening || morning,
    evening: () => (evening ? { ...evening } : null),
    endDay: (from = scene.name === "room" ? "room" : "garden") => endDay(from),
    skip: () => skipEvening(),
    play: (steps) => Favors.run(steps, K, { day: S().day, id: "test", key: "test", taken: [], engaged: false }),
    debug: () => ({ day: S().day, phase: S().phase, done: Object.keys(S().done), learned: Object.keys(S().learned), holding: holding(), hint: G.hint, busy: busyCount, friends: S().friends,
      waitingFor: [...new Set(listeners.map((l) => l.type))], magpie: companion.mode,
      favor: current ? current.key : null, inFavor: inFavor(), bridge: State.bridgeBirds() }),
  };
})();
