import { T, mono } from '../shared';

export default function KpiCard({ label, value, delta, up, useMono = true }) {
  return (
    <div style={{ background: T.white, borderRadius: 14, padding: 18, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.3, color: T.text4, marginBottom: 10, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.8, marginBottom: delta ? 6 : 0, fontFamily: useMono ? mono : 'inherit' }}>{value}</div>
      {delta && (
        <span style={{
          fontSize: 12, fontWeight: 600, color: up ? T.greenDk : T.red,
          padding: '3px 8px', borderRadius: 6, background: up ? T.greenSoft : T.redSoft,
        }}>{delta}</span>
      )}
    </div>
  );
}
