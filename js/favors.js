
const Favors = (() => {
  const KINDS = {};

  const ORDER = ["resume", "moment", "scene", "when", "repeat", "meet", "still", "near", "find", "fetch", "give", "tap", "outside",
    "greet", "choose", "say", "bird", "act", "magpie", "hold", "friend", "phase", "world", "restore", "guide", "thought", "emote",
    "sound", "wait", "learn", "hint"];
  const ENGAGING = new Set(["moment", "scene", "find", "fetch", "give", "tap", "still", "greet", "choose", "say", "act"]);
  const OWN_LEARN = new Set(["say", "choose", "learn", "outside"]);

  const kindOf = (step) => ORDER.find((k) => k in step) || null;
  const typeOf = (ref) => (typeof ref === "string" ? ref : ref && ref.thing);
  const asSteps = (b) => (Array.isArray(b) ? b : [b]);
  const warn = (...a) => console.warn("Starling:", ...a);

  async function run(steps, K, ctx = {}) {
    let last = null;
    for (const raw of steps === undefined || steps === null ? [] : asSteps(steps)) {
      if (K.stale && K.stale()) return last;                          // (the day ended: the rest waits for tomorrow)
      const step = typeof raw === "string" ? { say: raw } : raw;      // a bare line id: say it
      const kind = step && typeof step === "object" ? kindOf(step) : null;
      if (!kind) { warn("a step I don't know", raw); continue; }
      if (ENGAGING.has(kind)) ctx.engaged = true;
      try {
        last = await KINDS[kind](step, K, ctx);
        if (K.stale && K.stale()) return last;
        if (step.learn && !OWN_LEARN.has(kind)) K.learn(...[].concat(step.learn));
      } catch (e) {
        setTimeout(() => { throw e; });           // (shows up as an error, and the story goes on)
      }
    }
    return last;
  }

  KINDS.resume = (s, K, ctx) => { if (ctx.favor && ctx.key) K.mark(`${ctx.key}.${s.resume}`); };

  function resumeAt(steps, isDone, key) {
    const list = asSteps(steps || []);
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s && typeof s === "object" && kindOf(s) === "resume" && isDone(`${key}.${s.resume}`)) return i;
    }
    return -1;
  }

  function stepsLeft(f, isDone, key) {
    const steps = asSteps(f.steps || []), at = resumeAt(steps, isDone, key);
    return at < 0 ? { steps, resumed: false } : { steps: [...asSteps(steps[at].steps || []), ...steps.slice(at + 1)], resumed: true };
  }

  function holdingAt(f, isDone, key) {
    const steps = asSteps(f.steps || []), at = resumeAt(steps, isDone, key);
    return at < 0 ? null : steps[at].hold || null;
  }

  async function play(f, K, ctx) {
    const steps = asSteps(f.steps || []);
    const at = resumeAt(steps, K.done, ctx.key);
    if (at < 0) return run(steps, K, ctx);
    const cp = steps[at];
    ctx.resumed = cp.resume;
    K.hold(cp.hold || null);
    await run(cp.steps, K, ctx);
    if (K.stale && K.stale()) return null;
    const lead = cp.lead !== false && steps.slice(0, at).find((s) => s && typeof s === "object" && kindOf(s) === "meet");
    if (lead) {
      await run([{ ...lead, far: 0.01 }], K, ctx);
      if (K.stale && K.stale()) return null;
    }
    return run(steps.slice(at + 1), K, ctx);
  }

  KINDS.say = async (s, K, ctx) => {
    const id = s.say !== undefined ? s.say : s.choose;
    const reply = await K.speak(id, s.learn ? [].concat(s.learn) : null);
    const line = (id && typeof id === "object" ? id : LINES[id]) || {};
    const branch = reply !== null && reply !== undefined && s.replies ? (reply in s.replies ? s.replies[reply] : s.replies["*"]) : undefined;
    if (branch !== undefined && branch !== null) await run(asSteps(branch), K, ctx);
    else if (reply === "?" && line.explain) await K.speak(line.explain);
    return reply;
  };
  KINDS.choose = KINDS.say;

  KINDS.learn = (s, K) => K.learn(...[].concat(s.learn));

  KINDS.hint = (s, K) => { K.G.hint = s.hint || null; };

  KINDS.thought = (s, K) => {
    if (s.on && s.on !== "magpie") { const b = K.bird(s.on); if (b) b.thought = s.thought || null; }
    else K.G.thought = s.thought || null;
  };

  KINDS.guide = (s, K) => { K.G.guide = s.guide ? K.guideTo(s.guide, s) : null; };

  KINDS.emote = (s, K) => K.emote(s.on || "magpie", s.emote);

  KINDS.wait = (s, K) => K.wait(s.wait);

  KINDS.phase = (s, K) => K.setPhase(s.phase, s.glide !== undefined ? s.glide : 3);

  KINDS.friend = (s, K) => K.friend(s.friend, { quiet: !!s.quiet, id: s.id || null });

  KINDS.sound = (s) => {
    const v = s.sound;
    if (typeof v === "string") { if (typeof Sound[v] === "function") Sound[v](); else warn("no sound", v); }
    else if (v && v.tap) Sound.tap(v.tap);
    else if (v && v.chirp) Sound.chirp(v.chirp, v.pitch, v.n || 0);
  };

  KINDS.hold = (s, K) => K.hold(s.hold || null);

  KINDS.magpie = (s, K) => K.magpieDo(s.magpie);

  KINDS.scene = (s, K, ctx) => K.scripted(() => run(s.scene, K, ctx));

  KINDS.moment = (s, K, ctx) => {
    const m = Moments[s.moment];
    if (!m) { warn(`no moment "${s.moment}" in js/moments.js`); return null; }
    const playing = m(s, K, ctx);
    if (s.wait === false) { Promise.resolve(playing).catch((e) => setTimeout(() => { throw e; })); return null; }
    return playing;
  };

  KINDS.bird = async (s, K) => {
    const had = K.bird(s.bird);
    const b = had || (s.species ? K.storyBird({ ...s, id: s.bird }) : null);
    if (!b) { warn(`no bird "${s.bird}" here`); return null; }
    if (had) {
      if (s.look !== undefined) {
        b.look = s.look ? K.lookWith(BIRDS[b.species], s.look) : BIRDS[b.species];
        if (s.portrait) setPortraitLook(b.species, s.look || null);
      }
      if (s.thought !== undefined) b.thought = s.thought;
      if (s.pose) b.pose = s.pose;
      if (s.does) b.does = s.does;
      if (s.range !== undefined) b.range = s.range * TILE;
      if (s.favor !== undefined) b.favor = s.favor;
      if (s.faceLeft !== undefined) b.faceLeft = s.faceLeft;
    }
    if (s.face) b.faceLeft = s.face === "left";
    if (s.flyTo) {
      const p = K.pos(s.flyTo);
      if (p) {
        Wildlife.flyTo(b, p.x, p.y);
        b.home = { x: p.x, y: p.y };
        b.sortY = s.sortAfter ? K.sortAfter(s.sortAfter, p) : s.sortY !== undefined ? s.sortY : null;
      }
    }
    if (s.hopTo) { const p = K.pos(s.hopTo); if (p) Wildlife.hopTo(b, p.x, p.y); }
    if (s.chirp) Wildlife.greet(b);
    if (s.emote) Wildlife.showEmote(b, s.emote);
    if (s.celebrate) Wildlife.celebrate(b);
    if (s.act) {
      const acting = Wildlife.act(b, s.act, s.seconds, { cueEvery: s.cueEvery });
      if (!goesOn(s)) await acting;
    }
    if (s.leave) Wildlife.leave(b, s.leave === "forGood");
    if (s.remove) Wildlife.remove(b.id);
    return b;
  };

  const goesOn = (s) => s.wait === false || s.seconds === 0 || (s.seconds === undefined && ["sleep", "pant"].includes(s.act));

  KINDS.act = async (s, K) => {
    if (s.on === "magpie") {
      const acting = Magpie.act(s.act, s.seconds);
      if (goesOn(s)) return null;
      return acting;
    }
    if (s.bird) {
      const b = K.bird(s.bird);
      if (!b) return null;
      const acting = Wildlife.act(b, s.act, s.seconds, { cueEvery: s.cueEvery });
      return goesOn(s) ? null : acting;
    }
    return Player.act(s.act);
  };

  KINDS.meet = async (s, K, ctx = {}) => {
    const b = K.bird(s.meet);
    if (!b) { warn(`no bird "${s.meet}" to meet`); return null; }
    const her = K.herFeet();
    const far = Math.hypot(her.x - b.x, her.y - b.y) > (s.far || 6) * TILE;
    const lead = s.friendLead && K.isFriend(b.species) ? s.friendLead : s.lead;
    if (lead && far) await K.say(lead);
    K.G.hint = s.hint !== undefined ? s.hint : lead || null;
    K.G.guide = () => (scene.name === "garden" && !b.gone ? { x: b.x, y: b.y - 10, edgeOnly: true, top: Wildlife.headTop(b).y, bottom: b.y } : null);
    const ahead = far && !!lead && !!s.ahead;
    if (ahead) {
      const sortY = b.sortY !== null && b.sortY !== undefined ? b.sortY : null;
      const itsTree = (t) => sortY !== null && Math.abs(t.footY + 0.5 - sortY) < 0.01;
      const first = K.herFeet().x < b.x ? -1 : 1;
      const side = [first, -first].find((d) => K.clearOfThings(K.birdBox(b.x + d * 24, b.y + 2), itsTree)) || first;
      Magpie.flyTo("perch", b.x + side * 24, b.y + 2, (sortY !== null ? sortY : b.y + 2) + 0.5);
      Magpie.face(side > 0);
    }
    if (s.by === "tap") await new Promise((ok) => { b.onTap = () => { b.onTap = null; Wildlife.greet(b); ok(); }; });
    else {
      K.G.onMagpie = () => { Magpie.joy(); Sound.chirp(MAGPIE_VOICE.chirp, MAGPIE_VOICE.pitch); K.walkToBird(b); return true; };
      const how = await K.talkTo(b, s.close !== undefined ? s.close : 2.5);
      K.G.onMagpie = null;
      if (how === "tap") ctx.metByTap = { bird: b, at: performance.now() };
    }
    K.G.hint = null; K.G.guide = null;
    if (ahead) Magpie.flyTo("follow");
    return b;
  };

  KINDS.near = async (s, K) => {
    const ref = s.near, place = K.placeOf(ref);
    const spot = () => K.pos(ref, place);
    if (!spot()) { warn("nowhere to go", ref); return; }
    const isThing = !!typeOf(ref) && !(ref && (ref.bird || ref.patch !== undefined || ref.tile));
    const reach = s.reach || 2, stop = s.stop !== undefined ? s.stop : isThing ? 5.5 : 0;
    const within = (tiles) => { const p = spot(); return !!p && K.near(p.x, p.y, tiles, place); };
    if (s.lead && (!s.onlyIfFar || !within(reach))) await K.say(s.lead);
    if (s.magpie) K.magpieDo(s.magpie);
    K.G.hint = s.hint !== undefined ? s.hint : s.lead || null;
    if (s.guide) K.G.guide = K.guideTo(s.guide === true ? ref : s.guide, { edgeOnly: s.guide === true, place });
    const go = () => K.walkThere(ref, place);
    const walkers = [].concat(s.tapWalks || []);
    for (const id of walkers) { if (id === "magpie") K.G.onMagpie = go; else { const b = K.bird(id); if (b) b.onTap = go; } }
    const stopped = () => !isMoving() && !player.path.length;
    await K.until(() => within(reach) || (stop > 0 && stopped() && within(stop)));
    if (!within(reach) || s.front) { go(); await K.until(stopped); }
    for (const id of walkers) { if (id === "magpie") K.G.onMagpie = null; else { const b = K.bird(id); if (b && b.onTap === go) b.onTap = null; } }
    if (s.intoView && place === "garden" && stepIntoView()) await K.until(stopped);
    K.G.hint = null;
    if (s.guide) K.G.guide = null;
  };

  KINDS.tap = async (s, K) => {
    const refs = Array.isArray(s.tap) ? s.tap : [s.tap];
    if (s.hint !== undefined) K.G.hint = s.hint;
    if (s.guide) K.G.guide = K.guideTo(s.guide === true ? refs[0] : s.guide, s.guide === true ? {} : s.guide);
    const undo = [];
    const got = await new Promise((ok) => {
      let over = false;
      const done = (what) => { if (!over) { over = true; ok(what); } };
      for (const ref of refs) {
        if (ref === "magpie") {
          K.G.onMagpie = () => { done("magpie"); return true; };
          undo.push(() => { K.G.onMagpie = null; });
        } else if (ref === "roof") {
          const stop = K.listen("roof", (t) => done(t));
          K.G.onRoof = () => { done("roof"); Magpie.says(THINGS.roof.name); return true; };
          undo.push(stop, () => { K.G.onRoof = null; });
        } else if (ref && ref.bird) {
          const bird = K.bird(ref.bird);
          if (!bird) { warn(`no bird "${ref.bird}" to tap`); continue; }
          bird.onTap = () => { Wildlife.greet(bird); done(bird); };
          undo.push(() => { bird.onTap = null; });
        } else {
          undo.push(K.listen(typeOf(ref), (t) => { if (K.fits(ref, t)) done(t); }));
        }
      }
    });
    undo.forEach((f) => f());
    if (s.hint !== undefined) K.G.hint = null;
    if (s.guide) K.G.guide = null;
    return got;
  };

  KINDS.still = async (s, K) => {
    if (s.hint !== undefined) K.G.hint = s.hint;
    const close = () => { if (!s.near) return true; const p = K.pos(s.near); return !!p && K.near(p.x, p.y, s.within || 5); };
    await K.until(() => player.still > s.still && !Speech.isOpen() && !K.busy() && close());
    if (s.hint !== undefined) K.G.hint = null;
  };

  KINDS.outside = (s, K) => {
    const o = s.outside && typeof s.outside === "object" ? s.outside : {};
    return K.outside({ ...o, learn: s.learn || o.learn });
  };

  KINDS.greet = async (s, K) => {
    const kinds = Object.keys(s.greet || {});
    const left = new Set(kinds);
    const flock = (species) => Wildlife.all().filter((b) => b.story && !b.gone && !b.hiddenIn && b.species === species);
    if (s.hint !== undefined) K.G.hint = s.hint;
    K.G.guide = () => {
      if (scene.name !== "garden") return null;
      const out = [];
      for (const species of left) {
        const b = flock(species).find((x) => !x.flight);
        if (b) { const h = Wildlife.headTop(b); out.push({ x: h.x, y: h.y - 1 }); }
      }
      return out.length ? out : null;
    };
    let talking = false;
    await new Promise((ok) => {
      const arm = (b) => {
        b.onTap = async () => {
          if (talking) return;
          if (!left.has(b.species)) { K.greetBird(b); return; }
          left.delete(b.species);
          talking = true;
          Wildlife.greet(b);
          for (const id of [].concat(s.greet[b.species])) await K.say(id);
          talking = false;
          K.greetBird(b);
          if (!left.size) ok();
        };
      };
      for (const species of kinds) flock(species).forEach(arm);
      if (!kinds.length) ok();
    });
    for (const species of kinds) flock(species).forEach((b) => { b.onTap = null; b.greets = true; });
    K.G.guide = null;
    if (s.hint !== undefined) K.G.hint = null;
  };

  KINDS.fetch = async (s, K, ctx) => {
    const item = s.fetch, from = s.from || item, place = K.placeOf(from);
    if (s.hint !== undefined) K.G.hint = s.hint;
    if (s.guide) K.G.guide = K.guideTo(s.guide === true ? { ...(typeof from === "string" ? { thing: from } : from), dy: -16 } : s.guide, { unlessHolding: true, soft: s.soft, place });
    const stop = K.listen(typeOf(from), (t) => {
      if (!K.fits(from, t) || K.holding()) return;
      K.hold(item);
      if (s.emote) K.emote("her", s.emote);
      if (s.take && s.keep) removeThing(t, K.worldOf(place));
      else if (s.take) take(t, place, K, ctx);
    });
    await K.until(() => K.holding() === item);
    stop();
    if (s.hint !== undefined) K.G.hint = null;
    if (s.guide) K.G.guide = null;
  };

  function take(t, place, K, ctx) {
    const w = K.worldOf(place);
    if (!w.things.includes(t)) return;
    removeThing(t, w);
    (ctx.taken = ctx.taken || []).push({ t, place });
  }

  KINDS.find = async (s, K, ctx) => {
    const item = s.find, type = s.thing || item, place = s.place || "garden";
    const w = K.worldOf(place);
    const spares = s.spares === false ? [] : w.things.filter((t) => t.type === type && !t.lost);
    spares.forEach((t) => take(t, place, K, ctx));
    let lost = w.things.find((t) => t.lost && t.type === type);
    if (!lost) {
      lost = addThing(K.placed({ type, at: s.at || [0, 0], variant: s.variant || 0 }, place), w);
      lost.lost = true;
    }
    if (s.hint !== undefined) K.G.hint = s.hint;
    K.G.guide = () => (scene.name === place && WORLD.things.includes(lost) ? { x: lost.footX, y: lost.footY - 8, soft: true, room: place === "room" } : null);
    const stop = K.listen(type, (t) => { if (t.lost) { K.hold(item); removeThing(t, w); } });
    await K.until(() => K.holding() === item);
    stop();
    K.G.guide = null;
    if (s.hint !== undefined) K.G.hint = null;
    spares.forEach((t) => restoreThing(t, w));
    ctx.taken = (ctx.taken || []).filter((x) => !spares.includes(x.t));
  };

  KINDS.give = async (s, K, ctx = {}) => {
    const item = s.give;
    const targets = [].concat(s.to || [], s.or || []);
    if (s.hint !== undefined) K.G.hint = s.hint;
    const stops = [];
    if (s.from) {
      stops.push(K.listen(typeOf(s.from), (t) => {
        if (!K.fits(s.from, t) || K.holding()) return;
        K.hold(item);
        if (s.emote) K.emote("her", s.emote);
      }));
    }
    const armed = [], thinking = [];
    let toMagpie = false;
    if (s.guide) {
      const first = targets[0];
      if (first && first.bird) K.G.guide = K.guideTo({ bird: first.bird, dy: -10 }, { edgeOnly: true });
      else if (first && first !== "magpie") K.G.guide = K.guideTo(s.guide === true ? { ...(typeof first === "string" ? { thing: first } : first), dy: -16 } : s.guide, { edgeOnly: s.guide === true });
    }
    const got = await new Promise((ok) => {
      let over = false;
      const finish = (who) => { if (!over) { over = true; ok(who); } };
      for (const target of targets) {
        if (target === "magpie") {
          toMagpie = true;
          if (s.thought) K.G.thought = s.thought;
          K.G.onMagpie = () => (K.holding() === item ? (finish("magpie"), true) : false);
        } else if (target.bird || target.birds) {
          for (const id of [].concat(target.bird || target.birds)) {
            const b = K.bird(id);
            if (!b) { warn(`no bird "${id}" to give to`); continue; }
            if (s.thought) { b.thought = s.thought; thinking.push(b); }
            const arm = () => {
              b.onReach = () => {
                if (K.holding() === item) finish(b);
                else { Wildlife.showEmote(b, "question"); Sound.tap(420); arm(); }
              };
            };
            arm();
            armed.push(b);
          }
        } else {
          stops.push(K.listen(typeOf(target), (t) => { if (K.fits(target, t) && K.holding() === item) finish(t); }));
        }
      }
      const met = ctx.metByTap;
      ctx.metByTap = null;
      if (met && performance.now() - met.at < 1500 && armed.includes(met.bird) && K.holding() === item) finish(met.bird);
    });
    stops.forEach((stop) => stop());
    armed.forEach((b) => { b.onReach = null; });
    thinking.forEach((b) => { if (b.thought === s.thought) b.thought = null; });
    if (toMagpie) { K.G.onMagpie = null; if (s.thought) K.G.thought = null; }
    if (s.hint !== undefined) K.G.hint = null;
    if (s.guide) K.G.guide = null;
    if (!s.keep) K.hold(null);
    return got;
  };

  KINDS.world = (s, K) => K.applyWorld(s.world, true);

  KINDS.restore = (s, K, ctx) => K.restoreTaken(ctx);

  function holds(c, K) {
    const learned = (w) => !!K.S().learned[Words.base(w)];
    if (c.learned !== undefined && ![].concat(c.learned).every(learned)) return false;
    if (c.notLearned !== undefined && [].concat(c.notLearned).every(learned)) return false;
    if (c.done !== undefined && !K.done(c.done)) return false;
    if (c.notDone !== undefined && K.done(c.notDone)) return false;
    if (c.holding !== undefined && K.holding() !== c.holding) return false;
    if (c.day !== undefined && K.S().day !== c.day) return false;
    if (c.friend !== undefined && !(K.S().friends || []).includes(c.friend)) return false;
    return true;
  }
  KINDS.when = async (s, K, ctx) => {
    if (holds(s.when || {}, K)) return run(s.steps || s.then, K, ctx);
    if (s.else) return run(s.else, K, ctx);
    return null;
  };

  KINDS.repeat = async (s, K, ctx) => {
    for (let i = 0; i < s.repeat; i++) { ctx.round = i; await run(s.steps, K, ctx); }
    ctx.round = 0;
  };

  const ALSO = {
    resume: ["hold"],
    bird: ["thought", "act", "wait", "emote"], act: ["bird", "wait"], meet: ["hint"],
    near: ["magpie", "hint", "guide"], still: ["near", "hint"], tap: ["hint", "guide"],
    greet: ["hint"], fetch: ["hint", "guide", "emote"], find: ["hint"],
    give: ["thought", "hint", "guide", "emote"],
  };
  const SPECIAL = new Set(["her", "door", "magpie", "roof"]);                 // places and targets that aren't things
  const FRAME_KEYS = { goHome: ["freeFor", "stillFor"], evening: ["homeIn", "sunsetFor", "nightFalls", "nightWait", "magpieFlies", "starEvery", "groupRest", "hurry", "music"] };
  const THING_KEYS = new Set(["thing", "tap", "sortAfter", "tree", "bush", "feeder", "in", "into", "from", "near", "guide", "to", "or", "at"]);
  const ICON_KEYS = new Set(["thought", "emote", "item", "icon", "airIcon"]);
  const IN_BEAK = new Set(["flower", "persimmon", "crowFeather"]);            // (js/props.js drawInBeak draws these itself)

  function deep(node, fn, key = null, parent = null) {
    if (Array.isArray(node)) { for (const v of node) deep(v, fn, key, parent); return; }
    if (node && typeof node === "object") { for (const [k, v] of Object.entries(node)) { fn(k, v, node); deep(v, fn, k, node); } }
  }

  function check(days = window.DAYS || {}, { quiet = false } = {}) {
    const problems = [];
    const say = (p) => problems.push(p);
    const lines = window.LINES || {}, icons = window.ICONS || {}, words = window.WORDS || {}, birds = window.BIRDS || {};
    const base = (w) => (typeof Words !== "undefined" ? Words.base(w) : String(w).toLowerCase());
    const hasLine = (id) => !!lines[id];
    const types = new Set([...Object.keys(window.THINGS || {}), ...Object.keys(window.ROOM_THINGS || {}), ...Object.keys(window.OBSERVATORY_THINGS || {}), "flower"]);
    if (typeof SCENES !== "undefined") for (const sc of Object.values(SCENES)) for (const t of (sc.world && sc.world.things) || []) types.add(t.type);
    const constellations = new Set(["@bridge", "@moon", ...(window.CONSTELLATIONS || []).map((c) => c.id)]);
    const numbers = Object.keys(days).map(Number).sort((a, b) => a - b);

    const look = (steps, where) => {
      for (const raw of steps === undefined || steps === null ? [] : asSteps(steps)) {
        if (typeof raw === "string") { if (!hasLine(raw)) say(`${where}: no line "${raw}"`); continue; }
        if (!raw || typeof raw !== "object") continue;
        const kind = kindOf(raw);
        if (!kind) { say(`${where}: a step I don't know: ${JSON.stringify(raw)}`); continue; }
        if (kind !== "moment") {
          const more = Object.keys(raw).filter((k) => k !== kind && k !== "learn" && ORDER.includes(k) && !(ALSO[kind] || []).includes(k));
          if (more.length) say(`${where}: a step with two kinds (${kind} and ${more.join(", ")}): only ${kind} would play: ${JSON.stringify(raw)}`);
        }
        for (const key of ["say", "choose", "lead", "friendLead", "hint"]) if (typeof raw[key] === "string" && raw[key] !== "sunset" && !hasLine(raw[key])) say(`${where}: no line "${raw[key]}"`);
        if (kind === "moment" && typeof Moments !== "undefined" && !Moments[raw.moment]) say(`${where}: no moment "${raw.moment}"`);
        if (raw.lines) for (const id of Object.values(raw.lines)) if (!hasLine(id)) say(`${where}: no line "${id}"`);
        if (raw.greet) for (const id of Object.values(raw.greet).flat()) if (!hasLine(id)) say(`${where}: no line "${id}"`);
        const id = raw.say !== undefined ? raw.say : raw.choose;
        if (raw.replies && typeof id === "string" && hasLine(id)) {
          const offered = lines[id].replies || [];
          for (const r of Object.keys(raw.replies)) if (r !== "*" && !offered.includes(r)) say(`${where}: a branch for the reply "${r}", which "${id}" doesn't offer (${JSON.stringify(offered)})`);
        }
        for (const key of ["scene", "steps", "then", "else"]) if (raw[key]) look(raw[key], where);
        if (raw.replies) for (const b of Object.values(raw.replies)) look(b, where);
      }
    };

    const lasting = new Set(["magpie"]);
    for (const n of numbers) {
      const d = days[n];
      const where = `Day ${n}`;
      const morning = Array.isArray(d.morning) ? d.morning : d.morning && d.morning.steps;
      look(morning, `${where} morning`);
      look(d.out, `${where} going out`);
      look(d.again, `${where} again`);
      for (const f of d.favors || []) look(f.steps, `${where} ${f.id}`);
      const againWords = [];
      deep(d.again, (k, v) => { if (k === "learn") againWords.push(...[].concat(v)); });
      if (againWords.length) say(`${where} again: lights up ${againWords.join(", ")} (again steps can play more than once: light words up in the day's own steps)`);
      const resumes = (node) => { let n = 0; deep(node, (k) => { if (k === "resume") n++; }); return n; };
      for (const part of [morning, d.out, d.again, (d.night || {}).hook]) if (resumes(part)) say(`${where}: a resume step outside a favor (only a favor picks up where it stood)`);
      for (const f of d.favors || []) {
        const top = asSteps(f.steps || []).filter((s) => s && typeof s === "object" && kindOf(s) === "resume");
        if (resumes(f.steps) !== top.length) say(`${where} ${f.id}: a resume step inside a scene, a reply or another step (only in the favor's own list of steps)`);
        const names = top.map((s) => s.resume);
        if (new Set(names).size !== names.length) say(`${where} ${f.id}: two resume steps with the same name (${names.join(", ")})`);
        for (const s of top) { let teaches = !!s.learn; deep(s.steps, (k) => { if (k === "learn") teaches = true; }); if (teaches) say(`${where} ${f.id}: the resume step "${s.resume}" lights up words (it only sets the scene)`); }
      }
      const night = d.night || {};
      for (const key of ["lookUp", "tomorrow"]) if (night[key] && !hasLine(night[key])) say(`${where} night: no line "${night[key]}"`);
      for (const l of [].concat(night.lines || [])) {
        if (typeof l === "string") { if (!hasLine(l)) say(`${where} night sky: no line "${l}"`); }
        else if (l && typeof l === "object") {
          if (l.say && !hasLine(l.say)) say(`${where} night sky: no line "${l.say}"`);
          if (l.look && !constellations.has(l.look)) say(`${where} night sky: no constellation "${l.look}" (data/constellations.js)`);
        }
      }
      if (night.hook) look(typeof night.hook === "string" ? { moment: night.hook } : night.hook, `${where} night hook`);

      const defined = new Set(lasting), wanted = [], taught = new Set();
      const learn = (list) => { for (const w of [].concat(list || [])) { const b = base(w); if (!words[b]) say(`${where}: lights up "${w}", which isn't in data/words.js`); else taught.add(b); } };
      learn(night.learn);
      deep(d, (k, v, parent) => {
        if (k === "learn") learn(v);
        if (typeof v === "string") {
          if (k === "species" || k === "friend") { if (!birds[v]) say(`${where}: no bird "${v}" in data/birds.js`); }
          if (THING_KEYS.has(k) && !SPECIAL.has(v) && !types.has(v)) say(`${where}: no thing "${v}" (${k}) in data/world.js or data/room.js`);
          if (ICON_KEYS.has(k) && !icons[v]) say(`${where}: no icon "${v}" (${k}) in data/icons.js`);
          if (k === "carry" && !IN_BEAK.has(v) && !icons[v]) say(`${where}: nothing to carry called "${v}"`);
          if ((k === "bird" && !parent.species) || k === "meet" || (k === "on" && !SPECIAL.has(v))) wanted.push(v);
          if (k === "id" && parent.species) defined.add(v);
          if (k === "bird" && parent.species) defined.add(v);
        }
        if ((k === "birds" || k === "tapWalks") && Array.isArray(v)) for (const b of v) if (typeof b === "string" && b !== "magpie") wanted.push(b);
        if (k === "flock") for (const f of [].concat(v)) if (f && f.id && (f.count || 1) > 1) for (let i = 0; i < f.count; i++) defined.add(`${f.id}${i}`);
        if (k === "greet" && v && typeof v === "object" && !Array.isArray(v)) for (const sp of Object.keys(v)) if (!birds[sp]) say(`${where}: greets "${sp}", no bird in data/birds.js`);
      });
      for (const b of new Set(wanted)) if (!defined.has(b)) say(`${where}: no bird "${b}" there (put it there in a favor's birds, or with { bird, species })`);
      for (const f of d.favors || []) for (const e of [].concat((f.world && f.world.after) || [])) if (e && !e.today) for (const b of e.birds || []) if (b && b.id) lasting.add(b.id);

      for (const [w, info] of Object.entries(words)) if (info.day === n && !taught.has(w)) say(`${where}: "${w}" is a word of Day ${n} (data/words.js), but no step of the day lights it up`);
    }

    for (const [n, page] of Object.entries(window.DIARY || {})) {
      const d = days[n];
      if (!d || !page) continue;
      const ids = new Set((d.favors || []).map((f) => f.id));
      const named = [...[].concat(page.pictureAfter || []), ...(page.text || []).flatMap((l) => (l && typeof l === "object" ? [].concat(l.after || []) : []))];
      for (const id of named) if (!ids.has(id)) say(`Diary page ${n}: no favor "${id}" on Day ${n} (data/days/day${n}.js)`);
    }

    for (const [when, id] of Object.entries(window.FRAME_LINES || {})) if (id && !hasLine(id)) say(`The frame's ${when}: no line "${id}" (data/dialogue.js FRAME_LINES)`);
    for (const when of ["headHome", "morningReply"]) { const l = lines[(window.FRAME_LINES || {})[when]]; if (!l || !(l.replies || []).length) say(`The frame's ${when} needs a line with replies (data/dialogue.js FRAME_LINES)`); }
    for (const key of ["day", "sleepAsk", "sleepYes", "sleepNo", "skipEvening"]) if (!(window.UI_TEXT || {})[key]) say(`data/ui-text.js: no ${key}`);
    const F = window.DAY_FRAME || {};
    if (typeof F.breath !== "number") say("data/game-settings.js DAY_FRAME: no breath (seconds)");
    for (const [part, keys] of Object.entries(FRAME_KEYS)) {
      for (const k of keys) { const v = (F[part] || {})[k]; if (k === "music" ? typeof v !== "string" : typeof v !== "number") say(`data/game-settings.js DAY_FRAME: no ${part}.${k}`); }
    }
    const his = ((window.HUSBAND || {}).lines) || {};
    for (const key of ["morning", "goodDay", "home", "goodnight"]) if (!(his[key] || []).length) say(`data/husband.js: no ${key} line`);

    numbers.forEach((n, i) => { if (n !== i + 1) say(`Day ${i + 1} is missing (the days go ${numbers.join(", ")})`); });
    if (typeof document !== "undefined") {
      for (const el of document.querySelectorAll('script[src*="data/days/day"]')) {
        const m = /day(\d+)\.js/.exec(el.getAttribute("src"));
        if (m && !days[Number(m[1])]) say(`data/days/day${m[1]}.js didn't load (a mistake in it? see the console)`);
      }
    }
    if (!quiet) for (const p of problems) warn(p);
    return problems;
  }

  return { run, play, stepsLeft, holdingAt, check, kinds: KINDS };
})();
