
const Speech = (() => {
  const $ = (id) => document.getElementById(id);
  let open = false, resolveLine = null, typing = null, current = null;
  let ending = null;            // ends the line showing now (its promise resolves with null)
  function endLine() { const f = ending; ending = null; if (f) f(); }

  const VOICES = () => ({
    ...Object.fromEntries(Object.entries(BIRDS).map(([k, b]) => [k, { chirp: b.chirp || "tweet", pitch: b.chirpPitch || 2600 }])),
    husband: (window.HUSBAND && HUSBAND.voice) || { chirp: "hum", pitch: 330 },
  });

  function fill(text) {
    const name = State.get().magpieName || "Magpie";
    return text.replace(/\{name\}/g, name);
  }

  function pieces(text) {
    return text.match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
  }

  function wordSpan(piece, speaker, hintable = true, korean = undefined) {
    const s = document.createElement("span");
    s.textContent = piece;
    if (!/[A-Za-z]/.test(piece)) return s;
    const base = Words.base(piece);
    s.className = "word " + (Words.isBright(piece) ? "bright" : "dim");
    s.dataset.word = base;
    if (hintable && (!Words.isBright(piece) || Words.info(piece))) {
      s.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        showHint(piece, s, korean);
      });
    }
    return s;
  }

  function showHint(piece, el, korean = undefined) {
    const info = Words.info(piece);
    const hint = $("hint");
    const bright = Words.isBright(piece);
    hint.innerHTML = "";
    const pic = document.createElement("div");
    pic.className = "hint-picture";
    if (info && info.icon && ICONS[info.icon]) pic.appendChild(pixelIcon(info.icon, 40));
    else pic.textContent = info ? info.picture : "✨";
    const word = document.createElement("div");
    word.className = "hint-word";
    word.textContent = piece.toLowerCase();
    hint.append(pic, word);
    const own = korean !== undefined ? korean : current && current.korean;
    const ko = (own && own[Words.base(piece)]) || (info && info.korean);
    if (ko && !bright) {
      const k = document.createElement("div");
      k.className = "hint-korean";
      k.textContent = ko;
      hint.appendChild(k);
    }
    hint.classList.remove("hidden", "pop");
    void hint.offsetWidth;
    hint.classList.add("pop");
    const r = el.getBoundingClientRect();
    const w = hint.offsetWidth, h = hint.offsetHeight;
    hint.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    hint.style.top = `${r.top - h - 10 >= 8 ? r.top - h - 10 : Math.min(window.innerHeight - h - 8, r.bottom + 10)}px`;
    Sound.tap(900);
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => hint.classList.add("hidden"), 2600);
  }

  function pixelIcon(name, size) {
    const c = iconFromGrid(ICONS[name]).toCanvas();
    const k = Math.max(2, Math.round(size / c.height));
    Object.assign(c.style, { width: `${c.width * k}px`, height: `${c.height * k}px`, imageRendering: "pixelated", display: "inline-block" });
    return c;
  }

  const met = {};
  function metWord(word) {
    const b = Words.base(word);
    if (met[b]) return met[b];
    const now = current && current.text && !current.chirps && current.who !== "narrator" ? fill(current.text) : null;
    const has = now && pieces(now).some((p) => /[A-Za-z]/.test(p) && Words.base(p) === b);
    return { text: has ? now : null, who: current ? current.who : null };
  }

  function say(id, extra = {}) {
    const line = { ...LINES[id], ...extra };
    if (!line.who) return Promise.resolve(null);
    endLine();                    // (the line showing now ends first: one line at a time)
    if (typeof UI !== "undefined" && UI.hideBubble) UI.hideBubble();
    current = line;
    const box = $("speech");
    const text = $("speech-text");
    const replies = $("replies");
    text.innerHTML = "";
    replies.innerHTML = "";
    const narrator = line.who === "narrator";
    $("speech-name").textContent = narrator ? "" : line.who === "magpie" ? fill("{name}") : line.who === "husband" ? (window.HUSBAND && HUSBAND.name) || ""
      : (BIRDS[line.who] ? BIRDS[line.who].name : line.who);
    if (!narrator) drawPortrait($("portrait"), line.who, line.face || "happy");
    box.classList.toggle("narrator", narrator);
    box.classList.remove("hidden");
    box.classList.toggle("chirps", !!line.chirps);
    $("speech-next").classList.add("hidden");
    const under = $("speech-under");
    under.textContent = line.under ? fill(line.under) : "";
    under.classList.remove("shown");
    open = true;

    const voice = narrator ? null : VOICES()[line.who] || { chirp: "tweet", pitch: 2600 };
    const spans = pieces(fill(line.text)).map((p) => {
      const s = line.chirps ? Object.assign(document.createElement("span"), { textContent: p }) : wordSpan(p, line.who);
      s.classList.add("hidden-word");
      text.appendChild(s);
      return s;
    });
    if (!line.chirps && !narrator) for (const s of spans) if (s.classList.contains("dim") && s.dataset.word && !met[s.dataset.word]) met[s.dataset.word] = { text: fill(line.text), who: line.who };

    return new Promise((resolve) => {
      let i = 0, chirped = 0, timer = null, typed = false, over = false;
      const done = (value) => {
        if (over) return;
        over = true;
        clearInterval(timer);
        if (typing === timer) typing = null;
        if (ending === end) ending = null;
        resolve(value);
      };
      const end = () => done(null);
      ending = end;
      const finish = () => {
        if (typed) return;
        typed = true;
        clearInterval(timer);
        if (typing === timer) typing = null;
        spans.forEach((s) => s.classList.remove("hidden-word"));
        under.classList.add("shown");
        const choices = line.replies && line.replies.includes("?") && line.whatsThat && (State.get().wonders || 0) >= 3 && UI_TEXT.whatsThat
          ? [...line.replies, UI_TEXT.whatsThat] : line.replies;
        if (choices) {
          for (const r of choices) {
            const b = document.createElement("button");
            b.className = "reply";
            pieces(fill(r)).forEach((p) => b.appendChild(wordSpan(p, "her", false)));
            b.addEventListener("pointerdown", (e) => {
              e.stopPropagation();
              if (over) return;
              if (r === UI_TEXT.whatsThat && typeof showEmote === "function") { showEmote("player", "sparkles"); showEmote("magpie", "heart"); }
              done(r === UI_TEXT.whatsThat ? "?" : r);
              close();
            });
            replies.appendChild(b);
          }
        } else {
          $("speech-next").classList.remove("hidden");
        }
      };
      const isWord = (el) => /[A-Za-z♪]/.test(el.textContent);
      const step = () => {
        if (i >= spans.length) { finish(); return; }
        do { spans[i].classList.remove("hidden-word"); i++; } while (i < spans.length && !isWord(spans[i]));
        if (voice) Sound.chirp(voice.chirp, voice.pitch, chirped++);
      };
      while (i < spans.length && !isWord(spans[i])) spans[i++].classList.remove("hidden-word");
      step();
      timer = typing = setInterval(step, 150);
      resolveLine = () => {
        if (!typed) { finish(); if (line.early) line.early(); return false; }       // first tap: show the whole line
        if (line.replies) return false;               // she needs to choose a reply
        if (line.ready && !line.ready()) { if (line.early) line.early(); return false; }   // (the picture's moment first)
        done(null);
        close();
        return true;
      };
    });
  }

  function close() {
    open = false;
    resolveLine = null;
    $("speech").classList.add("hidden");
    $("hint").classList.add("hidden");
    endLine();                    // (a line still waiting ends: no reply)
  }

  function tap() {
    if (!open || !resolveLine) return open;
    resolveLine();
    return true;
  }

  function lightUp(word) {
    const b = Words.base(word);
    document.querySelectorAll(`.word[data-word="${b}"]`).forEach((s) => {
      s.classList.remove("dim");
      s.classList.add("bright", "twinkle");
    });
    Sound.twinkle();
  }

  function sizePortrait(canvasEl) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.round((96 * dpr) / 64));
    const size = (64 * k) / dpr;
    canvasEl.style.width = canvasEl.style.height = `${size}px`;
  }

  function drawPortrait(canvasEl, who, face) {
    sizePortrait(canvasEl);
    const g = canvasEl.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const p = renderPortrait(who, face);
    if (p) g.drawImage(p, 0, 0);
  }

  $("speech").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (open && !current.chirps) {
      let best = null;
      for (const s of $("speech-text").querySelectorAll(".word.dim[data-word]:not(.hidden-word)")) {
        const r = s.getBoundingClientRect();
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        const d = Math.hypot(dx, dy);
        if (d <= 12 && (!best || d < best.d)) best = { s, d };
      }
      if (best) { showHint(best.s.textContent, best.s); return; }
    }
    tap();
  });

  return { say, tap, lightUp, close, sizePortrait, isOpen: () => open, typing: () => !!typing, speaker: () => (current ? current.who : null), met: metWord,
    pieces, wordSpan, showHint, fill,
    lineText: () => (current && current.text && !current.chirps && current.who !== "narrator" ? fill(current.text) : null) };
})();
