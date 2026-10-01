
const DEV = false;
const PARAMS = DEV ? new URLSearchParams(location.search) : new URLSearchParams();

function dropSwitches(...names) {
  try {
    const kept = location.search.slice(1).split("&").filter((kv) => kv && !names.includes(kv.split("=")[0]));
    history.replaceState(history.state, "", location.pathname + (kept.length ? "?" + kept.join("&") : "") + location.hash);
  } catch (e) { /* (fine: it just stays in the address) */ }
}

window.STARLING_DEBUG = {
  locate() {
    const dpr = window.devicePixelRatio || 1;
    const pt = (x, y, inWorld = true) => {
      const s = gameToScreen(x, y, inWorld);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    };
    const out = {
      zoom,
      tilePoints: +(TILE * scale / dpr).toFixed(1),
      smallestTapPoints: Math.round(Math.max(TILE, minTap()) * scale / dpr),
      tilesTall: +(canvas.height / TILE).toFixed(2),
      tilesWide: +(canvas.width / TILE).toFixed(2),
      devicePixelsPerGamePixel: scale,
      started,
      closeup: Closeup.isOpen(),
    };
    out.story = Story.debug();
    if (Closeup.isOpen()) {
      out.targets = Closeup.targets().map((t) => ({ name: t.name, ...pt(t.x, t.y, false) }));
      return out;
    }
    const p = playerPixelPos();
    out.player = { ...pt(p.x + 8, p.y), tile: [player.nx, player.ny], facing: player.facing, moving: isMoving(),
      inPatch: currentPatch, sitting: !!player.sitting, onTile: WORLD.tile(player.nx, player.ny) };
    const mb = companionBox();
    out.magpie = { ...pt(mb.x + mb.w / 2, mb.y + mb.h / 2), tile: [companion.x, companion.y] };
    const seen = {};
    for (const t of WORLD.things) {
      if (!t.tappable) continue;
      const b = thingBox(t), c = pt(b.x + b.w / 2, b.y + b.h / 2);
      if (c.x < 0 || c.y < 0 || c.x > window.innerWidth || c.y > window.innerHeight) continue;
      const d = Math.hypot(c.x - out.player.x, c.y - out.player.y);
      if (!seen[t.name] || d < seen[t.name].d) seen[t.name] = { ...c, d: Math.round(d) };
    }
    out.things = seen;
    const look = document.getElementById("look-button");
    if (!look.classList.contains("hidden")) {
      const r = look.getBoundingClientRect();
      out.lookButton = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    out.emotes = emotes.map((e) => `${e.who}: ${e.name}`);
    out.scene = scene.name;
    out.story = Story.debug();
    out.birds = {};
    if (!WORLD.indoors) {
      for (const b of Wildlife.all()) {
        if (b.gone || b.underwater) continue;
        const h = Wildlife.headTop(b), c = pt(h.x, (h.y + b.y) / 2);
        if (c.x < 0 || c.y < 0 || c.x > window.innerWidth || c.y > window.innerHeight) continue;
        const d = Math.hypot(c.x - out.player.x, c.y - out.player.y);
        for (const key of new Set([b.id.replace(/-\d+$/, ""), b.species].filter(Boolean))) {
          const cur = out.birds[key], story = !!b.story;
          if (!cur || (story && !cur.story) || (story === !!cur.story && d < cur.d)) out.birds[key] = { ...c, d: Math.round(d), name: b.name, story };
        }
      }
    }
    const box = document.getElementById("speech");
    if (!box.classList.contains("hidden")) {
      const r = box.getBoundingClientRect();
      out.speech = {
        who: document.getElementById("speech-name").textContent, text: document.getElementById("speech-text").textContent,
        x: Math.round(r.right - 22), y: Math.round(r.bottom - 18),
        replies: [...document.querySelectorAll(".reply")].map((b) => { const q = b.getBoundingClientRect(); return { text: b.textContent, x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; }),
      };
    }
    if (!document.getElementById("name-card").classList.contains("hidden")) {
      const q = document.getElementById("name-ok").getBoundingClientRect();
      out.nameCard = { ok: { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) },
        choices: [...document.querySelectorAll("#name-choices button")].map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }) };
    }
    const bubble = document.getElementById("bubble");
    out.bubble = bubble.classList.contains("hidden") ? null : bubble.textContent;
    return out;
  },
  walkTo(x, y) { walkToward({ x, y }); },
  teleport(x, y, place = "garden") { if (scene.name !== place) { useScene(place); resize(); } player.hidden = false; player.tx = player.nx = x; player.ty = player.ny = y; player.progress = 1; player.path = []; standUp(); cameraGoal.x = null; },
};
