import type { BoxElement, Doc, EdgeEl, Element, FrameEl, Id, Side, TextEl } from './types';

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isBox = (el: Element): el is BoxElement => el.type !== 'edge';

export function snap(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

// ---------- テキストの大きさ（おおよそ） ----------

const LINE_HEIGHT = 1.3;

export function textColumns(el: TextEl): string[] {
  return el.text.split('\n');
}

export function textSize(el: TextEl): { w: number; h: number } {
  const lines = el.text.split('\n');
  if (el.vertical) {
    const maxLen = Math.max(1, ...lines.map((l) => [...l].length));
    return { w: Math.max(1, lines.length) * el.fontSize * LINE_HEIGHT, h: maxLen * el.fontSize * 1.08 };
  }
  // 全角文字幅 ≒ fontSize として折り返し行数を概算
  const perLine = Math.max(1, Math.floor(el.width / (el.fontSize * 0.98)));
  const rows = lines.reduce((n, l) => n + Math.max(1, Math.ceil(approxWidth(l) / perLine)), 0);
  return { w: el.width, h: rows * el.fontSize * LINE_HEIGHT };
}

function approxWidth(s: string) {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) < 0x2000 ? 0.55 : 1;
  return w;
}

export function boxOf(el: BoxElement): Box {
  if (el.type === 'text') {
    const s = textSize(el);
    return { x: el.x, y: el.y, w: s.w, h: s.h };
  }
  return { x: el.x, y: el.y, w: el.width, h: el.height };
}

export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function boxesIntersect(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------- 多角形 ----------

export function pointInPolygon(p: Pt, pts: number[], ox = 0, oy = 0) {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2] + ox,
      yi = pts[i * 2 + 1] + oy;
    const xj = pts[j * 2] + ox,
      yj = pts[j * 2 + 1] + oy;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInFrame(p: Pt, f: FrameEl) {
  if (f.shape === 'polygon') return pointInPolygon(p, f.points, f.x, f.y);
  if (f.shape === 'ellipse') {
    const rx = f.width / 2,
      ry = f.height / 2;
    const dx = (p.x - (f.x + rx)) / rx,
      dy = (p.y - (f.y + ry)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height;
}

/** 頂点群を左上が (0,0) になるよう正規化し、x/y/width/height を合わせる */
export function normalizePolygon(f: FrameEl): Pick<FrameEl, 'x' | 'y' | 'width' | 'height' | 'points'> {
  const xs = f.points.filter((_, i) => i % 2 === 0);
  const ys = f.points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const maxX = Math.max(...xs),
    maxY = Math.max(...ys);
  return {
    x: f.x + minX,
    y: f.y + minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points: f.points.map((v, i) => (i % 2 === 0 ? v - minX : v - minY)),
  };
}

const EPS = 0.5;

/**
 * 直角を保ったまま頂点 i を (nx, ny) へ動かす。
 * 隣の辺が水平なら隣の頂点の y を、垂直なら x を一緒に動かす。
 */
export function moveVertexOrtho(points: number[], i: number, nx: number, ny: number): number[] {
  const p = points.slice();
  const n = p.length / 2;
  const ox = p[i * 2],
    oy = p[i * 2 + 1];
  const prev = (i - 1 + n) % n,
    next = (i + 1) % n;

  const dirOf = (j: number): 'h' | 'v' | 'zero' | 'diag' => {
    const dx = Math.abs(p[j * 2] - ox),
      dy = Math.abs(p[j * 2 + 1] - oy);
    if (dx < EPS && dy < EPS) return 'zero';
    if (dy < EPS) return 'h';
    if (dx < EPS) return 'v';
    return 'diag';
  };
  const dPrev = dirOf(prev),
    dNext = dirOf(next);

  const apply = (j: number, d: 'h' | 'v' | 'zero' | 'diag', other: 'h' | 'v' | 'zero' | 'diag') => {
    if (d === 'zero') {
      // 長さ0の辺は、もう一方の辺に対して垂直な辺として扱う
      if (other === 'h') p[j * 2] = nx;
      else if (other === 'v') p[j * 2 + 1] = ny;
      return;
    }
    if (d === 'h') p[j * 2 + 1] = ny;
    else if (d === 'v') p[j * 2] = nx;
  };
  apply(prev, dPrev, dNext);
  apply(next, dNext, dPrev);
  p[i * 2] = nx;
  p[i * 2 + 1] = ny;
  return p;
}

// ---------- 枠の中身 ----------

/** 枠の中に（中心が）入っていて、枠より前面にある要素の id */
export function frameContents(doc: Doc, frameId: Id): Id[] {
  const idx = doc.elements.findIndex((e) => e.id === frameId);
  const frame = doc.elements[idx];
  if (!frame || frame.type !== 'frame') return [];
  const out: Id[] = [];
  for (let i = idx + 1; i < doc.elements.length; i++) {
    const el = doc.elements[i];
    if (!isBox(el) || el.locked) continue;
    if (pointInFrame(center(boxOf(el)), frame)) out.push(el.id);
  }
  return out;
}

// ---------- 矢印の経路 ----------

function sidePoint(b: Box, side: Exclude<Side, 'auto'>): Pt {
  switch (side) {
    case 'top':
      return { x: b.x + b.w / 2, y: b.y };
    case 'bottom':
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left':
      return { x: b.x, y: b.y + b.h / 2 };
    case 'right':
      return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

function clipToBox(b: Box, toward: Pt, ellipse: boolean): Pt {
  const c = center(b);
  const dx = toward.x - c.x,
    dy = toward.y - c.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return c;
  let s: number;
  if (ellipse) {
    s = 1 / Math.sqrt((dx / (b.w / 2)) ** 2 + (dy / (b.h / 2)) ** 2);
  } else {
    s = Math.min(Math.abs(dx) > 1e-6 ? b.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? b.h / 2 / Math.abs(dy) : Infinity);
  }
  return { x: c.x + dx * s, y: c.y + dy * s };
}

const isH = (s: Side) => s === 'left' || s === 'right';

function autoSides(a: Box, b: Box, fromSide: Side, toSide: Side): [Exclude<Side, 'auto'>, Exclude<Side, 'auto'>] {
  const ca = center(a),
    cb = center(b);
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const horizontal = gapX >= gapY;
  const hDir = (from: Pt, to: Pt): 'left' | 'right' => (to.x >= from.x ? 'right' : 'left');
  const vDir = (from: Pt, to: Pt): 'top' | 'bottom' => (to.y >= from.y ? 'bottom' : 'top');
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const;

  let fs = fromSide === 'auto' ? null : fromSide;
  let ts = toSide === 'auto' ? null : toSide;
  if (!fs && !ts) {
    fs = horizontal ? hDir(ca, cb) : vDir(ca, cb);
    ts = opposite[fs];
  } else if (fs && !ts) {
    const sp = sidePoint(a, fs);
    if (isH(fs)) ts = sp.y >= b.y && sp.y <= b.y + b.h ? opposite[hDir(ca, cb)] : sp.y < b.y ? 'top' : 'bottom';
    else ts = sp.x >= b.x && sp.x <= b.x + b.w ? opposite[vDir(ca, cb)] : sp.x < b.x ? 'left' : 'right';
  } else if (!fs && ts) {
    const tp = sidePoint(b, ts);
    if (isH(ts)) fs = tp.y >= a.y && tp.y <= a.y + a.h ? hDir(ca, cb) : tp.y < a.y ? 'top' : 'bottom';
    else fs = tp.x >= a.x && tp.x <= a.x + a.w ? vDir(ca, cb) : tp.x < a.x ? 'left' : 'right';
  }
  return [fs!, ts!];
}

export interface EdgeGeometry {
  points: number[];
  tension: number;
}

export function edgeGeometry(edge: EdgeEl, from: BoxElement, to: BoxElement): EdgeGeometry {
  const a = boxOf(from),
    b = boxOf(to);
  const ellA = from.type === 'frame' && from.shape === 'ellipse';
  const ellB = to.type === 'frame' && to.shape === 'ellipse';

  if (edge.routing === 'orthogonal') {
    const [fs, ts] = autoSides(a, b, edge.fromSide, edge.toSide);
    const s = sidePoint(a, fs),
      t = sidePoint(b, ts);
    let pts: Pt[];
    if (isH(fs) && isH(ts)) {
      const mx = s.x + (t.x - s.x) * edge.bend;
      pts = [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t];
    } else if (!isH(fs) && !isH(ts)) {
      const my = s.y + (t.y - s.y) * edge.bend;
      pts = [s, { x: s.x, y: my }, { x: t.x, y: my }, t];
    } else if (isH(fs)) {
      pts = [s, { x: t.x, y: s.y }, t];
    } else {
      pts = [s, { x: s.x, y: t.y }, t];
    }
    return { points: dedupe(pts), tension: 0 };
  }

  const s = edge.fromSide === 'auto' ? clipToBox(a, center(b), ellA) : sidePoint(a, edge.fromSide);
  const t = edge.toSide === 'auto' ? clipToBox(b, center(a), ellB) : sidePoint(b, edge.toSide);
  if (edge.routing === 'curved') {
    const curv = (edge.bend - 0.5) * 2; // -1〜1
    const mx = (s.x + t.x) / 2,
      my = (s.y + t.y) / 2;
    const dx = t.x - s.x,
      dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = curv * len * 0.4;
    const m = { x: mx - (dy / len) * off, y: my + (dx / len) * off };
    return { points: [s.x, s.y, m.x, m.y, t.x, t.y], tension: 0.5 };
  }
  return { points: [s.x, s.y, t.x, t.y], tension: 0 };
}

function dedupe(pts: Pt[]): number[] {
  const out: number[] = [];
  let last: Pt | null = null;
  for (const p of pts) {
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    out.push(p.x, p.y);
    last = p;
  }
  if (out.length < 4) out.push(out[0] + 0.01, out[1]);
  return out;
}

/** 折れ線上の割合 t の位置 */
export function pointAlong(points: number[], t: number): Pt {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    const l = Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    segs.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let k = 0; k < segs.length; k++) {
    if (d <= segs[k] || k === segs.length - 1) {
      const r = segs[k] ? d / segs[k] : 0;
      const i = k * 2;
      return { x: points[i] + (points[i + 2] - points[i]) * r, y: points[i + 1] + (points[i + 3] - points[i + 1]) * r };
    }
    d -= segs[k];
  }
  return { x: points[0], y: points[1] };
}
