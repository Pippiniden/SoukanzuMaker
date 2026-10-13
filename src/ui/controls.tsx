import { FONTS, fontStack } from '../model/fonts';
import { useState, type ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="prop-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="prop-row">
      <span className="prop-label">{label}</span>
      <span className="prop-field">{children}</span>
    </label>
  );
}

export function TextInput(props: { value: string; onChange: (v: string) => void; autoFocusKey?: boolean; placeholder?: string }) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      data-autofocus={props.autoFocusKey ? '' : undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function TextArea(props: { value: string; onChange: (v: string) => void; autoFocusKey?: boolean; rows?: number }) {
  return (
    <textarea
      value={props.value}
      rows={props.rows ?? 3}
      data-autofocus={props.autoFocusKey ? '' : undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

/**
 * 数値の入力欄。
 * 入力途中の値（例：200 と打つ途中の「2」）は最低値で補正せずにそのまま表示し、
 * 範囲内になった時点で反映する。範囲外のまま確定（フォーカスを外す・Enter）したときだけ補正する。
 */
export function NumberInput(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const { min, max } = props;
  const shown = draft ?? String(Math.round(props.value * 100) / 100);
  const inRange = (v: number) => (min === undefined || v >= min) && (max === undefined || v <= max);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) {
      const c = clamp(v);
      if (c !== props.value) props.onChange(c);
    }
    setDraft(null);
  };
  return (
    <input
      type="number"
      className={props.className}
      title={props.title}
      value={shown}
      min={min}
      max={max}
      step={props.step ?? 1}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const v = parseFloat(raw);
        if (!Number.isNaN(v) && inRange(v)) props.onChange(v);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(e.currentTarget.value);
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function Slider(props: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <span className="slider">
      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 0.01}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
      <span className="slider-val">{Math.round(props.value * 100) / 100}</span>
    </span>
  );
}

/** 色選択（allowNone で「なし」を選べる） */
export function ColorInput(props: { value: string; onChange: (v: string) => void; allowNone?: boolean; noneValue?: string }) {
  const none = !props.value || props.value === 'transparent';
  return (
    <span className="color-input">
      <input
        type="color"
        value={none ? '#ffffff' : props.value}
        disabled={none}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.allowNone && (
        <label className="mini-check">
          <input
            type="checkbox"
            checked={none}
            onChange={(e) => props.onChange(e.target.checked ? (props.noneValue ?? 'transparent') : '#ffffff')}
          />
          なし
        </label>
      )}
    </span>
  );
}

export function Select<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Check(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  );
}

export function Seg<T extends string>(props: { value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <span className="seg">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          className={o.value === props.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** フォントの選択（それぞれのフォントで名前を表示） */
export function FontSelect(props: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)} style={{ fontFamily: fontStack(props.value) }}>
      {FONTS.map((f) => (
        <option key={f.key} value={f.key} style={{ fontFamily: fontStack(f.key) }}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
