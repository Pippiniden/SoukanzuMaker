import { useStore } from '../store/useStore';
import type { Element, Id } from '../model/types';
import { displayName } from './PropertiesPanel';

const TYPE_ICON: Record<Element['type'], string> = {
  card: '人',
  frame: '枠',
  edge: '→',
  text: '文',
  image: '画',
};

export function LayersPanel() {
  const elements = useStore((s) => s.doc.elements);
  const selection = useStore((s) => s.selection);
  const sel = new Set(selection);
  const st = useStore.getState();

  const toggle = (id: Id, key: 'hidden' | 'locked') =>
    st.commit((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, [key]: !e[key] } : e)) }));

  const list = [...elements].reverse();
  return (
    <aside className="panel left-panel">
      <h3 className="panel-title">
        レイヤー <span className="count">{elements.length}</span>
      </h3>
      {list.length === 0 && <p className="hint">まだ何もありません。上のツールから追加してください。</p>}
      <ul className="layer-list">
        {list.map((e) => (
          <li
            key={e.id}
            className={`layer ${sel.has(e.id) ? 'selected' : ''} ${e.hidden ? 'is-hidden' : ''}`}
            onClick={(ev) => {
              if (ev.shiftKey) st.setSelection(sel.has(e.id) ? selection.filter((x) => x !== e.id) : [...selection, e.id]);
              else st.setSelection([e.id]);
            }}
          >
            <span className={`layer-icon t-${e.type}`}>{TYPE_ICON[e.type]}</span>
            <span className="layer-name">{displayName(e, elements)}</span>
            <button
              type="button"
              className={`icon-btn ${e.hidden ? 'on' : ''}`}
              title={e.hidden ? '表示する' : '隠す（画像出力にも含めない）'}
              onClick={(ev) => {
                ev.stopPropagation();
                toggle(e.id, 'hidden');
              }}
            >
              {e.hidden ? '隠' : '見'}
            </button>
            <button
              type="button"
              className={`icon-btn ${e.locked ? 'on' : ''}`}
              title={e.locked ? 'ロック解除' : 'ロック（動かせなくする）'}
              onClick={(ev) => {
                ev.stopPropagation();
                toggle(e.id, 'locked');
              }}
            >
              {e.locked ? '固' : '－'}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
