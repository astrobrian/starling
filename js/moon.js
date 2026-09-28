
const Moon = (() => {
  const SYNODIC = 29.530589;

  function lunarDate(day) {
    const row = (window.MOON_NIGHTS || []).find((n) => n.day === day);
    let month, d;
    if (row) [month, d] = row.lunar;
    else if (day <= 23) { month = 6; d = day + 6; }
    else if (day <= 53) { month = 7; d = day - 23; }
    else { month = 8; d = day - 53; }
    const fmt = (window.MOON_TEXT && MOON_TEXT.lunarDate) || "음력 {month}월 {day}일";
    return { month, day: d, korean: fmt.replace("{month}", month).replace("{day}", d) };
  }

  function forDay(day) {
    const nights = window.MOON_NIGHTS || [];
    let n = Math.max(0, Math.round(day || 0));
    let row = nights.find((x) => x.day === n);
    if (!row && nights.length) row = nights.find((x) => x.day === 1 + ((n - 1) % 29)) || nights[nights.length - 1];
    row = row || { day: n, lunar: [6, 7], age: 6.8, lit: 0.43, waxing: true, phase: "firstQuarter", up: true, dir: "southwest", height: "middle", alt: 31, az: 228 };
    const phases = (window.MOON_TEXT && MOON_TEXT.phases) || {};
    return {
      ...row,
      day: n,
      angle: (row.age / SYNODIC) * 360,                  // how far round from the sun (0 new, 180 full)
      text: phases[row.phase] || { name: "moon", korean: "달", emoji: "🌙" },
      lunarLabel: lunarDate(n).korean,
    };
  }

  const LIT = () => [PALETTE.cream, mix(PALETTE.starlight, PALETTE.cream, 0.45), mix(PALETTE.starlight, PALETTE.starBright, 0.6), mix(PALETTE.starBright, PALETTE.starBand, 0.45)];
  const DARK = () => mix(PALETTE.night2, PALETTE.night3, 0.5);
  const RIM_LIT = () => mix(PALETTE.starBand, PALETTE.night3, 0.25);
  const RIM_DARK = () => mix(PALETTE.nightIndigo, PALETTE.night1, 0.5);

  const SEAS = [
    [0.66, -0.3, 0.12, false],   // Crisium
    [0.28, -0.34, 0.16, true],   // Serenitatis
    [0.36, 0.02, 0.17, true],    // Tranquillitatis
    [0.6, 0.2, 0.13, false],     // Fecunditatis
    [0.34, 0.38, 0.1, false],    // Nectaris
    [-0.3, -0.42, 0.22, true],   // Imbrium
    [-0.56, 0.02, 0.26, true],   // Procellarum
    [-0.18, 0.46, 0.13, false],  // Nubium
  ];

  const cache = {};
  function sprite(r, info) {
    info = info || forDay(1);
    const angle = ((info.angle % 360) + 360) % 360;
    const psi = angle <= 180 ? angle : 360 - angle;     // 0: new, 90: half, 180: full
    const side = angle <= 180 ? 1 : -1;                  // lit on the right (waxing) or the left (waning)
    const key = `${r}|${Math.round(psi)}|${side}`;
    if (cache[key]) return cache[key];
    const lit = LIT(), dark = DARK();
    const n = 2 * r;
    const inDisc = (x, y) => x >= 0 && y >= 0 && x < n && y < n && (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r;
    const sx = side * Math.sin((psi * Math.PI) / 180), sz = -Math.cos((psi * Math.PI) / 180);
    const band = [];                                      // per pixel: -1 dark, 0..3 lit bands
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!inDisc(x, y)) { band.push(null); continue; }
      const nx = (x + 0.5 - r) / r, ny = (y + 0.5 - r) / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const mu0 = nx * sx + nz * sz;                      // how straight on the sunlight falls here
      const rim = !inDisc(x - 1, y) || !inDisc(x + 1, y) || !inDisc(x, y - 1) || !inDisc(x, y + 1);
      const sliver = psi > 12 && psi < 90 && !inDisc(x + side, y) && Math.abs(ny) < 0.8;
      if (mu0 <= 0 && !sliver) { band.push(-1); continue; }
      const b = Math.max(0, mu0) / (Math.max(0, mu0) + nz + 1e-6) + (rim ? 0.12 : 0);
      band.push(b > 0.6 ? 0 : b > 0.3 ? 1 : b > 0.12 ? 2 : 3);
    }
    const seaPx = new Set();
    for (const [mx, my, mr, small] of SEAS) {
      if (r < 8 && !small) continue;
      const cx = r + mx * r, cy = r + my * r, rr = Math.max(0.5, mr * r * (r < 8 ? 1.15 : 1));
      let found = false;
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr * rr) { seaPx.add(y * n + x); found = true; }
      }
      if (!found) seaPx.add(Math.floor(cy) * n + Math.floor(cx));
    }
    const buf = new PixelBuffer(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const b = band[y * n + x];
      if (b === null) continue;
      if (b < 0) { buf.set(x, y, dark); continue; }
      const rim = !inDisc(x - 1, y) || !inDisc(x + 1, y) || !inDisc(x, y - 1) || !inDisc(x, y + 1);
      const sea = seaPx.has(y * n + x) && !rim && b < 3;
      buf.set(x, y, lit[Math.min(3, b + (sea ? 1 : 0))]);
    }
    const out = new PixelBuffer(n + 2, n + 2);
    out.stamp(buf, 1, 1);
    const litSet = new Set(lit.map((c) => c.toLowerCase()));
    for (let y = 0; y < n + 2; y++) for (let x = 0; x < n + 2; x++) {
      if (out.get(x, y)) continue;
      const near = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => buf.get(x - 1 + dx, y - 1 + dy)).filter(Boolean);
      if (!near.length) continue;
      out.set(x, y, near.some((c) => litSet.has(c.toLowerCase())) ? RIM_LIT() : RIM_DARK());
    }
    const c = out.toCanvas();
    c.r = r;
    return (cache[key] = c);
  }

  function draw(ctx, x, y, r, info) {
    const s = sprite(r, info);
    const k = info.lit, glowX = x + (info.waxing ? 1 : -1) * Math.round(r * (1 - k) * 0.6);
    if (k > 0.02) Daylight.drawLight(ctx, glowX, y, Math.round(r * (2.2 + k)), "starBright", 0.25 + 0.45 * k);
    ctx.drawImage(s, Math.round(x) - r - 1, Math.round(y) - r - 1);
  }

  return { forDay, sprite, lunarDate, draw };
})();
