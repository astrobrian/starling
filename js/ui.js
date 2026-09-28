
const UI = (() => {
  const $ = (id) => document.getElementById(id);

  function iconImage(name, scale) {
    const c = iconFromGrid(ICONS[name]).toCanvas();
    const img = new Image();
    img.src = c.toDataURL();
    img.width = c.width * scale;
    img.height = c.height * scale;
    img.className = "pixel-icon";
    img.alt = "";
    return img;
  }

  function setup({ onMenu, onBack, onLookCloser, zoom, onZoom }) {
    $("menu-button").appendChild(iconImage("menu", 3));
    $("menu-button").setAttribute("aria-label", UI_TEXT.menu);
    $("menu-button").addEventListener("click", onMenu);

    $("settings-title").textContent = UI_TEXT.settings;
    $("music-label").textContent = UI_TEXT.music;
    $("sound-label").textContent = UI_TEXT.sounds;
    $("settings-done").textContent = UI_TEXT.done;
    $("settings-version").textContent = `${UI_TEXT.version} ${window.GAME_VERSION || ""}`;

    $("zoom-label").textContent = UI_TEXT.zoom;
    const zoomRow = $("zoom-choices");
    for (const z of ["close", "normal", "far", "wide"]) {
      const btn = document.createElement("button");
      btn.textContent = UI_TEXT["zoom_" + z];
      btn.dataset.zoom = z;
      btn.addEventListener("click", () => {
        onZoom(z);
        zoomRow.querySelectorAll("button").forEach((b) => b.classList.toggle("chosen", b.dataset.zoom === z));
      });
      btn.classList.toggle("chosen", zoom() === z);
      zoomRow.appendChild(btn);
    }
    $("music-volume").value = Sound.settings.music * 100;
    $("sound-volume").value = Sound.settings.sound * 100;
    $("music-volume").addEventListener("input", (e) => Sound.setVolume("music", e.target.value / 100));
    $("sound-volume").addEventListener("change", (e) => Sound.setVolume("sound", e.target.value / 100));
    $("settings-done").addEventListener("click", () => $("settings").classList.add("hidden"));
    $("settings").addEventListener("pointerdown", (e) => {
      if (e.target === $("settings")) $("settings").classList.add("hidden");
    });

    $("back-button").appendChild(iconImage("back", 3));
    $("back-button").addEventListener("click", onBack);
    $("look-button").appendChild(iconImage("magnifier", 3));
    $("look-button").addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); onLookCloser(); });
  }

  let bubbleTimer = null, bubbleWordTimer = null, bubbleAnchor = null;

  function say(text, voice = {}, anchor = null) {
    const el = $("bubble"), words = text.split(" ");
    clearTimeout(bubbleTimer);
    clearInterval(bubbleWordTimer);
    el.innerHTML = "";
    const spans = words.map((w) => {
      const s = document.createElement("span");
      s.className = "word";
      s.textContent = w;
      el.appendChild(s);
      return s;
    });
    el.classList.remove("hidden", "pop");
    void el.offsetWidth;            // restart the pop animation
    el.classList.add("pop");
    el.classList.toggle("small", !!voice.small);
    bubbleAnchor = anchor;
    let i = 0;
    const next = () => {
      if (i >= spans.length) { clearInterval(bubbleWordTimer); return; }
      spans[i].classList.add("shown");
      Sound.chirp(voice.chirp, voice.pitch, i);
      i++;
    };
    next();
    bubbleWordTimer = setInterval(next, 170);
    bubbleTimer = setTimeout(() => el.classList.add("hidden"), 1600 + words.length * 400);
  }

  function hideBubble() {
    clearTimeout(bubbleTimer);
    clearInterval(bubbleWordTimer);
    $("bubble").classList.add("hidden");
  }

  function placeBubble(point, avoid = null, lean = 0, clear = null, feet = null) {
    const el = $("bubble");
    if (!point || el.classList.contains("hidden")) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const rightEdge = () => {
      let r = window.innerWidth - 8;
      for (const b of document.querySelectorAll("#menu-button, .side-button")) {
        if (b.classList.contains("hidden") || !b.getClientRects().length) continue;
        const q = b.getBoundingClientRect();
        if (y < q.bottom + 4 && y + h > q.top - 4) r = Math.min(r, q.left - 6);
      }
      return r;
    };
    let y = point.y - h - 10;
    let x = Math.max(8, Math.min(rightEdge() - w, point.x - w * (lean > 0 ? 0.2 : lean < 0 ? 0.8 : 0.5)));
    const overHer = () => avoid && x < avoid.x + avoid.w && x + w > avoid.x && y + h > avoid.y && y < avoid.y + avoid.h;
    let below = false;
    const underFeet = () => { below = true; y = feet + 12; x = Math.max(8, Math.min(rightEdge() - w, point.x - w / 2)); };
    if (overHer()) {
      const talkerLeft = point.x < avoid.x + avoid.w / 2;
      const slid = talkerLeft ? Math.max(point.x + 14 - w, Math.min(x, avoid.x - w - 4)) : Math.min(point.x - 14, Math.max(x, avoid.x + avoid.w + 4));
      x = Math.max(8, Math.min(rightEdge() - w, slid));
      if (overHer()) {
        if (feet !== null && point.y > avoid.y + avoid.h / 2) underFeet();
        else {
          y = avoid.y - h - 6;
          x = Math.max(8, Math.min(rightEdge() - w, talkerLeft ? point.x - w * 0.75 : point.x - w * 0.25));
        }
      }
    }
    if (!below && y < 8 && feet !== null) underFeet();
    y = Math.max(8, y);
    x = Math.max(8, Math.min(rightEdge() - w, x));
    const hitsClear = () => clear && x < clear.x + clear.w && x + w > clear.x && y < clear.y + clear.h && y + h > clear.y;
    if (hitsClear()) {
      x = clear.x + clear.w / 2 < point.x ? Math.max(x, Math.min(point.x - 14, clear.x + clear.w + 4)) : Math.min(x, Math.max(point.x + 14 - w, clear.x - w - 4));
      x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
      if (hitsClear()) { below = true; y = clear.feet + 12; x = Math.max(8, Math.min(window.innerWidth - w - 8, point.x - w / 2)); }
    }
    el.classList.toggle("below", below);
    el.style.left = `${Math.round(x)}px`;          // (left/top, so its pop grows in place)
    el.style.top = `${Math.round(y)}px`;
    el.style.setProperty("--tail-x", `${Math.round(Math.max(14, Math.min(w - 14, point.x - x)))}px`);
  }

  let tinyTimer = null;
  function tinySay(text, point) {
    const el = $("tiny-bubble");
    el.textContent = text;
    el.classList.remove("hidden", "pop");
    void el.offsetWidth;
    el.classList.add("pop");
    el.style.left = `${Math.round(point.x - 20)}px`;
    el.style.top = `${Math.round(point.y - 44)}px`;
    clearTimeout(tinyTimer);
    tinyTimer = setTimeout(() => el.classList.add("hidden"), 1300);
  }

  function showBack(on) { $("back-button").classList.toggle("hidden", !on); }

  function showLook(point) {
    const el = $("look-button");
    el.classList.toggle("hidden", !point);
    if (point) el.style.transform = `translate(${Math.round(point.x - 22)}px, ${Math.round(point.y - 44)}px)`;
  }

  const bubbleShowing = () => !$("bubble").classList.contains("hidden");

  return {
    openSettings: () => $("settings").classList.remove("hidden"),
    setup, say, hideBubble, placeBubble, tinySay, showBack, showLook, bubbleShowing, bubbleAnchor: () => bubbleAnchor };
})();
