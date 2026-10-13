import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, Layer, Rect, Shape, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useStore } from '../store/useStore';
import type { BoxElement, CardEl, Element, FrameEl, Id } from '../model/types';
import { boxOf, boxesIntersect, frameContents, isBox, moveVertexOrtho, normalizePolygon, snap } from '../model/geometry';
import { makeCard, makeEdge, makeFrame, makeImage, makeText } from '../model/defaults';
import { CardShape, EdgeShape, FrameShape, ImageShape, TextShape, type ShapeHandlers } from './shapes';
import { stageRef } from './stageRef';
import { fileToDataUrl } from '../io/image';

interface DragState {
  primary: Id;
  startPointer: { x: number; y: number };
  starts: Map<Id, { x: number; y: number }>;
  moved: boolean;
  clickedSelected: boolean;
  additive: boolean;
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
  base: Id[];
}

export function Editor() {
  const doc = useStore((s) => s.doc);
  const assets = useStore((s) => s.assets);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const view = useStore((s) => s.view);
  const edgeFrom = useStore((s) => s.edgeFrom);
  const vertexEdit = useStore((s) => s.vertexEdit);
  const fontEpoch = useStore((s) => s.fontEpoch);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const contentLayer = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const drag = useRef<DragState | null>(null);
  const pan = useRef<{ cx: number; cy: number; vx: number; vy: number } | null>(null);
  const spaceDownRef = useRef(false);
  spaceDownRef.current = spaceDown;

  const byId = useMemo(() => new Map(doc.elements.map((e) => [e.id, e])), [doc.elements]);
  const selSet = useMemo(() => new Set(selection), [selection]);

  // ---------- サイズ・ズーム ----------

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    stageRef.current = stage.current;
  });

  useEffect(() => {
    const onFit = () => fitView();
    window.addEventListener('soukanzu:fit', onFit);
    return () => window.removeEventListener('soukanzu:fit', onFit);
  });

  const fitView = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { doc } = useStore.getState();
    const m = 40;
    const scale = Math.min((el.clientWidth - m * 2) / doc.width, (el.clientHeight - m * 2) / doc.height, 2);
    useStore.getState().setView({
      scale,
      x: (el.clientWidth - doc.width * scale) / 2,
      y: Math.max(m, (el.clientHeight - doc.height * scale) / 2),
    });
  }, []);

  useEffect(() => {
    // 初回表示時にページ全体が見えるようにする
    const t = setTimeout(fitView, 0);
    return () => clearTimeout(t);
  }, [fitView]);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const s = stage.current!;
    const { view, setView } = useStore.getState();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = s.getPointerPosition()!;
      const factor = Math.exp(-e.evt.deltaY * 0.01);
      const scale = Math.min(6, Math.max(0.08, view.scale * factor));
      const px = (p.x - view.x) / view.scale,
        py = (p.y - view.y) / view.scale;
      setView({ scale, x: p.x - px * scale, y: p.y - py * scale });
    } else {
      setView({ x: view.x - e.evt.deltaX, y: view.y - e.evt.deltaY });
    }
  };

  // ---------- 座標変換 ----------

  const toPage = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const { view } = useStore.getState();
    return { x: (clientX - r.left - view.x) / view.scale, y: (clientY - r.top - view.y) / view.scale };
  };

  const snapOn = (evt: { ctrlKey: boolean; metaKey: boolean }) => {
    const s = useStore.getState().doc.settings.snap;
    return evt.ctrlKey || evt.metaKey ? !s : s;
  };

  // ---------- 要素のクリック・ドラッグ ----------

  const handlers: ShapeHandlers = useMemo(
    () => ({
      onDown: (e, id) => {
        const st = useStore.getState();
        if (e.evt.button === 1 || st.tool === 'hand' || spaceDownRef.current) return;
        if (st.tool === 'edge') {
          e.cancelBubble = true;
          const el = st.doc.elements.find((x) => x.id === id);
          if (!el || el.type === 'edge') return;
          if (!st.edgeFrom) st.set({ edgeFrom: id });
          else if (st.edgeFrom !== id) {
            const edge = makeEdge(st.edgeFrom, id);
            st.addElements([edge]);
            st.set({ edgeFrom: null });
          }
          return;
        }
        if (st.tool !== 'select') return; // 作成ツールのときはステージに任せる
        e.cancelBubble = true;
        const additive = e.evt.shiftKey;
        const el = st.doc.elements.find((x) => x.id === id);
        if (!el) return;
        const wasSelected = st.selection.includes(id);
        let sel = st.selection;
        if (additive) sel = wasSelected ? sel.filter((x) => x !== id) : [...sel, id];
        else if (!wasSelected) sel = [id];
        st.setSelection(sel);

        if (el.type === 'edge' || el.locked || (additive && wasSelected)) return;
        // 動かす対象：選択中の要素 ＋ 選択中の枠の中身（Alt を押すと枠だけ動かす）
        const movers = new Set<Id>();
        for (const sid of sel) {
          const s = st.doc.elements.find((x) => x.id === sid);
          if (!s || !isBox(s) || s.locked) continue;
          movers.add(sid);
          if (s.type === 'frame' && !e.evt.altKey) frameContents(st.doc, sid).forEach((c) => movers.add(c));
        }
        const starts = new Map<Id, { x: number; y: number }>();
        for (const mid of movers) {
          const m = st.doc.elements.find((x) => x.id === mid) as BoxElement;
          starts.set(mid, { x: m.x, y: m.y });
        }
        drag.current = {
          primary: id,
          startPointer: toPage(e.evt.clientX, e.evt.clientY),
          starts,
          moved: false,
          clickedSelected: wasSelected,
          additive,
        };
      },
      onDbl: (id) => {
        const st = useStore.getState();
        const el = st.doc.elements.find((x) => x.id === id);
        if (!el) return;
        st.setSelection([id]);
        if (el.type === 'frame' && el.shape === 'polygon') {
          st.set({ vertexEdit: id });
          return;
        }
        // 文字の入力欄にフォーカス
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-autofocus]');
          input?.focus();
          input?.select();
        }, 30);
      },
    }),
    [],
  );

  useEffect(() => {
    const move = (evt: PointerEvent) => {
      if (pan.current) {
        useStore.getState().setView({ x: pan.current.vx + evt.clientX - pan.current.cx, y: pan.current.vy + evt.clientY - pan.current.cy });
        return;
      }
      const d = drag.current;
      if (d) {
        const st = useStore.getState();
        const p = toPage(evt.clientX, evt.clientY);
        let dx = p.x - d.startPointer.x,
          dy = p.y - d.startPointer.y;
        if (!d.moved) {
          if (Math.hypot(dx, dy) * st.view.scale < 3) return;
          d.moved = true;
          st.beginGesture();
        }
        // 操作中の要素の左上だけをグリッドに合わせ、他は同じだけ動かす
        const ps = d.starts.get(d.primary);
        if (ps && snapOn(evt)) {
          const g = st.doc.settings.gridSize;
          dx = snap(ps.x + dx, g) - ps.x;
          dy = snap(ps.y + dy, g) - ps.y;
        }
        st.live((doc) => ({
          ...doc,
          elements: doc.elements.map((el) => {
            const s0 = d.starts.get(el.id);
            return s0 ? ({ ...el, x: s0.x + dx, y: s0.y + dy } as Element) : el;
          }),
        }));
        return;
      }
      const m = marqueeRef.current;
      if (m) {
        const p = toPage(evt.clientX, evt.clientY);
        marqueeRef.current = { ...m, x1: p.x, y1: p.y };
        setMarquee(marqueeRef.current);
      }
    };
    const up = () => {
      if (pan.current) {
        pan.current = null;
        return;
      }
      const d = drag.current;
      if (d) {
        drag.current = null;
        const st = useStore.getState();
        if (d.moved) st.endGesture();
        else if (!d.additive && d.clickedSelected && st.selection.length > 1) st.setSelection([d.primary]);
        return;
      }
      const m = marqueeRef.current;
      if (m) {
        marqueeRef.current = null;
        setMarquee(null);
        finishMarquee(m);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const finishMarquee = (m: Marquee) => {
    const st = useStore.getState();
    const box = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
    if (box.w < 2 && box.h < 2) return;
    const hit = st.doc.elements
      .filter((e) => isBox(e) && !e.hidden && !e.locked)
      .filter((e) => {
        const b = boxOf(e as BoxElement);
        // 枠は全体が範囲に入ったときだけ選ぶ（中身だけを選びやすくするため）
        if (e.type === 'frame') return b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
        return boxesIntersect(b, box);
      })
      .map((e) => e.id);
    st.setSelection(m.additive ? Array.from(new Set([...m.base, ...hit])) : hit);
  };

  // ---------- ステージ（何もない所）のクリック ----------

  const onStageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const st = useStore.getState();
    const evt = e.evt;
    if (evt.button === 1 || st.tool === 'hand' || spaceDown) {
      pan.current = { cx: evt.clientX, cy: evt.clientY, vx: st.view.x, vy: st.view.y };
      return;
    }
    if (evt.button !== 0) return;
    // 変形ハンドルなど UI 部品の上では何もしない（何もない所・ページ背景だけが対象）
    if (e.target !== e.target.getStage() && e.target.id() !== 'page-bg') return;
    const p = toPage(evt.clientX, evt.clientY);
    const g = st.doc.settings.gridSize;
    const sp = snapOn(evt) ? { x: snap(p.x, g), y: snap(p.y, g) } : p;

    if (st.tool === 'card') {
      st.addElements([makeCard(sp.x, sp.y)]);
      st.setTool('select');
      return;
    }
    if (st.tool === 'text') {
      st.addElements([makeText(sp.x, sp.y)]);
      st.setTool('select');
      return;
    }
    if (st.tool === 'frame') {
      const kind = st.frameKind;
      const frame = kind.startsWith('poly:')
        ? makeFrame(sp.x, sp.y, 'polygon', {}, kind.slice(5))
        : makeFrame(sp.x, sp.y, kind === 'ellipse' ? 'ellipse' : 'rect', { cornerRadius: kind === 'round' ? 24 : 0 });
      // 枠は背面に置く
      st.commit((d) => ({ ...d, elements: [frame, ...d.elements] }));
      st.setSelection([frame.id]);
      st.setTool('select');
      return;
    }
    if (st.tool === 'edge') {
      st.set({ edgeFrom: null });
      return;
    }
    // 選択ツール：範囲選択の開始
    if (!evt.shiftKey) st.setSelection([]);
    marqueeRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: evt.shiftKey, base: st.selection };
    setMarquee(marqueeRef.current);
  };

  // ---------- 変形（Transformer） ----------

  const transformTargets = useMemo(
    () =>
      selection
        .map((id) => byId.get(id))
        .filter((e): e is BoxElement => !!e && isBox(e) && !e.locked && !e.hidden && e.id !== vertexEdit),
    [selection, byId, vertexEdit],
  );
  const keepRatio = transformTargets.length === 1 && transformTargets[0].type === 'image';

  useEffect(() => {
    const tr = trRef.current;
    const layer = contentLayer.current;
    if (!tr || !layer) return;
    const nodes = transformTargets.map((e) => layer.findOne('#' + e.id)).filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [transformTargets, fontEpoch]);

  const applyTransform = () => {
    const tr = trRef.current!;
    const st = useStore.getState();
    const patches = new Map<Id, Partial<Element>>();
    for (const node of tr.nodes()) {
      const el = st.doc.elements.find((e) => e.id === node.id());
      if (!el || !isBox(el)) continue;
      const sx = node.scaleX(),
        sy = node.scaleY();
      node.scale({ x: 1, y: 1 });
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const x = r2(node.x()),
        y = r2(node.y());
      if (el.type === 'text') {
        patches.set(el.id, {
          x,
          y,
          width: r2(Math.max(20, el.width * sx)),
          fontSize: Math.abs(sy - 1) > 0.001 ? Math.max(6, Math.round(el.fontSize * sy * 10) / 10) : el.fontSize,
        } as Partial<Element>);
      } else if (el.type === 'frame' && el.shape === 'polygon') {
        patches.set(el.id, {
          x,
          y,
          points: el.points.map((v, i) => r2(i % 2 === 0 ? v * sx : v * sy)),
          width: r2(el.width * sx),
          height: r2(el.height * sy),
        } as Partial<Element>);
      } else {
        patches.set(el.id, { x, y, width: r2(Math.max(10, el.width * sx)), height: r2(Math.max(10, el.height * sy)) } as Partial<Element>);
      }
    }
    const fn = (d: typeof st.doc) => ({
      ...d,
      elements: d.elements.map((e) => (patches.has(e.id) ? ({ ...e, ...patches.get(e.id) } as Element) : e)),
    });
    st.live(fn);
  };

  const anchorSnap = (_old: Konva.Vector2d, next: Konva.Vector2d, evt: MouseEvent | undefined) => {
    const st = useStore.getState();
    if (!snapOn(evt ?? { ctrlKey: false, metaKey: false })) return next;
    const g = st.doc.settings.gridSize * st.view.scale;
    return {
      x: Math.round((next.x - st.view.x) / g) * g + st.view.x,
      y: Math.round((next.y - st.view.y) / g) * g + st.view.y,
    };
  };

  // ---------- 画像のドロップ ----------

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const st = useStore.getState();
    const p = toPage(e.clientX, e.clientY);
    // カードの上に落としたらそのカードの写真にする
    const target = [...st.doc.elements]
      .reverse()
      .find((el): el is CardEl => el.type === 'card' && !el.hidden && p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height);
    for (const [i, file] of files.entries()) {
      const { dataUrl, width, height } = await fileToDataUrl(file);
      const assetId = useStore.getState().addAsset(dataUrl);
      if (target && i === 0) {
        useStore.getState().updateEl(target.id, { imageId: assetId, layout: target.layout } as Partial<Element>);
        useStore.getState().setSelection([target.id]);
      } else {
        const s = Math.min(1, 300 / Math.max(width, height));
        useStore.getState().addElements([makeImage(p.x + i * 20, p.y + i * 20, assetId, width * s, height * s)]);
      }
    }
  };

  // ---------- スペースキーで一時的に手のひら ----------

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ---------- 描画 ----------

  const vertexFrame = vertexEdit ? (byId.get(vertexEdit) as FrameEl | undefined) : undefined;
  const edgeFromEl = edgeFrom ? byId.get(edgeFrom) : undefined;
  const cursor =
    tool === 'hand' || spaceDown ? 'grab' : tool === 'select' ? 'default' : tool === 'edge' ? 'crosshair' : 'copy';

  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      style={{ cursor }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stage}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onWheel={onWheel}
        onPointerDown={onStageDown}
      >
        <Layer listening={true}>
          <Rect
            name="ui"
            x={0}
            y={0}
            width={doc.width}
            height={doc.height}
            fill="#fff"
            shadowColor="#000"
            shadowOpacity={0.15}
            shadowBlur={24}
            listening={false}
          />
          <Rect
            id="page-bg"
            x={0}
            y={0}
            width={doc.width}
            height={doc.height}
            {...(doc.background2
              ? {
                  fillLinearGradientStartPoint: { x: 0, y: 0 },
                  fillLinearGradientEndPoint: { x: doc.width, y: doc.height },
                  fillLinearGradientColorStops: [0, doc.background, 1, doc.background2],
                }
              : { fill: doc.background })}
          />
          {doc.settings.showGrid && <Grid w={doc.width} h={doc.height} g={doc.settings.gridSize} scale={view.scale} />}
        </Layer>

        <Layer ref={contentLayer} key={fontEpoch}>
          {doc.elements.map((el) => {
            switch (el.type) {
              case 'card':
                return <CardShape key={el.id} el={el} src={el.imageId ? assets[el.imageId] : undefined} h={handlers} />;
              case 'frame':
                return <FrameShape key={el.id} el={el} h={handlers} />;
              case 'text':
                return <TextShape key={el.id} el={el} h={handlers} />;
              case 'image':
                return <ImageShape key={el.id} el={el} src={assets[el.imageId]} h={handlers} />;
              case 'edge':
                return (
                  <EdgeShape
                    key={el.id}
                    el={el}
                    from={byId.get(el.from) as BoxElement | undefined}
                    to={byId.get(el.to) as BoxElement | undefined}
                    selected={selSet.has(el.id)}
                    h={handlers}
                  />
                );
            }
          })}
        </Layer>

        <Layer name="ui">
          {selection
            .map((id) => byId.get(id))
            .filter((e): e is BoxElement => !!e && isBox(e) && !!e.locked && !e.hidden)
            .map((e) => {
              const b = boxOf(e);
              return (
                <Rect key={e.id} x={b.x} y={b.y} width={b.w} height={b.h} stroke="#f59e0b" dash={[6, 4]} strokeWidth={1.5 / view.scale} listening={false} />
              );
            })}
          {edgeFromEl && isBox(edgeFromEl) && (
            <Rect
              {...(() => {
                const b = boxOf(edgeFromEl);
                return { x: b.x - 4, y: b.y - 4, width: b.w + 8, height: b.h + 8 };
              })()}
              stroke="#27a5a0"
              strokeWidth={3 / view.scale}
              dash={[8, 5]}
              listening={false}
            />
          )}
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            flipEnabled={false}
            ignoreStroke
            keepRatio={keepRatio}
            anchorSize={9}
            anchorCornerRadius={2}
            borderStroke="#4f8cff"
            anchorStroke="#4f8cff"
            onTransformStart={() => useStore.getState().beginGesture()}
            onTransform={applyTransform}
            onTransformEnd={() => {
              applyTransform();
              useStore.getState().endGesture();
            }}
            anchorDragBoundFunc={anchorSnap}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
          />
          {vertexFrame && vertexFrame.shape === 'polygon' && <VertexHandles frame={vertexFrame} scale={view.scale} />}
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(79,140,255,0.08)"
              stroke="#4f8cff"
              strokeWidth={1 / view.scale}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}

// ---------- グリッド ----------

function Grid({ w, h, g, scale }: { w: number; h: number; g: number; scale: number }) {
  return (
    <Shape
      name="ui"
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        c.save();
        c.beginPath();
        // 細かすぎるときは間引く
        const step = g * Math.max(1, Math.ceil(6 / (g * scale)));
        for (let x = step; x < w; x += step) {
          c.moveTo(x, 0);
          c.lineTo(x, h);
        }
        for (let y = step; y < h; y += step) {
          c.moveTo(0, y);
          c.lineTo(w, y);
        }
        c.strokeStyle = 'rgba(70, 90, 130, 0.13)';
        c.lineWidth = 1 / scale;
        c.stroke();
        c.restore();
      }}
    />
  );
}

// ---------- 多角形の頂点編集 ----------

function VertexHandles({ frame, scale }: { frame: FrameEl; scale: number }) {
  const ortho = useStore((s) => s.orthoVertex);
  const pts = frame.points;
  const n = pts.length / 2;
  const r = 6 / scale;

  const toRel = (abs: Konva.Vector2d) => {
    const { view } = useStore.getState();
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return { x: r2((abs.x - view.x) / view.scale - frame.x), y: r2((abs.y - view.y) / view.scale - frame.y) };
  };

  const bound = (pos: Konva.Vector2d) => {
    const st = useStore.getState();
    if (!st.doc.settings.snap) return pos;
    const g = st.doc.settings.gridSize;
    const page = { x: (pos.x - st.view.x) / st.view.scale, y: (pos.y - st.view.y) / st.view.scale };
    return { x: snap(page.x, g) * st.view.scale + st.view.x, y: snap(page.y, g) * st.view.scale + st.view.y };
  };

  const update = (points: number[], live: boolean) => {
    const st = useStore.getState();
    const cur = st.doc.elements.find((e) => e.id === frame.id) as FrameEl;
    const next = live ? { ...cur, points } : { ...cur, ...normalizePolygon({ ...cur, points }) };
    st.updateEl(frame.id, next, { live: true });
  };

  const insertAt = (i: number) => {
    const j = (i + 1) % n;
    const mx = (pts[i * 2] + pts[j * 2]) / 2,
      my = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2;
    // 直角モードでは段差を作れるよう同じ位置に2点入れる
    const add = ortho ? [mx, my, mx, my] : [mx, my];
    const points = [...pts.slice(0, (i + 1) * 2), ...add, ...pts.slice((i + 1) * 2)];
    useStore.getState().updateEl(frame.id, { points } as Partial<Element>);
  };

  const remove = (i: number) => {
    if (n <= 3) return;
    const points = pts.filter((_, k) => Math.floor(k / 2) !== i);
    const cur = useStore.getState().doc.elements.find((e) => e.id === frame.id) as FrameEl;
    useStore.getState().updateEl(frame.id, normalizePolygon({ ...cur, points }) as Partial<Element>);
  };

  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const j = (i + 1) % n;
        const mx = (pts[i * 2] + pts[j * 2]) / 2 + frame.x,
          my = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2 + frame.y;
        return (
          <Rect
            key={'m' + i}
            x={mx - r * 0.7}
            y={my - r * 0.7}
            width={r * 1.4}
            height={r * 1.4}
            fill="#fff"
            stroke="#27a5a0"
            strokeWidth={1.5 / scale}
            onPointerDown={(e) => {
              e.cancelBubble = true;
              insertAt(i);
            }}
            onMouseEnter={(e) => (e.target.getStage()!.container().style.cursor = 'copy')}
            onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
          />
        );
      })}
      {Array.from({ length: n }, (_, i) => (
        <Circle
          key={'v' + i}
          x={pts[i * 2] + frame.x}
          y={pts[i * 2 + 1] + frame.y}
          radius={r}
          fill="#4f8cff"
          stroke="#fff"
          strokeWidth={2 / scale}
          draggable
          dragBoundFunc={bound}
          onPointerDown={(e) => {
            e.cancelBubble = true;
            if (e.evt.altKey || e.evt.button === 2) remove(i);
          }}
          onDblClick={() => remove(i)}
          onDragStart={() => useStore.getState().beginGesture()}
          onDragMove={(e) => {
            const rel = toRel(e.target.getAbsolutePosition());
            const cur = (useStore.getState().doc.elements.find((x) => x.id === frame.id) as FrameEl).points;
            const next = ortho ? moveVertexOrtho(cur, i, rel.x, rel.y) : cur.map((v, k) => (k === i * 2 ? rel.x : k === i * 2 + 1 ? rel.y : v));
            update(next, true);
          }}
          onDragEnd={() => {
            const cur = (useStore.getState().doc.elements.find((x) => x.id === frame.id) as FrameEl).points;
            update(cur, false);
            useStore.getState().endGesture();
          }}
          onMouseEnter={(e) => (e.target.getStage()!.container().style.cursor = 'move')}
          onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
        />
      ))}
    </>
  );
}
