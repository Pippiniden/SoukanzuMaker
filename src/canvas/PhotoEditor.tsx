import { Circle, Group, Image as KImage, Line, Rect } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { CardEl, Element } from '../model/types';
import { useStore } from '../store/useStore';
import { cardLayout } from './cardLayout';

type ToPage = (cx: number, cy: number) => { x: number; y: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 写真の位置合わせ：
 * 写真全体を薄く表示し、ドラッグで動かす。カードの写真枠の中心と写真の中心に印を出し、
 * 中央付近では中央に吸い付く。ホイールで拡大縮小。
 */
export function PhotoEditor({ card, src, scale, toPage }: { card: CardEl; src: string; scale: number; toPage: ToPage }) {
  const [img] = useImage(src);
  if (!img) return null;
  const L = cardLayout(card, true);
  const p = L.photo;
  if (!p) return null;

  const iw = img.naturalWidth,
    ih = img.naturalHeight;
  const s = Math.max(p.w / iw, p.h / ih) * Math.max(1, card.imageZoom);
  const cw = p.w / s,
    ch = p.h / s;
  const cropX = (iw - cw) * card.imageFocusX,
    cropY = (ih - ch) * card.imageFocusY;
  const px = card.x + p.x,
    py = card.y + p.y;
  const gx = px - cropX * s,
    gy = py - cropY * s;
  const gw = iw * s,
    gh = ih * s;
  const fcx = px + p.w / 2,
    fcy = py + p.h / 2;
  const icx = gx + gw / 2,
    icy = gy + gh / 2;

  // 動かせる向きで中央が揃っているか
  const movableX = iw - cw > 0.5,
    movableY = ih - ch > 0.5;
  const centeredX = !movableX || Math.abs(card.imageFocusX - 0.5) < 0.002;
  const centeredY = !movableY || Math.abs(card.imageFocusY - 0.5) < 0.002;
  const ok = '#19b37a',
    ng = '#ffffff';

  const clip = (ctx: Konva.Context) =>
    p.round ? ctx.arc(px + p.w / 2, py + p.h / 2, p.w / 2, 0, Math.PI * 2) : ctx.rect(px, py, p.w, p.h);

  const startDrag = (clientX: number, clientY: number) => {
    const st = useStore.getState();
    const start = toPage(clientX, clientY);
    const fx0 = card.imageFocusX,
      fy0 = card.imageFocusY;
    let began = false;
    const move = (e: PointerEvent) => {
      if (!began) {
        began = true;
        st.beginGesture();
      }
      const q = toPage(e.clientX, e.clientY);
      const dx = q.x - start.x,
        dy = q.y - start.y;
      let fx = movableX ? clamp01(fx0 - dx / s / (iw - cw)) : fx0;
      let fy = movableY ? clamp01(fy0 - dy / s / (ih - ch)) : fy0;
      // 中央付近（画面上で 8px 以内）なら中央に吸い付ける
      const th = 8 / useStore.getState().view.scale;
      if (movableX && Math.abs(fx - 0.5) * (iw - cw) * s < th) fx = 0.5;
      if (movableY && Math.abs(fy - 0.5) * (ih - ch) * s < th) fy = 0.5;
      useStore.getState().updateEl(card.id, { imageFocusX: fx, imageFocusY: fy } as Partial<Element>, { live: true });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (began) useStore.getState().endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const lw = 1.5 / scale;
  const mark = 10 / scale;
  return (
    <Group>
      {/* 写真全体（はみ出す部分は薄く） */}
      <KImage image={img} x={gx} y={gy} width={gw} height={gh} opacity={0.35} listening={false} />
      <Group clipFunc={clip} listening={false}>
        <KImage image={img} x={gx} y={gy} width={gw} height={gh} />
        {/* 三分割の補助線 */}
        {[1, 2].map((k) => (
          <Line key={'v' + k} points={[px + (p.w * k) / 3, py, px + (p.w * k) / 3, py + p.h]} stroke="#ffffff" opacity={0.45} strokeWidth={1 / scale} />
        ))}
        {[1, 2].map((k) => (
          <Line key={'h' + k} points={[px, py + (p.h * k) / 3, px + p.w, py + (p.h * k) / 3]} stroke="#ffffff" opacity={0.45} strokeWidth={1 / scale} />
        ))}
      </Group>
      {/* 写真枠の輪郭 */}
      {p.round ? (
        <Circle x={px + p.w / 2} y={py + p.h / 2} radius={p.w / 2} stroke="#4f8cff" strokeWidth={2 / scale} listening={false} />
      ) : (
        <Rect x={px} y={py} width={p.w} height={p.h} stroke="#4f8cff" strokeWidth={2 / scale} listening={false} />
      )}
      {/* 写真枠の中心（十字）：揃うと緑になる */}
      <Line points={[fcx, py, fcx, py + p.h]} stroke={centeredX ? ok : ng} strokeWidth={lw} dash={[6 / scale, 4 / scale]} shadowColor="#000" shadowBlur={2} shadowOpacity={0.6} listening={false} />
      <Line points={[px, fcy, px + p.w, fcy]} stroke={centeredY ? ok : ng} strokeWidth={lw} dash={[6 / scale, 4 / scale]} shadowColor="#000" shadowBlur={2} shadowOpacity={0.6} listening={false} />
      {/* 写真の中心の印 */}
      <Circle x={icx} y={icy} radius={mark * 0.6} stroke={centeredX && centeredY ? ok : '#ff5a7a'} strokeWidth={2 / scale} listening={false} />
      <Line points={[icx - mark, icy, icx + mark, icy]} stroke={centeredX && centeredY ? ok : '#ff5a7a'} strokeWidth={2 / scale} listening={false} />
      <Line points={[icx, icy - mark, icx, icy + mark]} stroke={centeredX && centeredY ? ok : '#ff5a7a'} strokeWidth={2 / scale} listening={false} />
      {/* つかむ領域 */}
      <Rect
        x={Math.min(gx, px)}
        y={Math.min(gy, py)}
        width={Math.max(gx + gw, px + p.w) - Math.min(gx, px)}
        height={Math.max(gy + gh, py + p.h) - Math.min(gy, py)}
        fill="rgba(0,0,0,0.001)"
        onPointerDown={(e) => {
          e.cancelBubble = true;
          startDrag(e.evt.clientX, e.evt.clientY);
        }}
        onMouseEnter={(e) => (e.target.getStage()!.container().style.cursor = 'move')}
        onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
      />
    </Group>
  );
}
