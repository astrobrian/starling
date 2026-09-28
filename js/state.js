
const State = (() => {
  const KEY = "starling.progress";
  const MORNING = "starling.morning";          // how things were when today began
  const QUICK = 30 * 60 * 1000;                 // away for less than this: pick up where she was
  const VERSION = 3;                            // 2: Chapter 1 reworked (days from data/days/); 3: dawn, slept, again
  const fresh = () => ({
    version: VERSION,
    day: 1,                  // which day of the game
    phase: "morning",        // morning, noon, sunset, night
    learned: {},             // word -> the day she learned it
    learnedWith: {},         // word -> who she learned it with ("bulbul", "magpie"...)
    learnedLine: {},         // word -> the line she met it in ("I am so hungry. Can you get me a berry?")
    done: {},                // story steps that are finished ("d1_berry"...)
    friends: [],             // birds that are her friends (species: their faces show on the title and the backup)
    friendDay: {},           // species -> the day it became her friend
    bridge: [],              // bridge birds that joined (magpies and crows): { species, day, id }
    gifts: [],               // little gifts for her collection
    magpieName: null,
    holding: null,           // what she's carrying (berry, feather...)
    scene: "room",           // where she is: room or garden
    doll: null,              // the doll riding on her back today
    dollDay: 0,              // the day she picked it
    dollOf: {},              // day -> the doll that came along that day (for her diary)
    dawn: { words: [], friends: [], bridge: [] },   // what she had when this morning began (words, friends, bridge ids)
    slept: true,             // they slept together: their morning (waking up, the kiss) is still to come
    again: false,            // this morning goes on with yesterday's day ("Our friends are waiting!")
  });
  let data = fresh();
  const copy = (o) => JSON.parse(JSON.stringify(o));

  function lastDay() {
    let n = 0;
    while (window.DAYS && DAYS[n + 1]) n++;
    return n;
  }

  function eachStep(steps, fn) {
    if (!steps) return;
    for (const s of Array.isArray(steps) ? steps : [steps]) {
      if (!s || typeof s !== "object" || Array.isArray(s)) continue;
      fn(s);
      for (const v of Object.values(s)) {
        if (Array.isArray(v)) eachStep(v, fn);
        else if (v && typeof v === "object") for (const w of Object.values(v)) if (w && typeof w === "object") eachStep(w, fn);
      }
    }
  }
  const morningSteps = (d) => (Array.isArray(d.morning) ? d.morning : (d.morning && d.morning.steps) || []);

  function friendsOfDay(n) {
    const d = window.DAYS && DAYS[n];
    if (!d) return [];
    const out = [];
    const scan = (steps, key) => eachStep(steps, (s) => { if (typeof s.friend === "string") out.push({ species: s.friend, id: s.id || key }); });
    scan(morningSteps(d), `d${n}_wake`);
    scan(d.out, `d${n}_out`);
    for (const f of d.favors || []) scan(f.steps, `d${n}_${f.id}`);
    if (d.night && d.night.hook) scan(d.night.hook, `d${n}_sky`);
    return out;
  }

  function addFriend(p, species, day, id) {
    p.friends = p.friends || []; p.friendDay = p.friendDay || {}; p.bridge = p.bridge || [];
    const look = window.BIRDS && BIRDS[species];
    if (look && look.bridge) {
      const key = id || `${species}-${day}`;
      if (p.bridge.some((b) => b.id === key)) return false;
      p.bridge.push({ species, day, id: key });
      return true;
    }
    if (p.friends.includes(species)) return false;
    p.friends.push(species);
    p.friendDay[species] = day;
    return true;
  }

  function fillEarlierDays(p, day) {
    for (let n = 1; n < day; n++) {
      const d = window.DAYS && DAYS[n];
      if (!d) continue;
      p.done[`d${n}_wake`] = true;
      for (const f of d.favors || []) p.done[`d${n}_${f.id}`] = true;
      p.done[`d${n}_sky`] = true;
      for (const f of friendsOfDay(n)) addFriend(p, f.species, n, f.id);
    }
    for (const [w, info] of Object.entries(window.WORDS || {})) if (info.day < day && !p.learned[w]) p.learned[w] = info.day;
  }

  const OLD_WORDS = ["river", "where", "mom", "duck", "crackers", "candy", "fish", "wait", "hide", "sky"];
  const OLD_MARKS = ["d3_duckling", "d3_feeder", "d4_crackers", "d4_heron", "d5_grebe", "d5_friends"];
  function upgrade(p) {
    if (!p || typeof p !== "object" || typeof p.day !== "number" || p.version >= VERSION) return p;
    let out = copy(p);
    if (!(out.version >= 2)) out = toVersion2(out);
    return toVersion3(out);
  }

  function toVersion2(p) {
    const out = { ...fresh(), ...p };
    out.version = 2;
    const day = Math.max(1, Math.min(out.day || 1, lastDay() || 1));
    out.day = day;
    out.learned = out.learned || {}; out.learnedWith = out.learnedWith || {}; out.learnedLine = out.learnedLine || {};
    const drop = (w) => { delete out.learned[w]; delete out.learnedWith[w]; delete out.learnedLine[w]; };
    for (const w of OLD_WORDS) drop(w);
    for (const w of Object.keys(out.learned)) {
      const info = window.WORDS && WORDS[w];
      if (!info || info.day >= day || out.learned[w] >= day) drop(w);
    }
    out.done = out.done || {};
    for (const k of Object.keys(out.done)) {
      const m = /^d(\d+)_/.exec(k);
      if (OLD_MARKS.includes(k) || /^day\d+$/.test(k) || (m && Number(m[1]) >= day)) delete out.done[k];
    }
    out.friends = []; out.friendDay = {}; out.bridge = [];
    fillEarlierDays(out, day);
    out.phase = "morning"; out.scene = "room"; out.holding = null;
    if (out.dollDay >= day) { out.doll = null; out.dollDay = 0; }
    out.migrated = true;
    return out;
  }

  function toVersion3(p) {
    const out = { ...fresh(), ...p };
    const day = out.day, before = (d) => (d || 1) < day;
    out.dawn = {
      words: Object.keys(out.learned || {}).filter((w) => before(out.learned[w])),
      friends: (out.friends || []).filter((s) => before((out.friendDay || {})[s])),
      bridge: (out.bridge || []).filter((b) => before(b.day)).map((b) => b.id),
    };
    out.slept = !(out.done || {})[`d${day}_wake`];
    out.again = false;
    out.version = 3;
    return out;
  }

  function load() {
    let morning = null, migrated = false;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = upgrade(JSON.parse(raw));
        migrated = !!(p && p.migrated);
        data = { ...fresh(), ...p };
      }
      const m = localStorage.getItem(MORNING);
      if (m) morning = { ...fresh(), ...upgrade(JSON.parse(m)) };
    } catch (e) { /* private mode: play without saving */ }
    delete data.migrated;
    const params = new URLSearchParams(location.search);
    const quick = !migrated && !params.has("away") && data.savedAt && Date.now() - data.savedAt < QUICK;
    const dayDone = !migrated && !!data.done[`d${data.day}_sky`];
    if (migrated) { /* already that day's morning (see upgrade) */ }
    else if (quick || dayDone) { /* just as she left it */ }
    else if (morning && morning.day === data.day && !morning.migrated) { const name = data.magpieName; data = copy(morning); data.magpieName = data.magpieName || name; }
    else toMorning();                        // a save from before mornings were kept
    delete data.migrated;
    const jump = Number(params.get("day"));
    if (jump >= 1 && jump <= 30) startDay(Math.floor(jump), true);
    else if (quick || dayDone) save();       // the morning kept stays this morning
    else beginDay();
    return data;
  }

  function toMorning() {
    const today = `d${data.day}_`;
    if (!data.again) for (const k of Object.keys(data.done)) if (k.startsWith(today)) delete data.done[k];
    const dawn = data.dawn || { words: [], friends: [], bridge: [] };
    const had = new Set(dawn.words || []);
    for (const w of Object.keys(data.learned)) if (!had.has(w) && data.learned[w] >= data.day) delete data.learned[w];
    const friendsHad = new Set(dawn.friends || []), bridgeHad = new Set(dawn.bridge || []);
    for (const [s, d] of Object.entries(data.friendDay || {})) if (d === data.day && !friendsHad.has(s)) { delete data.friendDay[s]; data.friends = data.friends.filter((x) => x !== s); }
    data.bridge = (data.bridge || []).filter((b) => b.day !== data.day || bridgeHad.has(b.id));
    if (data.dollDay === data.day) { data.doll = null; data.dollDay = 0; }
    data.phase = "morning"; data.scene = "room"; data.holding = null; data.slept = true;
  }

  let frozen = false;           // (a backup is being brought back: nothing more to save)
  function save() {
    if (frozen) return;
    data.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);

  function beginDay() {
    data.dawn = {
      words: Object.keys(data.learned || {}),
      friends: [...(data.friends || [])],
      bridge: (data.bridge || []).map((b) => b.id),
    };
    save();
    try { localStorage.setItem(MORNING, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function startDay(day, jumping = false) {
    if (jumping) {
      data = fresh();
      fillEarlierDays(data, day);
      data.magpieName = day > 1 ? (MAGPIE_NAMES[0]) : null;
    }
    data.day = day;
    data.phase = "morning";
    data.scene = "room";
    data.holding = null;
    data.slept = true;
    data.again = false;
    beginDay();
  }

  function nextMorning(next, again = false) {
    const day = data.day;
    if (again) delete data.done[`d${day}_sky`];               // (tonight's stars again, tomorrow night)
    data.day = next;
    data.again = !!again;
    data.slept = true;
    data.doll = null; data.dollDay = 0;
    data.phase = "morning";
    data.scene = "room";
    data.holding = null;
    beginDay();
  }

  return {
    load, save, startDay, beginDay, nextMorning, lastDay, upgrade,
    get: () => data,
    set(key, value) { data[key] = value; save(); },
    isDone: (step) => !!data.done[step],
    markDone(step) { data.done[step] = true; save(); },
    clearDay(day) { for (const k of Object.keys(data.done)) if (k.startsWith(`d${day}_`)) delete data.done[k]; },
    friend(species, id = null) { const added = addFriend(data, species, data.day, id); if (added) save(); return added; },
    bridgeBirds: () => (data.bridge || []).map((b) => ({ species: b.species, day: b.day })),
    otherFriends: () => (data.friends || []).map((s) => ({ species: s, day: (data.friendDay || {})[s] || 1 })),
    friendsOn: (day) => [...(data.bridge || []).filter((b) => b.day === day).map((b) => b.species),
      ...(data.friends || []).filter((s) => (data.friendDay || {})[s] === day)],
    sinceDawn() {
      const dawn = data.dawn || { words: [], friends: [], bridge: [] };
      const had = (list) => new Set(list || []);
      const words = had(dawn.words), friends = had(dawn.friends), bridge = had(dawn.bridge);
      return {
        words: Object.keys(data.learned || {}).filter((w) => !words.has(w)),
        friends: (data.friends || []).filter((s) => !friends.has(s)),
        bridge: (data.bridge || []).filter((b) => !bridge.has(b.id)).map((b) => b.id),
      };
    },
    reset() { data = fresh(); beginDay(); },
    freeze() { frozen = true; },
  };
})();

const Words = (() => {
  const known = new Set((window.KNOWN_WORDS || []).map((w) => w.toLowerCase()));
  const formOf = {};
  for (const [w, info] of Object.entries(window.WORDS || {})) for (const f of info.forms || []) formOf[f] = w;

  function base(word) {
    const w = word.toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
    if (!w) return "";
    if (formOf[w]) return formOf[w];
    if (WORDS[w] || known.has(w)) return w;
    for (const [suffix, repl] of [["ies", "y"], ["es", ""], ["s", ""], ["ing", ""], ["ed", ""]]) {
      if (w.endsWith(suffix) && w.length > suffix.length + 2) {
        const b = w.slice(0, -suffix.length) + repl;
        if (WORDS[b] || known.has(b)) return b;
      }
    }
    return w;
  }

  function isBright(word) {
    const b = base(word);
    if (!b) return true;
    if (WORDS[b]) return !!State.get().learned[b];
    return true;                    // anything that isn't a target word shines
  }

  function isTarget(word) { return !!WORDS[base(word)]; }

  function learn(word, who = null, line = null) {
    const b = base(word);
    const data = State.get();
    if (!WORDS[b] || data.learned[b]) return false;
    data.learned[b] = data.day;
    if (who) (data.learnedWith = data.learnedWith || {})[b] = who;
    if (line) (data.learnedLine = data.learnedLine || {})[b] = line;
    State.save();
    return true;
  }

  const learnedOn = (day) => Object.keys(State.get().learned).filter((w) => State.get().learned[w] === day);

  return { base, isBright, isTarget, learn, learnedOn, info: (w) => WORDS[base(w)] };
})();
