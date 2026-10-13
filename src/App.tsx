import { useEffect, useState } from 'react';
import { Editor } from './canvas/Editor';
import { Toolbar } from './ui/Toolbar';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { LayersPanel } from './ui/LayersPanel';
import { useStore } from './store/useStore';
import { loadSaved, startAutosave } from './io/persist';
import { sampleDoc } from './model/sample';
import { fileToDataUrl } from './io/image';
import { makeImage } from './model/defaults';
import type { Element } from './model/types';
import { shiftWaypoints, waypointStarts } from './model/edgeOps';

// 開発時のみ、ブラウザのコンソールから状態を確認できるようにする
if (import.meta.env.DEV) (window as unknown as { soukanzu: typeof useStore }).soukanzu = useStore;

export function App() {
  const [ready, setReady] = useState(false);

  // 保存済みの作業を復元（なければサンプル）
  useEffect(() => {
    let stop: (() => void) | undefined;
    loadSaved().then((saved) => {
      if (saved?.doc) useStore.getState().loadDoc(saved.doc, saved.assets ?? {});
      else useStore.getState().loadDoc(sampleDoc(), {});
      useStore.setState({ lastSavedAt: saved?.savedAt ?? null });
      stop = startAutosave();
      setReady(true);
    });
    return () => stop?.();
  }, []);

  // 日本語フォントの読み込みが終わったら描画し直す
  useEffect(() => {
    const bump = () => useStore.setState((s) => ({ fontEpoch: s.fontEpoch + 1 }));
    document.fonts?.ready.then(bump);
    document.fonts?.addEventListener('loadingdone', bump);
    // キャンバスで使う文字のフォントを先に読み込ませる
    document.fonts?.load('bold 16px "Noto Sans JP"', 'あ漢字');
    document.fonts?.load('16px "Noto Sans JP"', 'あ漢字');
    return () => document.fonts?.removeEventListener('loadingdone', bump);
  }, []);

  useShortcuts();
  usePaste();

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <LayersPanel />
        <main className="canvas-area">{ready && <Editor />}</main>
        <PropertiesPanel />
      </div>
      <StatusBar />
    </div>
  );
}

function StatusBar() {
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const count = useStore((s) => s.doc.elements.length);
  const sel = useStore((s) => s.selection.length);
  return (
    <footer className="statusbar">
      <span>要素 {count}</span>
      {sel > 0 && <span>選択 {sel}</span>}
      <span className="spacer" />
      <span>
        {lastSavedAt ? `ブラウザに自動保存済み ${new Date(lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '未保存'}
      </span>
      <span className="muted">データはこの端末の外へ送信されません</span>
    </footer>
  );
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable);

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && k === 'c') {
        if (e.shiftKey) st.copyStyle();
        else st.copy();
        return;
      }
      if (mod && k === 'v' && e.shiftKey) {
        e.preventDefault();
        st.pasteStyle();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        st.duplicate();
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        st.setSelection(st.doc.elements.filter((x) => !x.hidden && !x.locked).map((x) => x.id));
        return;
      }
      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        st.removeSelected();
        return;
      }
      if (k === 'escape') {
        if (st.edgeFrom) st.set({ edgeFrom: null, edgeStyle: {} });
        else if (st.vertexEdit) st.set({ vertexEdit: null });
        else if (st.tool !== 'select') st.setTool('select');
        else st.setSelection([]);
        return;
      }
      if (k.startsWith('arrow') && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? st.doc.settings.gridSize : 1;
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        const sel = new Set(st.selection.filter((id) => st.doc.elements.find((x) => x.id === id && x.type !== 'edge' && !x.locked)));
        const wps = waypointStarts(st.doc, sel);
        st.commit((d) => ({
          ...d,
          elements: d.elements.map((el) =>
            sel.has(el.id) && el.type !== 'edge' ? ({ ...el, x: el.x + dx, y: el.y + dy } as Element) : shiftWaypoints(el, wps, dx, dy),
          ),
        }));
        return;
      }
      if (mod || e.altKey) return;
      const tools: Record<string, Parameters<typeof st.setTool>[0]> = { v: 'select', h: 'hand', c: 'card', f: 'frame', t: 'text', e: 'edge' };
      if (tools[k]) st.setTool(tools[k]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** 画像を貼り付けたら、選択中のカードの写真にする（カード以外なら画像素材として追加） */
function usePaste() {
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      const st = useStore.getState();
      if (!file) {
        st.paste();
        return;
      }
      e.preventDefault();
      const { dataUrl, width, height } = await fileToDataUrl(file);
      const id = useStore.getState().addAsset(dataUrl);
      const target = st.doc.elements.find((x) => x.id === st.selection[0]);
      if (st.selection.length === 1 && target?.type === 'card') {
        useStore.getState().updateEl(target.id, { imageId: id, layout: target.layout === 'nameOnly' ? 'photo' : target.layout } as Partial<Element>);
        return;
      }
      const { view } = st;
      const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null;
      const cx = ((wrap?.clientWidth ?? 800) / 2 - view.x) / view.scale;
      const cy = ((wrap?.clientHeight ?? 600) / 2 - view.y) / view.scale;
      const s = Math.min(1, 300 / Math.max(width, height));
      useStore.getState().addElements([makeImage(cx - (width * s) / 2, cy - (height * s) / 2, id, width * s, height * s)]);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
}
