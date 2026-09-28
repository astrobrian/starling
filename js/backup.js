
const Backup = (() => {
  const $ = (id) => document.getElementById(id);
  const T = () => UI_TEXT;
  const KEYS = ["progress", "morning", "closeupSeen", "introSeen"];      // what a backup keeps (not settings or zoom)
  const PREFIX = "STARLING";

  function check(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  const toB64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const fromB64 = (text) => { const s = atob(text.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

  async function squeeze(text) {
    if (typeof CompressionStream === "undefined") return { kind: "0", bytes: new TextEncoder().encode(text) };
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return { kind: "1", bytes: new Uint8Array(await new Response(stream).arrayBuffer()) };
  }
  async function unsqueeze(kind, bytes) {
    if (kind === "0") return new TextDecoder().decode(bytes);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }

  async function makeCode() {
    State.save();
    const saved = {};
    for (const k of KEYS) { try { const v = localStorage.getItem("starling." + k); if (v !== null) saved[k] = v; } catch (e) { /* private mode */ } }
    const { kind, bytes } = await squeeze(JSON.stringify(saved));
    const data = toB64(bytes);
    const code = `${PREFIX}-${kind}.${check(data)}.${data}`;
    return code.match(/.{1,40}/g).join("\n");
  }

  function summaryOf(progressText) {
    try {
      const p = State.upgrade(JSON.parse(progressText || "null"));
      if (!p || typeof p.day !== "number") return null;
      return { day: p.day, stars: Object.keys(p.learned || {}).length, friends: p.friends || [] };
    } catch (e) {
      return null;
    }
  }
  const stored = (k) => { try { return localStorage.getItem("starling." + k); } catch (e) { return null; } };
  const fresh = (k, v) => { if (k !== "progress" || v === null) return v; try { return JSON.stringify({ ...JSON.parse(v), savedAt: Date.now() }); } catch (e) { return v; } };
  const now = () => { const p = State.get(); return { day: p.day, stars: Object.keys(p.learned || {}).length, friends: p.friends || [] }; };

  async function readCode(text) {
    const flat = (text || "").replace(/\s+/g, "");
    const at = flat.indexOf(PREFIX + "-");
    if (at < 0) return null;
    const m = flat.slice(at).match(/^STARLING-([01])\.([0-9a-z]+)\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    for (let data = m[3], cut = 0; cut <= 200 && data.length >= 8; cut++, data = data.slice(0, -1)) {
      if (check(data) !== m[2]) continue;
      try {
        const saved = JSON.parse(await unsqueeze(m[1], fromB64(data)));
        const sum = summaryOf(saved.progress);
        if (sum) return { saved, ...sum };
      } catch (e) {
      }
    }
    return null;
  }

  function words(id, text, korean) {
    const el = $(id);
    el.textContent = text;
    if (korean) { const k = document.createElement("small"); k.className = "korean"; k.textContent = korean; el.appendChild(k); }
  }
  const note = (text, korean) => words("backup-note", text || "", text ? korean : null);

  async function save() {
    const code = await makeCode();
    reset();
    words("backup-title", T().backupSaveTitle, T().backupSaveTitleKorean);
    words("backup-help", T().backupSaveHelp, T().backupSaveHelpKorean);
    $("backup-text").value = code;
    $("backup-text").readOnly = true;
    $("backup-go").classList.add("hidden");
    $("backup-done").textContent = T().done;
    $("backup-card").classList.remove("hidden");
    try {
      if (navigator.share) await navigator.share({ text: code });
      else { await navigator.clipboard.writeText(code); note(T().backupCopied, T().backupCopiedKorean); }
    } catch (e) {
    }
  }

  let pending = null;           // the backup she pasted, waiting for her Yes
  function load() {
    reset();
    words("backup-title", T().backupLoadTitle, T().backupLoadTitleKorean);
    words("backup-help", T().backupLoadHelp, T().backupLoadHelpKorean);
    $("backup-text").value = "";
    $("backup-text").readOnly = false;
    $("backup-go").textContent = T().backupLoadGo;
    $("backup-go").classList.remove("hidden");
    $("backup-done").textContent = T().backupBack;
    const before = summaryOf(stored("progress.previous"));
    if (before) {
      words("backup-undo", T().backupUndo.replace("{day}", before.day).replace("{stars}", before.stars), T().backupUndoKorean);
      $("backup-undo").classList.remove("hidden");
    }
    $("backup-card").classList.remove("hidden");
  }

  async function loadPasted() {
    if (pending) { if (Date.now() - pending.askedAt > 800) sure(); return; }       // (Yes, but not a quick double tap)
    const text = $("backup-text").value;
    if (!text.trim()) { note(T().backupEmpty, T().backupEmptyKorean); return; }
    const got = await readCode(text);
    if (!got) { note(T().backupBad, T().backupBadKorean); return; }
    pending = { ...got, askedAt: Date.now() };
    $("backup-card").classList.add("asking");
    words("backup-title", T().backupSure, T().backupSureKorean);
    const rows = $("backup-compare");
    rows.innerHTML = "";
    rows.append(whatRow(T().backupThis, got), whatRow(T().backupNow, now()));
    $("backup-go").textContent = T().backupYes;
    $("backup-done").textContent = T().backupNo;
    note("");
  }

  function whatRow(label, sum) {
    const row = document.createElement("div");
    row.className = "backup-what";
    const name = document.createElement("span");
    name.className = "label";
    name.textContent = label;
    const what = document.createElement("span");
    what.className = "what";
    if (typeof fillWhat === "function") fillWhat(what, sum.stars, sum.friends, 4);
    const day = document.createElement("span");
    day.className = "day";
    day.textContent = T().backupDay.replace("{day}", sum.day);
    row.append(name, day, what);
    return row;
  }

  function sure() {
    const n = now(), older = pending.stars < n.stars || pending.day < n.day;
    if (older && typeof Title !== "undefined" && Title && Title.ask) {
      $("backup-card").classList.add("hidden");
      Title.ask(T().backupOlder, T().backupYes, (el) => el.append(whatRow(T().backupThis, pending), whatRow(T().backupNow, n)), bringIn, T().backupOlderKorean);
    }
    else bringIn();
  }

  function bringIn() {
    if (!pending) return;
    State.freeze();
    try {
      for (const k of ["progress", "morning"]) { const v = stored(k); if (v) localStorage.setItem("starling." + k + ".previous", v); }
      for (const k of KEYS) localStorage.removeItem("starling." + k);
      for (const [k, v] of Object.entries(pending.saved)) localStorage.setItem("starling." + k, fresh(k, v));
    } catch (e) { /* private mode */ }
    location.href = location.pathname;
  }

  function undo() {
    const before = summaryOf(stored("progress.previous"));
    if (!before) return;
    const go = () => {
      State.freeze();
      try {
        for (const k of ["progress", "morning"]) {
          const here = stored(k), back = stored(k + ".previous");
          if (back !== null) localStorage.setItem("starling." + k, fresh(k, back)); else localStorage.removeItem("starling." + k);
          if (here !== null) localStorage.setItem("starling." + k + ".previous", here); else localStorage.removeItem("starling." + k + ".previous");
        }
      } catch (e) { /* private mode */ }
      location.href = location.pathname;
    };
    const text = T().backupUndoSure.replace("{day}", before.day).replace("{stars}", before.stars);
    if (typeof Title !== "undefined" && Title && Title.ask) {
      $("backup-card").classList.add("hidden");
      Title.ask(text, T().backupYes, (el) => el.append(whatRow(T().backupBefore, before), whatRow(T().backupNow, now())), go, T().backupUndoSureKorean);
    }
    else go();
  }

  function reset() {
    pending = null;
    $("backup-card").classList.remove("asking");
    $("backup-compare").innerHTML = "";
    $("backup-undo").classList.add("hidden");
    note("");
  }

  function close() {
    $("backup-card").classList.add("hidden");
    reset();
  }

  function offer() {
    return new Promise((done) => {
      words("backup-offer-text", T().backupOffer, T().backupOfferKorean);
      const what = $("backup-offer-what");
      what.innerHTML = "";
      const n = now();
      if (typeof fillWhat === "function") fillWhat(what, n.stars, n.friends, 6);
      $("backup-offer").classList.remove("hidden");
      const finish = () => { $("backup-offer").classList.add("hidden"); done(); };
      $("backup-offer-yes").onclick = async () => { $("backup-offer").classList.add("hidden"); await save(); const wait = setInterval(() => { if ($("backup-card").classList.contains("hidden")) { clearInterval(wait); done(); } }, 300); };
      $("backup-offer-no").onclick = finish;
    });
  }

  function persist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not available */ }
  }

  function setup() {
    if (!$("backup-card")) return;
    $("backup-label").textContent = T().backupRow;
    words("backup-save", T().backupSave, T().backupSaveKorean);
    words("backup-load", T().backupLoad, T().backupLoadKorean);
    $("backup-offer-yes").textContent = T().backupOfferYes;
    $("backup-offer-no").textContent = T().backupNotNow;
    $("backup-save").addEventListener("click", () => { $("settings").classList.add("hidden"); save(); });
    $("backup-load").addEventListener("click", () => { $("settings").classList.add("hidden"); load(); });
    $("backup-go").addEventListener("click", loadPasted);
    $("backup-done").addEventListener("click", close);
    $("backup-undo").addEventListener("click", undo);
    $("backup-text").addEventListener("input", () => {
      if (!pending) { note(""); return; }
      const text = $("backup-text").value;
      load();
      $("backup-text").value = text;
    });
  }

  return { setup, save, load, offer, persist, makeCode, readCode };
})();
