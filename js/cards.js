
const Cards = (() => {
  async function show(title, sub = "", seconds = 3, icon = "star", tapAfter = 1.5, low = false, wait = (s) => new Promise((ok) => setTimeout(ok, s * 1000))) {
    const el = document.getElementById("day-card");
    el.classList.toggle("low", Sky.isOpen() || low);
    document.getElementById("day-card-text").textContent = title;
    document.getElementById("day-card-sub").textContent = sub;
    const iconBox = document.getElementById("day-card-icon");
    iconBox.innerHTML = "";
    const c = iconFromGrid(ICONS[icon] || ICONS.star).toCanvas();
    const img = document.createElement("img");
    img.src = c.toDataURL(); img.className = "pixel-icon"; img.width = c.width * 5; img.height = c.height * 5;
    iconBox.appendChild(img);
    el.classList.remove("hidden");
    let skip = null, over = false;
    const tapped = new Promise((ok) => { skip = ok; });
    const onTap = () => skip();
    setTimeout(() => { if (!over) window.addEventListener("pointerdown", onTap, { once: true }); }, tapAfter * 1000);
    await Promise.race([wait(seconds), tapped]);
    over = true;
    window.removeEventListener("pointerdown", onTap);
    el.classList.add("hidden");
  }

  function doll() {
    return new Promise((ok) => {
      const $ = (x) => document.getElementById(x);
      const card = $("doll-card"), choices = $("doll-choices"), picked = $("doll-picked");
      $("doll-ask").textContent = DOLL_TEXT.ask;
      choices.innerHTML = "";
      choices.classList.remove("chosen");
      picked.classList.add("hidden");
      let chosen = null;
      for (const d of DOLLS) {
        const btn = document.createElement("button");
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const sp = renderDoll(d.id, "sit");
        c.getContext("2d").drawImage(sp.canvas, Math.round(12 - sp.canvas.width / 2), 24 - sp.canvas.height);
        const label = document.createElement("span");
        label.textContent = d.name;
        btn.append(c, label);
        btn.addEventListener("click", () => {
          if (chosen) return;
          chosen = d.id;
          btn.classList.add("picked");
          choices.classList.add("chosen");
          picked.textContent = dollText("picked", d.id);
          picked.classList.remove("hidden");
          Sound.hearts();
          let closed = false;
          const close = () => { if (closed) return; closed = true; card.onpointerdown = null; card.classList.add("hidden"); ok(d.id); };
          setTimeout(close, 1200);
          setTimeout(() => { if (!closed) card.onpointerdown = close; }, 250);      // a tap goes on at once
        });
        choices.appendChild(btn);
      }
      card.classList.remove("hidden");
    });
  }

  function sleep(onYes) {
    const $ = (x) => document.getElementById(x);
    const card = $("sleep-card");
    if (!card || !card.classList.contains("hidden")) return;
    $("sleep-card-text").textContent = UI_TEXT.sleepAsk;
    $("sleep-yes").textContent = UI_TEXT.sleepYes;
    $("sleep-no").textContent = UI_TEXT.sleepNo;
    const box = $("sleep-card-icon");
    box.innerHTML = "";
    const c = iconFromGrid(ICONS.zzz || ICONS.star).toCanvas();
    const img = document.createElement("img");
    img.src = c.toDataURL(); img.className = "pixel-icon"; img.width = c.width * 4; img.height = c.height * 4;
    box.appendChild(img);
    const close = () => { card.classList.add("hidden"); $("sleep-yes").onclick = null; $("sleep-no").onclick = null; };
    $("sleep-no").onclick = () => { close(); Sound.tap(700); };
    $("sleep-yes").onclick = () => { close(); Sound.tap(900); onYes(); };
    card.classList.remove("hidden");
    Sound.tap(600);
  }

  function nameMagpie() {
    return new Promise((ok) => {
      const card = document.getElementById("name-card");
      const input = document.getElementById("name-input");
      const choices = document.getElementById("name-choices");
      const portrait = document.getElementById("name-portrait");
      Speech.sizePortrait(portrait);
      const g = portrait.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 64, 64);
      g.drawImage(renderPortrait("magpie", "curious"), 0, 0);
      input.value = "";
      choices.innerHTML = "";
      for (const n of MAGPIE_NAMES) {
        const b = document.createElement("button");
        b.textContent = n;
        b.addEventListener("click", () => { input.value = n; Sound.tap(700); });
        choices.appendChild(b);
      }
      const okButton = document.getElementById("name-ok");
      okButton.textContent = "✓";
      const finish = () => {
        const name = input.value.trim().slice(0, 12) || MAGPIE_NAMES[0];
        card.classList.add("hidden");
        okButton.onclick = null;
        input.blur();
        ok(name);
      };
      okButton.onclick = finish;
      input.onkeydown = (e) => { if (e.key === "Enter") finish(); };
      card.classList.remove("hidden");
    });
  }

  return { show, doll, sleep, nameMagpie };
})();
