
const State = (() => {
  const KEY = "starling.progress";
  const MORNING = "starling.morning";          // how things were when today began
  const QUICK = 30 * 60 * 1000;                 // away for less than this: pick up where she was
  const VERSION = 4;                            // 2: Chapter 1 reworked (days from data/days/); 3: dawn, slept, again; 4: days that changed after she played them
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
    free: false,             // today is a free day (no day is written for its number yet): when one is, it starts from its real morning
    wonders: 0,              // how many times she has heard him wonder "What's that?" (js/husband.js; from 3, she can ask it too)
    hairFlower: null,        // the flower he tucked behind her ear (js/quirks.js): { day, color, center, ear }; only that day's shows
    diaryDolls: {},          // day -> the doll that came along, for that day's diary picture (js/diary.js)
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

  function partsOf(n) {
    const d = window.DAYS && DAYS[n];
    if (!d) return [];
    const part = (key, steps, extra = []) => {
      const words = [...extra], friends = [];
      eachStep(steps, (s) => {
        if (s.learn) words.push(...[].concat(s.learn));
        if (typeof s.friend === "string") friends.push({ species: s.friend, id: s.id || key });
      });
      return { key, words: words.filter((w) => typeof w === "string"), friends };
    };
    const night = d.night || {};
    return [
      part(`d${n}_wake`, morningSteps(d)),
      part(`d${n}_out`, d.out),
      ...(d.favors || []).map((f) => part(`d${n}_${f.id}`, f.steps)),
      part(`d${n}_sky`, night.hook, [].concat(night.learn || [])),
    ];
  }

  function catchUp(p, day) {
    p.done = p.done || {}; p.learned = p.learned || {};
    for (let n = 1; n <= day; n++) {
      for (const part of partsOf(n)) {
        const isOut = part.key === `d${n}_out`;
        if (n < day && !isOut) p.done[part.key] = true;
        if (!(n < day || (!isOut && p.done[part.key]))) continue;
        for (const w of part.words) {
          const b = typeof Words !== "undefined" ? Words.base(w) : w;
          if (window.WORDS && WORDS[b] && !p.learned[b]) p.learned[b] = n;
        }
        for (const f of part.friends) addFriend(p, f.species, n, f.id);
      }
    }
  }

  const OLD_WORDS = ["river", "where", "mom", "duck", "crackers", "candy", "fish", "wait", "hide", "sky"];
  const OLD_MARKS = ["d3_duckling", "d3_feeder", "d4_crackers", "d4_heron", "d5_grebe", "d5_friends"];
  function upgrade(p) {
    if (!p || typeof p !== "object" || typeof p.day !== "number") return p;
    let out = p;
    if (!(p.version >= VERSION)) {
      out = copy(p);
      if (!(out.version >= 2)) out = toVersion2(out);
      if (!(out.version >= 3)) out = toVersion3(out);
      out = toVersion4(out);
    }
    return freeDayWritten(out);
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
    catchUp(out, day);
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

  function toVersion4(p) {
    const out = { ...fresh(), ...p };
    out.done = out.done || {}; out.learned = out.learned || {};
    const d = window.DAYS && DAYS[out.day];
    if (d && !(d.favors || []).some((f) => out.done[`d${out.day}_${f.id}`])) toItsMorning(out);
    if (!d) out.free = true;                     // (a free day now: when it's written, its real morning)
    catchUp(out, out.day);
    const dawn = out.dawn || { words: [], friends: [], bridge: [] };
    const union = (list, more) => [...new Set([...(list || []), ...more])];
    out.dawn = {
      words: union(dawn.words, Object.keys(out.learned).filter((w) => out.learned[w] < out.day)),
      friends: union(dawn.friends, (out.friends || []).filter((s) => ((out.friendDay || {})[s] || 1) < out.day)),
      bridge: union(dawn.bridge, (out.bridge || []).filter((b) => b.day < out.day).map((b) => b.id)),
    };
    out.version = 4;
    return out;
  }

  function freeDayWritten(p) {
    if (!p.free || !(window.DAYS && DAYS[p.day])) return p;
    const out = copy(p);
    toItsMorning(out);
    out.free = false;
    return out;
  }

  function toItsMorning(p) {
    const today = `d${p.day}_`;
    const marks = Object.keys(p.done || {}).filter((k) => k.startsWith(today));
    for (const k of marks) delete p.done[k];
    const changed = marks.length > 0 || p.phase !== "morning" || p.again;
    p.phase = "morning"; p.scene = "room"; p.holding = null; p.slept = true; p.again = false;
    if (p.dollDay === p.day) { p.doll = null; p.dollDay = 0; }
    if (changed) p.migrated = true;
    return p;
  }

  function read(key) {
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return { value: null, raw: null }; }     // (private mode: play without saving)
    if (raw === null) return { value: null, raw: null };
    try {
      const value = upgrade(JSON.parse(raw));
      if (!value || typeof value !== "object" || typeof value.day !== "number") throw new Error("not a save");
      return { value, raw };
    } catch (e) {
      try { localStorage.setItem(key + ".broken", raw); } catch (e2) { /* (no room) */ }
      console.warn(`(${key} couldn't be read: its text is kept in ${key}.broken)`, e);
      return { value: null, raw, broken: true };
    }
  }

  let loaded = false;           // (nothing is saved until her save has been read: ?free never reads it)
  let jumped = false;           // (?day=N is used once)
  function load() {
    const progress = read(KEY), kept = read(MORNING);
    loaded = true;
    let migrated = false;
    const morning = kept.value ? { ...fresh(), ...kept.value } : null;
    if (progress.value) {
      migrated = !!progress.value.migrated;
      data = { ...fresh(), ...progress.value };
    } else if (morning) {
      data = copy(morning);
      migrated = true;
    } else if (progress.broken || kept.broken) {
      data = fresh();
      frozen = true;
      return data;
    }
    delete data.migrated;
    const params = typeof PARAMS !== "undefined" ? PARAMS : new URLSearchParams();    // (js/dev.js)
    const quick = !migrated && !params.has("away") && data.savedAt && Date.now() - data.savedAt < QUICK;
    const dayDone = !migrated && !!data.done[`d${data.day}_sky`];
    if (migrated) { /* already that day's morning (see upgrade) */ }
    else if (quick || dayDone) { /* just as she left it */ }
    else if (morning && morning.day === data.day && !morning.migrated) { const name = data.magpieName; data = copy(morning); data.magpieName = data.magpieName || name; }
    else toMorning();                        // a save from before mornings were kept
    delete data.migrated;
    const jump = Number(params.get("day"));
    if (jump >= 1 && jump <= 30 && !jumped) {
      jumped = true;
      if (typeof dropSwitches === "function") dropSwitches("day");
      startDay(Math.floor(jump), true);
    }
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

  let frozen = false;           // (a backup is being brought back, or her save can't be read: nothing more to save)
  function save() {
    if (frozen || !loaded) return;
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
    if (frozen || !loaded) return;
    save();
    try { localStorage.setItem(MORNING, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function eraseProgress() {
    const stars = (text) => { try { return Object.keys(JSON.parse(text).learned || {}).length; } catch (e) { return -1; } };
    try {
      const now = localStorage.getItem(KEY), kept = localStorage.getItem(KEY + ".previous");
      if (now !== null && (kept === null || stars(now) >= stars(kept))) {
        localStorage.setItem(KEY + ".previous", now);
        const m = localStorage.getItem(MORNING);
        if (m !== null) localStorage.setItem(MORNING + ".previous", m); else localStorage.removeItem(MORNING + ".previous");
      }
      localStorage.removeItem(KEY);
      localStorage.removeItem(MORNING);
    } catch (e) { /* private mode */ }
    data = fresh();
  }

  function startDay(day, jumping = false) {
    if (jumping) {
      eraseProgress();
      catchUp(data, day);
      data.magpieName = day > 1 ? (MAGPIE_NAMES[0]) : null;
    }
    data.day = day;
    data.phase = "morning";
    data.scene = "room";
    data.holding = null;
    data.slept = true;
    data.again = false;
    data.free = !(window.DAYS && DAYS[day]);
    beginDay();
  }

  function nextMorning(next, again = false) {
    const day = data.day;
    if (again) delete data.done[`d${day}_sky`];               // (tonight's stars again, tomorrow night)
    data.day = next;
    data.again = !!again;
    data.free = !(window.DAYS && DAYS[next]);        // (a free day: when one is written for it, it starts from its real morning)
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
    reset() { data = fresh(); frozen = false; beginDay(); },
    eraseProgress,
    freeze() { frozen = true; },
    addWonder() { data.wonders = (data.wonders || 0) + 1; save(); },
    setHairFlower(f) { data.hairFlower = f || null; save(); },
    keepDiaryDoll(day, doll) {
      if (!doll || (data.diaryDolls || {})[day] === doll) return;
      data.diaryDolls = { ...(data.diaryDolls || {}), [day]: doll };
      save();
    },
  };
})();

if (typeof PARAMS !== "undefined" && PARAMS.has("reset")) {
  State.eraseProgress();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("starling.") && !k.endsWith(".previous") && !k.endsWith(".broken")) localStorage.removeItem(k);
  } catch (e) { /* private mode */ }
  if (typeof dropSwitches === "function") dropSwitches("reset");
}

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
