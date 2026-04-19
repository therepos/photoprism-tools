import { T, mono, font } from '../shared';

export function Input({ label, hint, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginBottom: 6, display: 'block', letterSpacing: -0.1 }}>{label}</label>
      <input {...props} style={{
        width: '100%', height: 40, borderRadius: 10, border: `1px solid ${T.border}`,
        padding: '0 14px', fontSize: 14, color: T.text,
        fontFamily: props.type === 'number' ? mono : 'inherit',
        outline: 'none', boxSizing: 'border-box', background: T.white,
        ...(props.style || {}),
      }}
        onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 3px ${T.accentSoft}`; }}
        onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
      />
      {hint && <div style={{ fontSize: 11, color: T.text4, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginBottom: 6, display: 'block' }}>{label}</label>
      <select {...props} style={{
        width: '100%', height: 40, borderRadius: 10, border: `1px solid ${T.border}`,
        padding: '0 12px', fontSize: 14, color: T.text, fontFamily: 'inherit',
        outline: 'none', background: T.white, cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Segment({ options, value, onChange, style: s }) {
  return (
    <div style={{ display: 'flex', background: T.surface2, borderRadius: 10, padding: 3, ...(s || {}) }}>
      {options.map(o => (
        <div key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '7px 0', textAlign: 'center', fontSize: 12, fontWeight: 500, borderRadius: T.radiusSm,
          cursor: 'pointer', letterSpacing: -0.1, transition: 'all 0.15s',
          background: value === o.value ? T.white : 'transparent',
          color: value === o.value ? T.text : T.text3,
          boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
        }}>{o.label}</div>
      ))}
    </div>
  );
}

export function Section({ title, children, style: s }) {
  return (
    <div style={{ marginBottom: 20, ...(s || {}) }}>
      {title && <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: T.text4, marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'primary', style: s }) {
  const styles = {
    primary: { background: T.accent, color: '#fff', border: 'none' },
    secondary: { background: T.white, color: T.text2, border: `1px solid ${T.border2}` },
    danger: { background: 'transparent', color: T.red, border: `1px solid ${T.red}30` },
  };
  return (
    <button onClick={onClick} style={{
      padding: '11px 22px', borderRadius: T.radius, fontSize: 14, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: -0.1, transition: 'all 0.15s',
      ...styles[variant], ...(s || {}),
    }}>{children}</button>
  );
}

export function InfoBox({ children }) {
  return (
    <div style={{
      background: T.accentSoft, borderRadius: T.radius, padding: '14px 16px',
      border: `1px solid rgba(0,113,227,0.12)`, fontSize: 13, color: T.text2, lineHeight: 1.6, marginBottom: 16,
    }}>{children}</div>
  );
}
