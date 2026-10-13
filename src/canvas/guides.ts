import type { Doc, Id } from '../model/types';
import { boxOf, isBox, type Box } from '../model/geometry';

/** 揃える相手の線（v = 座標、lo〜hi = 線の届く範囲） */
export interface GuideLine {
  v: number;
  lo: number;
  hi: number;
}

export interface GuideTargets {
  xs: GuideLine[];
  ys: GuideLine[];
}

/** 揃えたときに表示するガイド線 */
export interface Guide {
  axis: 'x' | 'y';
  v: number;
  from: number;
  to: number;
}

/** 動かしていない要素の左端・中央・右端（上端・中央・下端）とページの端・中央 */
export function collectTargets(doc: Doc, exclude: Set<Id>): GuideTargets {
  const xs: GuideLine[] = [],
    ys: GuideLine[] = [];
  for (const e of doc.elements) {
    if (!isBox(e) || e.hidden || exclude.has(e.id)) continue;
    const b = boxOf(e);
    for (const v of [b.x, b.x + b.w / 2, b.x + b.w]) xs.push({ v, lo: b.y, hi: b.y + b.h });
    for (const v of [b.y, b.y + b.h / 2, b.y + b.h]) ys.push({ v, lo: b.x, hi: b.x + b.w });
  }
  for (const v of [0, doc.width / 2, doc.width]) xs.push({ v, lo: 0, hi: doc.height });
  for (const v of [0, doc.height / 2, doc.height]) ys.push({ v, lo: 0, hi: doc.width });
  return { xs, ys };
}

function best(cands: number[], lines: GuideLine[], th: number): { delta: number; v: number } | null {
  let out: { delta: number; v: number } | null = null;
  for (const c of cands) {
    for (const l of lines) {
      const d = l.v - c;
      if (Math.abs(d) <= th && (!out || Math.abs(d) < Math.abs(out.delta))) out = { delta: d, v: l.v };
    }
  }
  return out;
}

/** 箱が他の要素と揃う位置に近ければ、そこまでのずれを返す */
export function snapBox(box: Box, t: GuideTargets, th: number) {
  const bx = best([box.x, box.x + box.w / 2, box.x + box.w], t.xs, th);
  const by = best([box.y, box.y + box.h / 2, box.y + box.h], t.ys, th);
  return { dx: bx?.delta ?? null, dy: by?.delta ?? null };
}

/** 点（変形ハンドル）が揃う位置 */
export function snapPoint(p: { x: number; y: number }, t: GuideTargets, th: number) {
  const bx = best([p.x], t.xs, th);
  const by = best([p.y], t.ys, th);
  return { dx: bx?.delta ?? null, dy: by?.delta ?? null };
}

/** 最終的な位置で、ぴったり揃っている線をガイドとして返す */
export function guidesFor(box: Box, t: GuideTargets): Guide[] {
  const out: Guide[] = [];
  const eps = 0.5;
  for (const c of [box.x, box.x + box.w / 2, box.x + box.w]) {
    const hits = t.xs.filter((l) => Math.abs(l.v - c) < eps);
    if (hits.length) {
      out.push({
        axis: 'x',
        v: c,
        from: Math.min(box.y, ...hits.map((h) => h.lo)) - 10,
        to: Math.max(box.y + box.h, ...hits.map((h) => h.hi)) + 10,
      });
    }
  }
  for (const c of [box.y, box.y + box.h / 2, box.y + box.h]) {
    const hits = t.ys.filter((l) => Math.abs(l.v - c) < eps);
    if (hits.length) {
      out.push({
        axis: 'y',
        v: c,
        from: Math.min(box.x, ...hits.map((h) => h.lo)) - 10,
        to: Math.max(box.x + box.w, ...hits.map((h) => h.hi)) + 10,
      });
    }
  }
  return out;
}

export function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w)),
    btm = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}
