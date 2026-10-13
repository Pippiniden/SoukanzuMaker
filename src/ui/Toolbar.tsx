import { useState } from 'react';
import { patchDoc, useStore, type Tool } from '../store/useStore';
import { POLYGON_TEMPLATES, emptyDoc, makeImage } from '../model/defaults';
import { exportImage } from '../io/exportPng';
import { fileToDataUrl, pickFiles } from '../io/image';
import { loadProjectFile, PROJECT_EXT, saveProjectFile } from '../io/projectFile';
import { sampleDoc } from '../model/sample';
import { NumberInput } from './controls';

const ICONS: Record<string, React.ReactNode> = {
  select: <path d="M5 3l12 7-5 1.5L9.5 17z" />,
  hand: <path d="M8 11V5a1.5 1.5 0 013 0v5m0-1V4a1.5 1.5 0 013 0v6m0-3a1.5 1.5 0 013 0v6a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.5L8 13" />,
  card: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <circle cx="12" cy="9.5" r="3" />
      <path d="M8 18c1-2.5 7-2.5 8 0" />
    </>
  ),
  frame: <path d="M3 9h7V4h11v16H3z" strokeDasharray="0" />,
  text: <path d="M5 5h14M12 5v14M9 19h6" />,
  edge: (
    <>
      <path d="M4 18V8h12" />
      <path d="M13 4l4 4-4 4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.5" />
    </>
  ),
  undo: <path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2" />,
  redo: <path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: '選択', key: 'V' },
  { tool: 'hand', label: '移動', key: 'H' },
  { tool: 'card', label: 'カード', key: 'C' },
  { tool: 'frame', label: '枠', key: 'F' },
  { tool: 'text', label: '文字', key: 'T' },
  { tool: 'edge', label: '矢印', key: 'E' },
];

const FRAME_KINDS = [
  { value: 'rect', label: '四角' },
  { value: 'round', label: '角丸' },
  { value: 'ellipse', label: '楕円' },
  ...POLYGON_TEMPLATES.filter((t) => t.key !== 'rectPoly').map((t) => ({ value: 'poly:' + t.key, label: t.label })),
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const frameKind = useStore((s) => s.frameKind);
  const settings = useStore((s) => s.doc.settings);
  const canUndo = useStore((s) => s.past.length > 0 || !!s.gestureBase);
  const canRedo = useStore((s) => s.future.length > 0);
  const edgeFrom = useStore((s) => s.edgeFrom);
  const scale = useStore((s) => s.view.scale);
  const [menu, setMenu] = useState<null | 'file' | 'export'>(null);
  const st = useStore.getState();

  const setSettings = (p: Partial<typeof settings>) => st.commit((d) => ({ ...d, settings: { ...d.settings, ...p } }));

  const addImage = async () => {
    const files = await pickFiles('image/*', true);
    for (const [i, f] of files.entries()) {
      const { dataUrl, width, height } = await fileToDataUrl(f);
      const id = useStore.getState().addAsset(dataUrl);
      const s = Math.min(1, 300 / Math.max(width, height));
      useStore.getState().addElements([makeImage(60 + i * 20, 60 + i * 20, id, width * s, height * s)]);
    }
  };

  const zoom = (f: number) => {
    const { view, setView } = useStore.getState();
    const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null;
    const cx = (wrap?.clientWidth ?? 800) / 2,
      cy = (wrap?.clientHeight ?? 600) / 2;
    const scale = Math.min(6, Math.max(0.08, view.scale * f));
    setView({ scale, x: cx - ((cx - view.x) / view.scale) * scale, y: cy - ((cy - view.y) / view.scale) * scale });
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <img src="./favicon.svg" alt="" width={24} height={24} />
        <span>相関図メーカー</span>
      </div>

      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            className={`tool ${tool === t.tool ? 'on' : ''}`}
            title={`${t.label}（${t.key}）`}
            onClick={() => st.setTool(t.tool)}
          >
            <Icon name={t.tool} />
            <span>{t.label}</span>
          </button>
        ))}
        <button type="button" className="tool" title="画像素材を追加" onClick={addImage}>
          <Icon name="image" />
          <span>画像</span>
        </button>
      </div>

      {tool === 'frame' && (
        <div className="tool-group">
          <select value={frameKind} onChange={(e) => st.set({ frameKind: e.target.value })} title="作る枠の形">
            {FRAME_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <span className="tool-hint">キャンバスをクリックして配置</span>
        </div>
      )}
      {tool === 'edge' && (
        <div className="tool-group">
          <span className="tool-hint">
            {edgeFrom
              ? '終点をクリック（既存の矢印をクリックすると合流）・Esc で取り消し'
              : '始点のカードや枠をクリック（既存の矢印をクリックするとそこから分岐）'}
          </span>
        </div>
      )}

      <div className="tool-group">
        <button type="button" className="tool" disabled={!canUndo} onClick={() => st.undo()} title="元に戻す（Ctrl+Z）">
          <Icon name="undo" />
        </button>
        <button type="button" className="tool" disabled={!canRedo} onClick={() => st.redo()} title="やり直し（Ctrl+Shift+Z）">
          <Icon name="redo" />
        </button>
      </div>

      <div className="tool-group grid-group">
        <label className="check" title="グリッドを表示">
          <input type="checkbox" checked={settings.showGrid} onChange={(e) => setSettings({ showGrid: e.target.checked })} />
          グリッド
        </label>
        <label className="check" title="操作中の要素をグリッドに吸着（ドラッグ中に Ctrl で一時反転）">
          <input type="checkbox" checked={settings.snap} onChange={(e) => setSettings({ snap: e.target.checked })} />
          吸着
        </label>
        <label className="check" title="他の要素の端・中央に揃えて吸い付け、ガイド線を表示（ドラッグ中に Alt で一時オフ）">
          <input type="checkbox" checked={settings.guides} onChange={(e) => setSettings({ guides: e.target.checked })} />
          ガイド
        </label>
        <NumberInput
          className="grid-size"
          value={settings.gridSize}
          min={4}
          max={200}
          title="グリッド間隔(px)"
          onChange={(v) => patchDoc((d) => ({ settings: { ...d.settings, gridSize: v } }))}
        />
        <button type="button" onClick={() => st.snapAllToGrid()} title="すべての要素の位置とサイズをグリッドに合わせ直す">
          全体を揃える
        </button>
      </div>

      <div className="tool-group">
        <button type="button" onClick={() => zoom(1 / 1.2)} title="縮小">－</button>
        <button type="button" className="zoom-val" onClick={() => window.dispatchEvent(new Event('soukanzu:fit'))} title="全体表示">
          {Math.round(scale * 100)}%
        </button>
        <button type="button" onClick={() => zoom(1.2)} title="拡大">＋</button>
      </div>

      <div className="spacer" />

      <div className="menu-wrap">
        <button type="button" onClick={() => setMenu(menu === 'file' ? null : 'file')}>ファイル ▾</button>
        {menu === 'file' && <FileMenu close={() => setMenu(null)} />}
      </div>
      <div className="menu-wrap">
        <button type="button" className="primary" onClick={() => setMenu(menu === 'export' ? null : 'export')}>
          画像で保存 ▾
        </button>
        {menu === 'export' && <ExportMenu close={() => setMenu(null)} />}
      </div>
    </header>
  );
}

function FileMenu({ close }: { close: () => void }) {
  const run = (fn: () => void | Promise<void>) => async () => {
    close();
    try {
      await fn();
    } catch (e) {
      alert(`処理に失敗しました：${(e as Error).message}`);
    }
  };
  const st = useStore.getState();
  return (
    <div className="menu" onMouseLeave={close}>
      <button
        type="button"
        onClick={run(() => {
          if (confirm('新しい相関図を作りますか？（今の内容は消えます。必要ならプロジェクトを保存してください）')) {
            st.loadDoc(emptyDoc(), {});
            window.dispatchEvent(new Event('soukanzu:fit'));
          }
        })}
      >
        新規作成
      </button>
      <button
        type="button"
        onClick={run(async () => {
          const [file] = await pickFiles(`${PROJECT_EXT},.zip,.json`);
          if (!file) return;
          const { doc, assets } = await loadProjectFile(file);
          useStore.getState().loadDoc(doc, assets);
          window.dispatchEvent(new Event('soukanzu:fit'));
        })}
      >
        プロジェクトを開く…
      </button>
      <button type="button" onClick={run(() => saveProjectFile(st.doc, st.assets))}>
        プロジェクトを保存（{PROJECT_EXT}）
      </button>
      <hr />
      <button
        type="button"
        onClick={run(() => {
          if (confirm('サンプルの相関図を読み込みますか？（今の内容は消えます）')) {
            st.loadDoc(sampleDoc(), {});
            window.dispatchEvent(new Event('soukanzu:fit'));
          }
        })}
      >
        サンプルを読み込む
      </button>
      <p className="menu-note">作業内容はこのブラウザに自動保存されます。別の端末で使うときやバックアップには「プロジェクトを保存」を使ってください。</p>
    </div>
  );
}

function ExportMenu({ close }: { close: () => void }) {
  const [pixelRatio, setRatio] = useState(2);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [transparent, setTransparent] = useState(false);
  const hiddenCount = useStore((s) => s.doc.elements.filter((e) => e.hidden).length);
  const doc = useStore((s) => s.doc);
  return (
    <div className="menu export-menu">
      <label className="prop-row">
        <span className="prop-label">形式</span>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
      </label>
      <label className="prop-row">
        <span className="prop-label">倍率</span>
        <select value={pixelRatio} onChange={(e) => setRatio(Number(e.target.value))}>
          <option value={1}>1倍（{doc.width}×{doc.height}）</option>
          <option value={2}>2倍（{doc.width * 2}×{doc.height * 2}）</option>
          <option value={3}>3倍（{doc.width * 3}×{doc.height * 3}）</option>
        </select>
      </label>
      {format === 'png' && (
        <label className="check">
          <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
          背景を透明にする
        </label>
      )}
      {hiddenCount > 0 && <p className="menu-note">非表示の要素 {hiddenCount} 個は出力に含まれません。</p>}
      <button
        type="button"
        className="primary"
        onClick={async () => {
          close();
          await exportImage({ pixelRatio, format, transparent });
        }}
      >
        書き出す
      </button>
      <button type="button" onClick={close}>閉じる</button>
    </div>
  );
}
