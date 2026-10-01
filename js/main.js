
if (PARAMS.has("night")) Daylight.set("night", 0);
if (["morning", "noon", "sunset", "night"].includes(PARAMS.get("phase"))) Daylight.set(PARAMS.get("phase"), 0);

let started = false;

let nextOwlCall = 0;         // (when the scops owl calls next, at night)
function update(dt, time) {
  updateEmotes(dt);
  Observatory.update(dt);
  Story.update(dt, time);
  Effects.update(dt, time);
  for (const t of WORLD.things) {
    if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt);
    if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);           // (a bush rustling: js/wildlife.js)
  }

  if (Closeup.isOpen()) {
    Closeup.update(dt);
    UI.placeBubble(gameToScreen(...Object.values(Closeup.magpieHead()), false));
    showHusbandButton();
    showCornerButtons();
    return;
  }

  if (player.hop) { player.hop.t -= dt; if (player.hop.t <= 0) player.hop = null; }
  Player.update(dt);
  for (const p of tapPops) p.age += dt;
  tapPops = tapPops.filter((p) => p.age < 0.25);
  replayBusyTap();
  followHeldFinger();
  updateStride(dt);
  benchFish(time);

  if (!isMoving()) {
    const arrivedNow = nextStep();
    throughTheDoor(arrivedNow);
    intoAPatch(arrivedNow, time);
  }
  if (openPendingCloseup(time)) return;

  updateCompanion(dt);
  Husband.update(dt);
  const view = { x: camera.x, y: camera.y, w: canvas.width, h: canvas.height };
  if (CRITTERS) CRITTERS.update(dt, time, view);
  if (WORLD.garden) Atmosphere.update(dt, time, view);
  if (WORLD.garden) River.update(dt, time, WORLD, view);
  Daylight.update(dt);
  Sky.update(dt);
  Sky.keepAbove(speechBoxTop());                 // (while the magpie talks under the sky, what it talks about stays above the box)
  if (Sky.isOpen() !== skyShown) { skyShown = Sky.isOpen(); resize(); cameraGoal.x = null; }
  Dolls.update(dt);
  if (WORLD.garden) Wildlife.update(dt, time);
  if (WORLD.garden && Daylight.phase() === "night" && time > nextOwlCall) {
    if (nextOwlCall > 0) Sound.owlCall();
    nextOwlCall = time + 9 + Math.random() * 9;
  }
  placeStarLabels();
  if (WORLD.garden && Daylight.nightAmount() > 0.3) Fireflies.update(dt, time, WORLD, view);

  if (tapMarker) {
    tapMarker.age += dt;
    if (tapMarker.age > 0.6 && !player.path.length && !isMoving()) tapMarker = null;
  }

  updateCamera(dt);

  showHusbandButton();
  showCornerButtons();
  showLookButton();
  placeTheBubble(time);
}

Backup.setup();
UI.setup({
  onMenu: () => Title.showMenu(),
  onBack: () => (Sky.isOpen() ? Sky.close() : closeCloseup()),
  onLookCloser: () => openCloseup(currentPatch),
  zoom: () => zoom,
  onZoom: setZoom,
});

if (Story && !PARAMS.has("free")) Story.prepare();

function startGame() {
  started = true;
  Sound.start();
  Sound.playMusic("day");
  if (Story && !PARAMS.has("free")) Story.start();
}

function hasProgress() {
  if (PARAMS.has("free")) return false;
  const s = State.get();
  return s.day > 1 || Object.keys(s.done).length > 0 || Object.keys(s.learned).length > 0;
}

function eraseProgress() {
  State.eraseProgress();
  State.reset();
  saved.set("closeupSeen", false);
  closeupSeen = false;
  if (Story && !PARAMS.has("free")) Story.prepare();
}

Title.setup({
  day: () => State.get().day,
  hasProgress,
  onUnlock: () => { Sound.start(); Backup.persist(); },       // (and ask the browser to keep her save for good)
  onTitleMusic: () => Sound.playMusic("night"),
  started: () => started,
  summary: () => ({ stars: Object.keys(State.get().learned).length, friends: State.get().friends || [] }),
  onContinue() {
    if (started) return;                             // (back from the menu: she just goes on)
    if (Intro && !Intro.seen() && !PARAMS.has("reset") && !PARAMS.has("free") && State.get().phase !== "night") Intro.play(startGame);
    else startGame();
  },
  storyNew: () => !!(Intro && !Intro.seen()),
  onNewGame() {
    if (started) {
      if (!PARAMS.has("free")) { State.eraseProgress(); State.reset(); saved.set("closeupSeen", false); }
      try { sessionStorage.setItem("starling.newGame", "1"); } catch (e) { /* private mode */ }     // (opened fresh, the story starts right away)
      location.href = location.pathname + (PARAMS.has("free") ? "?free" : "");
      return;
    }
    if (!PARAMS.has("free")) eraseProgress();
    if (Intro && !((PARAMS.has("reset") || PARAMS.has("free")) && !PARAMS.has("intro"))) Intro.play(startGame);
    else startGame();
  },
  onStory: Intro ? () => { Title.hide(); Intro.play(() => Title.reopen()); } : null,
  onSettings: () => UI.openSettings(),
  onBackToTitle() {
    State.save();
    Title.reopen();          // the game waits underneath; Continue goes on where she was
  },
});
try {
  if (sessionStorage.getItem("starling.newGame")) {
    sessionStorage.removeItem("starling.newGame");
    Title.hide();
    if (Intro) Intro.play(startGame); else startGame();
  }
} catch (e) { /* private mode */ }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (Title.isOpen() || (Intro && Intro.isOpen())) { requestAnimationFrame(frame); return; }     // they draw their own skies
  update(dt, now / 1000);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

