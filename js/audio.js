
const Sound = (() => {
  let ac = null, master, musicBus, sfxBus;
  const settings = loadSettings();
  const musicWanted = () => !settings.musicOff && settings.music > 0;

  function loadSettings() {
    try {
      return { music: 0.6, sound: 0.8, ...JSON.parse(localStorage.getItem("starling.settings") || "{}") };
    } catch (e) {
      return { music: 0.6, sound: 0.8 };
    }
  }

  function saveSettings() {
    try { localStorage.setItem("starling.settings", JSON.stringify(settings)); } catch (e) { /* private mode */ }
  }

  function start() {
    if (ac) { wake(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    playLikeMusic();
    ac = new AC();
    if (ac.state === "suspended") ac.resume();
    for (const type of ["pointerup", "touchend", "click", "keydown"]) document.addEventListener(type, wake, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) rest(); else wake(); });
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
    musicBus = ac.createGain();
    musicBus.connect(master);
    sfxBus = ac.createGain();
    sfxBus.connect(master);
    applyVolumes();
  }

  function wake() {
    if (document.hidden) return;
    if (ac && ac.state !== "running" && ac.state !== "closed") ac.resume().catch(() => {});
    if (silentLoop && silentLoop.paused && musicWanted()) silentLoop.play().catch(() => {});
  }

  function rest() {
    if (ac && ac.state === "running") ac.suspend().catch(() => {});
    if (silentLoop && !silentLoop.paused) silentLoop.pause();
  }

  let silentLoop = null;
  function playLikeMusic() {
    const on = musicWanted();
    try {
      if (navigator.audioSession) { navigator.audioSession.type = on ? "playback" : "ambient"; return; }
    } catch (e) { /* not there: the silent loop below */ }
    if (!on) { if (silentLoop) silentLoop.pause(); return; }
    try {
      if (!silentLoop) { silentLoop = new Audio(silentWav()); silentLoop.loop = true; }
      if (!document.hidden) silentLoop.play().catch(() => {});
    } catch (e) { silentLoop = null; }
  }
  function session() {
    try { if (navigator.audioSession) return navigator.audioSession.type; } catch (e) { /* (below) */ }
    return silentLoop ? (silentLoop.paused ? "loop paused" : "loop") : "";
  }
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const text = (at, t) => { for (let i = 0; i < t.length; i++) v.setUint8(at + i, t.charCodeAt(i)); };
    text(0, "RIFF"); v.setUint32(4, 36 + n, true); text(8, "WAVE"); text(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    text(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  function applyVolumes() {
    if (!ac) return;
    musicBus.gain.setTargetAtTime(musicWanted() ? settings.music * 0.9 : 0, ac.currentTime, 0.1);
    sfxBus.gain.setTargetAtTime(settings.sound * 0.5, ac.currentTime, 0.05);
  }

  const FADE_IN = 2.5;         // seconds
  const FADE_OUT = 4;          // the last seconds of a track, as it rings away
  const buffers = {};          // decoded tracks
  const music = {
    name: null,                // the track that should be playing
    state: "off",              // off, loading, playing, quiet, missing
    source: null, gain: null,
    startedAt: 0, duration: 0, // for the position
    quietUntil: 0, timer: null,
    token: 0,                  // so a late-loading track can't start after a change
    loading: null,             // the download under way (an AbortController), so turning the music off stops it
    starts: 0,                 // how many times playback has started (for testing)
    gapOverride: null,         // the test page can shorten the quiet
  };

  function loadTrack(name, signal) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    const info = (window.MUSIC_TRACKS || {})[name];
    if (!info) return Promise.reject(new Error(`no track "${name}" in data/music-tracks.js`));
    return fetch(info.file, signal ? { signal } : undefined)
      .then((res) => {
        if (!res.ok) throw new Error(`${info.file}: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => new Promise((resolve, reject) => ac.decodeAudioData(data, resolve, reject)))
      .then((buffer) => (buffers[name] = buffer));
  }

  function fadeOutCurrent(seconds) {
    if (!music.source) return;
    const now = ac.currentTime, g = music.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + seconds);
    music.source.onended = null;
    music.source.stop(now + seconds + 0.05);
    music.source = null;
  }

  function playThrough(name, buffer, offset = 0, fadeIn = FADE_IN) {
    const now = ac.currentTime + 0.05;
    const gain = ac.createGain();
    const remaining = buffer.duration - offset;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + Math.min(fadeIn, remaining / 2));
    const fadeFrom = now + Math.max(Math.min(fadeIn, remaining / 2), remaining - FADE_OUT);
    gain.gain.setValueAtTime(1, fadeFrom);
    gain.gain.linearRampToValueAtTime(0, now + remaining);
    gain.connect(musicBus);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(now, offset);
    source.onended = () => {
      if (music.source !== source) return;
      music.source = null;
      music.state = "quiet";
      const gap = music.gapOverride != null ? music.gapOverride : 20 + Math.random() * 10;
      music.quietUntil = ac.currentTime + gap;
      clearTimeout(music.timer);
      music.timer = setTimeout(() => {
        if (music.state === "quiet" && music.name === name) playThrough(name, buffer, 0);
      }, gap * 1000);
    };
    Object.assign(music, { source, gain, startedAt: now - offset, duration: buffer.duration, state: "playing" });
    music.starts++;
  }

  function playMusic(name, options = {}) {
    if (!ac) return;
    const again = options.restart || options.offset != null;
    if (name === music.name && !again && music.state !== "off" && music.state !== "missing") return;
    const previous = music.name;
    music.name = name;
    if (!musicWanted()) {
      if (previous && previous !== name) delete buffers[previous];
      music.state = "off";
      return;
    }
    begin(name, previous, options);
  }

  function begin(name, previous, options = {}) {
    const again = options.restart || options.offset != null;
    const changing = name !== previous && music.source;
    clearTimeout(music.timer);
    fadeOutCurrent(again ? 0.3 : 2.5);
    if (previous && previous !== name) setTimeout(() => { if (music.name !== previous) delete buffers[previous]; }, 3000);
    music.state = "loading";
    const token = ++music.token;
    const loading = typeof AbortController === "function" ? new AbortController() : null;
    music.loading = loading;
    loadTrack(name, loading && loading.signal).then((buffer) => {
      if (music.loading === loading) music.loading = null;
      if (token !== music.token) {
        if (!musicWanted() || music.name !== name) delete buffers[name];
        return;
      }
      const start = () => { if (token === music.token) playThrough(name, buffer, options.offset || 0, options.offset ? 0.6 : FADE_IN); };
      if (changing && !again) setTimeout(start, 1500); else start();
    }).catch((e) => {
      if (music.loading === loading) music.loading = null;
      if ((e && e.name === "AbortError") || leaving) return;      // (the music was turned off while it loaded, or the page is opening fresh)
      console.warn("Starling: Couldn't load the music:", String((e && e.message) || e));
      if (token === music.token) music.state = "missing";
    });
  }

  let leaving = false;
  for (const type of ["beforeunload", "pagehide"]) window.addEventListener(type, () => { leaving = true; });

  function stopLoading() {
    if (music.loading) music.loading.abort();
    music.loading = null;
  }

  function silence() {
    music.token++;
    stopLoading();
    clearTimeout(music.timer);
    if (ac) fadeOutCurrent(1);
    music.state = "off";
    for (const k of Object.keys(buffers)) delete buffers[k];
  }

  function stopMusic() {
    if (!ac) return;
    music.token++;
    stopLoading();
    clearTimeout(music.timer);
    fadeOutCurrent(1.5);
    music.name = null;
    music.state = "off";
  }

  function musicStatus() {
    const now = ac ? ac.currentTime : 0;
    return {
      name: music.name,
      state: music.state,
      position: music.state === "playing" ? +(now - music.startedAt).toFixed(1) : null,
      duration: music.duration ? +music.duration.toFixed(1) : null,
      quietFor: music.state === "quiet" ? +Math.max(0, music.quietUntil - now).toFixed(1) : null,
      starts: music.starts,
      volume: music.source ? +music.gain.gain.value.toFixed(3) : 0,
      context: ac ? ac.state : "not started",
      musicOn: musicWanted(),
      loaded: Object.keys(buffers),          // the tracks decoded now
      session: session(),
    };
  }

  function setQuietGap(seconds) {
    music.gapOverride = seconds;
  }

  function blip({ type = "sine", from, to, dur, when = 0, vol = 0.3, filter = null }) {
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    let node = o;
    if (filter) {
      const f = ac.createBiquadFilter();
      f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q || 1;
      node = o.connect(f);
    }
    node.connect(g).connect(sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function bell(freq, when, volume) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(volume, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);
    g.connect(sfxBus);
    const a = ac.createOscillator();
    a.frequency.value = freq;
    a.connect(g);
    const b = ac.createOscillator();
    b.frequency.value = freq * 3.01;
    const bg = ac.createGain();
    bg.gain.setValueAtTime(volume * 0.35, when);
    bg.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    b.connect(bg).connect(sfxBus);
    a.start(when); b.start(when);
    a.stop(when + 1.3); b.stop(when + 0.3);
  }

  function chirp(style = "chatter", pitch = 1500, n = 0) {
    const wobble = 1 + (Math.sin(n * 2.3) * 0.08);
    if (style === "chatter") {
      for (let i = 0; i < 2; i++) {
        blip({ type: "triangle", from: pitch * wobble * (1.1 - i * 0.1), to: pitch * 0.7, dur: 0.045, when: i * 0.055, vol: 0.12,
          filter: { type: "bandpass", freq: pitch * 1.4, q: 2 } });
      }
    } else if (style === "tweet") {
      blip({ type: "sine", from: pitch * wobble, to: pitch * 1.35, dur: 0.09, vol: 0.12 });
    } else if (style === "coo") {
      blip({ type: "sine", from: pitch * wobble * 1.08, to: pitch * 0.9, dur: 0.2, vol: 0.14 });
    } else if (style === "quack") {
      blip({ type: "sawtooth", from: pitch * wobble * 1.15, to: pitch * 0.75, dur: 0.11, vol: 0.07,
        filter: { type: "bandpass", freq: pitch * 1.6, q: 3 } });
    } else if (style === "croak") {
      blip({ type: "sawtooth", from: pitch * wobble, to: pitch * 0.8, dur: 0.14, vol: 0.06,
        filter: { type: "lowpass", freq: pitch * 3 } });
    } else if (style === "trill") {
      for (let i = 0; i < 3; i++) blip({ type: "sine", from: pitch * wobble * (1 + i * 0.08), to: pitch * (1.12 + i * 0.08), dur: 0.035, when: i * 0.04, vol: 0.09 });
    } else if (style === "hum") {
      blip({ type: "triangle", from: pitch * wobble * 1.06, to: pitch * 0.94, dur: 0.12, vol: 0.13,
        filter: { type: "lowpass", freq: pitch * 4 } });
    } else if (style === "hoot") {
      blip({ type: "sine", from: pitch * wobble, to: pitch * 0.96, dur: 0.16, vol: 0.14 });
    } else if (style === "knock") {
      blip({ type: "triangle", from: pitch * wobble * 1.3, to: pitch * 0.6, dur: 0.05, vol: 0.14, filter: { type: "lowpass", freq: pitch * 2.2 } });
    } else if (style === "drum") {
      for (let i = 0; i < 9; i++) blip({ type: "triangle", from: pitch * 1.25, to: pitch * 0.6, dur: 0.035, when: i * 0.055, vol: 0.1 * (1 - i * 0.08), filter: { type: "lowpass", freq: pitch * 2 } });
    } else if (style === "screech") {
      blip({ type: "sawtooth", from: pitch * wobble * 1.1, to: pitch * 0.8, dur: 0.12, vol: 0.05, filter: { type: "bandpass", freq: pitch * 1.8, q: 1.5 } });
    } else if (style === "kkwong") {
      blip({ type: "square", from: pitch * wobble * 1.2, to: pitch * 0.9, dur: 0.1, vol: 0.05, filter: { type: "lowpass", freq: pitch * 3 } });
      blip({ type: "square", from: pitch * wobble * 1.1, to: pitch * 0.85, dur: 0.08, when: 0.12, vol: 0.04, filter: { type: "lowpass", freq: pitch * 3 } });
    } else if (style === "twitter") {
      for (let i = 0; i < 3; i++) blip({ type: "sine", from: pitch * wobble * (1 + (i % 2) * 0.2), to: pitch * (1.25 - (i % 2) * 0.15), dur: 0.035, when: i * 0.045, vol: 0.09 });
    } else if (style === "chuck") {
      for (let i = 0; i < 3; i++) blip({ type: "sine", from: pitch * wobble, to: pitch * 0.8, dur: 0.04, when: i * 0.07, vol: 0.11 });
    } else {
      blip({ type: "sine", from: pitch, to: pitch * 1.1, dur: 0.06, vol: 0.1 });
    }
  }

  function owlCall() {
    if (!ac) return;
    blip({ type: "sine", from: 1180, to: 1120, dur: 0.16, vol: 0.07 });
    blip({ type: "sine", from: 1000, to: 930, dur: 0.2, when: 0.26, vol: 0.07 });
  }

  function hearts() {
    if (!ac) return;
    [784, 988, 1175, 1568].forEach((f, i) => bell(f, ac.currentTime + i * 0.09, 0.1));
  }

  function pickup() {
    blip({ type: "sine", from: 660, to: 990, dur: 0.1, vol: 0.14 });
    blip({ type: "sine", from: 990, to: 1320, dur: 0.08, when: 0.07, vol: 0.1 });
  }

  function door() {
    blip({ type: "triangle", from: 220, to: 150, dur: 0.12, vol: 0.12, filter: { type: "lowpass", freq: 900 } });
    blip({ type: "triangle", from: 200, to: 140, dur: 0.1, when: 0.16, vol: 0.08, filter: { type: "lowpass", freq: 800 } });
  }

  function splash() {
    blip({ type: "sawtooth", from: 900, to: 300, dur: 0.18, vol: 0.04, filter: { type: "bandpass", freq: 1800, q: 0.7 } });
    blip({ type: "sine", from: 700, to: 1400, dur: 0.08, when: 0.05, vol: 0.06 });
  }

  function sleep() {
    if (!ac) return;
    [1175, 988, 784, 587].forEach((f, i) => bell(f, ac.currentTime + i * 0.28, 0.08));
  }

  function note(i = 0) {
    if (!ac) return;
    bell([659, 784, 880, 784, 1047, 880, 784][i % 7], ac.currentTime, 0.06);
  }

  function twinkle() {
    if (!ac) return;
    [1318.5, 1568, 2093].forEach((f, i) => bell(f, ac.currentTime + i * 0.07, 0.12));
  }

  function tap(pitch = 520, vol = 0.18) {
    blip({ type: "sine", from: pitch * 1.3, to: pitch, dur: 0.12, vol });
  }

  function buzz() {
    blip({ type: "sawtooth", from: 190, to: 170, dur: 0.28, vol: 0.06, filter: { type: "lowpass", freq: 700 } });
  }

  function setMusicOn(on) { turnMusic(on, musicWanted()); }
  function turnMusic(on, was) {
    if (on && !(settings.music > 0)) settings.music = settings.musicLast > 0 ? settings.musicLast : 0.6;
    settings.musicOff = !on;
    saveSettings();
    applyVolumes();
    if (on === was) return;
    if (ac) {
      playLikeMusic();
      if (!on) silence();
      else if (music.name) begin(music.name, null);
    }
    try { window.dispatchEvent(new CustomEvent("starling-music", { detail: { on } })); } catch (e) { /* (old browsers) */ }
  }

  function setVolume(kind, value, settled = false) {
    if (kind !== "music") {
      settings[kind] = value;
      saveSettings();
      applyVolumes();
      if (kind === "sound") tap();
      return;
    }
    const was = musicWanted();
    settings.music = value;
    if (settled && value > 0) settings.musicLast = value;
    if (value > 0 && !was) turnMusic(true, was);
    else if (!(value > 0) && was) turnMusic(false, was);
    else { saveSettings(); applyVolumes(); }
  }

  return {
    start, playMusic, stopMusic, musicStatus, setQuietGap,
    chirp, twinkle, tap, buzz, setVolume, setMusicOn, musicOn: musicWanted, settings,
    owlCall, hearts, pickup, door, splash, sleep, note,
    status: musicStatus,
  };
})();
