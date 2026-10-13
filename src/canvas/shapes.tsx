import { Circle, Ellipse, Group, Image as KImage, Label, Line, Rect, Shape, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import type { BoxElement, CardEl, EdgeEl, FrameEl, ImageEl, JunctionEl, TextEl } from '../model/types';
import { boldStyle, fontStack } from '../model/fonts';
import { cardLayout } from './cardLayout';
import { edgeGeometry, pointAlong, textSize } from '../model/geometry';
import { dashArray, measureText, toVertical } from './text';
import { drawEdge } from './edgeDraw';

type KEvt = Konva.KonvaEventObject<PointerEvent>;

export interface ShapeHandlers {
  onDown: (e: KEvt, id: string) => void;
  onDbl: (id: string) => void;
}

const isTransparent = (c: string) => !c || c === 'transparent';

// ---------- 写真（枠に合わせて切り抜き） ----------

function CoverImage(props: {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
  fx: number;
  fy: number;
}) {
  const [img] = useImage(props.src);
  if (!img) return null;
  const { w, h } = props;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * Math.max(1, props.zoom);
  const cw = w / scale,
    ch = h / scale;
  const crop = {
    x: (img.naturalWidth - cw) * props.fx,
    y: (img.naturalHeight - ch) * props.fy,
    width: cw,
    height: ch,
  };
  return <KImage image={img} x={props.x} y={props.y} width={w} height={h} crop={crop} listening={false} />;
}

function Placeholder({ x, y, w, h, title, round, font }: { x: number; y: number; w: number; h: number; title: string; round?: boolean; font: string }) {
  const ch = [...(title || '?')][0];
  const size = Math.min(w, h) * 0.45;
  return (
    <Group listening={false}>
      {round ? (
        <Circle x={x + w / 2} y={y + h / 2} radius={Math.min(w, h) / 2} fill="#dfe4ec" />
      ) : (
        <Rect x={x} y={y} width={w} height={h} fill="#dfe4ec" />
      )}
      <Text
        x={x}
        y={y + h / 2 - size * 0.6}
        width={w}
        align="center"
        text={ch}
        fontSize={size}
        fontStyle={boldStyle(font, true)}
        fontFamily={fontStack(font)}
        fill="#9aa4b4"
      />
    </Group>
  );
}

// ---------- カード ----------

export function CardShape({ el, src, h: handlers }: { el: CardEl; src?: string; h: ShapeHandlers }) {
  const { width: w, height: h } = el;
  const hasImage = !!src;
  const L = cardLayout(el, hasImage);
  const r = el.cornerRadius;
  const family = fontStack(el.font);

  let photo: React.ReactNode = null;
  if (L.photo) {
    const p = L.photo;
    const clip = (ctx: Konva.Context) =>
      p.round ? ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2) : roundRectPath(ctx, p.x, p.y, p.w, p.h, L.layout === 'inline' ? Math.min(r, p.w / 2) : 0);
    photo = (
      <Group clipFunc={clip} listening={false}>
        {hasImage ? (
          <CoverImage src={src!} x={p.x} y={p.y} w={p.w} h={p.h} zoom={el.imageZoom} fx={el.imageFocusX} fy={el.imageFocusY} />
        ) : (
          <Placeholder x={p.x} y={p.y} w={p.w} h={p.h} title={el.title} round={p.round} font={el.font} />
        )}
      </Group>
    );
  }

  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
      onDblTap={() => handlers.onDbl(el.id)}
    >
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={isTransparent(el.fill) ? undefined : el.fill}
        stroke={el.strokeWidth > 0 ? el.stroke : undefined}
        strokeWidth={el.strokeWidth}
        shadowEnabled={el.shadow}
        shadowColor="#000"
        shadowOpacity={0.18}
        shadowBlur={8}
        shadowOffsetY={2}
        // 背景なしでもクリックで選べるようにする
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      <Group clipFunc={(ctx) => roundRectPath(ctx, 0, 0, w, h, r)} listening={false}>
        {!isTransparent(el.textBg) && <Rect x={L.text.x} y={L.text.y} width={L.text.w} height={L.text.h} fill={el.textBg} />}
        {photo}
        <Text
          x={L.title.x}
          y={L.title.y}
          width={L.title.w}
          height={L.title.h + 1}
          text={el.title}
          fontSize={el.titleSize}
          fontStyle={boldStyle(el.font, true)}
          fontFamily={family}
          fill={el.titleColor}
          align={L.align}
          lineHeight={1.25}
          wrap={L.title.lines > 1 ? 'char' : 'none'}
          ellipsis
        />
        {L.subtitle && (
          <Text
            x={L.subtitle.x}
            y={L.subtitle.y}
            width={L.subtitle.w}
            text={el.subtitle}
            fontSize={el.subtitleSize}
            fontStyle={boldStyle(el.font, false)}
            fontFamily={family}
            fill={el.subtitleColor}
            align={L.align}
            wrap="none"
            ellipsis
          />
        )}
        {el.badge && <Badge text={el.badge} fill={el.badgeFill} color={el.badgeColor} size={el.badgeSize} font={el.font} />}
      </Group>
    </Group>
  );
}

function Badge({ text, fill, color, size, font }: { text: string; fill: string; color: string; size: number; font: string }) {
  const tw = measureText(text, size, true, font);
  const pad = Math.max(3, size * 0.4);
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={tw + pad * 2} height={size * 1.25 + pad} fill={fill} cornerRadius={[0, 0, 4, 0]} />
      <Text x={pad} y={pad / 2 + size * 0.05} text={text} fontSize={size} fontStyle={boldStyle(font, true)} fontFamily={fontStack(font)} fill={color} />
    </Group>
  );
}

function roundRectPath(ctx: Konva.Context, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------- 枠 ----------

function frameFill(el: FrameEl) {
  if (el.fillOpacity <= 0) return {};
  if (el.fill2) {
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: el.width, y: el.height },
      fillLinearGradientColorStops: [0, el.fill, 1, el.fill2],
    };
  }
  return { fill: el.fill };
}

export function FrameShape({ el, h: handlers }: { el: FrameEl; h: ShapeHandlers }) {
  const common: Konva.ShapeConfig = {
    ...frameFill(el),
    stroke: el.strokeWidth > 0 ? el.stroke : undefined,
    strokeWidth: el.strokeWidth,
    dash: dashArray(el.dash, el.strokeWidth),
    lineCap: 'round' as const,
    fillAfterStrokeEnabled: false,
  };
  // 塗りの透明度は線に影響させない
  const fillOnly: Konva.ShapeConfig = { ...common, stroke: undefined, opacity: el.fillOpacity };
  const strokeOnly: Konva.ShapeConfig = { ...common, fill: undefined, fillLinearGradientColorStops: undefined, fillEnabled: false };

  const draw = (p: Konva.ShapeConfig) =>
    el.shape === 'ellipse' ? (
      <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} {...p} />
    ) : el.shape === 'polygon' ? (
      <Line {...p} points={el.points} closed tension={0} lineJoin="round" />
    ) : (
      <Rect width={el.width} height={el.height} cornerRadius={el.cornerRadius} {...p} />
    );

  const down = (e: KEvt) => handlers.onDown(e, el.id);
  const dbl = () => handlers.onDbl(el.id);
  return (
    <>
      <Group id={el.id} x={el.x} y={el.y} visible={!el.hidden} onPointerDown={down} onDblClick={dbl} onDblTap={dbl}>
        {draw({ ...fillOnly, fillEnabled: true })}
        {draw(strokeOnly)}
      </Group>
      {el.title && el.titlePos !== 'none' && !el.hidden && <FrameTitle el={el} onDown={down} onDbl={dbl} />}
    </>
  );
}

/** 枠の見出しの位置と大きさ（ページ座標） */
export function frameTitleBox(el: FrameEl) {
  const size = el.titleSize;
  const sub = el.subtitleSize;
  const tw = Math.max(measureText(el.title, size, true, el.font), el.subtitle ? measureText(el.subtitle, sub, true, el.font) : 0);
  const bw = tw + 20;
  const bh = size * 1.3 + (el.subtitle ? sub * 1.3 : 0) + 10;
  const bottom = el.titlePos === 'insideBottom';
  // 見出しを置く辺の範囲（多角形は最上段／最下段の辺）
  let L = 0,
    R = el.width;
  if (el.shape === 'polygon') {
    const ys = el.points.filter((_, i) => i % 2 === 1);
    const edgeY = bottom ? Math.max(...ys) : Math.min(...ys);
    const xs = el.points.filter((_, i) => i % 2 === 0 && Math.abs(el.points[i + 1] - edgeY) < 0.5);
    L = Math.min(...xs);
    R = Math.max(...xs);
  }
  const outside = el.titlePos === 'outsideTopLeft';
  const inset = outside ? 0 : 12;
  const x =
    el.titleAlign === 'center' ? (L + R) / 2 - bw / 2 : el.titleAlign === 'right' ? R - inset - bw : L + inset;
  const y =
    el.titlePos === 'onTopEdge' ? -bh / 2 : outside ? -bh - 4 : bottom ? el.height - bh - 10 : 10;
  return { x: el.x + x + el.titleDx, y: el.y + y + el.titleDy, w: bw, h: bh };
}

function FrameTitle({ el, onDown, onDbl }: { el: FrameEl; onDown: (e: KEvt) => void; onDbl: () => void }) {
  const b = frameTitleBox(el);
  const family = fontStack(el.font);
  const weight = boldStyle(el.font, true);
  const bg = isTransparent(el.titleBg) ? undefined : el.titleBg;
  return (
    <Group x={b.x} y={b.y} onPointerDown={onDown} onDblClick={onDbl} onDblTap={onDbl}>
      <Rect width={b.w} height={b.h} fill={bg} cornerRadius={2} hitFunc={(ctx, s) => { ctx.beginPath(); ctx.rect(0, 0, b.w, b.h); ctx.fillStrokeShape(s); }} />
      <Text x={10} y={5} width={b.w - 20} align={el.titleAlign} text={el.title} fontSize={el.titleSize} fontStyle={weight} fontFamily={family} fill={el.titleColor} wrap="none" listening={false} />
      {el.subtitle && (
        <Text x={10} y={5 + el.titleSize * 1.25} width={b.w - 20} align={el.titleAlign} text={el.subtitle} fontSize={el.subtitleSize} fontStyle={weight} fontFamily={family} fill={el.titleColor} opacity={0.8} wrap="none" listening={false} />
      )}
    </Group>
  );
}

// ---------- テキスト ----------

export function TextShape({ el, h: handlers }: { el: TextEl; h: ShapeHandlers }) {
  const common = {
    fontSize: el.fontSize,
    fontStyle: boldStyle(el.font, el.bold),
    fontFamily: fontStack(el.font),
    fill: el.fill,
    stroke: el.strokeWidth > 0 ? el.strokeColor : undefined,
    strokeWidth: el.strokeWidth,
    fillAfterStrokeEnabled: true,
    listening: false,
  };
  const size = textSize(el);
  const cols = el.text.split('\n');
  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
      onDblTap={() => handlers.onDbl(el.id)}
    >
      <Rect width={size.w} height={size.h} fill="transparent" />
      {el.vertical ? (
        // 縦書き：右の列から順に並べる
        cols.map((col, i) => (
          <Text
            key={i}
            {...common}
            x={size.w - (i + 1) * el.fontSize * 1.3 + el.fontSize * 0.15}
            y={0}
            width={el.fontSize * 1.1}
            align="center"
            lineHeight={1.08}
            text={toVertical(col)}
          />
        ))
      ) : (
        <Text {...common} width={el.width} align={el.align} lineHeight={1.3} text={el.text} />
      )}
    </Group>
  );
}

// ---------- 画像素材 ----------

export function ImageShape({ el, src, h: handlers }: { el: ImageEl; src?: string; h: ShapeHandlers }) {
  const [img] = useImage(src ?? '');
  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
    >
      {img ? (
        <KImage image={img} width={el.width} height={el.height} />
      ) : (
        <Rect width={el.width} height={el.height} fill="#eef0f4" stroke="#c5cbd6" dash={[6, 4]} />
      )}
    </Group>
  );
}

// ---------- 分岐点 ----------

export function JunctionShape({ el, scale, selected, h: handlers }: { el: JunctionEl; scale: number; selected: boolean; h: ShapeHandlers }) {
  const r = 5 / scale;
  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
    >
      {el.dot && <Circle radius={el.dotSize / 2} fill={el.dotColor} listening={false} />}
      {/* 編集用の目印（画像には出ない） */}
      <Circle
        name="ui"
        radius={selected ? r * 1.4 : r}
        fill={selected ? '#4f8cff' : '#ffffff'}
        stroke="#4f8cff"
        strokeWidth={1.5 / scale}
        hitStrokeWidth={10 / scale}
      />
    </Group>
  );
}

// ---------- 矢印 ----------

export function EdgeShape(props: {
  el: EdgeEl;
  from?: BoxElement;
  to?: BoxElement;
  selected: boolean;
  h: ShapeHandlers;
}) {
  const { el, from, to, selected, h: handlers } = props;
  if (!from || !to || from.hidden || to.hidden) return null;
  const geo = edgeGeometry(el, from, to);
  const head = el.head;
  const w0 = el.strokeWidth;
  const w1 = el.taper ? el.endWidth : el.strokeWidth;
  const lp = pointAlong(geo.points, el.labelPos);
  const pts = geo.points;

  let label: React.ReactNode = null;
  if (el.label) {
    const text = el.labelVertical ? toVertical(el.label) : el.label;
    const tw = el.labelVertical ? el.labelSize * 1.1 : measureText(el.label, el.labelSize, true, el.labelFont);
    const th = el.labelVertical ? [...el.label].length * el.labelSize * 1.08 : el.labelSize * 1.2;
    const pad = 4;
    label = (
      <Label x={lp.x - tw / 2 - pad} y={lp.y - th / 2 - pad}>
        <Tag fill={isTransparent(el.labelBg) ? undefined : el.labelBg} cornerRadius={2} />
        <Text
          text={text}
          padding={pad}
          fontSize={el.labelSize}
          fontStyle={boldStyle(el.labelFont, true)}
          fontFamily={fontStack(el.labelFont)}
          fill={el.labelColor}
          align="center"
          lineHeight={el.labelVertical ? 1.08 : 1.2}
          width={tw + pad * 2}
        />
      </Label>
    );
  }

  const tracePath = (ctx: Konva.Context) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  };

  return (
    <Group
      id={el.id}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
    >
      {selected && (
        <Line
          name="ui"
          points={pts}
          stroke="#4f8cff"
          opacity={0.35}
          strokeWidth={Math.max(w0, w1) + 8}
          lineJoin="round"
          lineCap="round"
          listening={false}
        />
      )}
      <Shape
        stroke={el.stroke}
        strokeWidth={Math.max(w0, w1)}
        hitStrokeWidth={Math.max(14, Math.max(w0, w1) + 10)}
        sceneFunc={(ctx) =>
          drawEdge(ctx._context, pts, {
            color: el.stroke,
            w0,
            w1,
            dash: el.dash,
            headStart: head === 'start' || head === 'both',
            headEnd: head === 'end' || head === 'both',
            headSize: el.headSize,
            roundStart: from.type === 'junction',
            roundEnd: to.type === 'junction',
            miter: el.routing === 'orthogonal',
          })
        }
        hitFunc={(ctx, shape) => {
          tracePath(ctx);
          ctx.strokeShape(shape);
        }}
      />
      {label}
    </Group>
  );
}
