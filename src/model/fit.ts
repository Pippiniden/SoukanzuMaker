// 位置やサイズを他の要素に合わせる操作
import type { BoxElement, Doc, Element, FrameEl, Id } from './types';
import { boxOf, frameContents, isBox, normalizePolygon, type Box } from './geometry';
import { frameTitleBox } from '../canvas/shapes';

export type AlignRef = 'selection' | 'first' | 'page';
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

const boxesOf = (doc: Doc, ids: Id[]) =>
  ids.map((id) => doc.elements.find((e) => e.id === id)).filter((e): e is BoxElement => !!e && isBox(e));

function union(bs: Box[]): Box {
  const x = Math.min(...bs.map((b) => b.x)),
    y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
}

/** 要素を (dx, dy) 動かした形（多角形の頂点は相対座標なので x/y だけでよい） */
const moved = (e: Element, dx: number, dy: number): Element => (isBox(e) ? ({ ...e, x: e.x + dx, y: e.y + dy } as Element) : e);

/** 箱の位置・大きさを変えた要素（多角形は頂点を拡大縮小） */
function resized(e: BoxElement, b: Box): Element {
  if (e.type === 'junction') return { ...e, x: b.x, y: b.y };
  if (e.type === 'text') return { ...e, x: b.x, y: b.y, width: Math.max(20, b.w) };
  if (e.type === 'frame' && e.shape === 'polygon') {
    const sx = b.w / (e.width || 1),
      sy = b.h / (e.height || 1);
    const pts = e.points.map((v, i) => Math.round((i % 2 === 0 ? v * sx : v * sy) * 100) / 100);
    return { ...e, ...normalizePolygon({ ...e, points: pts }), x: b.x, y: b.y };
  }
  return { ...e, x: b.x, y: b.y, width: Math.max(10, b.w), height: Math.max(10, b.h) } as Element;
}

const apply = (doc: Doc, patches: Map<Id, Element>): Doc => ({
  ...doc,
  elements: doc.elements.map((e) => patches.get(e.id) ?? e),
});

/** 揃える（基準：選択範囲全体／最初に選んだ要素／キャンバス） */
export function alignTo(doc: Doc, ids: Id[], mode: AlignMode, ref: AlignRef): Doc {
  const els = boxesOf(doc, ids).filter((e) => !e.locked);
  if (!els.length) return doc;
  const refBox: Box =
    ref === 'page' ? { x: 0, y: 0, w: doc.width, h: doc.height } : ref === 'first' ? boxOf(boxesOf(doc, ids)[0]) : union(els.map(boxOf));
  const patches = new Map<Id, Element>();
  for (const e of els) {
    if (ref === 'first' && e.id === ids[0]) continue;
    const b = boxOf(e);
    const nx =
      mode === 'left' ? refBox.x : mode === 'right' ? refBox.x + refBox.w - b.w : mode === 'hcenter' ? refBox.x + refBox.w / 2 - b.w / 2 : b.x;
    const ny =
      mode === 'top' ? refBox.y : mode === 'bottom' ? refBox.y + refBox.h - b.h : mode === 'vcenter' ? refBox.y + refBox.h / 2 - b.h / 2 : b.y;
    patches.set(e.id, moved(e, nx - b.x, ny - b.y));
  }
  return apply(doc, patches);
}

/** 最初に選んだ要素と同じ幅・高さにする */
export function matchSize(doc: Doc, ids: Id[], what: 'width' | 'height' | 'both'): Doc {
  const els = boxesOf(doc, ids);
  if (els.length < 2) return doc;
  const r = boxOf(els[0]);
  const patches = new Map<Id, Element>();
  for (const e of els.slice(1)) {
    if (e.locked || e.type === 'junction') continue;
    const b = boxOf(e);
    patches.set(e.id, resized(e, { x: b.x, y: b.y, w: what === 'height' ? b.w : r.w, h: what === 'width' || e.type === 'text' ? b.h : r.h }));
  }
  return apply(doc, patches);
}

/** 間隔を指定して並べる（並び順は今の位置の順） */
export function arrangeWithGap(doc: Doc, ids: Id[], axis: 'x' | 'y', gap: number): Doc {
  const items = boxesOf(doc, ids)
    .filter((e) => !e.locked)
    .map((e) => ({ e, b: boxOf(e) }))
    .sort((a, c) => (axis === 'x' ? a.b.x - c.b.x : a.b.y - c.b.y));
  if (items.length < 2) return doc;
  let cur = axis === 'x' ? items[0].b.x : items[0].b.y;
  const patches = new Map<Id, Element>();
  for (const { e, b } of items) {
    patches.set(e.id, axis === 'x' ? moved(e, cur - b.x, 0) : moved(e, 0, cur - b.y));
    cur += (axis === 'x' ? b.w : b.h) + gap;
  }
  return apply(doc, patches);
}

/** 枠を、中に入れたい要素がちょうど収まる大きさにする（見出しの分の余白も取る） */
export function fitFrameAround(doc: Doc, frameId: Id, ids: Id[], pad: number): Doc {
  const frame = doc.elements.find((e) => e.id === frameId) as FrameEl | undefined;
  if (!frame || frame.type !== 'frame') return doc;
  const els = boxesOf(doc, ids).filter((e) => e.id !== frameId);
  if (!els.length) return doc;
  const u = union(els.map(boxOf));
  let top = pad,
    bottom = pad;
  if (frame.title && (frame.titlePos === 'insideTopLeft' || frame.titlePos === 'insideBottom')) {
    const tb = frameTitleBox(frame);
    if (frame.titlePos === 'insideTopLeft') top = Math.max(pad, tb.h + 20);
    else bottom = Math.max(pad, tb.h + 20);
  } else if (frame.title && frame.titlePos === 'onTopEdge') {
    top = Math.max(pad, frameTitleBox(frame).h / 2 + 10);
  }
  let b: Box = { x: u.x - pad, y: u.y - top, w: u.w + pad * 2, h: u.h + top + bottom };
  if (frame.shape === 'ellipse') {
    // 楕円の内側に四角が収まるよう √2 倍にする
    const cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    b = { x: cx - (b.w * Math.SQRT2) / 2, y: cy - (b.h * Math.SQRT2) / 2, w: b.w * Math.SQRT2, h: b.h * Math.SQRT2 };
  }
  return apply(doc, new Map([[frame.id, resized(frame, b)]]));
}

/** 枠を今の中身に合わせる */
export function fitFrameToContents(doc: Doc, frameId: Id, pad: number): Doc {
  return fitFrameAround(doc, frameId, frameContents(doc, frameId), pad);
}

/** 要素のまとまりを枠の中央に置く */
export function centerInFrame(doc: Doc, frameId: Id, ids: Id[]): Doc {
  const frame = doc.elements.find((e) => e.id === frameId) as FrameEl | undefined;
  if (!frame) return doc;
  const els = boxesOf(doc, ids).filter((e) => e.id !== frameId && !e.locked);
  if (!els.length) return doc;
  const u = union(els.map(boxOf));
  const fb = boxOf(frame);
  // 見出しが内側にある場合は、その下の領域の中央に置く
  let top = fb.y,
    h = fb.h;
  if (frame.title && frame.titlePos === 'insideTopLeft') {
    const tb = frameTitleBox(frame);
    top = tb.y + tb.h;
    h = fb.y + fb.h - top;
  }
  const dx = fb.x + fb.w / 2 - (u.x + u.w / 2),
    dy = top + h / 2 - (u.y + u.h / 2);
  return apply(doc, new Map(els.map((e) => [e.id, moved(e, dx, dy)])));
}

/**
 * キャンバスと中身をまとめて拡大縮小する（解像度を上げても見た目の比率を保つ）。
 * 位置・大きさ・文字サイズ・線の太さ・角の丸み・グリッドをすべて同じ倍率にする。
 */
export function scaleDoc(doc: Doc, f: number, offsetX = 0, offsetY = 0): Doc {
  const r = (v: number) => Math.round(v * f * 100) / 100;
  const px = (v: number) => Math.round((v * f + offsetX) * 100) / 100;
  const py = (v: number) => Math.round((v * f + offsetY) * 100) / 100;
  const elements = doc.elements.map((e): Element => {
    switch (e.type) {
      case 'card':
        return {
          ...e, x: px(e.x), y: py(e.y), width: r(e.width), height: r(e.height),
          strokeWidth: r(e.strokeWidth), cornerRadius: r(e.cornerRadius), titleSize: r(e.titleSize),
          subtitleSize: r(e.subtitleSize), badgeSize: r(e.badgeSize), textArea: r(e.textArea),
        };
      case 'frame':
        return {
          ...e, x: px(e.x), y: py(e.y), width: r(e.width), height: r(e.height), points: e.points.map(r),
          strokeWidth: r(e.strokeWidth), cornerRadius: r(e.cornerRadius), titleSize: r(e.titleSize),
          subtitleSize: r(e.subtitleSize), titleDx: r(e.titleDx), titleDy: r(e.titleDy),
        };
      case 'text':
        return { ...e, x: px(e.x), y: py(e.y), width: r(e.width), fontSize: r(e.fontSize), strokeWidth: r(e.strokeWidth) };
      case 'image':
        return { ...e, x: px(e.x), y: py(e.y), width: r(e.width), height: r(e.height) };
      case 'junction':
        return { ...e, x: px(e.x), y: py(e.y), dotSize: r(e.dotSize) };
      case 'edge':
        return {
          ...e, waypoints: e.waypoints.map((w) => ({ x: px(w.x), y: py(w.y) })),
          strokeWidth: r(e.strokeWidth), endWidth: r(e.endWidth), headSize: r(e.headSize), labelSize: r(e.labelSize),
        };
    }
  });
  return {
    ...doc,
    width: Math.round(doc.width * f),
    height: Math.round(doc.height * f),
    elements,
    settings: { ...doc.settings, gridSize: Math.max(4, Math.round(doc.settings.gridSize * f)) },
  };
}
