
function diaryMoon(day, r = 5) {
  const s = Moon.sprite(r, Moon.forDay(day));
  return s.getContext ? s : s.canvas;
}

const Diary = !document.getElementById("diary") ? null : (() => {
  const $ = (id) => document.getElementById(id);
  const root = $("diary"), page = $("diary-page"), canvas = $("diary-picture"), ctx = canvas.getContext("2d");
  const W = DIARY_PICTURE.w, H = DIARY_PICTURE.h;
  const BASE_FONT = 25, SMALLEST_FONT = 18;
  const WEATHER_ICON = { sunny: "sun", hot: "hot", cloudy: "cloudy", rainy: "rainy" };
  let open = false, mode = null, days = [], index = 0, done = null, pending = null;
  let pictures = null, clock = 0, last = 0, turning = false, ready = false, swipe = null;

  const entry = (day) => (window.DIARY && DIARY[day]) || null;
  const moonNote = (day) => { const m = Moon.forDay(day); return typeof m.note === "string" ? m.note : null; };
  const dollOn = (day) => {
    const s = State.get();
    return (s.diaryDolls && s.diaryDolls[day]) || (s.dollDay === day ? s.doll : null) || null;
  };
  function keepDoll(day) {
    const s = State.get();
    if (s.dollDay === day && s.doll) State.keepDiaryDoll(day, s.doll);
  }

  function sizeCanvas(c, w, h, points) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.round((points * dpr) / h));
    c.style.width = (w * k) / dpr + "px";
    c.style.height = (h * k) / dpr + "px";
  }
  function paint(c, src, points) {
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    sizeCanvas(c, src.width, src.height, points);
  }

  function setUp() {
    if (ready) return;
    ready = true;
    canvas.width = W; canvas.height = H;
    $("diary-title").textContent = UI_TEXT.diaryTitle;
    $("diary-title-ko").textContent = UI_TEXT.diaryTitleKorean;
    for (const [id, grid, label] of [["diary-prev", ICONS.chevronLeft, UI_TEXT.diaryBack], ["diary-next", ICONS.chevronRight, UI_TEXT.diaryNext]]) {
      const b = $(id);
      b.setAttribute("aria-label", label);
      const c = document.createElement("canvas");
      paint(c, iconFromGrid(grid).toCanvas(), 22);
      b.appendChild(c);
      b.addEventListener("click", () => turn(id === "diary-next" ? 1 : -1));
    }
    $("diary-done").addEventListener("click", finish);
    root.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      swipe = mode === "read" ? { x: e.clientX, y: e.clientY } : null;
      if (e.target.closest(".word")) return;
      let best = null;
      for (const s of $("diary-text").querySelectorAll(".word[data-word]")) {
        if (!s.classList.contains("dim") && !Words.info(s.textContent)) continue;
        const r = s.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
        if (d <= 12 && (!best || d < best.d)) best = { s, d };
      }
      if (best) Speech.showHint(best.s.textContent, best.s, (entry(days[index]) || {}).korean || null);
    });
    root.addEventListener("pointerup", (e) => {
      const s = swipe;
      swipe = null;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
    });
    window.addEventListener("keydown", (e) => {
      if (!open) return;
      e.stopPropagation();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); if (mode === "read") turn(e.key === "ArrowRight" ? 1 : -1); }
      else if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); finish(); }
    }, true);
    window.addEventListener("keyup", (e) => { if (open) e.stopPropagation(); }, true);
    window.addEventListener("resize", () => { if (open) { layout(); fitText(); } });
  }

  function render() {
    const day = days[index], data = entry(day);
    root.classList.toggle("empty", !data);
    for (const id of ["diary-day", "diary-lunar", "diary-weather"]) $(id).classList.toggle("hidden", !data);
    const text = $("diary-text");
    text.innerHTML = "";
    text.style.fontSize = BASE_FONT + "px";
    if (data) {
      $("diary-day").textContent = UI_TEXT.diaryDay.replace("{day}", day);
      $("diary-lunar-text").textContent = Moon.lunarDate(day).korean;
      paint($("diary-moon"), diaryMoon(day), 18);
      const weather = data.weather || "sunny";
      paint($("diary-weather-icon"), iconFromGrid(ICONS[WEATHER_ICON[weather]] || ICONS.sun).toCanvas(), 22);
      const word = $("diary-weather-word");
      word.innerHTML = "";
      words(word, (UI_TEXT.weather && UI_TEXT.weather[weather]) || weather, day, data.korean);
      let n = 0;
      for (const line of pageLines(day, data)) {
        const p = document.createElement("p");
        n = words(p, line, day, data.korean, n);
        text.appendChild(p);
      }
      const note = data.moon || moonNote(day);
      if (note) {
        const p = document.createElement("p");
        p.className = "diary-moon-note";
        n = words(p, note, day, data.korean, n);
        text.appendChild(p);
      }
    } else {
      const p = document.createElement("p");
      words(p, UI_TEXT.diaryEmpty, 0, null);
      const k = document.createElement("p");
      k.className = "diary-korean";
      k.textContent = UI_TEXT.diaryEmptyKorean;
      text.append(p, k);
    }
    const dots = $("diary-dots");
    dots.innerHTML = "";
    if (mode === "read" && days.length > 1) {
      if (days.length <= 12) days.forEach((d, i) => { const s = document.createElement("span"); if (i === index) s.className = "on"; dots.appendChild(s); });
      else dots.textContent = `${index + 1} / ${days.length}`;
    }
    $("diary-prev").classList.toggle("off", index <= 0);
    $("diary-next").classList.toggle("off", index >= days.length - 1);
    clock = 0;
    layout();
    fitText();
  }

  const doneAll = (day, ids) => [].concat(ids || []).every((id) => State.isDone(`d${day}_${id}`));
  function pageLines(day, data) {
    const out = [];
    let waiting = false, shown = false;
    for (const line of data.text || []) {
      if (typeof line === "string") { out.push(line); continue; }
      if (!line || typeof line.text !== "string") continue;
      if (doneAll(day, line.after)) { out.push(line.text); if (line.after) shown = true; }
      else waiting = true;
    }
    if (waiting && !shown) out.push(...[].concat(data.fallback || []));
    return out;
  }

  const pictureOf = (day, data) => (!data ? "empty" : data.picture && doneAll(day, data.pictureAfter) ? data.picture : data.early || "empty");

  function words(el, text, day, korean, n = 0) {
    const today = new Set(day ? Words.learnedOn(day) : []);
    for (const piece of Speech.pieces(Speech.fill(text))) {
      const s = Speech.wordSpan(piece, "her", true, korean || null);
      if (s.dataset.word && today.has(s.dataset.word)) { s.classList.add("today"); s.style.setProperty("--i", n++); }
      el.appendChild(s);
    }
    return n;
  }

  function layout() {
    const body = page.querySelector(".diary-body"), frame = page.querySelector(".diary-picture");
    const dpr = window.devicePixelRatio || 1;
    const fs = getComputedStyle(frame), bs = getComputedStyle(body);
    const edge = parseFloat(fs.paddingTop) * 2 + parseFloat(fs.borderTopWidth) * 2;
    const h = body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - edge;
    const w = body.clientWidth * 0.5 - edge;
    const k = Math.max(1, Math.floor(Math.min((h * dpr) / H, (w * dpr) / W)));
    canvas.style.width = (W * k) / dpr + "px";
    canvas.style.height = (H * k) / dpr + "px";
    ctx.imageSmoothingEnabled = false;
  }

  function fitText() {
    const text = $("diary-text");
    let size = BASE_FONT;
    text.style.fontSize = size + "px";
    while (size > SMALLEST_FONT && text.scrollHeight > text.clientHeight + 1) text.style.fontSize = --size + "px";
  }

  let loopId = 0;                     // (one loop at a time, even when a page closes and opens in one frame)
  function loop(now, id) {
    if (!open || id !== loopId) return;
    clock += Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const day = days[index], data = entry(day);
    pictures = pictures || makeDiaryPictures(W, H);
    const draw = pictures[pictureOf(day, data)] || pictures.empty;
    ctx.clearRect(0, 0, W, H);
    draw(ctx, clock, { doll: data ? dollOn(day) : null });
    requestAnimationFrame((t) => loop(t, id));
  }

  function show(arrive) {
    setUp();
    open = true;
    turning = false;
    root.classList.toggle("bedtime", mode === "bedtime");
    root.classList.remove("hidden", "leaving");
    document.body.classList.add("diary-open");
    $("diary-done").textContent = mode === "bedtime" ? UI_TEXT.goodNight : UI_TEXT.diaryClose;
    render();
    page.classList.remove("arrive", "turn-out-next", "turn-out-back", "turn-in-next", "turn-in-back");
    root.classList.toggle("arriving", !!arrive);
    if (arrive) {
      void page.offsetWidth;
      page.classList.add("arrive");
      if ($("diary-text").querySelector(".today")) setTimeout(() => { if (open) Sound.twinkle(); }, 700);
    } else Sound.tap(760);
    last = performance.now();
    const id = ++loopId;
    requestAnimationFrame((t) => loop(t, id));
    pending = new Promise((ok) => { done = ok; });
    return pending;
  }

  function turn(dir) {
    if (!open || mode !== "read" || turning) return;
    const to = index + dir;
    if (to < 0 || to >= days.length) return;
    turning = true;
    $("hint").classList.add("hidden");
    Sound.tap(dir > 0 ? 820 : 700);
    root.classList.remove("arriving");
    page.classList.remove("arrive", "turn-in-next", "turn-in-back");
    page.classList.add(dir > 0 ? "turn-out-next" : "turn-out-back");
    setTimeout(() => {
      index = to;
      page.classList.remove("turn-out-next", "turn-out-back");
      render();
      page.classList.add(dir > 0 ? "turn-in-next" : "turn-in-back");
      setTimeout(() => { turning = false; }, 200);
    }, 160);
  }

  function finish() {
    if (!open) return;
    open = false;
    $("hint").classList.add("hidden");
    root.classList.add("leaving");
    document.body.classList.remove("diary-open");
    const ok = done;
    done = null; pending = null;
    setTimeout(() => { if (!open) root.classList.add("hidden"); root.classList.remove("leaving"); }, 260);
    Sound.tap(mode === "bedtime" ? 600 : 700);
    if (ok) ok();
  }

  function bedtime(day) {
    if (!entry(day)) return Promise.resolve();
    keepDoll(day);
    if (open && mode === "bedtime" && days[0] === day && pending) return pending;
    if (open) finish();
    mode = "bedtime";
    days = [day];
    index = 0;
    return show(true);
  }

  function openDiary() {
    if (open) return pending;
    const today = State.get().day;
    days = [];
    const upTo = State.get().again ? today : today - 1;
    for (let d = 1; d <= upTo; d++) if (entry(d)) days.push(d);
    mode = "read";
    index = Math.max(0, days.length - 1);
    return show(false);
  }

  function debug() {
    const at = (el) => {
      if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden" || el.closest(".hidden")) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      open, mode, day: open ? days[index] || null : null, pages: days.slice(), index,
      fontSize: parseFloat($("diary-text").style.fontSize) || null,
      fits: $("diary-text").scrollHeight <= $("diary-text").clientHeight + 1,
      picture: { ...at(canvas), scale: canvas.getBoundingClientRect().width / W, name: open ? pictureOf(days[index], entry(days[index])) : null },
      prev: at($("diary-prev")), next: at($("diary-next")), done: at($("diary-done")),
      words: [...root.querySelectorAll(".word")].map((s) => ({ word: s.textContent, dim: s.classList.contains("dim"), today: s.classList.contains("today"), ...at(s) })),
    };
  }

  return { bedtime, open: openDiary, close: finish, isOpen: () => open, debug };
})();
window.Diary = Diary;
