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
  if (el.type === 'junction') return { x: el.x, y: el.y, w: 0, h: 0 };
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

type FixedSide = Exclude<Side, 'auto'>;

export function sidePoint(b: Box, side: FixedSide, offset = 0.5): Pt {
  switch (side) {
    case 'top':
      return { x: b.x + b.w * offset, y: b.y };
    case 'bottom':
      return { x: b.x + b.w * offset, y: b.y + b.h };
    case 'left':
      return { x: b.x, y: b.y + b.h * offset };
    case 'right':
      return { x: b.x + b.w, y: b.y + b.h * offset };
  }
}

function clipToBox(b: Box, toward: Pt, ellipse: boolean): Pt {
  const c = center(b);
  if (b.w === 0 && b.h === 0) return c;
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

export const isH = (s: Side) => s === 'left' || s === 'right';
const ptBox = (p: Pt): Box => ({ x: p.x, y: p.y, w: 0, h: 0 });
const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const;

function autoSides(a: Box, b: Box, fromSide: Side, toSide: Side): [FixedSide, FixedSide] {
  const ca = center(a),
    cb = center(b);
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const horizontal = gapX >= gapY;
  const hDir = (from: Pt, to: Pt): 'left' | 'right' => (to.x >= from.x ? 'right' : 'left');
  const vDir = (from: Pt, to: Pt): 'top' | 'bottom' => (to.y >= from.y ? 'bottom' : 'top');

  let fs = fromSide === 'auto' ? null : fromSide;
  let ts = toSide === 'auto' ? null : toSide;
  if (!fs && !ts) {
    fs = horizontal ? hDir(ca, cb) : vDir(ca, cb);
    ts = OPPOSITE[fs];
  } else if (fs && !ts) {
    const sp = sidePoint(a, fs);
    if (isH(fs)) ts = sp.y >= b.y && sp.y <= b.y + b.h ? OPPOSITE[hDir(ca, cb)] : sp.y < b.y ? 'top' : 'bottom';
    else ts = sp.x >= b.x && sp.x <= b.x + b.w ? OPPOSITE[vDir(ca, cb)] : sp.x < b.x ? 'left' : 'right';
  } else if (!fs && ts) {
    const tp = sidePoint(b, ts);
    if (isH(ts)) fs = tp.y >= a.y && tp.y <= a.y + a.h ? hDir(ca, cb) : tp.y < a.y ? 'top' : 'bottom';
    else fs = tp.x >= a.x && tp.x <= a.x + a.w ? vDir(ca, cb) : tp.x < a.x ? 'left' : 'right';
  }
  return [fs!, ts!];
}

export interface EdgeGeometry {
  /** 描画する折れ線（曲線は細かい折れ線にしたもの） */
  points: number[];
  /** 始点・中継点・終点 */
  keyPoints: Pt[];
  /** 実際に使った辺 */
  sides: [FixedSide, FixedSide];
}

/** 中継点を通る直角の経路 */
function orthoThrough(s: Pt, startH: boolean, wps: Pt[], t: Pt, endH: boolean): Pt[] {
  const out: Pt[] = [s];
  let cur = s;
  let dirH = startH;
  const targets = [...wps, t];
  targets.forEach((b, k) => {
    const last = k === targets.length - 1;
    const sameY = Math.abs(cur.y - b.y) < 0.5,
      sameX = Math.abs(cur.x - b.x) < 0.5;
    if (sameX || sameY) {
      out.push(b);
      dirH = sameY;
    } else {
      const firstLegH = last ? !endH : dirH;
      const elbow = firstLegH ? { x: b.x, y: cur.y } : { x: cur.x, y: b.y };
      out.push(elbow, b);
      dirH = !firstLegH;
    }
    cur = b;
  });
  return out;
}

export function edgeGeometry(edge: EdgeEl, from: BoxElement, to: BoxElement): EdgeGeometry {
  const a = boxOf(from),
    b = boxOf(to);
  const wps = edge.waypoints ?? [];
  const nextBox = wps.length ? ptBox(wps[0]) : b;
  const prevBox = wps.length ? ptBox(wps[wps.length - 1]) : a;
  const fOff = edge.fromSide === 'auto' ? 0.5 : (edge.fromOffset ?? 0.5);
  const tOff = edge.toSide === 'auto' ? 0.5 : (edge.toOffset ?? 0.5);

  let fs: FixedSide, ts: FixedSide;
  if (wps.length) {
    fs = autoSides(a, nextBox, edge.fromSide, 'auto')[0];
    ts = autoSides(prevBox, b, 'auto', edge.toSide)[1];
  } else {
    [fs, ts] = autoSides(a, b, edge.fromSide, edge.toSide);
  }

  if (edge.routing === 'orthogonal') {
    const s = sidePoint(a, fs, fOff),
      t = sidePoint(b, ts, tOff);
    let pts: Pt[];
    if (wps.length) {
      pts = orthoThrough(s, isH(fs), wps, t, isH(ts));
    } else if (isH(fs) && isH(ts)) {
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
    return { points: flatten(dedupe(pts)), keyPoints: [s, ...wps, t], sides: [fs, ts] };
  }

  const ellA = from.type === 'frame' && from.shape === 'ellipse';
  const ellB = to.type === 'frame' && to.shape === 'ellipse';
  const s = edge.fromSide === 'auto' ? clipToBox(a, center(nextBox), ellA) : sidePoint(a, edge.fromSide, fOff);
  const t = edge.toSide === 'auto' ? clipToBox(b, center(prevBox), ellB) : sidePoint(b, edge.toSide, tOff);
  const key = [s, ...wps, t];

  if (edge.routing === 'curved') {
    let through = key;
    if (!wps.length) {
      const curv = (edge.bend - 0.5) * 2; // -1〜1
      const dx = t.x - s.x,
        dy = t.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = curv * len * 0.4;
      through = [s, { x: (s.x + t.x) / 2 - (dy / len) * off, y: (s.y + t.y) / 2 + (dx / len) * off }, t];
    }
    return { points: flatten(sampleSpline(through, 0.5)), keyPoints: key, sides: [fs, ts] };
  }
  return { points: flatten(dedupe(key)), keyPoints: key, sides: [fs, ts] };
}

function flatten(pts: Pt[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(p.x, p.y);
  if (out.length < 4) out.push(out[0] + 0.01, out[1]);
  return out;
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    out.push(p);
  }
  // 一直線上の中間点を取り除く
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1],
      b = out[i],
      c = out[i + 1];
    if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)) {
      const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
      if (dot >= 0) out.splice(i, 1);
    }
  }
  return out;
}

/** Konva と同じ方式の張力付き曲線を細かい折れ線にする */
export function sampleSpline(pts: Pt[], tension: number, steps = 18): Pt[] {
  if (pts.length < 3) return pts;
  const cps: [Pt, Pt][] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1],
      p1 = pts[i],
      p2 = pts[i + 1];
    const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y),
      d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sum = d01 + d12 || 1;
    const fa = (tension * d01) / sum,
      fb = (tension * d12) / sum;
    cps[i] = [
      { x: p1.x - fa * (p2.x - p0.x), y: p1.y - fa * (p2.y - p0.y) },
      { x: p1.x + fb * (p2.x - p0.x), y: p1.y + fb * (p2.y - p0.y) },
    ];
  }
  const out: Pt[] = [pts[0]];
  const quad = (a: Pt, c: Pt, b: Pt) => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps,
        u = 1 - t;
      out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
    }
  };
  const cubic = (a: Pt, c1: Pt, c2: Pt, b: Pt) => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps,
        u = 1 - t;
      out.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      });
    }
  };
  const n = pts.length;
  quad(pts[0], cps[1][0], pts[1]);
  for (let i = 1; i < n - 2; i++) cubic(pts[i], cps[i][1], cps[i + 1][0], pts[i + 1]);
  quad(pts[n - 2], cps[n - 2][1], pts[n - 1]);
  return out;
}

export function polylineLength(points: number[]) {
  let total = 0;
  for (let i = 0; i < points.length - 2; i += 2) total += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  return total;
}

/** 折れ線上の割合 t の位置 */
export function pointAlong(points: number[], t: number): Pt {
  return pointAtDistance(points, Math.max(0, Math.min(1, t)) * polylineLength(points));
}

export function pointAtDistance(points: number[], d: number): Pt {
  let rest = Math.max(0, d);
  for (let i = 0; i < points.length - 2; i += 2) {
    const l = Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    if (rest <= l || i >= points.length - 4) {
      const r = l ? Math.min(1, rest / l) : 0;
      return { x: points[i] + (points[i + 2] - points[i]) * r, y: points[i + 1] + (points[i + 3] - points[i + 1]) * r };
    }
    rest -= l;
  }
  return { x: points[0], y: points[1] };
}

/** 折れ線上で点 p に最も近い位置 */
export function projectOnPolyline(points: number[], p: Pt): { point: Pt; along: number; seg: number; distance: number } {
  let best = { point: { x: points[0], y: points[1] }, along: 0, seg: 0, distance: Infinity };
  let acc = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    const ax = points[i],
      ay = points[i + 1],
      bx = points[i + 2],
      by = points[i + 3];
    const dx = bx - ax,
      dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const r = l2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2)) : 0;
    const q = { x: ax + dx * r, y: ay + dy * r };
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (dist < best.distance) best = { point: q, along: acc + Math.sqrt(l2) * r, seg: i / 2, distance: dist };
    acc += Math.sqrt(l2);
  }
  return best;
}

/** 箱の辺のうち点に最も近いものと、その辺上の位置（0〜1） */
export function nearestSide(b: Box, p: Pt): { side: FixedSide; offset: number } {
  const d = {
    top: Math.abs(p.y - b.y),
    bottom: Math.abs(p.y - (b.y + b.h)),
    left: Math.abs(p.x - b.x),
    right: Math.abs(p.x - (b.x + b.w)),
  };
  const side = (Object.keys(d) as FixedSide[]).reduce((m, k) => (d[k] < d[m] ? k : m), 'top');
  const raw = isH(side) ? (p.y - b.y) / (b.h || 1) : (p.x - b.x) / (b.w || 1);
  return { side, offset: Math.max(0, Math.min(1, raw)) };
}
