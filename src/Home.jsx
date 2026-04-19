import { useState } from 'react';
import { T, mono, TOOLS, SearchIcon } from './shared';

export default function Home({ onNavigate }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const cats = ['all', ...new Set(TOOLS.map(t => t.cat))];
  const filtered = TOOLS.filter(t => {
    if (filter !== 'all' && t.cat !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* ── Navbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 28px', height: 52,
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 100, gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>P</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: T.text, letterSpacing: -0.4 }}>Praxis</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 240, height: 36, borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <SearchIcon />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools" style={{
            border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: T.text, flex: 1, fontFamily: 'inherit',
          }} />
          {!search && <span style={{ fontSize: 11, color: T.text4, background: T.white, border: `1px solid ${T.border}`, padding: '1px 6px', borderRadius: 5, fontFamily: mono }}>⌘K</span>}
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '52px 44px 0' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: T.text, letterSpacing: -1.4, lineHeight: 1.1, marginBottom: 10 }}>Quick tools</div>
        <div style={{ fontSize: 16, color: T.text3, marginBottom: 32, letterSpacing: -0.1, lineHeight: 1.5 }}>
          Financial calculators and utilities.<br />Fast, private, no login required.
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {cats.map(c => (
            <div key={c} onClick={() => setFilter(c)} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              letterSpacing: -0.1, transition: 'all 0.15s',
              background: filter === c ? T.text : 'transparent',
              color: filter === c ? '#fff' : T.text3,
            }}>{c === 'all' ? 'All' : c}</div>
          ))}
        </div>

        {/* ── Card grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingBottom: 60 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => onNavigate(t.id)} style={{
              background: T.white, borderRadius: 16, padding: 24,
              border: `1px solid ${T.border}`, boxShadow: T.shadow,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = T.shadow; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.color, letterSpacing: 0.3, textTransform: 'uppercase' }}>{t.cat}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 6, letterSpacing: -0.3 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.55 }}>{t.desc}</div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.accent }}>Open tool</span>
                <span style={{ color: T.accent, fontSize: 12 }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, background: T.white, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: T.text4 }}>
        <span>Built for practitioners.</span>
        <span>MIT License</span>
      </div>
    </div>
  );
}
