import { T, ChevronLeft } from '../shared';

export default function Navbar({ title, onBack, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '0 24px', height: 48,
      borderBottom: `0.5px solid ${T.border}`,
      background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 100, gap: 10,
    }}>
      <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.text3, fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: -0.1 }}>
        <ChevronLeft />
        <span>Praxis</span>
      </div>
      <span style={{ color: T.border2, fontSize: 14 }}>/</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: -0.2 }}>{title}</span>
      <div style={{ flex: 1 }} />
      {actions && <div style={{ display: 'flex', gap: 6 }}>{actions}</div>}
    </div>
  );
}

export function NavBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, fontWeight: 500, color: T.text3, padding: '5px 12px', borderRadius: T.radiusSm,
      background: T.surface2, border: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  );
}
