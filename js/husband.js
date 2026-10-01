
const Husband = (() => {
  const H = {
    state: "away",            // away, fetching, coming, together, leaving, atWork (at the telescope)
    x: 0, y: 0,               // where he's drawn (like her: his feet at x + 8, y + 14)
    facing: "down",
    moving: false,
    walked: 0,                // pixels walked, for his steps
    path: [],                 // tiles to follow, coming or leaving
    timer: 0,
    pose: null,               // null, "point", "wave", "reach"
    lift: 0,                  // a hop across the stepping stones
    pointed: [],               // what he showed her lately (names), so he picks something new
    wonder: null,              // his "What's that?": { target, found, timer, said, farFor, binoculars }
    nextWonder: 0,             // not before this time (seconds)
    rejoin: false,             // walking back to take her hand
    lastLine: -1,
    trail: [],                // her feet, lately (for walking single file)
    together: "side",         // side (holding hands), file (single file), stones, bench (sitting beside her)
    seated: null,             // the bench he's sitting on, beside her
    emote: null,              // a heart above his head: { name, age }
    blinkAt: 0, blinkUntil: 0,
  };
  let sprites = null;
  const S = () => sprites || (sprites = renderHusband());
  const data = () => window.HUSBAND || {};
  const lines = () => data().lines || {};
  const voice = () => data().voice || { chirp: "hum", pitch: 330 };
  const pick = (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : "");
  const now = () => performance.now() / 1000;
  const present = () => H.state === "coming" || H.state === "together" || H.state === "leaving" || H.state === "atWork" || (H.state === "routine" && !H.hidden);
  const herFeet = () => { const p = playerPixelPos(); return { x: p.x + 8, y: p.y + 14, p }; };
  const tileOf = (fx, fy) => ({ x: Math.floor(fx / TILE), y: Math.floor((fy - 2) / TILE) });
  const open = (fx, fy) => { const t = tileOf(fx, fy); return isWalkable(t.x, t.y) && WORLD.tile(t.x, t.y) !== "o"; };
  const onStones = (x, y) => WORLD.tile(x, y) === "o";

  function towardWork() {
    const view = { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height };
    const goal = { x: view.x + view.w * 0.8, y: view.y - TILE * 2 };
    const her = { x: player.nx, y: player.ny };
    let best = null;
    const consider = (x, y) => { const d = Math.hypot(x * TILE - goal.x, y * TILE - goal.y); if (!best || d < best.d) best = { x, y, d }; };
    const x0 = Math.max(0, Math.floor(view.x / TILE) - 2), x1 = Math.min(MAP_W - 1, Math.floor((view.x + view.w) / TILE) + 2);
    const y0 = Math.max(0, Math.floor(view.y / TILE) - 3), y1 = Math.min(MAP_H - 1, Math.floor((view.y + view.h) / TILE) + 2);
    for (let y = y0; y < Math.floor(view.y / TILE); y++) for (let x = x0; x <= x1; x++) if (isWalkable(x, y)) consider(x, y);
    for (let y = 0; y < MAP_H && !best && !WORLD.indoors; y++) for (let x = 0; x < MAP_W; x++) if (isWalkable(x, y) && WORLD.tile(x, y) === "=") consider(x, y);
    if (!best) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const inView = x * TILE + 16 > view.x && x * TILE < view.x + view.w && y * TILE + 16 > view.y && y * TILE < view.y + view.h;
      if (inView || !isWalkable(x, y) || (y > y0 && y < y1 && x > x0 && x < x1)) continue;       // just outside the view
      consider(x, y);
    }
    if (!best) return null;
    const path = findPath(best, her, MAP_W, MAP_H, isWalkable, stepCost);
    return path && path.length ? { start: best, path } : null;
  }

  let viaMagpie = false;
  function call() {
    if (H.state !== "away" || Closeup.isOpen() || Sky.isOpen() || changingPlace) return;
    H.state = "fetching";
    viaMagpie = !WORLD.indoors && companion.mode === "follow" && !companion.flight && !!(Story && Story.understands());
    H.timer = viaMagpie ? 2.4 : 1.6;
    if (viaMagpie) {
      const view = { x: camera.x, y: camera.y, w: canvas.width };
      Magpie.flyTo("away", view.x + view.w * 0.8, view.y - 30);
      Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch);
    }
  }

  function arrive() {
    const h = herFeet();
    H.state = "coming";
    H.trail = [];
    if (WORLD.indoors) {
      const door = WORLD.door;
      H.x = door.x * TILE; H.y = door.y * TILE;
      H.path = (findPath({ x: door.x, y: door.y }, { x: player.nx, y: player.ny }, MAP_W, MAP_H, isWalkable, stepCost) || []).slice(0, -1);
      Sound.door();
      return;
    }
    const way = towardWork();
    if (way) {
      H.x = way.start.x * TILE; H.y = way.start.y * TILE;
      H.path = way.path.slice(0, -1);                // up to the tile before hers
    } else {
      H.x = h.p.x + 20; H.y = h.p.y; H.path = [];
    }
    if (viaMagpie) Magpie.flyTo("follow");
  }

  function bye() {
    if (H.state !== "together" && H.state !== "coming") return;
    H.wonder = null; H.rejoin = false;
    Quirks.stop();
    if (H.seated) { H.y = H.seated.footY; H.seated = null; }         // (up off the bench, onto the ground in front of it)
    H.state = "leaving";
    H.pose = "wave";
    H.timer = 1.2;
    H.facing = "down";
    const away = H.x + 8 >= herFeet().x ? 1 : -1;
    H.waveSide = away > 0 ? "left" : "right";
    H.waveTo = isWalkable(tileOf(H.x + 8 + away * 12, H.y + 14).x, tileOf(H.x + 8 + away * 12, H.y + 14).y) ? H.x + away * 8 : null;
    say(pick(lines().bye));
  }

  function goodnight() {
    if (!present()) return;
    say(pick(lines().goodnight));
    reset();
  }

  function reset() {
    H.state = "away"; H.path = []; H.pose = null; H.trail = []; H.emote = null; H.wonder = null; H.rejoin = false; H.nextWonder = 0; H.seated = null;
    endRoutineBits();
    Quirks.left();
  }

  function changedPlace() {
    if (scene.name === "dome") {
      const post = window.HUSBAND_POST || { x: 5, y: 7 };
      H.state = "atWork"; H.x = post.x * TILE; H.y = post.y * TILE; H.facing = "right"; H.pose = null; H.path = []; H.trail = [];
      const text = window.OBSERVATORY_TEXT || {};
      setTimeout(() => { say(pick(text.welcome)); H.facing = "down"; }, 500);
      setTimeout(() => { if (H.state === "atWork" && !Sky.isOpen()) say(text.look); }, 3600);        // and what to do here
      setTimeout(() => { if (H.state === "atWork") H.facing = "right"; }, 6500);
      return;
    }
    if (H.state === "atWork") { reset(); return; }             // she left the dome: he stays at work
    if (H.state === "fetching") { H.state = "away"; return; }
    if (!present()) return;
    if (H.state === "leaving") { reset(); return; }
    const h = herFeet();
    H.x = h.p.x; H.y = h.p.y; H.state = "together"; H.path = []; H.trail = []; H.wonder = null; H.rejoin = false; H.pose = null;
    H.seated = null; Quirks.stop();
  }

  function say(text, lean = 0, avoid = null) {
    if (!text || !present() || offScreen()) return;                         // (never out of thin air)
    const lift = (H.wonder && !H.wonder.found) || H.emote ? emoteSprite("question").height + 2 : 0;
    bubbleAt = { x: H.x + 8, y: H.y - TILE - 2 - lift, until: now() + 1.6 + text.split(" ").length * 0.4, lean, husband: true, avoid, feet: H.y + 16 };
    UI.say(text, voice(), "husband");
  }

  function tap() {
    if (H.state === "together" && H.wonder && !H.wonder.found) { found(); return; }
    UI.hideBubble();
    const list = (H.state === "atWork" && lines().dome) || lines().tap || [];
    if (!list.length) return;
    const dim = (text) => (text.match(/[A-Za-z']+/g) || []).filter((w) => !Words.isBright(w)).length;
    const counts = list.map(dim);
    const others = list.map((_, i) => i).filter((i) => i !== H.lastLine || list.length === 1);
    const least = Math.min(...others.map((i) => counts[i]));
    const choices = others.filter((i) => counts[i] === least);
    const i = choices[Math.floor(Math.random() * choices.length)];
    H.lastLine = i;
    const h = herFeet();
    if (H.state === "together" && !H.moving && !H.seated && !Quirks.playing()) H.facing = Math.abs(h.x - (H.x + 8)) > Math.abs(h.y - (H.y + 14)) ? (h.x < H.x + 8 ? "left" : "right") : h.y > H.y + 14 ? "down" : "up";
    H.emote = { name: "heart", age: 0 };
    Speech.say(null, { who: "husband", text: list[i], face: Math.random() < 0.5 ? "joy" : "happy" });
  }

  function goal() {
    const h = herFeet();
    const next = player.path[0], moving = isMoving();
    if (onStones(player.tx, player.ty) || onStones(player.nx, player.ny) || (moving && next && onStones(next.x, next.y))) {
      let ahead = next || { x: player.nx + (player.nx - player.tx), y: player.ny + (player.ny - player.ty) };
      if (!isWalkable(ahead.x, ahead.y) || (ahead.x === player.nx && ahead.y === player.ny)) {
        const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing] || [1, 0];
        const tries = [[d[0], d[1]], [-d[0], -d[1]], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: player.nx + dx, y: player.ny + dy }));
        ahead = tries.find((t) => isWalkable(t.x, t.y)) || { x: player.nx + 1, y: player.ny };
      }
      return { x: ahead.x * TILE, y: ahead.y * TILE, mode: "stones", face: h.x < ahead.x * TILE + 8 ? "left" : "right" };
    }
    const f = player.sitting ? "down" : player.facing;
    const side = H.x + 8 >= h.x ? 1 : -1, dir = f === "right" ? 1 : -1;
    const clear = (s) => [0.25, 0.5, 0.75, 1].every((k) => open(h.x + (s.x + 8 - h.x) * k, h.y + (s.y + 14 - h.y) * k));
    const spots = f === "down" || f === "up"
      ? [{ x: h.p.x + side * 13, y: h.p.y }, { x: h.p.x - side * 13, y: h.p.y }]
      : [{ x: h.p.x + dir * 8, y: h.p.y - 3 }];
    const spot = spots[0];
    if (!player.sitting) for (const s of spots) if (clear(s)) return { ...s, mode: "side", face: f };
    if (player.sitting && player.sitting.w >= 2 && H.state === "together") {
      const b = player.sitting;
      if (!player.seatDx) scootOver(b);
      return { x: b.footX - 8 - player.seatDx, y: b.footY - TILE - 3, mode: "bench", face: "down" };
    }
    if (player.sitting) {
      const other = { x: h.p.x - side * 16, y: h.p.y + 6 };
      for (const s of [spot, other, { x: h.p.x + side * 18, y: h.p.y + 8 }]) if (open(s.x + 8, s.y + 14)) return { ...s, mode: "file", face: "down" };
    }
    let d = 0, prev = { x: h.x, y: h.y };
    for (let i = H.trail.length - 1; i >= 0; i--) {
      const t = H.trail[i];
      d += Math.hypot(t.x - prev.x, t.y - prev.y);
      prev = t;
      if (d >= 17) return { x: t.x - 8, y: t.y - 14, mode: "file", face: null };
    }
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1]]) {
      const s = { x: h.p.x + dx * 16, y: h.p.y + dy * 16 };
      if (clear(s)) return { ...s, mode: "file", face: null };
    }
    return { x: prev.x - 8, y: prev.y - 14, mode: "file", face: null };
  }

  function shareBench(bench) {
    if (H.state !== "together" || !bench || bench.w < 2) return 0;
    return H.x + 8 >= bench.footX ? -QUIRK_FIT.seat : QUIRK_FIT.seat;
  }
  function scootOver(bench) {
    const dx = H.x + 8 >= bench.footX ? -QUIRK_FIT.seat : QUIRK_FIT.seat;
    player.seatDx = dx;
    player.hop = { dx: -dx, dy: 0, t: 0.2, dur: 0.2 };
  }

  function moveToward(tx, ty, dt, speed) {
    const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy);
    if (d < 0.5) { H.x = tx; H.y = ty; H.moving = false; return; }
    const step = Math.min(d, speed * dt);
    H.x += (dx / d) * step; H.y += (dy / d) * step;
    H.walked += step;
    H.moving = step > speed * dt * 0.25 && d > 1.5;
    if (H.moving) H.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  function update(dt) {
    if (H.emote) { H.emote.age += dt; if (H.emote.age > 1.8) H.emote = null; }
    if (heart) { heart.age += dt; if (heart.age > 1.9) heart = null; }
    if (H.state === "routine") { updateRoutine(dt); return; }
    if (H.state === "away") return;
    if (H.state === "fetching") {
      H.timer -= dt;
      if (H.timer <= 0) arrive();
      return;
    }
    const h = herFeet(), last = H.trail[H.trail.length - 1];
    if (!last || Math.hypot(h.x - last.x, h.y - last.y) > 2) { H.trail.push({ x: h.x, y: h.y }); if (H.trail.length > 60) H.trail.shift(); }
    H.lift = 0;

    if (H.state === "coming") {
      const t = H.path[0];
      if (t) {
        moveToward(t.x * TILE, t.y * TILE, dt, 6.5 * TILE);
        if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      }
      if (!H.path.length || Math.hypot(H.x + 8 - h.x, H.y + 14 - h.y) < TILE * 1.4) {
        H.state = "together";
        H.emote = { name: "heart", age: 0 };
        Sound.hearts();
        say(pick(lines().hello));
      }
      return;
    }

    if (H.state === "leaving") {
      if (H.pose === "wave") {
        H.timer -= dt;
        H.moving = false;
        if (H.waveTo != null) H.x += Math.sign(H.waveTo - H.x) * Math.min(Math.abs(H.waveTo - H.x), 40 * dt);
        if (H.timer > 0) return;
        H.pose = null;
        const from = tileOf(H.x + 8, H.y + 14);
        const to = WORLD.indoors ? WORLD.door : (towardWork() || {}).start;
        H.path = to ? findPath(from, to, MAP_W, MAP_H, isWalkable, stepCost) || [] : [];
        H.timer = 8;
      }
      const t = H.path[0];
      if (t) {
        moveToward(t.x * TILE, t.y * TILE, dt, 5 * TILE);
        if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      }
      H.timer -= dt;
      const off = H.x + 16 < camera.x || H.x > camera.x + canvas.width || H.y + 16 < camera.y || H.y - TILE > camera.y + canvas.height;
      if (off || !H.path.length || H.timer <= 0) { if (WORLD.indoors) Sound.door(); reset(); }
      return;
    }

    if (H.state === "atWork") { H.moving = false; return; }

    if (H.wonder) { updateWonder(dt); return; }
    if (Quirks.playing()) { Quirks.update(dt); return; }
    keepUp(dt);
    const walking = isMoving() && player.path.length >= 1 && player.path.length <= 3;     // (she's about to stop, nearby: she'll see him)
    if (walking && Quirks.due("whatsThat") && now() > H.nextWonder && calm() && Math.random() < dt / 1.2 && !wonder()) H.nextWonder = now() + 8;   // (nothing to see here: soon)
    else if (!H.wonder) Quirks.maybe(dt);
  }

  function keepUp(dt) {
    const herSpeed = Math.max(player.speed || 0, WALK_SPEED) * TILE;
    const g = goal();
    H.together = g.mode;
    const d = Math.hypot(g.x - H.x, g.y - H.y);
    if (d > 6 * TILE && !H.rejoin) { H.x = g.x; H.y = g.y; }          // far behind (a new place): he's just there
    if (H.rejoin && d < 20) { H.rejoin = false; if (H.rejoinHappy) H.emote = { name: "heart", age: 0 }; }
    const fast = g.mode === "stones" ? herSpeed * 1.5 : Math.max(herSpeed * 1.15, d * 6);
    const pointing = H.pose === "point" && H.timer > 0;
    if (!pointing) moveToward(g.x, g.y, dt, fast);
    if (g.mode === "stones") {
      const t = tileOf(H.x + 8, H.y + 14);
      if (onStones(t.x, t.y) && H.moving) H.lift = Math.round(Math.abs(Math.sin(((H.x + 8) / TILE) * Math.PI)) * 3);
      if (!H.moving) { H.facing = g.face; H.pose = "reach"; }
    } else if (H.pose === "reach") H.pose = null;
    if (!H.moving && g.face && g.mode === "side" && !pointing) H.facing = g.face;
    H.seated = g.mode === "bench" && Math.hypot(g.x - H.x, g.y - H.y) < 0.5 ? player.sitting : null;
    if (H.seated) { H.facing = "down"; H.moving = false; }

    if (pointing) { H.timer -= dt; if (H.timer <= 0) H.pose = null; }
  }

  function calm() {
    if (!WORLD.garden || WORLD.indoors || WORLD.small || changingPlace || Closeup.isOpen() || Sky.isOpen()) return false;
    if ((Speech && Speech.isOpen()) || (Story && Story.busy()) || player.sitting || player.hidden) return false;
    if (H.together !== "side" || H.pose || State.get().holding) return false;      // (single file, the stones; carrying something for a bird)
    return !(typeof Story !== "undefined" && Story && Story.inFavor && Story.inFavor());
  }

  const ROOM_FOR_WORDS = 70;       // (points: a one-line bubble, its tail and the screen's margin: css #bubble)
  const roomAbove = () => gameToScreen(H.x + 8, H.y - TILE - 4 - emoteSprite("question").height).y >= ROOM_FOR_WORDS;

  function spotSomething(only = null) {
    const f = { x: H.x + 8, y: H.y + 14 };
    const onScreen = (x, y) => x > camera.x + 12 && x < camera.x + canvas.width - 12 && y > camera.y + 12 && y < camera.y + canvas.height - 12;
    const near = (x, y) => onScreen(x, y) && Math.hypot(x - f.x, y - f.y) > TILE && Math.hypot(x - f.x, y - f.y) < 7 * TILE;
    const kinds = { bird: [], butterfly: [], feather: [], flower: [] };
    for (const b of Wildlife.all()) {
      if (b.gone || b.underwater || b.flight || b.favor || b.thought || !near(b.x, b.y)) continue;
      kinds.bird.push({ name: b.name.toLowerCase().replace("japanese", "Japanese"), moves: true, react: () => Wildlife.greet(b), pos: () => (b.gone || b.flight || b.underwater || !Wildlife.all().includes(b) ? null : { x: b.x, y: b.y - 8 }) });
    }
    for (const fl of typeof CRITTERS !== "undefined" && CRITTERS ? CRITTERS.flies : []) {
      if (near(fl.x, fl.y)) kinds.butterfly.push({ name: "butterfly", moves: true, pos: () => (onScreen(fl.x, fl.y) ? { x: fl.x, y: fl.y - 2 } : null) });
    }
    for (const t of WORLD.things) {
      if (t.lost || t.hidden || !near(t.footX, t.footY)) continue;
      if (t.type === "feather") kinds.feather.push({ name: "feather", react: () => { t.bounce = 0.4; }, pos: () => ({ x: t.footX, y: t.footY - 4 }) });
      if (t.type === "flower") kinds.flower.push({ name: t.name, react: () => { t.bounce = 0.4; }, pos: () => ({ x: t.footX, y: t.footY - 9 }) });
    }
    const h = herFeet(), herDir = { x: h.x - f.x, y: h.y - f.y }, herD = Math.hypot(herDir.x, herDir.y);
    for (const k of Object.keys(kinds)) kinds[k] = kinds[k].filter((c) => {
      const p = c.pos();
      if (!p || herD > 2 * TILE) return !!p;
      const dx = p.x - f.x, dy = p.y - f.y;
      return (dx * herDir.x + dy * herDir.y) / (Math.hypot(dx, dy) * herD || 1) < 0.5;
    });
    const weight = { bird: 3, butterfly: 2, feather: 2, flower: 1 };
    const fresh = (list) => list.filter((c) => !H.pointed.includes(c.name));
    if (only) for (const k of Object.keys(kinds)) if (k !== only) kinds[k] = [];          // (for tests: one kind)
    let pool = Object.keys(kinds).filter((k) => fresh(kinds[k]).length);
    if (!pool.length) pool = Object.keys(kinds).filter((k) => kinds[k].length);
    if (!pool.length) return null;
    let r = Math.random() * pool.reduce((n, k) => n + weight[k], 0), kind = pool[0];
    for (const k of pool) { r -= weight[k]; if (r <= 0) { kind = k; break; } }
    const list = fresh(kinds[kind]).length ? fresh(kinds[kind]) : kinds[kind];
    return list[Math.floor(Math.random() * list.length)];
  }

  function faceToward(p) {
    const dx = p.x - (H.x + 8), dy = p.y - (H.y + 14);
    if (H.wonder && H.wonder.binoculars) { H.facing = dx < 0 ? "left" : "right"; return; }
    H.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
  }

  function wonder(o = {}) {
    if (H.state !== "together" || !roomAbove()) return false;
    const sideways = (t) => { const p = t && t.pos(); if (!p) return false; const dx = p.x - (H.x + 8), dy = p.y - (H.y + 8); return Math.abs(dx) >= 1.5 * Math.abs(dy) && Math.abs(dx) >= 2 * TILE; };
    const want = o.binoculars !== undefined ? o.binoculars : Math.random() < 0.45;
    let target = spotSomething(o.kind);
    for (let i = 0; want && i < 6 && target && !sideways(target); i++) target = spotSomething(o.kind) || target;      // (binoculars want something off to the side)
    if (!target) return false;
    const binoculars = want && sideways(target);
    H.wonder = { target, found: false, timer: 0, said: now(), since: now(), farFor: 0, binoculars, firstStop: true };
    H.pointed = [target.name, ...H.pointed.filter((n) => n !== target.name)].slice(0, 4);
    H.together = "wonder";
    H.moving = false;
    H.rejoin = false;
    faceToward(target.pos() || { x: H.x + 8, y: H.y });
    H.pose = binoculars ? "binoculars" : null;
    say(pick(lines().wonder));
    return true;
  }

  function fillThing(text, name) {
    const a = (/^[aeiou]/i.test(name) ? "an " : "a ") + name;
    return text.replace(/(^|[.!?]\s+)\{a thing\}/, (m, p) => p + a[0].toUpperCase() + a.slice(1)).replace(/\{a thing\}/g, a).replace(/\{thing\}/g, name);
  }

  let sparkle = null;
  const cueSprite = (n) => Cues.icon(n, true);       // (always twice as big: js/cues.js)
  function found() {
    const w = H.wonder;
    const inView = (q) => q && q.x > camera.x + 8 && q.x < camera.x + canvas.width - 8 && q.y > camera.y + 8 && q.y < camera.y + canvas.height - 8;
    if (!inView(w.target.pos())) { const other = spotSomething(); if (other && inView(other.pos())) w.target = other; }
    const p = w.target.pos();
    UI.hideBubble();
    w.found = true;
    if (!inView(p)) {
      if (!w.target.moves) { endWonder(true); return; }
      H.pose = "wave"; H.facing = "down"; w.timer = 2.2; say(fillThing(pick(lines().gone), w.target.name)); return;
    }
    if (w.target.react) w.target.react();
    H.facing = p.x < H.x + 8 ? "left" : "right";
    H.pose = p.y > H.y + 1 ? "pointLow" : "point";          // (below his shoulders: he points down at it)
    w.timer = 2.6;
    sparkle = { target: w.target, at: now() };
    Sound.tap(1150);
    say(fillThing(pick(lines().found), w.target.name), p.x < H.x + 8 ? 1 : -1, { x: p.x - 13, y: p.y - 28, w: 26, h: 30 });
  }

  function updateWonder(dt) {
    const w = H.wonder;
    H.moving = false;
    H.together = "wonder";
    if (w.found) {
      w.timer -= dt;
      if (w.timer <= 0) endWonder(true);
      return;
    }
    if ((Story && Story.busy()) || Closeup.isOpen() || Sky.isOpen() || !WORLD.garden) { endWonder(false); return; }
    const off = offScreen();
    w.offFor = off ? (w.offFor || 0) + dt : 0;
    if (w.offFor > 6) { endWonder(false); return; }
    const p = w.target.pos();
    if (p) faceToward(p);
    if (w.answer && now() - w.answer.at > 1.2 && !UI.bubbleShowing()) { thanked(); return; }
    if (!w.counted && !off && now() - w.since > 1.5) { w.counted = true; State.addWonder(); }
    const moving = isMoving();
    if (w.herMoving && !moving) {
      const h = herFeet(), near = Math.hypot(h.x - (H.x + 8), h.y - (H.y + 14)) < 1.5 * TILE;
      if (near && !w.firstStop && now() - w.said > 2) { found(); return; }
      if (!w.firstStop || now() - w.said > 2) w.askAt = now() + 0.3;
      w.firstStop = false;
    }
    w.herMoving = moving;
    if (w.askAt && now() >= w.askAt && !UI.bubbleShowing() && !(Speech && Speech.isOpen()) && !w.answer) {
      w.askAt = null;
      if (!off && roomAbove() && (w.asked || 0) < 3) { w.asked = (w.asked || 0) + 1; w.said = now(); say(pick(lines().wonder)); }
    }
  }

  function reached(thing) {
    const w = H.wonder;
    if (!w || w.found || w.answer || !thing) return;
    const p = w.target.pos();
    const same = (thing.name || "").toLowerCase() === w.target.name.toLowerCase() || (p && thing.footX !== undefined && Math.hypot(thing.footX - p.x, thing.footY - 9 - p.y) < TILE);
    if (same) w.answer = { at: now(), thing };
  }
  function thanked() {
    const w = H.wonder, h = herFeet();
    w.found = true;
    w.timer = 2.4;
    H.pose = null;
    H.facing = Math.abs(h.x - (H.x + 8)) * 2 >= Math.abs(h.y - (H.y + 14)) ? (h.x < H.x + 8 ? "left" : "right") : h.y > H.y + 14 ? "down" : "up";
    H.emote = { name: "heart", age: 0 };
    sparkle = { target: w.target, at: now() };
    Sound.hearts();
    const p = w.target.pos();
    say(fillThing(pick(lines().thanks), w.target.name), 0, p ? { x: p.x - 13, y: p.y - 28, w: 26, h: 30 } : null);
  }
  const offScreen = () => H.x + 16 < camera.x || H.x > camera.x + canvas.width || H.y + 16 < camera.y || H.y - TILE > camera.y + canvas.height;
  function besideHim() {
    const me = tileOf(H.x + 8, H.y + 14), s = herFeet().x < H.x + 8 ? -1 : 1;
    return [[s, 0], [-s, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: me.x + dx, y: me.y + dy })).find((t) => isWalkable(t.x, t.y)) || me;
  }

  function endWonder(happy) {
    if (bubbleAt && bubbleAt.husband) UI.hideBubble();          // (his question doesn't linger)
    H.wonder = null;
    H.pose = null;
    H.rejoin = true;
    H.rejoinHappy = happy;
    H.nextWonder = 0;
    Quirks.happened("whatsThat");                             // (the next moment, of any kind, not for a few minutes)
  }

  let heart = null;                    // a heart between the two of them (a kiss): { x, y, age }
  function endRoutineBits() { H.hidden = false; H.holdHands = false; H.sortY = null; H.goal = null; }

  function routineAt(x, y, facing = "down", pose = null) {
    const was = H.goal;
    H.state = "routine"; H.x = x; H.y = y; H.facing = facing; H.pose = pose; H.path = []; H.trail = [];
    H.wonder = null; H.rejoin = false; H.moving = false; endRoutineBits();
    if (was && was.resolve) was.resolve();
  }
  function routineHere() { routineAt(H.x, H.y, H.facing, null); }
  function routinePose(pose, facing = null) { H.pose = pose; if (facing) H.facing = facing; H.moving = false; }
  function routineHide(hidden) { H.hidden = !!hidden; }
  function routineSit(x, y, sortY) { routineAt(x, y, "down", "sit"); H.sortY = sortY; H.holdHands = true; }

  function routineWalk(x, y, path = null, speed = 4.6) {
    if (H.goal && H.goal.resolve) H.goal.resolve();
    return new Promise((resolve) => {
      H.pose = null;
      H.path = path ? path.slice() : [];
      H.goal = { x, y, speed, resolve };
    });
  }
  function updateRoutine(dt) {
    const g = H.goal;
    if (!g) { H.moving = false; return; }
    const t = H.path[0];
    if (t) {
      moveToward(t.x * TILE, t.y * TILE, dt, g.speed * TILE);
      if (Math.hypot(H.x - t.x * TILE, H.y - t.y * TILE) < 1) H.path.shift();
      if (g.near && g.near()) { H.path = []; g.x = H.x; g.y = H.y; }
      return;
    }
    moveToward(g.x, g.y, dt, g.speed * TILE);
    if (Math.hypot(H.x - g.x, H.y - g.y) < 0.5) {
      H.x = g.x; H.y = g.y; H.moving = false; H.goal = null;
      g.resolve();
    }
  }

  function comeHome(seconds = null) {
    const h = herFeet();
    let start, path;
    if (WORLD.indoors) {
      const door = WORLD.door;
      start = { x: door.x, y: door.y };
      path = findPath(start, { x: player.nx, y: player.ny }, MAP_W, MAP_H, isWalkable, stepCost) || [];
      Sound.door();
    } else {
      const way = towardWork();
      if (way) { start = way.start; path = way.path; } else { start = { x: player.nx + 1, y: player.ny }; path = []; }
    }
    routineAt(start.x * TILE, start.y * TILE, "down");
    const way = path.slice(0, -1), end = way[way.length - 1] || start;
    const speed = seconds ? Math.max(5.2, Math.min(RUN_SPEED * 1.2, way.length / seconds)) : 5.2;
    const p = routineWalk(end.x * TILE, end.y * TILE, way, speed);
    H.goal.near = () => Math.hypot(H.x + 8 - h.x, H.y + 14 - h.y) < TILE * 1.6;
    return p.then(() => { H.moving = false; });
  }

  function routineLeave() {
    const from = tileOf(H.x + 8, H.y + 14);
    let path = [];
    if (WORLD.indoors) path = findPath(from, WORLD.door, MAP_W, MAP_H, isWalkable, stepCost) || [];
    else { const way = towardWork(); if (way) path = findPath(from, way.start, MAP_W, MAP_H, isWalkable, stepCost) || []; }
    const end = path[path.length - 1] || from;
    return routineWalk(end.x * TILE, end.y * TILE, path, 4.6).then(() => {
      if (WORLD.indoors) Sound.door();
      reset();
    });
  }

  function heartBetween(x, y) { heart = { x, y, age: 0 }; Sound.hearts(); }

  function sprite() {
    const s = S(), t = now();
    const moment = Quirks.hisSprite();                    // (in one of their little moments: js/quirks.js)
    if (moment) return moment;
    if (H.state === "routine" && H.pose) {
      if (H.pose === "kiss" && s.kiss[H.facing]) return s.kiss[H.facing];
      if (H.pose === "sit") {
        if (t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
        return t < H.blinkUntil ? s.blink.sit : s.sit;
      }
      if (H.pose === "wave") return (H.waveSide === "right" ? s.waveRight : s.wave)[Math.floor(t * 4) % 2];
    }
    if (H.seated) {
      if (t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
      return t < H.blinkUntil ? s.blink.sit : s.sit;
    }
    if (H.pose === "binoculars" && s.binoculars[H.facing]) return s.binoculars[H.facing];
    if (H.pose === "wave" && (H.state === "leaving" || H.wonder)) return (H.waveSide === "right" ? s.waveRight : s.wave)[Math.floor(t * 4) % 2];
    if ((H.pose === "point" || H.pose === "pointLow") && (H.facing === "left" || H.facing === "right")) return s[H.pose][H.facing];
    if (H.pose === "reach" && (H.facing === "left" || H.facing === "right")) return s.reach[H.facing];
    const step = H.moving ? 1 + (Math.floor(H.walked / 8) % 2) : 0;
    const holdSide = H.state === "together" && H.together === "side" && (H.facing === "left" || H.facing === "right") && !Quirks.playing();
    if (holdSide) return s.hold[H.facing][step];
    if (!H.moving && t > H.blinkAt) { H.blinkUntil = t + 0.14; H.blinkAt = t + 3 + Math.random() * 3; }
    if (!H.moving && t < H.blinkUntil && s.blink[H.facing]) return s.blink[H.facing];
    return s[H.facing][step];
  }

  function items() {
    if (!present() || H.state === "fetching") return [];
    const out = [];
    const fx = H.x + 8, fy = H.y + 14;
    const top = Math.round(H.y) - TILE - H.lift, x = Math.round(H.x);
    const bob = H.moving && Math.floor(H.walked / 8) % 2 ? 1 : 0;
    const doll = data().doll && data().doll.id;
    const peek = H.x < playerPixelPos().x ? "left" : "right";
    const seated = H.state === "routine" && H.pose === "sit";
    const lying = Quirks.hisDraw();                       // (lying on the bench, his head on her lap: js/quirks.js draws him)
    if (lying) out.push(lying);
    else out.push({ bottom: H.state === "routine" && H.sortY != null ? H.sortY : Quirks.inFront() ? playerPixelPos().y + TILE + 0.1 : H.seated ? H.seated.footY + 0.4 : fy - 0.2, draw: () => {
      if (!seated && !H.seated) drawShadow(fx + 1, fy + 2, 7, 2);
      if (doll) Dolls.drawOnBack(ctx, doll, x, top, H.facing, true, bob, peek);
      const spr = sprite();
      ctx.drawImage(spr, x - (spr.ox || 0), top);
      if (doll) Dolls.drawOnBack(ctx, doll, x, top, H.facing, false, bob, peek);
    } });
    if (seated && H.holdHands && player.sitting && !player.hidden) {
      const p = playerPixelPos(), herTop = Math.round(p.y) - TILE;
      const hx = Math.round(((H.x + 3) + (p.x + 12)) / 2) + 1, hy = Math.round((top + herTop) / 2) + 22;
      out.push({ bottom: Math.max(H.sortY || fy, player.sitting.footY + 0.5) + 0.3, draw: () => ctx.drawImage(handsSprite(), hx - 2, hy - 2) });
    }
    out.push(...Quirks.items());
    const onBench = H.seated && player.sitting === H.seated;
    if (H.state === "together" && ((H.together === "side" && !player.sitting) || onBench) && !player.hidden && !player.act && !Quirks.playing()) {        // (in an action she lets go: he watches)
      const p = playerPixelPos(), herTop = Math.round(p.y) - TILE;
      let hx, hy;
      if (H.facing === "down" || H.facing === "up") {
        const hisHand = H.x + 8 < p.x + 8 ? x + 12 : x + 3;
        const herHand = H.x + 8 < p.x + 8 ? Math.round(p.x) + 3 : Math.round(p.x) + 12;
        hx = Math.round((hisHand + herHand) / 2); hy = Math.round((top + herTop) / 2) + 22;
      } else {
        hx = Math.round(p.x) + (H.facing === "right" ? 13 : 2); hy = herTop + 22;
      }
      out.push({ bottom: onBench ? H.seated.footY + 0.8 : Math.max(fy, p.y + 14) + 0.3, draw: () => ctx.drawImage(handsSprite(), hx - 2, hy - 2) });
    }
    return out;
  }
  let hands = null;
  function handsSprite() {
    if (hands) return hands;
    const b = new PixelBuffer(4, 3);
    b.ellipse(2, 1.5, 2, 1.5, "skin", { flat: true });
    return (hands = outline(b).toCanvas());
  }

  function drawOverlay(ctx2) {
    if (heart) {
      const icon = emoteSprite("heart"), t = heart.age;
      if (!(t > 1.65 && Math.floor(t * 20) % 2)) {
        const lift = t < 0.15 ? 7 * (1 - t / 0.15) : -Math.min(4, (t - 0.15) * 3);
        ctx2.drawImage(icon, Math.round(heart.x - icon.width / 2), Math.round(heart.y - icon.height + lift));
      }
    }
    Quirks.drawOverlay(ctx2);                             // (their little moments' hearts, sparkles and Zzz)
    if (!present()) return;
    if (H.wonder && !H.wonder.found) {
      const q = emoteSprite("question"), bob = Math.round(Math.sin(now() * 3.5));
      ctx2.drawImage(q, Math.round(H.x + 8 - q.width / 2), Math.round(H.y - TILE - q.height - 1 + bob - H.lift));
      Cues.edge(ctx2, { x: H.x + 8, y: H.y - 8, walk: besideHim() }, "question", now());
    }
    if (sparkle) {
      const t = now() - sparkle.at, p = sparkle.target.pos();
      if (!H.wonder || !H.wonder.found || !p) sparkle = null;
      else if (!(H.wonder.timer < 0.25 && Math.floor(t * 20) % 2)) {
        const big = Math.floor(t * 4) % 2 === 0, icon = cueSprite(big ? "sparkles" : "sparkle"), lift = t < 0.12 ? 6 * (1 - t / 0.12) : 0;
        ctx2.drawImage(icon, Math.round(p.x - icon.width / 2 - (big ? 2 : 0)), Math.round(p.y - icon.height - 2 + lift));
      }
    }
    if (!H.emote) return;
    const icon = emoteSprite(H.emote.name), t = H.emote.age;
    if (t > 1.65 && Math.floor(t * 20) % 2) return;
    const lift = t < 0.12 ? 6 * (1 - t / 0.12) : 0;
    ctx2.drawImage(icon, Math.round(H.x + 8 - icon.width / 2), Math.round(H.y - TILE - icon.height - 1 + lift - H.lift));
  }

  function at(gx, gy, minTapPx) {
    if (!present()) return false;
    const cx = H.x + 8, cy = H.y - TILE + 16;
    const w = Math.max(16, minTapPx), h = Math.max(32, minTapPx);
    if (H.wonder && !H.wonder.found) {                               // (the "?" over his head counts as him)
      const q = emoteSprite("question").height + 4;
      return Math.abs(gx - cx) <= w / 2 && gy >= cy - h / 2 - q && gy <= cy + h / 2;
    }
    return Math.abs(gx - cx) <= w / 2 && Math.abs(gy - cy) <= h / 2;
  }

  function occupies(tx, ty) {
    if (!present()) return false;
    const t = tileOf(H.x + 8, H.y + 14);
    return t.x === tx && t.y === ty;
  }

  function button() {
    if (!started || changingPlace || Closeup.isOpen() || Sky.isOpen() || (Speech && Speech.isOpen()) || (Story && Story.busy())) return null;
    if (H.state === "routine" || (typeof Story !== "undefined" && Story.inRoutine && Story.inRoutine())) return null;     // (our morning, our evening)
    if (WORLD.small || H.state === "atWork") return null;
    if (H.state === "together" || H.state === "coming") return "bye";
    if (H.state === "fetching" || H.state === "leaving") return "wait";
    if (H.state !== "away" || player.hidden) return null;
    return "call";
  }

  return { call, bye, goodnight, reset, changedPlace, update, items, drawOverlay, at, occupies, button, tap, reached, says: say, state: () => H.state, pos: () => ({ x: H.x, y: H.y }),
    routine: { at: routineAt, here: routineHere, pose: routinePose, hide: routineHide, sit: routineSit, walk: routineWalk, comeHome, leave: routineLeave, heart: heartBetween,
      facing: (f) => { H.facing = f; }, moving: () => H.moving, lines: () => lines() },
    wonder: (o) => wonder(o), wonderSoon: () => { H.nextWonder = 0; Quirks.soon(); }, debugWonder: () => ({ wait: Math.round(Quirks.wait()), together: H.together, calm: calm(), moving: isMoving(), path: player.path.length, pose: H.pose, state: H.state }), wondering: () => (H.wonder ? { name: H.wonder.target.name, found: H.wonder.found, binoculars: H.wonder.binoculars } : null),
    shareBench, seated: () => H.seated, quirk: (name, o) => Quirks.start(name, o), roomAbove: () => roomAbove(),
    body: () => ({ H, S, say, moveToward, keepUp, herFeet, open, handsSprite, pick, lines }) };
})();
