import { create } from 'zustand';
import type { Assets, Doc, EdgeEl, Element, Id } from '../model/types';
import { emptyDoc, migrateDoc, newId } from '../model/defaults';
import { boxOf, isBox, snap } from '../model/geometry';

export type Tool = 'select' | 'hand' | 'card' | 'frame' | 'text' | 'edge';

export interface View {
  scale: number;
  x: number;
  y: number;
}

const HISTORY_LIMIT = 100;

interface State {
  doc: Doc;
  assets: Assets;
  selection: Id[];
  tool: Tool;
  /** 枠ツールで作る形（rect / round / ellipse / poly:<テンプレートキー>） */
  frameKind: string;
  edgeFrom: Id | null;
  /** 分岐から矢印を引くときに引き継ぐ見た目 */
  edgeStyle: Partial<EdgeEl>;
  vertexEdit: Id | null;
  /** 写真の位置を調整中のカード */
  photoEdit: Id | null;
  orthoVertex: boolean;
  past: Doc[];
  future: Doc[];
  gestureBase: Doc | null;
  view: View;
  clipboard: Element[] | null;
  styleClipboard: { type: Element['type']; style: Record<string, unknown> } | null;
  fontEpoch: number;
  lastSavedAt: number | null;

  commit: (fn: (d: Doc) => Doc) => void;
  beginGesture: () => void;
  live: (fn: (d: Doc) => Doc) => void;
  endGesture: () => void;
  updateEl: (id: Id, patch: Partial<Element>, opts?: { live?: boolean }) => void;
  addElements: (els: Element[], select?: boolean) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  setSelection: (ids: Id[]) => void;
  setTool: (t: Tool) => void;
  reorder: (ids: Id[], where: 'front' | 'back' | 'up' | 'down') => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  snapAllToGrid: () => void;
  loadDoc: (doc: Doc, assets: Assets) => void;
  addAsset: (dataUrl: string) => Id;
  setView: (v: Partial<View>) => void;
  set: (p: Partial<State>) => void;
}

const mapEls = (d: Doc, fn: (e: Element) => Element): Doc => ({ ...d, elements: d.elements.map(fn) });

/** スタイルとしてコピーしない（内容・位置に関わる）プロパティ */
const NON_STYLE_KEYS = new Set([
  'id', 'type', 'name', 'x', 'y', 'width', 'height', 'points', 'hidden', 'locked',
  'title', 'subtitle', 'badge', 'imageId', 'text', 'label', 'from', 'to',
]);

export const useStore = create<State>()((set, get) => ({
  doc: emptyDoc(),
  assets: {},
  selection: [],
  tool: 'select',
  frameKind: 'rect',
  edgeFrom: null,
  edgeStyle: {},
  vertexEdit: null,
  photoEdit: null,
  orthoVertex: true,
  past: [],
  future: [],
  gestureBase: null,
  view: { scale: 0.6, x: 40, y: 40 },
  clipboard: null,
  styleClipboard: null,
  fontEpoch: 0,
  lastSavedAt: null,

  commit: (fn) => {
    const { doc, past } = get();
    const next = fn(doc);
    if (next === doc) return;
    set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: [] });
  },

  beginGesture: () => {
    if (!get().gestureBase) set({ gestureBase: get().doc });
  },
  live: (fn) => set({ doc: fn(get().doc) }),
  endGesture: () => {
    const { gestureBase, doc, past } = get();
    if (!gestureBase) return;
    if (gestureBase !== doc) set({ past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [] });
    set({ gestureBase: null });
  },

  updateEl: (id, patch, opts) => {
    const fn = (d: Doc) => mapEls(d, (e) => (e.id === id ? ({ ...e, ...patch } as Element) : e));
    if (opts?.live) get().live(fn);
    else get().commit(fn);
  },

  addElements: (els, select = true) => {
    get().commit((d) => ({ ...d, elements: [...d.elements, ...els] }));
    if (select) set({ selection: els.map((e) => e.id) });
  },

  removeSelected: () => {
    const sel = new Set(get().selection);
    if (!sel.size) return;
    get().commit((d) => ({
      ...d,
      elements: d.elements.filter(
        (e) => !sel.has(e.id) && !(e.type === 'edge' && (sel.has(e.from) || sel.has(e.to))),
      ),
    }));
    set({ selection: [], vertexEdit: null });
  },

  undo: () => {
    get().endGesture();
    const { past, doc, future } = get();
    if (!past.length) return;
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], vertexEdit: null });
    pruneSelection();
  },
  redo: () => {
    get().endGesture();
    const { past, doc, future } = get();
    if (!future.length) return;
    set({ doc: future[0], future: future.slice(1), past: [...past, doc], vertexEdit: null });
    pruneSelection();
  },

  setSelection: (ids) => {
    const v = get().vertexEdit;
    const pe = get().photoEdit;
    set({
      selection: ids,
      vertexEdit: v && ids.length === 1 && ids[0] === v ? v : null,
      photoEdit: pe && ids.length === 1 && ids[0] === pe ? pe : null,
    });
  },
  setTool: (t) => set({ tool: t, edgeFrom: null, vertexEdit: t === 'select' ? get().vertexEdit : null, photoEdit: null }),

  reorder: (ids, where) => {
    const sel = new Set(ids);
    get().commit((d) => {
      const els = d.elements.slice();
      if (where === 'front') return { ...d, elements: [...els.filter((e) => !sel.has(e.id)), ...els.filter((e) => sel.has(e.id))] };
      if (where === 'back') return { ...d, elements: [...els.filter((e) => sel.has(e.id)), ...els.filter((e) => !sel.has(e.id))] };
      if (where === 'up') {
        for (let i = els.length - 2; i >= 0; i--)
          if (sel.has(els[i].id) && !sel.has(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]];
      } else {
        for (let i = 1; i < els.length; i++)
          if (sel.has(els[i].id) && !sel.has(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]];
      }
      return { ...d, elements: els };
    });
  },

  copy: () => {
    const { doc, selection } = get();
    const sel = new Set(selection);
    const els = doc.elements.filter(
      (e) => sel.has(e.id) || (e.type === 'edge' && sel.has(e.from) && sel.has(e.to)),
    );
    if (els.length) set({ clipboard: structuredClone(els) });
  },
  paste: () => {
    const clip = get().clipboard;
    if (!clip) return;
    const idMap = new Map<Id, Id>();
    for (const e of clip) idMap.set(e.id, newId(e.type));
    const existing = new Set(get().doc.elements.map((e) => e.id));
    const out: Element[] = [];
    for (const e of clip) {
      if (e.type === 'edge') {
        const from = idMap.get(e.from) ?? (existing.has(e.from) ? e.from : null);
        const to = idMap.get(e.to) ?? (existing.has(e.to) ? e.to : null);
        if (!from || !to) continue;
        const bothCopied = idMap.has(e.from) && idMap.has(e.to);
        const waypoints = (e.waypoints ?? []).map((w) => (bothCopied ? { x: w.x + 20, y: w.y + 20 } : w));
        out.push({ ...e, id: idMap.get(e.id)!, from, to, waypoints });
      } else {
        out.push({ ...e, id: idMap.get(e.id)!, x: e.x + 20, y: e.y + 20 });
      }
    }
    // 次の貼り付けはさらにずらす
    set({
      clipboard: clip.map((e) =>
        e.type === 'edge' ? { ...e, waypoints: (e.waypoints ?? []).map((w) => ({ x: w.x + 20, y: w.y + 20 })) } : { ...e, x: e.x + 20, y: e.y + 20 },
      ),
    });
    get().addElements(out);
  },
  duplicate: () => {
    get().copy();
    get().paste();
  },

  copyStyle: () => {
    const { doc, selection } = get();
    const el = doc.elements.find((e) => e.id === selection[0]);
    if (!el) return;
    const style: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(el)) if (!NON_STYLE_KEYS.has(k)) style[k] = v;
    set({ styleClipboard: { type: el.type, style } });
  },
  pasteStyle: () => {
    const { styleClipboard, selection } = get();
    if (!styleClipboard) return;
    const sel = new Set(selection);
    get().commit((d) =>
      mapEls(d, (e) => (sel.has(e.id) && e.type === styleClipboard.type ? ({ ...e, ...styleClipboard.style } as Element) : e)),
    );
  },

  snapAllToGrid: () => {
    const g = get().doc.settings.gridSize;
    get().commit((d) =>
      mapEls(d, (e) => {
        if (e.type === 'edge') return { ...e, waypoints: (e.waypoints ?? []).map((w) => ({ x: snap(w.x, g), y: snap(w.y, g) })) };
        if (!isBox(e) || e.locked) return e;
        const moved = { ...e, x: snap(e.x, g), y: snap(e.y, g) } as Element;
        if (e.type === 'card' || e.type === 'image' || (e.type === 'frame' && e.shape !== 'polygon')) {
          const b = boxOf(e);
          return { ...moved, width: Math.max(g, snap(b.w, g)), height: Math.max(g, snap(b.h, g)) } as Element;
        }
        if (e.type === 'frame' && e.shape === 'polygon') {
          const points = e.points.map((v) => snap(v, g));
          return { ...moved, points } as Element;
        }
        return moved;
      }),
    );
  },

  loadDoc: (doc, assets) =>
    set({ doc: migrateDoc(doc), assets, past: [], future: [], selection: [], vertexEdit: null, edgeFrom: null, gestureBase: null }),

  addAsset: (dataUrl) => {
    const id = newId('asset');
    set({ assets: { ...get().assets, [id]: dataUrl } });
    return id;
  },

  setView: (v) => set({ view: { ...get().view, ...v } }),
  set: (p) => set(p),
}));

function pruneSelection() {
  const s = useStore.getState();
  const ids = new Set(s.doc.elements.map((e) => e.id));
  const sel = s.selection.filter((id) => ids.has(id));
  if (sel.length !== s.selection.length) useStore.setState({ selection: sel });
}

export const getEl = (id: Id) => useStore.getState().doc.elements.find((e) => e.id === id);

let editTimer: number | undefined;

/**
 * パネルからの連続した編集（スライダー・色選択・文字入力）を
 * 1回の「元に戻す」単位にまとめて反映する
 */
export function patchEls(ids: Id[], patch: Partial<Element> | ((e: Element) => Partial<Element>)) {
  const st = useStore.getState();
  st.beginGesture();
  const set = new Set(ids);
  st.live((d) => ({
    ...d,
    elements: d.elements.map((e) =>
      set.has(e.id) ? ({ ...e, ...(typeof patch === 'function' ? patch(e) : patch) } as Element) : e,
    ),
  }));
  window.clearTimeout(editTimer);
  editTimer = window.setTimeout(() => useStore.getState().endGesture(), 500);
}

export function patchDoc(patch: Partial<Doc> | ((d: Doc) => Partial<Doc>)) {
  const st = useStore.getState();
  st.beginGesture();
  st.live((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
  window.clearTimeout(editTimer);
  editTimer = window.setTimeout(() => useStore.getState().endGesture(), 500);
}
