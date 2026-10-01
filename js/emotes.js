

const emoteSprite = (n) => Cues.icon(n);          // (a cue: twice as big when zoomed out, js/cues.js)
const EMOTE_TIME = 1.8;      // seconds on screen
const EMOTE_TIMES = { heat: 3.2 };   // (so hot: the sweat beads and heat squiggles stay a while)
let emotes = [];             // { who: "player" | "magpie", name, age, life }

function showEmote(who, name) {
  emotes = emotes.filter((e) => e.who !== who);
  emotes.push({ who, name, age: 0, life: EMOTE_TIMES[name] || EMOTE_TIME });
}

function updateEmotes(dt) {
  emotes.forEach((e) => (e.age += dt));
  emotes = emotes.filter((e) => e.age < e.life);
}

function drawEmotes() {
  for (const e of emotes) {
    const icon = emoteSprite(e.name);
    let head;
    if (e.who === "magpie") head = companionHeadTop();
    else { const p = playerPixelPos(); head = { x: p.x + 8, y: p.y - TILE + 1 }; }
    const t = e.age;
    const lift = t < 0.12 ? 6 * (1 - t / 0.12) : t < 0.22 ? -2 * Math.sin(((t - 0.12) / 0.1) * Math.PI) : 0;
    if (t > e.life - 0.15 && Math.floor(t * 20) % 2) continue;
    const y = Math.round(head.y - icon.height - 1 + lift), room = y - camera.y;
    const dx = room < 1 ? Math.round(icon.width / 2 + 7) : 0;
    ctx.drawImage(icon, Math.round(head.x - icon.width / 2) + dx, room < 1 ? Math.round(camera.y + 1 + lift) : y);
  }
}

function drawActCues() {
  Player.drawCues(ctx);
  const c = companion;
  if (!(c.cues && c.cues.length) && !(c.cueQueue && c.cueQueue.length)) return;
  const s = companionSprite(), f = companionFoot(), X = (u) => (c.faceLeft ? f.x + s.footX - u : f.x - s.footX + u);
  Wildlife.drawCues(ctx, c, { mouth: { x: X(s.beakX), y: f.y - s.footY + s.beakY }, head: companionHeadTop() }, { big: true });     // (the talker's notes: at a cue's size)
}
