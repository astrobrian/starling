
const flowerCache = {};

function renderFlower(speciesName, color, variant = 0) {
  const key = `${speciesName}/${color}/${variant}`;
  if (flowerCache[key]) return flowerCache[key];
  const sp = FLOWERS[speciesName];
  const tall = sp.size === "tall";
  const frames = [-1, 0, 1].map((sway) => {
    const b = new PixelBuffer(14, tall ? 30 : 14);
    const layout = flowerLayout(sp, variant);
    const baseY = b.h - 0.5;
    const stem = layout.stem || "leaf";
    for (const leaf of layout.leaves) b.rotEllipse(...leaf, "leaf");
    if (layout.back) layout.back(b, sway);
    for (const [x0, y0, x1, y1, w, lean] of layout.stalks || []) b.line(x0, y0, x1 + sway * lean, y1, w, stem, { flat: false });
    for (const bl of layout.blooms) {
      const lean = sway * bl.lean;
      const [fx, fy] = bl.from ? [bl.from[0] + sway * (bl.from[2] || 0), bl.from[1]] : [bl.stemX, baseY];
      b.line(fx, fy, bl.x + lean, bl.y, bl.stemW || 1, stem, { flat: false });
    }
    for (const bl of layout.blooms) drawBloom(b, sp, color, bl.x + sway * bl.lean, bl.y, bl.r);
    for (const [x, y, rx, ry, a, lean] of layout.over || []) b.rotEllipse(x + sway * (lean || 0), y, rx, ry, a, "leaf");
    return outline(b).toCanvas();
  });
  return (flowerCache[key] = { frames, tall, w: 16, h: tall ? 32 : 16 });
}

function flowerLayout(sp, variant) {
  const j = (i) => (hash2(variant, i, 91) - 0.5) * 1.6;   // small jitter
  switch (sp.shape) {
    case "daisy":
      return {
        blooms: [
          { x: 3.8 + j(1), y: 6 + j(2), r: 2.6, stemX: 6, lean: 1 },
          { x: 9.6 + j(3), y: 3.6 + j(4), r: 3, stemX: 7.5, lean: 1 },
          { x: 7 + j(5), y: 9.2, r: 2.3, stemX: 7, lean: 0.5 },
        ],
        leaves: [[4.5, 12.4, 3, 1.3, -0.4], [9.6, 12.4, 3, 1.3, 0.4]],
      };
    case "tulip":
      return {
        blooms: [
          { x: 4.6 + j(1), y: 5.2 + j(2), r: 2.9, stemX: 6, lean: 1 },
          { x: 9.8 + j(3), y: 6.8 + j(4), r: 2.9, stemX: 8, lean: 1 },
        ],
        leaves: [[4, 11, 1.4, 3.6, -0.5], [10.2, 11.2, 1.4, 3.6, 0.5], [7, 11.8, 1.3, 2.8, 0]],
      };
    case "rose":
      return {
        blooms: [
          { x: 6.6 + j(1), y: 5.4 + j(2), r: 3.8, stemX: 7, lean: 1 },
          { x: 11 + j(3) * 0.5, y: 9, r: 2, stemX: 8.5, lean: 0.5 },
        ],
        leaves: [[3.6, 10.6, 2.4, 1.4, -0.5], [9.8, 12, 2.4, 1.4, 0.4], [5.6, 12.6, 2.2, 1.3, 0.3]],
      };
    case "sunflower":
      return {
        blooms: [{ x: 7, y: 6.8, r: 5.9, stemX: 7, lean: 1, stemW: 2 }],
        leaves: [[3.4, 17.4, 3.6, 1.8, -0.5], [10.6, 20.6, 3.6, 1.8, 0.5], [4, 25, 3.2, 1.6, -0.3]],
      };
    case "cosmos":
      return {
        blooms: [
          { x: 4.6 + j(1), y: 5 + j(2), r: 4.2, stemX: 6.5, lean: 1 },
          { x: 10 + j(3) * 0.5, y: 12.2 + j(4), r: 3.6, stemX: 7.5, lean: 1 },
        ],
        leaves: [[4.4, 20, 2.4, 0.9, -0.7], [9.8, 23, 2.4, 0.9, 0.7], [5, 26, 2.2, 0.9, -0.5]],
      };
    case "balsam": {
      const s = hash2(variant, 7, 91) > 0.5 ? 1 : -1;
      return {
        stem: "#A3C07A",
        stalks: [[7, 13.5, 7 + j(1) * 0.3, 2.6, 1.3, 1]],
        leaves: [[3.5, 11, 3.2, 1.1, 0.55], [10.5, 10.2, 3.2, 1.1, -0.55], [9.6, 12.8, 2.4, 0.9, -0.25]],
        blooms: [
          { x: 7 - 2.5 * s, y: 5.7, r: 2.35, from: [7, 6.4, 0.7], lean: 0.75 },
          { x: 7 + 2.6 * s, y: 7.8, r: 2.35, from: [7, 8.4, 0.5], lean: 0.55 },
          { x: 7 - 2.3 * s, y: 10, r: 2, from: [7, 10.4, 0.3], lean: 0.35 },
        ],
        over: [[4.3, 2.9, 3.1, 0.95, -0.5, 1], [9.7, 3.1, 3.1, 0.95, 0.5, 1], [7.2, 1.7, 0.95, 2.1, 0, 1]],
      };
    }
    case "zinnia":
      return {
        blooms: [
          { x: 7.2 + j(1) * 0.6, y: 4.8 + j(2) * 0.4, r: 4.4, stemX: 7, lean: 1 },
          { x: 11.3, y: 9.8 + j(3) * 0.3, r: 2.3, stemX: 8.5, lean: 0.5 },
        ],
        leaves: [[3.9, 11.6, 2.9, 1.25, -0.35], [10.4, 12.6, 2.4, 1.1, 0.3], [5.2, 9.2, 2.2, 0.95, -0.7]],
      };
    case "mossRose":
      return {
        stem: "#C98A74",
        leaves: [],
        blooms: [
          { x: 3.9 + j(1) * 0.4, y: 8.3, r: 2.7, stemX: 5, lean: 0.4 },
          { x: 10 + j(3) * 0.4, y: 7.2 + j(4) * 0.3, r: 2.9, stemX: 8.5, lean: 0.4 },
          { x: 7.1, y: 11, r: 2.2, stemX: 7, lean: 0.2 },
        ],
        back: (b) => {
          const R = rampFor("#8DC07A");
          const sprigs = [[1.5, 12.5], [3.5, 11.5], [5.8, 12.8], [8.6, 12.6], [11, 11.4], [12.6, 12.8], [6.2, 9.4], [12.4, 9.6], [1.6, 10]];
          sprigs.forEach(([x, y], i) => {
            for (const [a, len] of [[-2.3, 2.4], [-1.57, 3], [-0.85, 2.4]]) {
              const aa = a + (hash2(variant, i, 93) - 0.5) * 0.5, n = Math.round(len + hash2(variant, i, 94));
              for (let k = 0; k < n; k++) b.set(Math.round(x + Math.cos(aa) * k), Math.round(y + Math.sin(aa) * k), R[k === n - 1 ? 0 : k === 0 ? 2 : 1]);
            }
          });
        },
      };
  }
}

function drawBloom(b, sp, color, cx, cy, r) {
  const head = [cx, cy, r, r];
  const radial = (n, len, wid, tilt = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + tilt;
      b.rotEllipse(cx + Math.cos(a) * r * len, cy + Math.sin(a) * r * len * 0.9,
        r * wid[0], r * wid[1], a, color, { shadeAs: head });
    }
  };
  const seams = (n, from, to, tilt, band = 2) => {
    if (r < 6) return;
    const R = rampFor(color);
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2 + tilt;
      for (let d = from; d <= to; d += 0.4 / r) {
        const x = Math.floor(cx + Math.cos(a) * r * d), y = Math.floor(cy + Math.sin(a) * r * d * 0.9);
        if (b.get(x, y)) b.set(x, y, R[band]);
      }
    }
  };
  switch (sp.shape) {
    case "daisy":
      if (r < 4) {                       // tiny: a soft disk with a dot
        b.circle(cx, cy, r, color, { shadeAs: head });
      } else radial(sp.petals, 0.58, [0.45, 0.2]);
      b.circle(cx, cy, Math.max(0.9, r * 0.38), sp.center, { flat: true });
      break;
    case "tulip":
      b.polygon([
        [cx - r * 0.95, cy - r * 0.8], [cx - r * 0.45, cy - r * 0.2], [cx, cy - r * 1.05],
        [cx + r * 0.45, cy - r * 0.2], [cx + r * 0.95, cy - r * 0.8], [cx + r * 0.9, cy + r * 0.45],
        [cx + r * 0.45, cy + r * 0.95], [cx - r * 0.45, cy + r * 0.95], [cx - r * 0.9, cy + r * 0.45],
      ], color, { shadeAs: head });
      break;
    case "rose":
      b.circle(cx, cy, r, color, { shadeAs: head });
      if (r >= 3) {
        const ramp = rampFor(color);
        b.circle(cx + 0.2, cy + 0.1, r * 0.62, ramp[2], { flat: true });
        b.circle(cx - 0.2, cy - 0.3, r * 0.42, ramp[1], { flat: true });
        b.circle(cx - 0.4, cy - 0.5, r * 0.2, ramp[0], { flat: true });
      }
      break;
    case "sunflower":
      radial(sp.petals, 0.66, [0.42, 0.2], 0.2);
      b.circle(cx, cy, r * 0.46, sp.center, { shadeAs: [cx, cy, r * 0.5, r * 0.5] });
      break;
    case "cosmos":
      radial(sp.petals, 0.56, [0.5, 0.3], 0.3);
      b.circle(cx, cy, Math.max(0.9, r * 0.26), sp.center, { flat: true });
      break;
    case "balsam": {
      const R = rampFor(color);
      if (r < 3) {
        b.circle(cx, cy, r, color, { shadeAs: head });
        b.set(Math.floor(cx + 0.2), Math.floor(cy + 0.2), R[2]);          // the cup
        b.set(Math.floor(cx - 0.8), Math.floor(cy - 0.8), R[0]);
        break;
      }
      radial(6, 0.52, [0.5, 0.42], 0.3);
      seams(6, 0.5, 0.92, 0.3);
      b.circle(cx + r * 0.06, cy + r * 0.06, r * 0.52, R[2], { flat: true });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 1.1, lit = Math.cos(a + 2.2) > 0.2;
        b.rotEllipse(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.2, r * 0.26, r * 0.17, a, R[lit ? 0 : 1], { flat: true });
      }
      b.circle(cx, cy, Math.max(0.6, r * 0.1), sp.center, { flat: true });
      break;
    }
    case "zinnia": {
      b.circle(cx, cy, r * 0.8, color, { shadeAs: head });
      radial(sp.petals, 0.72, [0.3, 0.25]);
      seams(sp.petals, 0.56, 0.92, 0);
      if (r >= 3.4) b.circle(cx - r * 0.05, cy - r * 0.05, r * 0.52, color, { shadeAs: [cx - r * 0.2, cy - r * 0.2, r * 0.62, r * 0.62] });
      seams(8, 0.3, 0.5, 0.2);
      const cr = Math.max(0.7, r * 0.2);
      b.circle(cx, cy, cr + (r >= 3.4 ? Math.max(0.9, r * 0.12) : 0), "beeYellow", { flat: true });
      b.circle(cx, cy, cr, sp.center, { flat: true });
      break;
    }
    case "mossRose": {
      radial(sp.petals, 0.46, [0.56, 0.5], -Math.PI / 2);
      seams(sp.petals, 0.3, 0.8, -Math.PI / 2);
      if (r >= 2.5) b.circle(cx + 0.2, cy + 0.2, r * 0.5, rampFor(color)[2], { flat: true, onlyFilled: true });
      b.circle(cx, cy, Math.max(0.8, r * 0.28), sp.center, { flat: true });
      break;
    }
  }
}

function flowerName(speciesName, color) {
  const word = COLOR_WORDS[color];
  return word ? `${word} ${FLOWERS[speciesName].name}` : FLOWERS[speciesName].name;
}
