import { patchDoc, patchEls, useStore } from '../store/useStore';
import type { BoxElement, CardEl, Dash, Doc, EdgeEl, Element, FrameEl, Id, ImageEl, Side, TextEl } from '../model/types';
import {
  CANVAS_PRESETS,
  CARD_PRESETS,
  EDGE_PRESETS,
  FRAME_PRESETS,
  POLYGON_TEMPLATES,
} from '../model/defaults';
import { boxOf, isBox, normalizePolygon } from '../model/geometry';
import { Check, ColorInput, NumberInput, Row, Section, Seg, Select, Slider, TextArea, TextInput } from './controls';
import { fileToDataUrl, loadImage, pickFiles } from '../io/image';

const DASH_OPTIONS: { value: Dash; label: string }[] = [
  { value: 'solid', label: '実線' },
  { value: 'dashed', label: '破線' },
  { value: 'dotted', label: '点線' },
];

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: 'auto', label: '自動' },
  { value: 'top', label: '上' },
  { value: 'right', label: '右' },
  { value: 'bottom', label: '下' },
  { value: 'left', label: '左' },
];

export function PropertiesPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const selected = selection.map((id) => doc.elements.find((e) => e.id === id)).filter((e): e is Element => !!e);

  return (
    <aside className="panel right-panel">
      {selected.length === 0 && <DocProps doc={doc} />}
      {selected.length === 1 && <SingleProps el={selected[0]} />}
      {selected.length > 1 && <MultiProps els={selected} />}
    </aside>
  );
}

// ---------- 何も選んでいないとき：キャンバス設定 ----------

function DocProps({ doc }: { doc: Doc }) {
  const preset = CANVAS_PRESETS.find((p) => p.width === doc.width && p.height === doc.height);
  return (
    <>
      <Section title="相関図">
        <Row label="タイトル">
          <TextInput value={doc.title} onChange={(v) => patchDoc({ title: v })} />
        </Row>
      </Section>
      <Section title="キャンバス">
        <Row label="サイズ">
          <select
            value={preset ? preset.label : 'custom'}
            onChange={(e) => {
              const p = CANVAS_PRESETS.find((x) => x.label === e.target.value);
              if (p) useStore.getState().commit((d) => ({ ...d, width: p.width, height: p.height }));
            }}
          >
            {CANVAS_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
            <option value="custom">任意のサイズ</option>
          </select>
        </Row>
        <Row label="幅 × 高さ">
          <span className="pair">
            <NumberInput value={doc.width} min={100} max={8000} onChange={(v) => patchDoc({ width: v })} />
            <NumberInput value={doc.height} min={100} max={8000} onChange={(v) => patchDoc({ height: v })} />
          </span>
        </Row>
        <Row label="背景">
          <ColorInput value={doc.background} onChange={(v) => patchDoc({ background: v })} />
        </Row>
        <Row label="グラデーション">
          <span className="color-input">
            <Check checked={!!doc.background2} onChange={(on) => patchDoc({ background2: on ? '#e8f1fb' : undefined })} label="" />
            {doc.background2 && <ColorInput value={doc.background2} onChange={(v) => patchDoc({ background2: v })} />}
          </span>
        </Row>
      </Section>
      <Section title="グリッド">
        <Row label="間隔(px)">
          <NumberInput
            value={doc.settings.gridSize}
            min={4}
            max={200}
            onChange={(v) => patchDoc((d) => ({ settings: { ...d.settings, gridSize: Math.max(4, v) } }))}
          />
        </Row>
        <p className="hint">ドラッグ中に Ctrl（Mac は ⌘）を押すと、吸着の ON/OFF を一時的に切り替えられます。</p>
      </Section>
      <Section title="使い方">
        <ul className="hint-list">
          <li>上のツールでカード・枠・テキストを選び、キャンバスをクリックして配置</li>
          <li>矢印ツールで「始点 → 終点」の順にクリック</li>
          <li>写真はカードの上に画像ファイルをドラッグ＆ドロップ、またはコピーして貼り付け</li>
          <li>多角形の枠はダブルクリックで頂点編集</li>
          <li>Shift+クリックで複数選択、空白をドラッグで範囲選択</li>
          <li>Ctrl+ホイールで拡大縮小、スペース＋ドラッグで移動</li>
        </ul>
      </Section>
    </>
  );
}

// ---------- 1つ選択 ----------

function SingleProps({ el }: { el: Element }) {
  const p = (patch: Partial<Element> | ((e: Element) => Partial<Element>)) => patchEls([el.id], patch);
  return (
    <>
      {el.type === 'card' && <CardProps el={el} p={p} />}
      {el.type === 'frame' && <FrameProps el={el} p={p} />}
      {el.type === 'edge' && <EdgeProps el={el} p={p} />}
      {el.type === 'text' && <TextProps el={el} p={p} />}
      {el.type === 'image' && <ImageProps el={el} p={p} />}
      {isBox(el) && <GeometryProps els={[el]} />}
      <CommonActions ids={[el.id]} />
    </>
  );
}

type P = (patch: Partial<Element> | ((e: Element) => Partial<Element>)) => void;

function PresetButtons<T>({ presets, onPick }: { presets: { key: string; label: string; style: Partial<T> }[]; onPick: (s: Partial<T>) => void }) {
  return (
    <div className="preset-grid">
      {presets.map((pr) => {
        const st = pr.style as Record<string, string>;
        return (
          <button key={pr.key} type="button" className="preset" onClick={() => onPick(pr.style)} title={pr.label}>
            <span className="swatch" style={{ background: st.fill2 ? `linear-gradient(135deg, ${st.fill}, ${st.fill2})` : (st.fill ?? st.stroke ?? '#fff'), borderColor: st.stroke }} />
            {pr.label}
          </button>
        );
      })}
    </div>
  );
}

async function chooseImage(): Promise<{ id: Id; width: number; height: number } | null> {
  const [file] = await pickFiles('image/*');
  if (!file) return null;
  const { dataUrl, width, height } = await fileToDataUrl(file);
  return { id: useStore.getState().addAsset(dataUrl), width, height };
}

function CardProps({ el, p }: { el: CardEl; p: P }) {
  const hasImage = !!el.imageId;
  return (
    <>
      <Section title="人物・組織カード">
        <Row label="名前">
          <TextInput value={el.title} onChange={(v) => p({ title: v })} autoFocusKey />
        </Row>
        <Row label="サブテキスト">
          <TextInput value={el.subtitle} onChange={(v) => p({ subtitle: v })} placeholder="演者名・肩書など" />
        </Row>
        <Row label="バッジ">
          <span className="color-input">
            <TextInput value={el.badge} onChange={(v) => p({ badge: v })} placeholder="父・母など" />
            <ColorInput value={el.badgeFill} onChange={(v) => p({ badgeFill: v })} />
          </span>
        </Row>
      </Section>
      <Section title="表示形式">
        <Seg
          value={el.layout}
          onChange={(v) => p({ layout: v })}
          options={[
            { value: 'photo', label: '写真' },
            { value: 'circle', label: '丸' },
            { value: 'inline', label: '横並び' },
            { value: 'nameOnly', label: '名前のみ' },
          ]}
        />
        <Row label="写真">
          <span className="btn-row">
            <button
              type="button"
              onClick={async () => {
                const img = await chooseImage();
                if (img) p({ imageId: img.id, layout: el.layout === 'nameOnly' ? 'photo' : el.layout });
              }}
            >
              {hasImage ? '差し替え' : '選ぶ'}
            </button>
            {hasImage && (
              <button type="button" onClick={() => p({ imageId: undefined })}>
                外す
              </button>
            )}
          </span>
        </Row>
        {hasImage ? (
          <>
            <Row label="拡大">
              <Slider value={el.imageZoom} min={1} max={3} onChange={(v) => p({ imageZoom: v })} />
            </Row>
            <Row label="位置（横）">
              <Slider value={el.imageFocusX} min={0} max={1} onChange={(v) => p({ imageFocusX: v })} />
            </Row>
            <Row label="位置（縦）">
              <Slider value={el.imageFocusY} min={0} max={1} onChange={(v) => p({ imageFocusY: v })} />
            </Row>
          </>
        ) : (
          el.layout !== 'nameOnly' && (
            <Row label="写真がないとき">
              <Select
                value={el.noImage}
                onChange={(v) => p({ noImage: v })}
                options={[
                  { value: 'nameOnly', label: '名前だけのカード' },
                  { value: 'initial', label: '頭文字アイコン' },
                ]}
              />
            </Row>
          )
        )}
      </Section>
      <Section title="スタイル">
        <PresetButtons<CardEl> presets={CARD_PRESETS} onPick={(s) => p(s)} />
        <Row label="背景">
          <ColorInput value={el.fill} onChange={(v) => p({ fill: v })} allowNone />
        </Row>
        <Row label="枠線">
          <span className="color-input">
            <ColorInput value={el.stroke} onChange={(v) => p({ stroke: v })} />
            <NumberInput value={el.strokeWidth} min={0} max={20} onChange={(v) => p({ strokeWidth: v })} />
          </span>
        </Row>
        <Row label="角の丸み">
          <Slider value={el.cornerRadius} min={0} max={40} step={1} onChange={(v) => p({ cornerRadius: v })} />
        </Row>
        <Row label="名前の文字">
          <span className="color-input">
            <ColorInput value={el.titleColor} onChange={(v) => p({ titleColor: v })} />
            <NumberInput value={el.titleSize} min={6} max={80} onChange={(v) => p({ titleSize: v })} />
          </span>
        </Row>
        <Row label="サブの文字">
          <span className="color-input">
            <ColorInput value={el.subtitleColor} onChange={(v) => p({ subtitleColor: v })} />
            <NumberInput value={el.subtitleSize} min={6} max={60} onChange={(v) => p({ subtitleSize: v })} />
          </span>
        </Row>
        <Row label="影">
          <Check checked={el.shadow} onChange={(v) => p({ shadow: v })} label="つける" />
        </Row>
      </Section>
    </>
  );
}

function FrameProps({ el, p }: { el: FrameEl; p: P }) {
  const vertexEdit = useStore((s) => s.vertexEdit);
  const ortho = useStore((s) => s.orthoVertex);
  const editing = vertexEdit === el.id;

  const toPolygon = (key: string) => {
    const tpl = POLYGON_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    const points = tpl.points.map((v, i) => Math.round(v * (i % 2 === 0 ? el.width : el.height)));
    useStore.getState().updateEl(el.id, { shape: 'polygon', points } as Partial<Element>);
  };

  return (
    <>
      <Section title="枠">
        <Row label="見出し">
          <TextInput value={el.title} onChange={(v) => p({ title: v })} autoFocusKey />
        </Row>
        <Row label="英字サブ">
          <TextInput value={el.subtitle} onChange={(v) => p({ subtitle: v })} placeholder="例：TATSUMI GAKUEN" />
        </Row>
        <Row label="見出し位置">
          <Select
            value={el.titlePos}
            onChange={(v) => p({ titlePos: v })}
            options={[
              { value: 'insideTopLeft', label: '内側の左上' },
              { value: 'onTopEdge', label: '上辺に重ねる' },
              { value: 'outsideTopLeft', label: '外側の左上' },
              { value: 'none', label: '表示しない' },
            ]}
          />
        </Row>
        <Row label="見出しの文字">
          <span className="color-input">
            <ColorInput value={el.titleColor} onChange={(v) => p({ titleColor: v })} />
            <NumberInput value={el.titleSize} min={8} max={80} onChange={(v) => p({ titleSize: v })} />
          </span>
        </Row>
        <Row label="見出しの背景">
          <ColorInput value={el.titleBg} onChange={(v) => p({ titleBg: v })} allowNone />
        </Row>
      </Section>
      <Section title="形">
        <Seg
          value={el.shape}
          onChange={(v) => {
            if (v === 'polygon') toPolygon('rectPoly');
            else useStore.getState().updateEl(el.id, { shape: v } as Partial<Element>);
          }}
          options={[
            { value: 'rect', label: '四角' },
            { value: 'ellipse', label: '楕円' },
            { value: 'polygon', label: '多角形' },
          ]}
        />
        <Row label="テンプレート">
          <select value="" onChange={(e) => e.target.value && toPolygon(e.target.value)}>
            <option value="">多角形の形を選ぶ…</option>
            {POLYGON_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Row>
        {el.shape === 'rect' && (
          <Row label="角の丸み">
            <Slider value={el.cornerRadius} min={0} max={80} step={1} onChange={(v) => p({ cornerRadius: v })} />
          </Row>
        )}
        {el.shape === 'polygon' && (
          <>
            <Row label="頂点編集">
              <button
                type="button"
                className={editing ? 'primary' : ''}
                onClick={() => useStore.getState().set({ vertexEdit: editing ? null : el.id })}
              >
                {editing ? '編集を終える' : '頂点を編集'}
              </button>
            </Row>
            <Row label="直角を保つ">
              <Check checked={ortho} onChange={(v) => useStore.getState().set({ orthoVertex: v })} label="辺を水平・垂直のまま動かす" />
            </Row>
            {editing && (
              <p className="hint">
                青い点をドラッグで移動、辺の中央の□をクリックで頂点を追加、頂点をダブルクリック（または Alt+クリック）で削除。
              </p>
            )}
          </>
        )}
      </Section>
      <Section title="スタイル">
        <PresetButtons<FrameEl> presets={FRAME_PRESETS} onPick={(s) => p(s)} />
        <Row label="塗り">
          <span className="color-input">
            <ColorInput value={el.fill} onChange={(v) => p({ fill: v })} />
            <Check checked={!!el.fill2} onChange={(on) => p({ fill2: on ? '#ffffff' : undefined })} label="グラデ" />
            {el.fill2 && <ColorInput value={el.fill2} onChange={(v) => p({ fill2: v })} />}
          </span>
        </Row>
        <Row label="塗りの濃さ">
          <Slider value={el.fillOpacity} min={0} max={1} onChange={(v) => p({ fillOpacity: v })} />
        </Row>
        <Row label="線">
          <span className="color-input">
            <ColorInput value={el.stroke} onChange={(v) => p({ stroke: v })} />
            <NumberInput value={el.strokeWidth} min={0} max={30} onChange={(v) => p({ strokeWidth: v })} />
          </span>
        </Row>
        <Row label="線の種類">
          <Seg value={el.dash} onChange={(v) => p({ dash: v })} options={DASH_OPTIONS} />
        </Row>
      </Section>
    </>
  );
}

function EdgeProps({ el, p }: { el: EdgeEl; p: P }) {
  const elements = useStore((s) => s.doc.elements);
  const nodes = elements.filter(isBox);
  const nodeOptions = nodes.map((n) => ({ value: n.id, label: displayName(n) }));
  return (
    <>
      <Section title="矢印">
        <Row label="ラベル">
          <TextInput value={el.label} onChange={(v) => p({ label: v })} autoFocusKey placeholder="親子・信頼など" />
        </Row>
        <Row label="始点">
          <Select value={el.from} options={nodeOptions} onChange={(v) => p({ from: v })} />
        </Row>
        <Row label="終点">
          <Select value={el.to} options={nodeOptions} onChange={(v) => p({ to: v })} />
        </Row>
        <Row label="向き">
          <span className="btn-row">
            <Seg
              value={el.head}
              onChange={(v) => p({ head: v })}
              options={[
                { value: 'end', label: '→' },
                { value: 'both', label: '↔' },
                { value: 'start', label: '←' },
                { value: 'none', label: '—' },
              ]}
            />
            <button type="button" title="始点と終点を入れ替え" onClick={() => p({ from: el.to, to: el.from, fromSide: el.toSide, toSide: el.fromSide })}>
              入替
            </button>
          </span>
        </Row>
      </Section>
      <Section title="経路">
        <Seg
          value={el.routing}
          onChange={(v) => p({ routing: v, bend: v === 'curved' ? 0.75 : 0.5 })}
          options={[
            { value: 'orthogonal', label: '直角' },
            { value: 'straight', label: '直線' },
            { value: 'curved', label: '曲線' },
          ]}
        />
        <Row label="出る辺">
          <Select value={el.fromSide} options={SIDE_OPTIONS} onChange={(v) => p({ fromSide: v })} />
        </Row>
        <Row label="入る辺">
          <Select value={el.toSide} options={SIDE_OPTIONS} onChange={(v) => p({ toSide: v })} />
        </Row>
        {el.routing !== 'straight' && (
          <Row label={el.routing === 'curved' ? '曲がり具合' : '折れ位置'}>
            <Slider value={el.bend} min={0} max={1} onChange={(v) => p({ bend: v })} />
          </Row>
        )}
      </Section>
      <Section title="スタイル">
        <PresetButtons<EdgeEl> presets={EDGE_PRESETS} onPick={(s) => p(s)} />
        <Row label="線">
          <span className="color-input">
            <ColorInput value={el.stroke} onChange={(v) => p({ stroke: v })} />
            <NumberInput value={el.strokeWidth} min={1} max={30} onChange={(v) => p({ strokeWidth: v })} />
          </span>
        </Row>
        <Row label="線の種類">
          <Seg value={el.dash} onChange={(v) => p({ dash: v })} options={DASH_OPTIONS} />
        </Row>
        <Row label="矢じりの大きさ">
          <Slider value={el.headSize} min={4} max={40} step={1} onChange={(v) => p({ headSize: v })} />
        </Row>
      </Section>
      <Section title="ラベル">
        <Row label="文字">
          <span className="color-input">
            <ColorInput value={el.labelColor} onChange={(v) => p({ labelColor: v })} />
            <NumberInput value={el.labelSize} min={6} max={60} onChange={(v) => p({ labelSize: v })} />
          </span>
        </Row>
        <Row label="背景">
          <ColorInput value={el.labelBg} onChange={(v) => p({ labelBg: v })} allowNone />
        </Row>
        <Row label="位置">
          <Slider value={el.labelPos} min={0} max={1} onChange={(v) => p({ labelPos: v })} />
        </Row>
        <Row label="縦書き">
          <Check checked={el.labelVertical} onChange={(v) => p({ labelVertical: v })} label="縦に並べる" />
        </Row>
      </Section>
    </>
  );
}

function TextProps({ el, p }: { el: TextEl; p: P }) {
  return (
    <Section title="テキスト">
      <TextArea value={el.text} onChange={(v) => p({ text: v })} autoFocusKey />
      <Row label="文字">
        <span className="color-input">
          <ColorInput value={el.fill} onChange={(v) => p({ fill: v })} />
          <NumberInput value={el.fontSize} min={6} max={200} onChange={(v) => p({ fontSize: v })} />
        </span>
      </Row>
      <Row label="書式">
        <span className="btn-row">
          <Check checked={el.bold} onChange={(v) => p({ bold: v })} label="太字" />
          <Check checked={el.vertical} onChange={(v) => p({ vertical: v })} label="縦書き" />
        </span>
      </Row>
      {!el.vertical && (
        <Row label="揃え">
          <Seg
            value={el.align}
            onChange={(v) => p({ align: v })}
            options={[
              { value: 'left', label: '左' },
              { value: 'center', label: '中' },
              { value: 'right', label: '右' },
            ]}
          />
        </Row>
      )}
      <Row label="縁取り">
        <span className="color-input">
          <ColorInput value={el.strokeColor} onChange={(v) => p({ strokeColor: v })} />
          <NumberInput value={el.strokeWidth} min={0} max={20} onChange={(v) => p({ strokeWidth: v })} />
        </span>
      </Row>
    </Section>
  );
}

function ImageProps({ el, p }: { el: ImageEl; p: P }) {
  const src = useStore((s) => s.assets[el.imageId]);
  return (
    <Section title="画像">
      <Row label="画像">
        <span className="btn-row">
          <button
            type="button"
            onClick={async () => {
              const img = await chooseImage();
              if (img) p({ imageId: img.id, height: (el.width * img.height) / img.width });
            }}
          >
            差し替え
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!src) return;
              const img = await loadImage(src);
              p({ height: (el.width * img.naturalHeight) / img.naturalWidth });
            }}
          >
            元の比率
          </button>
        </span>
      </Row>
    </Section>
  );
}

function GeometryProps({ els }: { els: BoxElement[] }) {
  const el = els[0];
  const b = boxOf(el);
  const sized = el.type === 'card' || el.type === 'frame' || el.type === 'image';
  const setPos = (k: 'x' | 'y', v: number) => patchEls([el.id], { [k]: v } as Partial<Element>);
  const setSize = (k: 'width' | 'height', v: number) => {
    if (el.type === 'frame' && el.shape === 'polygon') {
      const sx = k === 'width' ? v / el.width : 1;
      const sy = k === 'height' ? v / el.height : 1;
      patchEls([el.id], (e) => {
        const f = e as FrameEl;
        return normalizePolygon({ ...f, points: f.points.map((p, i) => (i % 2 === 0 ? p * sx : p * sy)) });
      });
    } else patchEls([el.id], { [k]: Math.max(10, v) } as Partial<Element>);
  };
  return (
    <Section title="位置とサイズ">
      <Row label="X / Y">
        <span className="pair">
          <NumberInput value={b.x} onChange={(v) => setPos('x', v)} />
          <NumberInput value={b.y} onChange={(v) => setPos('y', v)} />
        </span>
      </Row>
      <Row label={sized ? '幅 / 高さ' : '幅'}>
        <span className="pair">
          <NumberInput value={b.w} min={10} onChange={(v) => (el.type === 'text' ? patchEls([el.id], { width: v } as Partial<Element>) : setSize('width', v))} />
          {sized && <NumberInput value={b.h} min={10} onChange={(v) => setSize('height', v)} />}
        </span>
      </Row>
    </Section>
  );
}

function CommonActions({ ids }: { ids: Id[] }) {
  const st = useStore.getState();
  const elements = useStore((s) => s.doc.elements);
  const styleClip = useStore((s) => s.styleClipboard);
  const sel = elements.filter((e) => ids.includes(e.id));
  const allHidden = sel.every((e) => e.hidden);
  const allLocked = sel.every((e) => e.locked);
  return (
    <Section title="操作">
      <div className="btn-grid">
        <button type="button" onClick={() => st.reorder(ids, 'front')}>最前面へ</button>
        <button type="button" onClick={() => st.reorder(ids, 'up')}>前面へ</button>
        <button type="button" onClick={() => st.reorder(ids, 'down')}>背面へ</button>
        <button type="button" onClick={() => st.reorder(ids, 'back')}>最背面へ</button>
        <button type="button" onClick={() => st.commit((d) => ({ ...d, elements: d.elements.map((e) => (ids.includes(e.id) ? { ...e, hidden: !allHidden } : e)) }))}>
          {allHidden ? '表示する' : '隠す'}
        </button>
        <button type="button" onClick={() => st.commit((d) => ({ ...d, elements: d.elements.map((e) => (ids.includes(e.id) ? { ...e, locked: !allLocked } : e)) }))}>
          {allLocked ? 'ロック解除' : 'ロック'}
        </button>
        <button type="button" onClick={() => st.copyStyle()} disabled={ids.length !== 1}>スタイルをコピー</button>
        <button type="button" onClick={() => st.pasteStyle()} disabled={!styleClip}>スタイルを貼付</button>
        <button type="button" onClick={() => st.duplicate()}>複製</button>
        <button type="button" className="danger" onClick={() => st.removeSelected()}>削除</button>
      </div>
    </Section>
  );
}

// ---------- 複数選択 ----------

function MultiProps({ els }: { els: Element[] }) {
  const boxes = els.filter(isBox);
  const ids = els.map((e) => e.id);
  const types = new Set(els.map((e) => e.type));
  const onlyType = types.size === 1 ? els[0].type : null;

  const align = (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const bs = boxes.map(boxOf);
    const minX = Math.min(...bs.map((b) => b.x)),
      maxX = Math.max(...bs.map((b) => b.x + b.w));
    const minY = Math.min(...bs.map((b) => b.y)),
      maxY = Math.max(...bs.map((b) => b.y + b.h));
    const map = new Map(boxes.map((e, i) => [e.id, bs[i]]));
    useStore.getState().commit((d) => ({
      ...d,
      elements: d.elements.map((e) => {
        const b = map.get(e.id);
        if (!b || e.locked) return e;
        const patch =
          mode === 'left' ? { x: minX } :
          mode === 'right' ? { x: maxX - b.w } :
          mode === 'hcenter' ? { x: (minX + maxX) / 2 - b.w / 2 } :
          mode === 'top' ? { y: minY } :
          mode === 'bottom' ? { y: maxY - b.h } :
          { y: (minY + maxY) / 2 - b.h / 2 };
        return { ...e, ...patch } as Element;
      }),
    }));
  };

  const distribute = (axis: 'x' | 'y') => {
    const items = boxes.map((e) => ({ e, b: boxOf(e) })).sort((a, c) => (axis === 'x' ? a.b.x - c.b.x : a.b.y - c.b.y));
    if (items.length < 3) return;
    const first = items[0].b,
      last = items[items.length - 1].b;
    const total = items.reduce((s, it) => s + (axis === 'x' ? it.b.w : it.b.h), 0);
    const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
    const gap = (span - total) / (items.length - 1);
    let cur = axis === 'x' ? first.x : first.y;
    const pos = new Map<Id, number>();
    for (const it of items) {
      pos.set(it.e.id, cur);
      cur += (axis === 'x' ? it.b.w : it.b.h) + gap;
    }
    useStore.getState().commit((d) => ({
      ...d,
      elements: d.elements.map((e) => (pos.has(e.id) && !e.locked ? ({ ...e, [axis]: pos.get(e.id)! } as Element) : e)),
    }));
  };

  const sameSize = () => {
    const ref = boxes[0];
    if (!ref || !('height' in ref)) return;
    useStore.getState().commit((d) => ({
      ...d,
      elements: d.elements.map((e) =>
        ids.includes(e.id) && (e.type === 'card' || e.type === 'image' || (e.type === 'frame' && e.shape !== 'polygon'))
          ? ({ ...e, width: ref.width, height: (ref as CardEl).height } as Element)
          : e,
      ),
    }));
  };

  return (
    <>
      <Section title={`${els.length}個を選択中`}>
        <div className="btn-grid three">
          <button type="button" onClick={() => align('left')}>左揃え</button>
          <button type="button" onClick={() => align('hcenter')}>左右中央</button>
          <button type="button" onClick={() => align('right')}>右揃え</button>
          <button type="button" onClick={() => align('top')}>上揃え</button>
          <button type="button" onClick={() => align('vcenter')}>上下中央</button>
          <button type="button" onClick={() => align('bottom')}>下揃え</button>
          <button type="button" onClick={() => distribute('x')}>横に等間隔</button>
          <button type="button" onClick={() => distribute('y')}>縦に等間隔</button>
          <button type="button" onClick={sameSize} title="最初に選んだ要素のサイズに揃える">同じサイズ</button>
        </div>
      </Section>
      {onlyType === 'card' && (
        <Section title="カードのスタイルを一括変更">
          <PresetButtons<CardEl> presets={CARD_PRESETS} onPick={(s) => patchEls(ids, s as Partial<Element>)} />
          <Seg
            value={(els[0] as CardEl).layout}
            onChange={(v) => patchEls(ids, { layout: v } as Partial<Element>)}
            options={[
              { value: 'photo', label: '写真' },
              { value: 'circle', label: '丸' },
              { value: 'inline', label: '横並び' },
              { value: 'nameOnly', label: '名前のみ' },
            ]}
          />
        </Section>
      )}
      {onlyType === 'frame' && (
        <Section title="枠のスタイルを一括変更">
          <PresetButtons<FrameEl> presets={FRAME_PRESETS} onPick={(s) => patchEls(ids, s as Partial<Element>)} />
        </Section>
      )}
      {onlyType === 'edge' && (
        <Section title="矢印のスタイルを一括変更">
          <PresetButtons<EdgeEl> presets={EDGE_PRESETS} onPick={(s) => patchEls(ids, s as Partial<Element>)} />
        </Section>
      )}
      <CommonActions ids={ids} />
    </>
  );
}

// ---------- 表示名 ----------

export function displayName(e: Element, all?: Element[]): string {
  if (e.name) return e.name;
  switch (e.type) {
    case 'card':
      return e.title || 'カード';
    case 'frame':
      return e.title ? `枠：${e.title}` : '枠';
    case 'text':
      return e.text.split('\n')[0].slice(0, 16) || 'テキスト';
    case 'image':
      return '画像';
    case 'edge': {
      const find = (id: Id) => all?.find((x) => x.id === id);
      const a = find(e.from),
        b = find(e.to);
      const ends = a && b ? `${displayName(a)} → ${displayName(b)}` : '矢印';
      return e.label ? `${e.label}（${ends}）` : ends;
    }
  }
}
