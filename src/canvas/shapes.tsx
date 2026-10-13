import { Arrow, Circle, Ellipse, Group, Image as KImage, Label, Line, Rect, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import type { BoxElement, CardEl, EdgeEl, FrameEl, ImageEl, TextEl } from '../model/types';
import { FONT_FAMILY } from '../model/defaults';
import { edgeGeometry, pointAlong, textSize } from '../model/geometry';
import { dashArray, measureText, toVertical } from './text';

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

function Placeholder({ x, y, w, h, title, round }: { x: number; y: number; w: number; h: number; title: string; round?: boolean }) {
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
        fontStyle="bold"
        fontFamily={FONT_FAMILY}
        fill="#9aa4b4"
      />
    </Group>
  );
}

// ---------- カード ----------

export function CardShape({ el, src, h: handlers }: { el: CardEl; src?: string; h: ShapeHandlers }) {
  const { width: w, height: h } = el;
  const hasImage = !!src;
  const layout = !hasImage && el.noImage === 'nameOnly' ? 'nameOnly' : el.layout;
  const textH = el.titleSize * 1.35 + (el.subtitle ? el.subtitleSize * 1.5 : 0) + 10;
  const r = el.cornerRadius;

  const titleProps = {
    text: el.title,
    fontSize: el.titleSize,
    fontStyle: 'bold',
    fontFamily: FONT_FAMILY,
    fill: el.titleColor,
    wrap: 'none' as const,
    ellipsis: true,
    listening: false,
  };
  const subProps = {
    text: el.subtitle,
    fontSize: el.subtitleSize,
    fontFamily: FONT_FAMILY,
    fill: el.subtitleColor,
    wrap: 'none' as const,
    ellipsis: true,
    listening: false,
  };

  let body: React.ReactNode;
  if (layout === 'photo') {
    const ph = Math.max(10, h - textH);
    body = (
      <>
        <Group clipFunc={(ctx) => roundRectPath(ctx, 0, 0, w, h, r)} listening={false}>
          {hasImage ? (
            <CoverImage src={src!} x={0} y={0} w={w} h={ph} zoom={el.imageZoom} fx={el.imageFocusX} fy={el.imageFocusY} />
          ) : (
            <Placeholder x={0} y={0} w={w} h={ph} title={el.title} />
          )}
        </Group>
        <Text {...titleProps} x={4} y={ph + 6} width={w - 8} align="center" />
        {el.subtitle && <Text {...subProps} x={4} y={ph + 8 + el.titleSize * 1.3} width={w - 8} align="center" />}
      </>
    );
  } else if (layout === 'circle') {
    const d = Math.max(10, Math.min(w - 12, h - textH - 8));
    const cx = w / 2,
      cy = 6 + d / 2;
    body = (
      <>
        <Group clipFunc={(ctx) => ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)} listening={false}>
          {hasImage ? (
            <CoverImage src={src!} x={cx - d / 2} y={cy - d / 2} w={d} h={d} zoom={el.imageZoom} fx={el.imageFocusX} fy={el.imageFocusY} />
          ) : (
            <Placeholder x={cx - d / 2} y={cy - d / 2} w={d} h={d} title={el.title} round />
          )}
        </Group>
        <Text {...titleProps} x={4} y={d + 14} width={w - 8} align="center" />
        {el.subtitle && <Text {...subProps} x={4} y={d + 16 + el.titleSize * 1.3} width={w - 8} align="center" />}
      </>
    );
  } else if (layout === 'inline') {
    const s = Math.max(10, h - 10);
    const tx = s + 14;
    const block = el.titleSize * 1.25 + (el.subtitle ? el.subtitleSize * 1.4 : 0);
    const ty = (h - block) / 2;
    body = (
      <>
        <Group clipFunc={(ctx) => roundRectPath(ctx, 5, 5, s, s, Math.min(r, s / 2))} listening={false}>
          {hasImage ? (
            <CoverImage src={src!} x={5} y={5} w={s} h={s} zoom={el.imageZoom} fx={el.imageFocusX} fy={el.imageFocusY} />
          ) : (
            <Placeholder x={5} y={5} w={s} h={s} title={el.title} />
          )}
        </Group>
        <Text {...titleProps} x={tx} y={ty} width={Math.max(10, w - tx - 6)} />
        {el.subtitle && <Text {...subProps} x={tx} y={ty + el.titleSize * 1.3} width={Math.max(10, w - tx - 6)} />}
      </>
    );
  } else {
    const block = el.titleSize * 1.25 + (el.subtitle ? el.subtitleSize * 1.5 : 0);
    const ty = (h - block) / 2;
    body = (
      <>
        <Text {...titleProps} x={4} y={ty} width={w - 8} align="center" />
        {el.subtitle && <Text {...subProps} x={4} y={ty + el.titleSize * 1.35} width={w - 8} align="center" />}
      </>
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
      {body}
      {el.badge && <Badge text={el.badge} fill={el.badgeFill} color={el.badgeColor} />}
    </Group>
  );
}

function Badge({ text, fill, color }: { text: string; fill: string; color: string }) {
  const size = 14;
  const tw = measureText(text, size, true);
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={tw + 12} height={size + 10} fill={fill} cornerRadius={[0, 0, 4, 0]} />
      <Text x={6} y={5} text={text} fontSize={size} fontStyle="bold" fontFamily={FONT_FAMILY} fill={color} />
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

function FrameTitle({ el, onDown, onDbl }: { el: FrameEl; onDown: (e: KEvt) => void; onDbl: () => void }) {
  const size = el.titleSize;
  const subSize = Math.max(9, Math.round(size * 0.5));
  const tw = Math.max(measureText(el.title, size, true), el.subtitle ? measureText(el.subtitle, subSize, true) : 0);
  const bw = tw + 20;
  const bh = size * 1.3 + (el.subtitle ? subSize * 1.3 : 0) + 10;
  // 多角形は最上段の左端を基準にする
  let ax = 0;
  if (el.shape === 'polygon') {
    const ys = el.points.filter((_, i) => i % 2 === 1);
    const minY = Math.min(...ys);
    const xs = el.points.filter((_, i) => i % 2 === 0 && el.points[i + 1] === minY);
    ax = Math.min(...xs);
  }
  let x = el.x + ax + 12,
    y = el.y + 10;
  if (el.titlePos === 'onTopEdge') y = el.y - bh / 2;
  if (el.titlePos === 'outsideTopLeft') {
    x = el.x + ax;
    y = el.y - bh - 4;
  }
  const bg = isTransparent(el.titleBg) ? undefined : el.titleBg;
  return (
    <Group x={x} y={y} onPointerDown={onDown} onDblClick={onDbl} onDblTap={onDbl}>
      <Rect width={bw} height={bh} fill={bg} cornerRadius={2} hitFunc={(ctx, s) => { ctx.beginPath(); ctx.rect(0, 0, bw, bh); ctx.fillStrokeShape(s); }} />
      <Text x={10} y={5} text={el.title} fontSize={size} fontStyle="bold" fontFamily={FONT_FAMILY} fill={el.titleColor} listening={false} />
      {el.subtitle && (
        <Text x={10} y={5 + size * 1.25} text={el.subtitle} fontSize={subSize} fontStyle="bold" fontFamily={FONT_FAMILY} fill={el.titleColor} opacity={0.8} listening={false} />
      )}
    </Group>
  );
}

// ---------- テキスト ----------

export function TextShape({ el, h: handlers }: { el: TextEl; h: ShapeHandlers }) {
  const common = {
    fontSize: el.fontSize,
    fontStyle: el.bold ? 'bold' : 'normal',
    fontFamily: FONT_FAMILY,
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
  const sw = el.strokeWidth;
  const head = el.head;
  const lp = pointAlong(geo.points, el.labelPos);

  let label: React.ReactNode = null;
  if (el.label) {
    const text = el.labelVertical ? toVertical(el.label) : el.label;
    const tw = el.labelVertical ? el.labelSize * 1.1 : measureText(el.label, el.labelSize, true);
    const th = el.labelVertical ? [...el.label].length * el.labelSize * 1.08 : el.labelSize * 1.2;
    const pad = 4;
    label = (
      <Label x={lp.x - tw / 2 - pad} y={lp.y - th / 2 - pad}>
        <Tag fill={isTransparent(el.labelBg) ? undefined : el.labelBg} cornerRadius={2} />
        <Text
          text={text}
          padding={pad}
          fontSize={el.labelSize}
          fontStyle="bold"
          fontFamily={FONT_FAMILY}
          fill={el.labelColor}
          align="center"
          lineHeight={el.labelVertical ? 1.08 : 1.2}
          width={tw + pad * 2}
        />
      </Label>
    );
  }

  return (
    <Group
      id={el.id}
      visible={!el.hidden}
      onPointerDown={(e) => handlers.onDown(e, el.id)}
      onDblClick={() => handlers.onDbl(el.id)}
    >
      {selected && (
        <Arrow
          name="ui"
          points={geo.points}
          tension={geo.tension}
          stroke="#4f8cff"
          fill="#4f8cff"
          opacity={0.35}
          strokeWidth={sw + 8}
          pointerLength={0}
          pointerWidth={0}
          lineJoin="round"
          lineCap="round"
          listening={false}
        />
      )}
      <Arrow
        points={geo.points}
        tension={geo.tension}
        stroke={el.stroke}
        fill={el.stroke}
        strokeWidth={sw}
        dash={dashArray(el.dash, sw)}
        lineCap={el.dash === 'dotted' ? 'round' : 'butt'}
        lineJoin="miter"
        pointerLength={el.headSize}
        pointerWidth={el.headSize}
        pointerAtEnding={head === 'end' || head === 'both'}
        pointerAtBeginning={head === 'start' || head === 'both'}
        hitStrokeWidth={Math.max(14, sw + 10)}
      />
      {label}
    </Group>
  );
}
