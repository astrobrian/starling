
function buttonRects(extra = "") {
  const out = [];
  for (const b of document.querySelectorAll("#menu-button, .side-button, .corner-button" + (extra ? ", " + extra : ""))) {
    if (b.classList.contains("hidden") || !b.getClientRects().length) continue;
    out.push(b.getBoundingClientRect());
  }
  return out;
}
function buttonBoxes(extra = "") {
  const k = (window.devicePixelRatio || 1) / scale, cr = canvas.getBoundingClientRect();     // k: game pixels per point
  return buttonRects(extra).map((b) => ({ x: camera.x + (b.left - cr.left) * k, y: camera.y + (b.top - cr.top) * k, w: b.width * k, h: b.height * k }));
}

function sideIcon(el, source, points) {
  const dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round((points * dpr) / source.width));
  el.style.width = (source.width * k) / dpr + "px";
  el.style.height = (source.height * k) / dpr + "px";
}

let sideTapAt = 0;
const sideTapOk = () => { const now = performance.now(); if (now - sideTapAt < 700) return false; sideTapAt = now; return true; };

const husbandButton = document.getElementById("husband-button");
function sideIconCanvas(src, into = document.createElement("canvas")) {
  into.width = into.height = 20;
  const g = into.getContext("2d");
  g.clearRect(0, 0, 20, 20);
  g.drawImage(src, Math.floor((20 - src.width) / 2), Math.ceil((20 - src.height) / 2));
  into.className = "side-face";
  sideIcon(into, into, 34);
  return into;
}
husbandButton.prepend(sideIconCanvas(renderHusbandHead()));
husbandButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const kind = Husband.button();
  if (kind === "wait" || !sideTapOk()) return;
  if (kind === "call") Husband.call();
  else if (kind === "bye") Husband.bye();
  Sound.tap(700);
});
let husbandButtonKind = undefined;
const OVER_CARDS = ["doll-card", "sleep-card", "name-card", "day-card"].map((id) => document.getElementById(id)).filter(Boolean);
const cardOver = () => OVER_CARDS.some((el) => !el.classList.contains("hidden"));
function showHusbandButton() {
  const kind = cardOver() ? null : Husband.button();
  if (kind !== husbandButtonKind) {
    husbandButtonKind = kind;
    husbandButton.classList.toggle("hidden", !kind);
    husbandButton.classList.toggle("waiting", kind === "wait");
    if (kind) husbandButton.querySelector("span").textContent = kind === "call" ? UI_TEXT.callHusband : kind === "bye" ? UI_TEXT.byeForNow : "…";
  }
  const free = started && !changingPlace && !Closeup.isOpen() && !Sky.isOpen() && !(Speech && Speech.isOpen()) && !(Story && Story.busy()) && !player.hidden
    && !(Story && Story.inRoutine && Story.inRoutine()) && !cardOver();          // (our morning, our evening: they stay home)
  const visit = !free ? null : WORLD.small ? "home" : "visit";
  if (visit !== visitButtonKind) {
    visitButtonKind = visit;
    visitButton.classList.toggle("hidden", !visit);
    if (visit) {
      visitButton.querySelector("span").textContent = visit === "home" ? UI_TEXT.goHome : UI_TEXT.visitHusband;
      sideIconCanvas(visitIcons[visit], visitIcon);
    }
  }
  visitButton.classList.toggle("second", !!kind);
  measureSideColumn();
}

let sideColumn = null;
function measureSideColumn() {
  for (const b of [husbandButton, visitButton]) {
    if (b.classList.contains("hidden") || !b.getClientRects().length) continue;
    const r = b.getBoundingClientRect(), fromRight = window.innerWidth - r.left, c = sideColumn;
    sideColumn = c ? { fromRight: Math.max(c.fromRight, fromRight), top: Math.min(c.top, r.top), bottom: Math.max(c.bottom, r.bottom) } : { fromRight, top: r.top, bottom: r.bottom };
  }
}
window.addEventListener("resize", () => { sideColumn = null; });
function showCornerButtons() {
  const playing = started && !(Title.isOpen && Title.isOpen()) && !cardOver();
  UI.showCornerButtons(playing, zoomCounts() && !upCloseShown);
}
const visitButton = document.getElementById("visit-button");
const visitIcons = { visit: iconFromGrid(ICONS.observatory).toCanvas(), home: iconFromGrid(ICONS.cottage).toCanvas() };
const visitIcon = sideIconCanvas(visitIcons.visit);     // the observatory, or her cottage ("Go home")
visitButton.prepend(visitIcon);
let visitButtonKind = undefined;
visitButton.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!sideTapOk()) return;
  if (visitButtonKind === "visit") visitObservatory();
  else if (visitButtonKind === "home") goHome();
  Sound.tap(700);
});
