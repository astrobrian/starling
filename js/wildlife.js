
const Wildlife = (() => {
  let birds = [];
  let serial = 1;
  let herTrail = [];               // where she has been lately (for followers)

  const rand = (a, b) => a + Math.random() * (b - a);
  const POSE = { ground: "stand", perch: "stand", swim: "swim", wade: "stand", spread: "spread", owl: "stand", follow: "walk" };

  function add(spec) {
    const look = spec.look || BIRDS[spec.species];
    const b = {
      id: spec.id || `${spec.species}-${serial++}`,
      species: spec.species, look, name: look.name, korean: look.korean || null,
      does: spec.does || "ground",
      x: spec.x, y: spec.y, home: { x: spec.x, y: spec.y },
      range: (spec.range || 1.5) * TILE,
      sortY: spec.sortY === undefined ? null : spec.sortY,
      shy: spec.shy === undefined ? ["ground", "perch", "walk"].includes(spec.does || "ground") : spec.shy,
      favor: !!spec.favor, story: !!spec.story,
      thought: spec.thought || null,
      pose: spec.pose || POSE[spec.does || "ground"] || "stand",
      faceLeft: spec.faceLeft === undefined ? Math.random() < 0.5 : spec.faceLeft,
      timer: rand(0.4, 2.5), hop: null, flight: null, gone: false, returnAt: 0,
      joy: 0, emote: null, target: null, underwater: false, lift: 0,
      act: null, run: null, hiddenIn: null,
    };
    birds.push(b);
    if (spec.flyIn) {
      const from = { x: b.x + (b.faceLeft ? 160 : -160), y: b.y - 140 };
      b.flight = { from, to: { x: b.x, y: b.y }, t: 0, dur: 1.4 };
      b.faceLeft = from.x > b.x;
    }
    return b;
  }

  const get = (id) => birds.find((b) => b.id === id);
  function remove(id) { const b = get(id); if (b) finishAct(b); birds = birds.filter((x) => x.id !== id); }

  function schedule(day, phase, world, instant = true) {
    const wanted = [];
    for (const e of window.BIRD_SCHEDULE || []) {
      if (day < e.from || !e.when.includes(phase)) continue;
      for (let i = 0; i < (e.count || 1); i++) wanted.push({ e, key: `${e.species}@${e.at}#${i}` });
    }
    const keys = new Set(wanted.map((w) => w.key));
    const leaving = birds.filter((b) => !b.story && b.key && !keys.has(b.key));
    for (const b of leaving) {
      if (instant) b.removeNow = true; else leave(b, true);
    }
    const rank = (b) => ({ hen: 0, duckling: 1, drake: 2 })[b.species] ?? 1;
    const swimmers = leaving.filter((b) => b.swimAway).sort((a, c) => rank(a) - rank(c) || alongRiver(c) - alongRiver(a));
    swimmers.forEach((b, i) => { b.swimAway.lane = 0; b.swimAway.after = i > 0 ? swimmers[i - 1] : null; });
    birds = birds.filter((b) => !b.removeNow);
    for (const { e, key } of wanted) {
      if (birds.some((b) => b.key === key)) continue;
      const i = Number(key.split("#")[1]);
      let x = e.at[0] * TILE, y = e.at[1] * TILE;
      if (e.does === "ground" || e.does === "swim") { x += (i % 2 ? 1 : -1) * i * 10; y += (i % 3) * 5; }
      let sortY = null;
      if (e.sortAfter) {
        const near = world.things.filter((t) => t.type === e.sortAfter)
          .reduce((a, t) => (!a || Math.hypot(t.footX - x, t.footY - y) < Math.hypot(a.footX - x, a.footY - y) ? t : a), null);
        if (near) sortY = near.footY + 0.5;
      }
      const b = add({ species: e.species, x, y, does: e.does, range: e.range, sortY, flyIn: !instant && e.does !== "swim" });
      b.key = key;
    }
  }

  function flyTo(b, x, y, dur = null, opts = {}) {
    finishAct(b);
    const from = { x: b.x, y: b.y };
    const d = Math.hypot(x - from.x, y - from.y);
    b.flight = { from, to: { x, y }, t: 0, dur: dur || Math.min(1.6, 0.4 + d / 170), home: !opts.keepHome, arc: opts.arc === undefined ? null : opts.arc, then: opts.then || null };
    b.faceLeft = x < from.x;
    b.hop = null;
  }

  function stepHop(b, dt) {
    const h = b.hop;
    h.t = Math.min(1, h.t + dt / (h.dur || 0.2));
    const k = h.t;
    b.x = h.from.x + (h.to.x - h.from.x) * k;
    b.y = h.from.y + (h.to.y - h.from.y) * k;
    b.lift = Math.sin(k * Math.PI) * (h.height || 3);
    if (k >= 1) { b.hop = null; b.lift = 0; }
  }
  function hop(b, height = 3.5) {
    if (!b || b.flight || b.gone || b.hiddenIn) return;
    b.hop = { from: { x: b.x, y: b.y }, to: { x: b.x, y: b.y }, t: 0, dur: 0.3, height, inPlace: true };
  }

  function leave(b, forGood = false) {
    if (forGood && b.does === "swim" && WORLD.river && WORLD.river.pointAt) {
      b.swimAway = { lane: 0, after: null };
      b.forGood = true;
      b.thought = null;
      return;
    }
    const dir = b.faceLeft ? -1 : 1;
    flyTo(b, b.x + dir * 230, b.y - 170, 1.5);
    b.flight.leave = true;
    b.forGood = forGood;
    b.thought = null;
  }

  const alongRiver = (b) => (WORLD.river ? WORLD.river.at(b.x / TILE, b.y / TILE).t : 0);
  function paddleAway(b, dt) {
    b.swimAway.going = true;
    const r = WORLD.river, here = r.at(b.x / TILE, b.y / TILE);
    const ahead = r.pointAt(here.t + 0.5);
    const tx = (ahead.x + here.fy * b.swimAway.lane) * TILE, ty = (ahead.y - here.fx * b.swimAway.lane) * TILE;
    const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy) || 1, speed = 11;
    b.x += (dx / len) * speed * dt;
    b.y += (dy / len) * speed * dt;
    if (Math.abs(dx) > 1) b.faceLeft = dx < 0;
    b.pose = "swim";
    const m = 48, out = b.x < camera.x - m || b.x > camera.x + canvas.width + m || b.y < camera.y - m || b.y > camera.y + canvas.height + m;
    if (out || len < 1.5) { b.swimAway = null; b.gone = true; b.removeNow = true; }     // out of sight, or at the river's end
  }

  function flee(b, herX, herY, time) {
    if (b.does === "ground") {
      const away = Math.atan2(b.y - herY, b.x - herX);
      for (let i = 0; i < 8; i++) {
        const a = away + rand(-0.7, 0.7), d = rand(40, 64);
        const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
        if (isWalkable(Math.floor(x / TILE), Math.floor((y - 2) / TILE)) && Math.hypot(x - b.home.x, y - b.home.y) < b.range + 40) {
          flyTo(b, x, y, 0.55, { keepHome: true });
          b.pose = "fly";
          return;
        }
      }
    }
    b.faceLeft = herX > b.x;                     // off it goes, away from her
    leave(b);
    b.returnAt = time + rand(12, 22);
  }

  const behave = {
    ground(b, dt, time, d, still) {
      if (b.species === "wagtail") b.pose = Math.floor(time * 3.5 + b.home.x) % 2 ? "bob" : "stand";
      b.timer -= dt;
      if (b.timer > 0) return;
      if (b.pose === "peck" && b.species !== "wagtail") b.pose = "stand";
      const r = Math.random();
      if (b.shy && still > 3 && d < 6 * TILE && d > 28) {
        const her = herFeet();
        const a = Math.atan2(her.y - b.y, her.x - b.x);
        hopTo(b, b.x + Math.cos(a) * 10, b.y + Math.sin(a) * 6);
        b.timer = rand(0.5, 1.2);
      } else if (r < 0.4) {
        if (b.species !== "wagtail") b.pose = "peck";
        b.timer = rand(0.25, 0.6);
      } else if (r < 0.75) {
        for (let i = 0; i < 5; i++) {
          const a = rand(0, Math.PI * 2), step = rand(6, 14);
          const x = b.x + Math.cos(a) * step, y = b.y + Math.sin(a) * step * 0.6;
          if (Math.hypot(x - b.home.x, y - b.home.y) > b.range) continue;
          if (!isWalkable(Math.floor(x / TILE), Math.floor((y - 2) / TILE))) continue;
          hopTo(b, x, y);
          break;
        }
        b.timer = rand(0.4, 1.6);
      } else {
        b.faceLeft = !b.faceLeft;
        b.timer = rand(0.8, 2.2);
      }
    },

    perch(b, dt, time) {
      b.timer -= dt;
      if (b.timer > 0) return;
      const r = Math.random();
      b.pose = r < 0.3 ? "peck" : r < 0.5 ? "bob" : "stand";
      if (r > 0.8) b.faceLeft = !b.faceLeft;
      b.timer = b.pose === "stand" ? rand(1, 3) : rand(0.3, 0.6);
    },

    swim(b, dt, time) {
      b.timer -= dt;
      if (b.pose === "dabble") {
        if (b.timer <= 0) { b.pose = "swim"; b.timer = rand(2, 5); }
        return;
      }
      const water = (x, y) => WORLD.river && WORLD.river.at(x / TILE, y / TILE).d < -0.45;
      if (!b.target || Math.hypot(b.target.x - b.x, b.target.y - b.y) < 2) {
        for (let i = 0; i < 10; i++) {
          const a = rand(0, Math.PI * 2), r = rand(0, b.range);
          const x = b.home.x + Math.cos(a) * r, y = b.home.y + Math.sin(a) * r * 0.7;
          if (water(x, y)) { b.target = { x, y }; break; }
        }
        if (!b.target) b.target = { x: b.home.x, y: b.home.y };
      }
      const dx = b.target.x - b.x, dy = b.target.y - b.y, len = Math.hypot(dx, dy) || 1;
      const speed = 5;
      b.x += (dx / len) * Math.min(len, speed * dt);
      b.y += (dy / len) * Math.min(len, speed * dt);
      if (Math.abs(dx) > 1) b.faceLeft = dx < 0;
      if (b.timer <= 0 && b.look.shape === "duck" && Math.random() < 0.35) { b.pose = "dabble"; b.timer = rand(1.4, 2.4); }
      else if (b.timer <= 0) b.timer = rand(2, 5);
    },

    wade(b, dt, time) {
      b.timer -= dt;
      if (b.timer > 0) return;
      const r = Math.random();
      if (b.pose === "strike") { b.pose = "stand"; b.timer = rand(3, 6); return; }
      if (r < 0.25) { b.pose = "strike"; b.timer = 0.55; }
      else if (r < 0.45) { b.faceLeft = !b.faceLeft; b.timer = rand(2, 4); }
      else { b.pose = b.pose === "walk" ? "stand" : "walk"; b.timer = rand(1.5, 4); }
    },

    spread(b, dt) {
      b.timer -= dt;
      if (b.timer > 0) return;
      b.pose = b.pose === "spread" ? "stand" : "spread";
      b.timer = b.pose === "spread" ? rand(6, 10) : rand(1.5, 3);
    },

    still() {},

    owl(b, dt) {
      b.timer -= dt;
      if (b.timer > 0) return;
      b.pose = b.pose === "blink" ? "stand" : "blink";
      b.timer = b.pose === "blink" ? 0.18 : rand(2, 5);
    },

    goto(b, dt) {
      const g = b.goal;
      if (!g) { b.does = "swim"; return; }
      const dx = g.x - b.x, dy = g.y - b.y, len = Math.hypot(dx, dy);
      const wet = WORLD.river && WORLD.river.at(b.x / TILE, b.y / TILE).d < -0.2;
      if (len < 1.5) {
        b.does = g.then || "swim"; b.home = { x: g.x, y: g.y }; b.target = null; b.goal = null; b.moving = false; b.lift = 0; b.pose = "swim";
        if (g.done) g.done();
        return;
      }
      const step = Math.min(len, (wet ? 24 : 42) * dt);
      b.x += (dx / len) * step; b.y += (dy / len) * step;
      b.faceLeft = dx < -0.5 ? true : dx > 0.5 ? false : b.faceLeft;
      b.moving = !wet;
      b.lift = wet ? 0 : Math.abs(Math.sin(performance.now() / 90)) * 1.5;
      b.pose = wet ? "swim" : "walk";
    },

    follow(b, dt) {
      const spot = herTrail[Math.max(0, herTrail.length - 1 - (b.lag || 10))];
      if (!spot) return;
      const dx = spot.x - b.x, dy = spot.y - b.y, len = Math.hypot(dx, dy);
      b.moving = len > 1;
      if (len > 1) {
        const step = Math.min(len, (len > 30 ? 90 : 62) * dt);
        b.x += (dx / len) * step; b.y += (dy / len) * step;
        b.faceLeft = dx < -0.5 ? true : dx > 0.5 ? false : b.faceLeft;
        b.lift = Math.abs(Math.sin(performance.now() / 90)) * 1.5;
      } else b.lift = 0;
      b.pose = "walk";
    },

    run(b, dt) {
      const r = b.run;
      if (!r) { b.does = "ground"; return; }
      const target = r.path ? r.path[0] || null : behindOn(r.ahead, r.gap);
      let moved = false;
      if (target) {
        const dx = target.x - b.x, dy = target.y - b.y, len = Math.hypot(dx, dy);
        const crowding = r.ahead && Math.hypot(r.ahead.x - b.x, r.ahead.y - b.y) < r.gap * 0.75;
        if (len > 0.5 && !crowding) {
          const step = Math.min(len, r.speed * (r.path ? 1 : 1.15) * dt);
          b.x += (dx / len) * step; b.y += (dy / len) * step;
          if (Math.abs(dx) > 0.3) b.faceLeft = dx < 0;
          moved = step > 0.05;
        } else if (r.path && len <= 0.5) r.path.shift();
      }
      const last = r.trail[r.trail.length - 1];
      if (Math.hypot(b.x - last.x, b.y - last.y) >= 1) { r.trail.push({ x: b.x, y: b.y }); if (r.trail.length > 400) r.trail.shift(); }
      r.done = r.path ? !r.path.length : !!(r.ahead.run && r.ahead.run.done && (!target || Math.hypot(target.x - b.x, target.y - b.y) < 0.8));
      if (moved) { r.phase += dt * 7; b.lift = Math.abs(Math.sin(r.phase * Math.PI)) * 2.5; b.pose = b.lift > 1 ? "jump" : "crouch"; }
      else { b.lift = 0; b.pose = "stand"; }
      if (r.group.birds.every((o) => o.run && o.run.done)) finishRun(r.group);
    },
  };

  const ACT_TIME = { drink: 2.6, bathe: 3.2, sing: 3, sleep: 0, jump: 1.65, dance: 1.2, pant: 0, fan: 1.8, flap: 1.2, shake: 0.56 };
  const HOP_TIME = { jump: 0.55, dance: 0.4 };
  const MELODY = [1, 1.12, 1.26, 1.12, 1.5, 1.33, 1.26];

  function newAct(name, seconds) {
    let dur = seconds === undefined || seconds === null ? ACT_TIME[name] : seconds;
    if (!dur || dur === Infinity) dur = Infinity;
    else if (HOP_TIME[name]) dur = Math.max(1, Math.round(dur / HOP_TIME[name])) * HOP_TIME[name];     // (whole hops: never stops in mid-air)
    return { name, t: 0, dur, n: 0, nextCue: name === "sleep" ? rand(0.6, 3) : 0.1, done: false, resolve: null };
  }

  function stepAct(a, dt, look, owner) {
    a.t += dt;
    const t = a.t;
    let pose = "stand", lift = 0, flip = false;
    const cue = (kind, dir) => (owner.cueQueue || (owner.cueQueue = [])).push({ kind, dir });
    if (a.name === "drink") {
      pose = look.drinks === "sip" || t % 1.3 < 0.9 ? "drink" : "tipUp";
    } else if (a.name === "bathe") {
      const k = t % 1.5, burst = Math.floor(t / 1.5);
      if (k < 0.9) {
        pose = Math.floor(k / 0.09) % 2 ? "bathe2" : "bathe";
        if (burst !== a.burst && typeof Sound !== "undefined") Sound.splash();
        a.burst = burst;
      } else pose = "soak";
    } else if (a.name === "sing") {
      const k = t % 2;
      if (k < 1.5) {
        pose = Math.floor(k / 0.2) % 2 ? "sing2" : "sing";
        if (t >= a.nextCue) {
          cue("note", a.cueDir || (owner.faceLeft ? -1 : 1));
          a.nextCue = t + 0.45;
          if (typeof Sound !== "undefined") Sound.chirp(look.chirp || "tweet", (look.chirpPitch || 2600) * MELODY[a.n % MELODY.length], a.n);
          a.n++;
        }
      } else pose = "tipUp";
    } else if (a.name === "sleep") {
      pose = owner.does === "perch" && (look.shape || "songbird") === "songbird" ? "roost" : "sleep";
      if (t >= a.nextCue) { cue("zzz", owner.faceLeft ? 1 : -1); a.nextCue = t + (a.cueEvery || rand(3.2, 5.5)); }
    } else if (a.name === "jump") {
      const k = t % HOP_TIME.jump;
      if (k < 0.12) pose = "crouch";
      else if (k < 0.42) { lift = Math.sin(((k - 0.12) / 0.3) * Math.PI) * 5; pose = "jump"; }
      else pose = k < 0.5 ? "crouch" : "stand";
    } else if (a.name === "dance") {
      const per = HOP_TIME.dance, turn = Math.floor(t / per + 0.5);
      if (a.turn !== undefined && turn !== a.turn) flip = true;
      a.turn = turn;
      lift = Math.sin(((t % per) / per) * Math.PI) * 5;
      pose = lift > 1.5 ? "jump" : "crouch";
    } else if (a.name === "pant") {
      pose = Math.floor(t / 0.16) % 2 ? "pant2" : "pant";
    } else if (a.name === "fan") {
      pose = Math.floor(t / 0.12) % 2 ? "fan" : "pant";
    } else if (a.name === "flap") {
      pose = Math.floor(t / 0.1) % 2 ? "wings" : "stand";
      lift = Math.abs(Math.sin(t * Math.PI * 2.5)) * 2;
    } else if (a.name === "shake") {
      const turn = Math.floor(t / 0.14);
      if (a.turn !== undefined && turn !== a.turn) flip = true;
      a.turn = turn;
    }
    a.done = t >= a.dur;
    return { pose, lift, flip };
  }

  function act(b, name, seconds) {
    if (!b) return Promise.resolve();
    finishAct(b);
    if (!name) return Promise.resolve();
    b.act = newAct(name, seconds);
    return new Promise((resolve) => { b.act.resolve = resolve; });
  }

  function finishAct(b) {
    const a = b && b.act;
    if (!a) return;
    b.act = null;
    b.lift = 0;
    b.pose = POSE[b.does] || "stand";
    if (a.resolve) a.resolve();
  }

  const CUE_LIFE = { note: 1.3, zzz: 2.1 };
  function drawCues(ctx2, o, anchor) {
    const now = performance.now() / 1000;
    for (const q of o.cueQueue || []) {
      const from = q.kind === "zzz" ? anchor.head : anchor.mouth;
      (o.cues || (o.cues = [])).push({ kind: q.kind, x: from.x + (q.dx || 0) * CUE, y: from.y + (q.dy || 0) * CUE, dir: q.dir || 1, born: now, seed: Math.random() * 6 });
    }
    if (o.cueQueue) o.cueQueue.length = 0;
    if (!o.cues || !o.cues.length) return;
    o.cues = o.cues.filter((c) => now - c.born < CUE_LIFE[c.kind]);
    for (const c of o.cues) {
      const age = now - c.born, k = age / CUE_LIFE[c.kind];
      if (k > 0.8 && Math.floor(age * 20) % 2) continue;
      const icon = emoteSprite(c.kind);
      const x = c.kind === "zzz" ? c.x + c.dir * (1 + k * 6) * CUE : c.x + (c.dir * (1 + k * 6) + Math.sin(age * 6 + c.seed) * 1.5) * CUE;
      const y = c.y - 1 - k * (c.kind === "zzz" ? 11 : 15) * CUE;
      ctx2.drawImage(icon, Math.round(x - icon.width / 2), Math.round(y - icon.height));
    }
  }

  function runTo(list, x, y, { speed = 72, gap = 12, range = 1 } = {}) {
    list = (list || []).filter(Boolean);
    if (!list.length) return Promise.resolve([]);
    const order = [...list].sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y));
    return new Promise((resolve) => {
      const group = { birds: order, resolve, range };
      order.forEach((b, i) => {
        finishAct(b);
        b.flight = null; b.hop = null; b.hiddenIn = null; b.gone = false;
        b.does = "run"; b.lift = 0; b.shy = false;                           // (she follows them: they don't mind)
        b.run = { group, ahead: order[i - 1] || null, path: i === 0 ? route(b, x, y) : null, trail: [{ x: b.x, y: b.y }], speed, gap, done: false, phase: i * 0.3 };
      });
    });
  }

  function route(b, x, y) {
    const tile = (px, py) => ({ x: Math.floor(px / TILE), y: Math.floor((py - 2) / TILE) });
    const from = tile(b.x, b.y), to = tile(x, y);
    const steps = findPath(from, to, MAP_W, MAP_H, isWalkable, stepCost);
    const pts = steps.map((s) => ({ x: s.x * TILE + 8, y: s.y * TILE + 11 }));
    if (isWalkable(to.x, to.y)) {
      if (pts.length && steps[steps.length - 1].x === to.x && steps[steps.length - 1].y === to.y) pts.pop();
      pts.push({ x, y });
    }
    return pts;
  }

  function behindOn(a, gap) {
    const tr = a.run ? a.run.trail : null;
    let prev = { x: a.x, y: a.y }, d = 0;
    if (!tr) return prev;
    for (let i = tr.length - 1; i >= 0; i--) {
      const p = tr[i], seg = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (d + seg >= gap) { const k = (gap - d) / (seg || 1); return { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k }; }
      d += seg; prev = p;
    }
    return prev;                                    // (it hasn't gone far yet: where it started)
  }

  function finishRun(group) {
    for (const b of group.birds) {
      b.run = null; b.does = "ground"; b.lift = 0; b.pose = "stand";
      b.home = { x: b.x, y: b.y }; b.range = group.range * TILE; b.timer = rand(0.6, 1.4);
    }
    group.resolve(group.birds);
  }

  const hideouts = new Map();       // bush -> { t: seconds to the next rustle }

  function hideIn(list, bush) {
    for (const b of (list || []).filter(Boolean)) {
      finishAct(b);
      b.flight = null; b.hop = null; b.run = null;
      b.hiddenIn = bush; b.gone = true;              // (gone: not drawn, not tappable)
      b.x = bush.footX; b.y = bush.footY - 2;
    }
    if (!hideouts.has(bush)) hideouts.set(bush, { t: rand(0.5, 1.2) });
  }

  function rustle(bush, chirp = true) {
    bush.bounce = 0.3; bush.shake = 0.35;
    const inside = birds.filter((b) => b.hiddenIn === bush);
    if (chirp && inside.length && typeof Sound !== "undefined") {
      const b = inside[Math.floor(Math.random() * inside.length)];
      Sound.chirp(b.look.chirp || "tweet", (b.look.chirpPitch || 3000) * rand(0.95, 1.15), serial++);
    }
  }

  function popOut(list, { spread = 30, arc = 12 } = {}) {
    list = (list || []).filter((b) => b && b.hiddenIn);
    if (!list.length) return Promise.resolve([]);
    const bush = list[0].hiddenIn, n = list.length, her = herFeet(), spots = [];
    bush.bounce = 0.4; bush.shake = 0.5;
    const open = (p) => isWalkable(Math.floor(p.x / TILE), Math.floor((p.y - 2) / TILE)) &&
      spots.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 10) && Math.hypot(her.x - p.x, her.y - p.y) > 14;
    return Promise.all(list.map((b, i) => new Promise((resolve) => {
      let spot = null;
      for (let k = 0; k < 30 && !spot; k++) {
        const front = k < 12, a = front ? Math.PI * (0.08 + 0.84 * (i + 0.5) / n) + rand(-0.3, 0.3) : rand(0, Math.PI * 2);
        const d = spread * rand(0.7, 1.15), p = { x: bush.footX + Math.cos(a) * d, y: bush.footY + Math.sin(a) * d * 0.8 };
        if (open(p)) spot = p;
      }
      spot = spot || { x: bush.footX + (i - (n - 1) / 2) * 11, y: bush.footY + 14 };
      spots.push(spot);
      setTimeout(() => {
        b.hiddenIn = null; b.gone = false; b.does = "ground"; b.shy = false;
        b.x = bush.footX + rand(-3, 3); b.y = bush.footY - 3;
        if (typeof Sound !== "undefined") Sound.chirp(b.look.chirp || "tweet", (b.look.chirpPitch || 3000) * rand(0.95, 1.2), i);
        flyTo(b, spot.x, spot.y, rand(0.45, 0.6), { arc, then: () => resolve(b) });
      }, i * 60);
    })));
  }

  function roost(list, x, y, { gap = null, faceLeft = false, sortY = null, instant = false } = {}) {
    if (!Array.isArray(list)) {
      const { species, count = 3 } = list;
      list = Array.from({ length: count }, (_, i) => add({ id: `${species}-roost-${serial++}-${i}`, species, x, y, does: "perch", story: true, shy: false, faceLeft }));
    }
    list = list.filter(Boolean);
    if (!list.length) return Promise.resolve([]);
    const n = list.length, look = list[0].look;
    const step = gap || Math.max(8, Math.round((look.bodyRx || 5.2) * 2 * 1.12 * 0.92) + 2);
    const base = sortY === null ? y + 0.5 : sortY;
    const settle = (b, i) => { b.faceLeft = faceLeft; b.sortY = base + (faceLeft ? i : n - 1 - i) * 0.001; };
    list.forEach((b, i) => { finishAct(b); b.does = "perch"; b.shy = false; b.thought = null; b.run = null; b.hiddenIn = null; b.gone = false; settle(b, i); });
    const spotX = (i) => x + (i - (n - 1) / 2) * step;
    const doze = (b, i) => { act(b, "sleep"); b.act.nextCue = 1 + i * 2.2; b.act.cueEvery = n * 2.2; };
    if (instant) {
      list.forEach((b, i) => { b.flight = null; b.hop = null; b.x = spotX(i); b.y = y; b.home = { x: b.x, y }; doze(b, i); });
      return Promise.resolve(list);
    }
    const landed = list.map((b, i) => new Promise((resolve) => setTimeout(() => flyTo(b, spotX(i), y, 0.9, { then: () => { settle(b, i); resolve(); } }), i * 300)));
    return Promise.all(landed).then(() => new Promise((resolve) => {
      list.forEach((b, i) => setTimeout(() => { settle(b, i); doze(b, i); if (i === n - 1) resolve(list); }, 300 + i * 420));
    }));
  }

  const TRUNKS = ["bigTree", "persimmonTree", "woodsTree", "willow"];
  behave.cling = (b, dt, time, d) => {
    if (b.trunkLeft === undefined) {
      const tree = WORLD.things.filter((t) => TRUNKS.includes(t.type))
        .reduce((a, t) => (!a || Math.abs(t.footX - b.home.x) + Math.abs(t.footY - b.home.y) < Math.abs(a.footX - b.home.x) + Math.abs(a.footY - b.home.y) ? t : a), null);
      b.trunkLeft = tree ? b.home.x > tree.footX : b.faceLeft;
      if (b.sortY === null && tree) b.sortY = tree.footY + 0.5;
    }
    b.faceLeft = b.trunkLeft;
    const headDown = (b.look.poses || RIG_PLANS.clinger.poses).includes("down");
    if (b.knocks) {
      const k = b.knocks;
      if (k.t <= 0) {
        if (k.left === 0) { b.knocks = null; b.pose = "stand"; b.timer = rand(1, 2); k.resolve(); return; }
        k.left--; b.pose = "drum2";
        Sound.chirp("knock", b.look.chirpPitch || 900, k.left);
      }
      k.t += dt;
      if (k.t > 0.12) b.pose = "drum1";
      if (k.t >= k.gap) k.t = 0;
      return;
    }
    if (b.drumming > 0) {
      b.drumming -= dt;
      b.pose = b.drumming <= 0 ? "stand" : Math.floor(b.drumming * 18) % 2 ? "drum2" : "drum1";
      return;
    }
    if (b.climbing) {
      const c = b.climbing;
      c.t = Math.min(1, c.t + dt / 0.18);
      b.y = c.from + (c.to - c.from) * c.t;
      if (c.t >= 1) { b.climbing = null; b.pose = c.to > c.from ? "down" : "stand"; }
      return;
    }
    b.timer -= dt;
    if (b.timer > 0) return;
    const top = b.home.y - b.range, down = headDown && b.pose.startsWith("down");
    const r = Math.random();
    if (r < 0.28) {
      b.pose = down ? "down" : "peck";
      b.timer = rand(0.25, 0.6);
    } else if (r < 0.7) {
      const step = rand(2.5, 4);
      if (!down && b.y - step < top) {
        if (headDown) b.pose = "down";
        else flyTo(b, b.x, b.home.y, 0.8);
      } else if (down && b.y + step > b.home.y) b.pose = "stand";
      else {
        b.climbing = { from: b.y, to: b.y + (down ? step : -step), t: 0 };
        b.pose = down ? "down2" : "climb";
      }
      b.timer = rand(0.2, 0.7);
    } else if (r < 0.8 && b.look.chirp === "knock" && !down) {
      b.drumming = rand(0.6, 1);
      if (d < 8 * TILE) Sound.chirp("drum", b.look.chirpPitch || 900);
      b.timer = rand(1.5, 3);
    } else {
      b.pose = down ? "down" : "stand";
      b.timer = rand(0.6, 1.8);
    }
  };

  behave.walk = (b, dt, time, d, still) => {
    const look = b.look;
    if (b.hop) return behave.ground(b, dt, time, d, still);         // a hopper mid-hop
    if (look.hides && d < 4 * TILE) {
      b.target = null; b.moving = false; b.pose = "crouch";
      return;
    }
    if (b.target) {
      const dx = b.target.x - b.x, dy = b.target.y - b.y, len = Math.hypot(dx, dy);
      const step = Math.min(len, (look.walkSpeed || 12) * dt);
      b.x += (dx / (len || 1)) * step; b.y += (dy / (len || 1)) * step;
      b.walked = (b.walked || 0) + step;
      if (Math.abs(dx) > 0.5) b.faceLeft = dx < 0;
      b.moving = len > 0.5;
      b.pose = Math.floor(b.walked / 3) % 2 ? "walk2" : "walk";
      if (!b.moving) { b.target = null; b.pose = "stand"; }
      return;
    }
    b.timer -= dt;
    if (b.timer > 0) return;
    const r = Math.random();
    if (r < 0.35) {
      b.pose = "peck";
      b.timer = rand(0.3, 0.8);
    } else if (r < 0.72) {
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2), dist = look.gait === "hop" ? rand(6, 14) : rand(10, 26);
        const x = b.x + Math.cos(a) * dist, y = b.y + Math.sin(a) * dist * 0.6;
        if (Math.hypot(x - b.home.x, y - b.home.y) > b.range || !isWalkable(Math.floor(x / TILE), Math.floor((y - 2) / TILE))) continue;
        if (look.gait === "hop") hopTo(b, x, y); else b.target = { x, y };
        break;
      }
      b.pose = "stand";
      b.timer = rand(0.5, 1.6);
    } else if (r < 0.86 && look.habits) {
      b.pose = look.habits[Math.floor(Math.random() * look.habits.length)];
      b.timer = rand(1.2, 2.8);
    } else {
      b.pose = "stand";
      b.faceLeft = !b.faceLeft;
      b.timer = rand(0.8, 2.2);
    }
  };

  behave.hawk = (b, dt) => {
    b.loop = (b.loop ?? rand(0, 6.3)) + dt * (b.look.hawkSpeed || 1);
    const t = b.loop, x = b.home.x + Math.sin(t) * b.range, y = b.home.y + Math.sin(2 * t) * b.range * 0.3;
    if (Math.abs(x - b.x) > 0.05) b.faceLeft = x < b.x;
    b.x = x; b.y = y;
    b.lift = 13 + Math.sin(t * 3) * 4;
    b.pose = "fly";
  };

  function knock(b, n = 1, gap = 0.55) {
    b.climbing = null; b.drumming = 0;
    return new Promise((resolve) => { b.knocks = { left: n, t: 0, gap, resolve }; });
  }

  function rigSprite(b, plan) {
    const now = performance.now() / 1000, seed = (b.id ? b.id.length : 0) * 0.37 + b.home.x * 0.013;
    const list = b.look.poses || plan.poses;
    let pose = b.pose;
    const flying = pose === "fly" || b.does === "hawk";
    if (flying) pose = plan.flap[Math.floor(now * plan.flapRate + seed * 10) % plan.flap.length];
    if (!list.includes(pose)) pose = list[0];
    if (!b.blinkAt) b.blinkAt = now + 1 + Math.random() * 4;
    if (now > b.blinkAt) { b.blinkUntil = now + 0.12; b.blinkAt = now + 2.5 + Math.random() * 2.5; }
    return renderBird(b.look, pose, !flying && pose !== "rest" && now < (b.blinkUntil || 0));
  }

  function hopTo(b, x, y) {
    b.hop = { from: { x: b.x, y: b.y }, to: { x, y }, t: 0 };
    if (Math.abs(x - b.x) > 0.5) b.faceLeft = x < b.x;
  }

  function herFeet() {
    const p = playerPixelPos();
    return { x: p.x + 8, y: p.y + 14 };
  }

  function update(dt, time) {
    const her = herFeet();
    const last = herTrail[herTrail.length - 1];
    if (!last || Math.hypot(her.x - last.x, her.y - last.y) >= 2) herTrail.push({ x: her.x, y: her.y });
    if (herTrail.length > 90) herTrail.shift();
    const still = player.still;
    for (const [bush, h] of hideouts) {
      if (!birds.some((b) => b.hiddenIn === bush)) { hideouts.delete(bush); continue; }
      h.t -= dt;
      if (h.t <= 0) { rustle(bush); h.t = rand(1.3, 3); }
    }
    for (const b of birds) {
      b.joy = Math.max(0, b.joy - dt);
      if (b.emote) { b.emote.age += dt; if (b.emote.age > 1.8) b.emote = null; }
      if (b.hiddenIn) continue;                                            // (inside a bush)
      const ahead = b.swimAway && b.swimAway.after;
      const waiting = ahead && !ahead.removeNow && birds.includes(ahead) && (!ahead.swimAway || !ahead.swimAway.going || Math.hypot(ahead.x - b.x, ahead.y - b.y) < 26 || alongRiver(ahead) <= alongRiver(b));
      if (b.swimAway && !waiting) { paddleAway(b, dt); continue; }             // (waiting its turn: paddles about as usual)
      if (b.flight) {
        b.flight.t = Math.min(1, b.flight.t + dt / b.flight.dur);
        const k = b.flight.t, e = k * k * (3 - 2 * k);
        b.x = b.flight.from.x + (b.flight.to.x - b.flight.from.x) * e;
        b.y = b.flight.from.y + (b.flight.to.y - b.flight.from.y) * e;
        const arc = b.flight.arc !== null && b.flight.arc !== undefined ? b.flight.arc : Math.min(24, Math.hypot(b.flight.to.x - b.flight.from.x, b.flight.to.y - b.flight.from.y) * 0.2);
        b.lift = Math.sin(k * Math.PI) * arc;
        b.pose = "fly";
        if (k >= 1) {
          const f = b.flight;
          b.flight = null; b.lift = 0;
          b.pose = POSE[b.does] || "stand";
          if (f.leave) { b.gone = true; if (b.forGood) b.removeNow = true; }
          else if (f.home) b.home = { x: f.to.x, y: f.to.y };                // (it lives here now)
          if (f.then) f.then();
        }
        continue;
      }
      if (b.gone) {
        if (!b.forGood && time > b.returnAt && Math.hypot(her.x - b.home.x, her.y - b.home.y) > 5 * TILE) {
          b.gone = false;
          b.x = b.home.x + (b.faceLeft ? 200 : -200); b.y = b.home.y - 150;
          flyTo(b, b.home.x, b.home.y, 1.4);
        }
        continue;
      }
      if (b.hop) { stepHop(b, dt); continue; }
      if (b.act) {
        const f = stepAct(b.act, dt, b.look, b);
        b.pose = f.pose; b.lift = f.lift;
        if (f.flip) b.faceLeft = !b.faceLeft;
        if (b.act.done) finishAct(b);
        continue;
      }
      const d = Math.hypot(her.x - b.x, her.y - b.y);
      if (b.shy && !b.favor && isMoving() && d < 34) { flee(b, her.x, her.y, time); continue; }
      (behave[b.does] || behave.perch)(b, dt, time, d, still);
    }
    birds = birds.filter((b) => !b.removeNow);
  }

  function spriteOf(b) {
    const shape = b.look.shape || "songbird";
    if (RIG_PLANS[shape]) return rigSprite(b, RIG_PLANS[shape]);
    const poses = { songbird: Object.keys(SONGBIRD_POSES), duck: ["swim", "dabble", "walk", "walk2", "fly"], wader: ["stand", "walk", "strike", "fly"],
      cormorant: ["stand", "spread", "fly"], grebe: ["swim"], owl: ["stand", "blink", "fly"] }[shape];
    const now = performance.now() / 1000, seed = (b.id ? b.id.length : 0) * 0.37 + b.home.x * 0.013;
    let pose = b.pose;
    if (b.hop && b.hop.inPlace && shape === "songbird") pose = b.hop.t < 0.2 || b.hop.t > 0.85 ? "crouch" : "jump";
    if (b.look.shape === "duck" && pose !== "fly" && (["ground", "follow", "still"].includes(b.does) || (b.does === "goto" && pose !== "swim"))) {
      pose = b.lift > 0.3 || (["follow", "goto"].includes(b.does) && b.moving) ? (Math.floor(performance.now() / 180) % 2 ? "walk2" : "walk") : "walk";
    }
    if (!poses.includes(pose)) pose = pose === "fly" && poses.includes("stand") ? "stand" : poses[0];
    if (pose === "fly" && shape === "songbird") pose = ["fly", "fly1", "fly2", "fly1"][Math.floor(now * 9 + seed * 10) % 4];
    if (pose === "swim" && (shape === "duck" || shape === "grebe") && Math.floor(now * 1.4 + seed * 5) % 2) pose = "swim-bob";
    if (!b.blinkAt) b.blinkAt = now + 1 + Math.random() * 4;
    if (now > b.blinkAt) { b.blinkUntil = now + 0.12; b.blinkAt = now + 2.5 + Math.random() * 2.5; }
    const blink = shape !== "owl" && !["fly", "fly1", "fly2", "dabble", "sleep", "roost"].includes(pose) && now < (b.blinkUntil || 0);
    return renderBird(b.look, pose, blink);
  }

  function place(b, s) {
    const fx = Math.round(b.x), fy = Math.round(b.y - b.lift);
    return b.faceLeft ? { x0: fx + s.footX, y0: fy - s.footY, flip: true } : { x0: fx - s.footX, y0: fy - s.footY, flip: false };
  }

  function drawBird(ctx, b) {
    if (b.gone || b.underwater) return;
    const s = spriteOf(b), p = place(b, s);
    const onGround = (b.does === "ground" || b.does === "run" || b.does === "walk" || b.does === "follow" || (b.does === "goto" && b.moving) || (b.does === "still" && b.look.shape === "duck")) && !b.sortY;
    if (onGround && !b.flight && b.lift < 2) drawShadow(b.x, b.y - 0.5, b.look.shape === "duck" ? 4.5 : b.look.shape === "pheasant" ? 6.5 : 3.5, 1.2);
    ctx.save();
    ctx.translate(p.x0, p.y0);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(s.canvas, 0, 0);
    ctx.restore();
    if ((b.does === "wade" || b.does === "still") && !b.flight && WORLD.river.at(b.x / TILE, b.y / TILE).d < 0.1) {
      ctx.fillStyle = RAMPS.pond[0];
      const x = Math.round(b.x), y = Math.round(b.y);
      for (const dx of [-4, -3, 3, 4]) ctx.fillRect(x + dx, y, 1, 1);
    }
  }

  function headTop(b) {
    const s = spriteOf(b), p = place(b, s);
    return { x: p.flip ? p.x0 - s.headX : p.x0 + s.headX, y: p.y0 + s.headY };
  }

  function items(view) {
    const seen = birds.filter((b) => !b.gone && Math.abs(b.x - (view.x + view.w / 2)) < view.w / 2 + 60 && Math.abs(b.y - (view.y + view.h / 2)) < view.h / 2 + 80);
    const out = seen.map((b) => ({ bottom: b.flight || b.does === "hawk" ? 1e6 : b.sortY !== null ? b.sortY : b.y, draw: () => drawBird(ctx, b), bird: b }));
    for (const b of seen) if ((b.flight || b.does === "hawk") && b.lift > 3) out.push({ bottom: b.y - 0.1, draw: () => drawShadow(b.x, b.y, 3, 1) });
    for (const row of roostRows(seen)) {
      const n = row.length, first = row[0], last = row[n - 1], cx = Math.round((first.x + last.x) / 2), y = Math.round(first.y);
      const L = roostLeaves(first.look, n, n > 1 ? Math.round((last.x - first.x) / (n - 1)) : 8, leafColorAt(cx, y));
      const keys = row.map((b) => (b.sortY !== null ? b.sortY : b.y));
      out.push({ bottom: Math.min(...keys) - 0.0002, draw: () => ctx.drawImage(L.back, cx - L.ax, y - L.ay) });
      out.push({ bottom: Math.max(...keys) + 0.0002, draw: () => ctx.drawImage(L.front, cx - L.ax, y - L.ay) });
    }
    return out;
  }

  function roostRows(seen) {
    const rows = [];
    const asleep = seen.filter((b) => b.pose === "roost" && !b.flight && !b.hop).sort((p, q) => p.x - q.x);
    for (const b of asleep) {
      const row = rows.find((r) => r[0].species === b.species && Math.abs(r[0].y - b.y) <= 2 && b.x - r[r.length - 1].x <= 12);
      if (row) row.push(b); else rows.push([b]);
    }
    return rows;
  }

  function leafColorAt(x, y) {
    const host = WORLD.things.find((t) => ["bush", "hedge", "berryBush"].includes(t.type) && Math.abs(t.footX - x) <= 16 && t.footY >= y && t.footY - y <= 24);
    return host && host.type !== "bush" ? "hedge" : "leaf";
  }

  const thoughtCache = {};
  function thoughtSprite(icon, empty = false) {
    const m = CUE, key = (empty ? " cloud" : icon) + m;
    if (thoughtCache[key]) return thoughtCache[key];
    const b = new PixelBuffer(20 * m, 17 * m);
    b.ellipse(10 * m, 7 * m, 9 * m, 6 * m, "cream", { flat: true });
    b.circle(5 * m, 5 * m, 4 * m, "cream", { flat: true });
    b.circle(14 * m, 4.5 * m, 4.2 * m, "cream", { flat: true });
    b.circle(9 * m, 3.5 * m, 3.6 * m, "cream", { flat: true });
    b.circle(4 * m, 15 * m, 1.4 * m, "cream", { flat: true });
    b.circle(1.6 * m, 16.2 * m, 0.9 * m, "cream", { flat: true });
    const out = outline(b);
    if (!empty) {
      const pic = iconFromGrid(ICONS[icon] || ICONS.question, m > 1);
      out.stamp(pic, Math.round(10 * m + 1 - pic.w / 2), Math.round(7.5 * m + 1 - pic.h / 2));
    }
    return (thoughtCache[key] = out.toCanvas());
  }

  function drawThoughtAt(ctx, x, y, icon, time, side = 1, dx = 0, dy = 0) {
    const m = CUE, c = thoughtSprite(icon);
    const bob = Math.round(Math.sin(time * 2.2) * 1.2 * m);
    if (dx || dy) {
      const tx = x + dx + side * (1 - 0.4 * m), ty = y + dy - 0.8 * m - 2 + bob;
      const steps = Math.min(3, Math.ceil(Math.hypot(tx - x, ty - y) / (5 * m)));
      for (let i = 1; i <= steps; i++) {
        const k = i / (steps + 1), r = Math.max(1, Math.round((0.6 + 0.5 * k) * m));
        drawDot(ctx, Math.round(x + (tx - x) * k), Math.round(y - 2 + (ty - y + 2) * k), r);
      }
    }
    x += dx; y += dy;
    if (side < 0) {
      ctx.save();
      ctx.translate(Math.round(x + 2 * m), Math.round(y - c.height - 1 + bob));
      ctx.scale(-1, 1);
      ctx.drawImage(thoughtSprite(icon, true), 0, 0);
      ctx.restore();
      const pic = thoughtIcon(icon);
      ctx.drawImage(pic, Math.round(x + 2 * m - (10 * m + 1) - pic.width / 2 + 0.5), Math.round(y - c.height - 1 + bob + 7.5 * m + 1.5 - pic.height / 2));
      return;
    }
    ctx.drawImage(c, Math.round(x - 2 * m), Math.round(y - c.height - 1 + bob));
  }
  const dotCache = {};
  function drawDot(ctx, x, y, r) {
    const c = dotCache[r] || (dotCache[r] = (() => { const b = new PixelBuffer(2 * r, 2 * r); b.circle(r, r, r, "cream", { flat: true }); return outline(b).toCanvas(); })());
    ctx.drawImage(c, x - r - 1, y - r - 1);
  }
  function thoughtBox(x, y, side = 1, dx = 0, dy = 0) {
    const m = CUE, w = 20 * m + 2, h = 17 * m + 2;
    return { x: (side < 0 ? x + 2 * m - w : x - 2 * m) + dx, y: y - h - 1 + dy, w, h };
  }

  function thoughtBubbles() {
    const groups = [];
    for (const b of birds) {
      if (!b.thought || b.gone || b.underwater || b.flight) continue;
      const h = headTop(b);
      const g = groups.find((q) => q.icon === b.thought && Math.abs(q.x - h.x) <= 26 && Math.abs(q.y - h.y) <= 14);
      if (g) { g.birds.push(b); g.x = Math.round((g.x * (g.birds.length - 1) + h.x) / g.birds.length); g.y = Math.min(g.y, h.y); }
      else groups.push({ birds: [b], icon: b.thought, x: h.x, y: h.y });
    }
    if (!groups.length) return groups;
    const clear = keepClear();
    for (const g of groups) {
      Object.assign(g, placeThought(g.x, g.y, clear));
      clear.push(g.box);
    }
    return groups;
  }
  function placeThought(x, y, clear, prefer = 1) {
    const m = CUE, a = prefer < 0 ? -1 : 1;
    const overlap = (p, r) => Math.max(0, Math.min(p.x + p.w, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + p.h, r.y + r.h) - Math.max(p.y, r.y));
    const tries = [[a, 0, 0], [-a, 0, 0], [a, 0, -6 * m], [-a, 0, -6 * m], [a, a * 8 * m, -4 * m], [-a, -a * 8 * m, -4 * m],
      [a, 0, -12 * m], [-a, 0, -12 * m], [a, a * 14 * m, -8 * m], [-a, -a * 14 * m, -8 * m]];
    let best = null;
    for (const [side, dx, dy] of tries) {
      const box = thoughtBox(x, y, side, dx, dy);
      const cost = clear.reduce((sum, r) => sum + overlap(box, r), 0);
      if (!best || cost < best.cost) best = { side, dx, dy, box, cost };
      if (!cost) break;
    }
    return best;
  }
  function thoughtSpot(x, y, prefer = 1) {
    return placeThought(x, y, [...keepClear(), ...thoughtBubbles().map((g) => g.box)], prefer);
  }
  function keepClear() {
    const out = [];
    if (!player.hidden && typeof playerPose === "function") {
      const p = playerPixelPos(), pose = playerPose();
      out.push({ x: p.x, y: p.y - TILE - pose.lift, w: pose.sprite.width, h: pose.sprite.height });
    }
    if (typeof Story !== "undefined" && Story && Story.wants) {
      for (const t of WORLD.things) {
        if (!t.tappable || !Story.wants(t)) continue;
        const s = thingSprite(t, 1);
        out.push({ x: t.footX - s.ax - 2, y: t.footY - s.ay - 2, w: s.canvas.width + 4, h: s.canvas.height + 4 });
      }
    }
    return out;
  }
  const thoughtIcon = (icon) => {
    const key = " icon " + icon + CUE;
    return thoughtCache[key] || (thoughtCache[key] = iconFromGrid(ICONS[icon] || ICONS.question, CUE > 1).toCanvas());
  };

  function drawOverlays(ctx, time) {
    for (const g of thoughtBubbles()) drawThoughtAt(ctx, g.x, g.y, g.icon, time, g.side, g.dx, g.dy);
    for (const b of birds) {
      if (b.gone || b.underwater || b.flight) continue;
      if (b.species === "owl" && b.pose !== "blink" && Daylight.nightAmount() > 0.5) {
        const s = spriteOf(b), p = place(b, s);
        for (const ex of [4, 9]) {
          for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
            const sx = ex + x + 1, sy = 6 + y + 1, px = p.flip ? p.x0 - sx - 1 : p.x0 + sx;
            ctx.fillStyle = x === 1 && y > 0 ? PALETTE.plum : x === 0 && y === 0 ? PALETTE.cream : PALETTE.beeYellow;
            ctx.fillRect(px, p.y0 + sy, 1, 1);
          }
        }
      }
      const h = headTop(b);
      if (b.emote) {
        const icon = ICONS[b.emote.name] && emoteSprite(b.emote.name);
        const t = b.emote.age;
        const lift = t < 0.12 ? 6 * (1 - t / 0.12) : 0;
        if (icon && !(t > 1.65 && Math.floor(t * 20) % 2)) ctx.drawImage(icon, Math.round(h.x - icon.width / 2), Math.round(h.y - icon.height - 2 + lift));
      }
      if ((b.cues && b.cues.length) || (b.cueQueue && b.cueQueue.length)) {
        const s = spriteOf(b), p = place(b, s), X = (u) => (p.flip ? p.x0 - u : p.x0 + u);
        drawCues(ctx, b, { mouth: { x: X(s.beakX === undefined ? s.headX : s.beakX), y: p.y0 + (s.beakY === undefined ? s.headY + 4 : s.beakY) }, head: { x: X(s.headX), y: p.y0 + s.headY } });
      }
    }
  }

  function wantedAt(gx, gy, minTapPx, bubbles = true) {
    for (const g of bubbles ? thoughtBubbles() : []) {
      const r = g.box;
      if (gx < r.x - 1 || gx >= r.x + r.w + 1 || gy < r.y - 1 || gy >= Math.max(r.y + r.h, g.y) + 1) continue;
      return g.birds.reduce((a, b) => (Math.abs(b.x - gx) < Math.abs(a.x - gx) ? b : a));
    }
    let wanted = null;
    for (const b of birds) {
      if (!(b.onTap || b.onReach) || b.gone || b.underwater || b.flight) continue;
      const s = spriteOf(b), p = place(b, s);
      const cx = p.flip ? p.x0 - s.canvas.width / 2 : p.x0 + s.canvas.width / 2, cy = p.y0 + s.canvas.height / 2;
      const w = Math.max(s.canvas.width, minTapPx), h = Math.max(s.canvas.height, minTapPx);
      if (Math.abs(gx - cx) > w / 2 || Math.abs(gy - cy) > h / 2) continue;
      const d = Math.hypot(gx - cx, gy - cy);
      if (!wanted || d < wanted.d) wanted = { b, d };
    }
    return wanted && wanted.b;
  }

  function birdAt(gx, gy, minTapPx, bubbles = true) {
    const wanted = wantedAt(gx, gy, minTapPx, bubbles);
    if (wanted) return wanted;
    let hit = null;
    for (const b of birds) {
      if (b.gone || b.underwater || b.flight) continue;
      const s = spriteOf(b), p = place(b, s);
      const X = Math.floor(gx), Y = Math.floor(gy);
      const u = p.flip ? p.x0 - X - 1 : X - p.x0, v = Y - p.y0;
      if (isSolid(s.canvas, u, v) && (!hit || (b.sortY || b.y) > (hit.sortY || hit.y))) hit = b;
    }
    if (hit || minTapPx === 0) return hit;          // 0: only a bird's own pixels count
    let near = null;
    for (const b of birds) {
      if (b.gone || b.underwater || b.flight) continue;
      const s = spriteOf(b), p = place(b, s);
      const cx = p.flip ? p.x0 - s.canvas.width / 2 : p.x0 + s.canvas.width / 2, cy = p.y0 + s.canvas.height / 2;
      const w = Math.max(s.canvas.width, minTapPx), h = Math.max(s.canvas.height, minTapPx);
      if (Math.abs(gx - cx) > w / 2 || Math.abs(gy - cy) > h / 2) continue;
      const d = Math.hypot(gx - cx, gy - cy);
      if (!near || d < near.d) near = { b, d };
    }
    return near && near.b;
  }

  function greet(b) {
    b.joy = 0.35;
    if (b.act && b.act.name === "sleep") { (b.cueQueue || (b.cueQueue = [])).push({ kind: "zzz", dir: b.faceLeft ? 1 : -1 }); return; }
    if (!b.flight && !b.hop && b.does === "ground") b.lift = 0;
    if ((b.look.shape || "songbird") === "songbird" && !b.flight && !b.hop && !b.act && !b.run) hop(b);
    Sound.chirp(b.look.chirp || "tweet", b.look.chirpPitch || 2600);
  }

  function celebrate(b) {
    act(b, "dance", 1.2);
    b.emote = { name: "heart", age: 0 };
    b.thought = null;
  }

  function showEmote(b, name) { b.emote = { name, age: 0 }; }

  function clear() { birds.forEach(finishAct); birds = []; hideouts.clear(); }

  return {
    add, get, remove, schedule, update, items, drawOverlays, drawThoughtAt, thoughtSpot, birdAt, wantedAt, greet, celebrate, showEmote,
    flyTo, leave, hopTo, headTop, clear, all: () => birds, knock,
    act, stop: finishAct, hop, runTo, hideIn, popOut, rustle, roost,
    newAct, stepAct, drawCues,
  };
})();
