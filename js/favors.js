
const Favors = (() => {
  const KINDS = {};

  const ORDER = ["moment", "scene", "when", "repeat", "meet", "near", "find", "fetch", "give", "tap", "still", "outside",
    "choose", "say", "bird", "act", "magpie", "hold", "friend", "phase", "world", "restore", "guide", "thought", "emote",
    "sound", "wait", "learn", "hint"];
  const ENGAGING = new Set(["moment", "scene", "find", "fetch", "give", "tap", "still", "choose", "say", "act"]);
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
    const m = typeof Moments !== "undefined" && Moments[s.moment];
    if (!m) { warn(`no moment "${s.moment}" in js/moments.js`); return null; }
    return m(s, K, ctx);
  };

  KINDS.bird = async (s, K) => {
    const had = K.bird(s.bird);
    const b = had || (s.species ? K.storyBird({ ...s, id: s.bird }) : null);
    if (!b) { warn(`no bird "${s.bird}" here`); return null; }
    if (had) {
      if (s.look !== undefined) b.look = s.look ? K.lookWith(BIRDS[b.species], s.look) : BIRDS[b.species];
      if (s.thought !== undefined) b.thought = s.thought;
      if (s.pose) b.pose = s.pose;
      if (s.does) b.does = s.does;
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
    if (s.act) await birdAct(b, s.act, s.seconds);
    if (s.leave) Wildlife.leave(b, s.leave === "forGood");
    if (s.remove) Wildlife.remove(b.id);
    return b;
  };

  async function birdAct(b, name, seconds) {
    if (typeof Wildlife.act === "function") return Wildlife.act(b, name, seconds);
    if (name === "dance" || name === "jump") Wildlife.celebrate(b);
    else if (name === "sing") { Wildlife.showEmote(b, "note"); Wildlife.greet(b); }
    else if (name === "sleep") Wildlife.showEmote(b, "zzz");
    else if (name === "drink" || name === "bathe") b.pose = "peck";
    return null;
  }

  KINDS.act = async (s, K) => {
    if (s.bird) { const b = K.bird(s.bird); return b ? birdAct(b, s.act, s.seconds) : null; }
    if (typeof Player !== "undefined" && Player && typeof Player.act === "function") return Player.act(s.act);
    K.emote("her", s.act === "sing" ? "note" : "sparkles");
    return K.wait(0.6);
  };

  KINDS.meet = async (s, K) => {
    const b = K.bird(s.meet);
    if (!b) { warn(`no bird "${s.meet}" to meet`); return null; }
    const her = K.herFeet();
    const far = Math.hypot(her.x - b.x, her.y - b.y) > (s.far || 6) * TILE;
    if (s.lead && far) await K.say(s.lead);
    K.G.hint = s.hint !== undefined ? s.hint : s.lead || null;
    K.G.guide = () => (scene.name === "garden" && !b.gone ? { x: b.x, y: b.y - 10, edgeOnly: true } : null);
    const ahead = far && !!s.lead && !!s.ahead;
    if (ahead) {
      const side = K.herFeet().x < b.x ? -1 : 1;
      magpieFlyTo("perch", b.x + side * 24, b.y + 2, b.y + 2.5);
      companion.faceLeft = side > 0;
    }
    if (s.by === "tap") await new Promise((ok) => { b.onTap = () => { b.onTap = null; Wildlife.greet(b); ok(); }; });
    else await K.talkTo(b);
    K.G.hint = null; K.G.guide = null;
    if (ahead) magpieFlyTo("follow");
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
    if (!within(reach)) { go(); await K.until(stopped); }
    for (const id of walkers) { if (id === "magpie") K.G.onMagpie = null; else { const b = K.bird(id); if (b && b.onTap === go) b.onTap = null; } }
    if (s.intoView && place === "garden" && stepIntoView()) await K.until(stopped);
    K.G.hint = null;
    if (s.guide) K.G.guide = null;
  };

  KINDS.tap = async (s, K) => {
    const ref = s.tap;
    if (s.hint !== undefined) K.G.hint = s.hint;
    if (s.guide) K.G.guide = K.guideTo(s.guide === true ? ref : s.guide, s.guide === true ? {} : s.guide);
    let got = null;
    if (ref === "magpie") await new Promise((ok) => { K.G.onMagpie = () => { K.G.onMagpie = null; ok(); return true; }; });
    else if (ref === "roof") {
      got = await new Promise((ok) => {
        const stop = K.listen("roof", (t) => { stop(); K.G.onRoof = null; ok(t); });
        K.G.onRoof = () => { stop(); K.G.onRoof = null; ok("roof"); magpieSays(THINGS.roof.name); return true; };
      });
    } else if (ref && ref.bird) {
      const b = K.bird(ref.bird);
      if (b) got = await new Promise((ok) => { b.onTap = () => { b.onTap = null; ok(b); }; });
    } else {
      got = await new Promise((ok) => { const stop = K.listen(typeOf(ref), (t) => { if (K.fits(ref, t)) { stop(); ok(t); } }); });
    }
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

  KINDS.fetch = async (s, K, ctx) => {
    const item = s.fetch, from = s.from || item, place = K.placeOf(from);
    if (s.hint !== undefined) K.G.hint = s.hint;
    if (s.guide) K.G.guide = K.guideTo(s.guide === true ? { ...(typeof from === "string" ? { thing: from } : from), dy: -16 } : s.guide, { unlessHolding: true, soft: s.soft, place });
    const stop = K.listen(typeOf(from), (t) => {
      if (!K.fits(from, t) || K.holding()) return;
      K.hold(item);
      if (s.emote) K.emote("her", s.emote);
      if (s.take) take(t, place, K, ctx);
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

  KINDS.find = async (s, K) => {
    const item = s.find, type = s.thing || item, place = s.place || "garden";
    const w = K.worldOf(place);
    const spares = s.spares === false ? [] : w.things.filter((t) => t.type === type && !t.lost);
    spares.forEach((t) => removeThing(t, w));
    let lost = w.things.find((t) => t.lost && t.type === type);
    if (!lost) {
      const at = s.at || [0, 0];
      lost = addThing({ type, x: at[0], y: at[1], variant: s.variant || 0 }, w);
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
  };

  KINDS.give = async (s, K) => {
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

  function check(days = window.DAYS || {}) {
    const problems = [];
    const lineIds = new Set(Object.keys(window.LINES || {}));
    const look = (steps, where) => {
      for (const raw of steps === undefined || steps === null ? [] : asSteps(steps)) {
        if (typeof raw === "string") { if (!lineIds.has(raw)) problems.push(`${where}: no line "${raw}"`); continue; }
        if (!raw || typeof raw !== "object") continue;
        const kind = kindOf(raw);
        if (!kind) { problems.push(`${where}: a step I don't know: ${JSON.stringify(raw)}`); continue; }
        for (const key of ["say", "choose", "lead", "hint"]) if (typeof raw[key] === "string" && raw[key] !== "sunset" && !lineIds.has(raw[key])) problems.push(`${where}: no line "${raw[key]}"`);
        if (kind === "moment" && typeof Moments !== "undefined" && !Moments[raw.moment]) problems.push(`${where}: no moment "${raw.moment}"`);
        if (raw.lines) for (const id of Object.values(raw.lines)) if (!lineIds.has(id)) problems.push(`${where}: no line "${id}"`);
        for (const key of ["scene", "steps", "then", "else"]) if (raw[key]) look(raw[key], where);
        if (raw.replies) for (const b of Object.values(raw.replies)) look(b, where);
      }
    };
    for (const [n, d] of Object.entries(days)) {
      look(Array.isArray(d.morning) ? d.morning : d.morning && d.morning.steps, `Day ${n} morning`);
      look(d.out, `Day ${n} going out`);
      for (const f of d.favors || []) look(f.steps, `Day ${n} ${f.id}`);
      if (d.night) {
        for (const key of ["lookUp", "tomorrow"]) if (d.night[key] && !lineIds.has(d.night[key])) problems.push(`Day ${n} night: no line "${d.night[key]}"`);
        if (d.night.hook) look(typeof d.night.hook === "string" ? { moment: d.night.hook } : d.night.hook, `Day ${n} night hook`);
      }
    }
    for (const p of problems) warn(p);
    return problems;
  }

  return { run, check, kinds: KINDS };
})();
