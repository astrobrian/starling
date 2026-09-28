
class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null); // hex color or null (empty)
  }

  get(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  set(x, y, color) {
    x = Math.floor(x); y = Math.floor(y);            // always a whole pixel
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = color ? paletteColor(color) : null;
  }

  fillShape(bounds, inside, norm, paint, opts = {}) {
    const x0 = Math.max(0, Math.floor(bounds.x0)), x1 = Math.min(this.w - 1, Math.ceil(bounds.x1));
    const y0 = Math.max(0, Math.floor(bounds.y0)), y1 = Math.min(this.h - 1, Math.ceil(bounds.y1));
    const shades = opts.flat === true ? null : rampFor(paint);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        if (!inside(cx, cy)) continue;
        if (opts.onlyFilled && !this.get(x, y)) continue;
        if (opts.clip && !opts.clip(x, y)) continue;
        let color;
        if (shades) {
          const [nx, ny] = opts.shadeAs
            ? [(cx - opts.shadeAs[0]) / opts.shadeAs[2], (cy - opts.shadeAs[1]) / opts.shadeAs[3]]
            : norm(cx, cy);
          color = shades[shadeBand(nx, ny, opts.light)];
        } else {
          color = paletteColor(paint);
        }
        this.px[y * this.w + x] = color;
      }
    }
    return this;
  }

  rect(x, y, w, h, paint, opts) {
    return this.fillShape(
      { x0: x, y0: y, x1: x + w, y1: y + h },
      (cx, cy) => cx >= x && cx < x + w && cy >= y && cy < y + h,
      (cx, cy) => [((cx - x) / w) * 2 - 1, ((cy - y) / h) * 2 - 1],
      paint, opts);
  }

  ellipse(cx0, cy0, rx, ry, paint, opts) {
    return this.fillShape(
      { x0: cx0 - rx, y0: cy0 - ry, x1: cx0 + rx, y1: cy0 + ry },
      (cx, cy) => ((cx - cx0) / rx) ** 2 + ((cy - cy0) / ry) ** 2 <= 1,
      (cx, cy) => [(cx - cx0) / rx, (cy - cy0) / ry],
      paint, opts);
  }

  circle(cx, cy, r, paint, opts) {
    return this.ellipse(cx, cy, r, r, paint, opts);
  }

  polygon(points, paint, opts) {
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const b = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const midX = (b.x0 + b.x1) / 2, midY = (b.y0 + b.y1) / 2;
    const halfW = Math.max(0.5, (b.x1 - b.x0) / 2), halfH = Math.max(0.5, (b.y1 - b.y0) / 2);
    return this.fillShape(b,
      (cx, cy) => pointInPolygon(cx, cy, points),
      (cx, cy) => [(cx - midX) / halfW, (cy - midY) / halfH],
      paint, opts);
  }

  rotEllipse(cx0, cy0, rx, ry, angle, paint, opts) {
    const c = Math.cos(angle), s = Math.sin(angle), r = Math.max(rx, ry);
    return this.fillShape(
      { x0: cx0 - r, y0: cy0 - r, x1: cx0 + r, y1: cy0 + r },
      (cx, cy) => {
        const dx = cx - cx0, dy = cy - cy0;
        const u = dx * c + dy * s, v = -dx * s + dy * c;
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
      },
      (cx, cy) => [(cx - cx0) / r, (cy - cy0) / r],
      paint, opts);
  }

  line(x0, y0, x1, y1, width, paint, opts) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * width / 2, ny = (dx / len) * width / 2;
    return this.polygon([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]],
      paint, { flat: true, ...opts });
  }

  triangle(ax, ay, bx, by, cx, cy, paint, opts) {
    return this.polygon([[ax, ay], [bx, by], [cx, cy]], paint, opts);
  }

  stamp(other, ox, oy) {
    for (let y = 0; y < other.h; y++)
      for (let x = 0; x < other.w; x++) {
        const c = other.get(x, y);
        if (c) this.set(ox + x, oy + y, c);
      }
    return this;
  }

  toCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const g = canvas.getContext("2d");
    const img = g.createImageData(this.w, this.h);
    this.px.forEach((c, i) => {
      if (!c) return;
      const [r, gg, b] = hexToRgb(c);
      img.data.set([r, gg, b, 255], i * 4);
    });
    g.putImageData(img, 0, 0);
    return canvas;
  }
}

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let SHADE_LIGHT = [-0.5, -0.85];
function shadeBand(nx, ny, light = SHADE_LIGHT) {
  const facing = nx * light[0] + ny * light[1];   // +1 toward the light
  const edge = nx * nx + ny * ny;                   // 0 center, 1 rim
  const v = facing * 0.75 - edge * 0.35;
  if (v > 0.32) return 0;
  if (v > -0.28) return 1;
  if (v > -0.62) return 2;
  return 3;
}

function outline(buf) {
  const out = new PixelBuffer(buf.w + 2, buf.h + 2);
  out.stamp(buf, 1, 1);
  const src = out.px.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= out.w || y >= out.h ? null : src[y * out.w + x]);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (at(x, y)) continue;
      const n = at(x, y - 1) || at(x, y + 1) || at(x - 1, y) || at(x + 1, y);
      if (n) out.px[y * out.w + x] = outlineColor(n);
    }
  }
  return out;
}

let CUE = 1;

function scale2xGrid(rows) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x] || ".");
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill("."));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
    out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
    out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out.map((r) => r.join(""));
}

function iconFromGrid(icon, big = false) {
  let rows = icon.grid;
  if (big) rows = scale2xGrid(rows.map((r) => [...r].map((ch) => (icon.colors[ch] ? ch : ".")).join("")));
  const buf = new PixelBuffer(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (icon.colors[ch]) buf.set(x, y, icon.colors[ch]);
    });
  });
  return icon.bare ? buf : outline(buf);
}

function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fractalNoise(x, y, seed = 0) {
  return valueNoise(x, y, seed) * 0.7 + valueNoise(x * 2.3, y * 2.3, seed + 17) * 0.3;
}
