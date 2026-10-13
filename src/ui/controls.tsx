import { FONTS, fontStack } from '../model/fonts';
import type { ReactNode } from 'react';

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

export function NumberInput(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={Math.round(props.value * 100) / 100}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) props.onChange(v);
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
