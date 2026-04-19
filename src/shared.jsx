/* ═══════════════════════════════════════════════════════════════
   shared.jsx — Constants, tokens (JS), icons, formatting utils.
   Imported by every component and tool.
   ═══════════════════════════════════════════════════════════════ */

// JS-side tokens (mirrors CSS vars for inline styles)
export const T = {
  bg: '#F5F5F7',
  white: '#FFFFFF',
  surface2: '#F9F9FB',
  border: '#E5E5EA',
  border2: '#D1D1D6',
  text: '#1D1D1F',
  text2: '#48484A',
  text3: '#86868B',
  text4: '#AEAEB2',
  accent: '#0071E3',
  accentSoft: 'rgba(0,113,227,0.06)',
  green: '#34C759',
  greenDk: '#248A3D',
  greenSoft: 'rgba(52,199,89,0.08)',
  red: '#FF3B30',
  redSoft: 'rgba(255,59,48,0.08)',
  orange: '#FF9500',
  orangeSoft: 'rgba(255,149,0,0.08)',
  purple: '#AF52DE',
  purpleSoft: 'rgba(175,82,222,0.07)',
  shadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  shadowHover: '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)',
  radius: 12,
  radiusSm: 8,
};

export const font = `-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif`;
export const mono = `'SF Mono','Menlo','Consolas',monospace`;

// ─── Formatting ───
export const fmt = n => n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString('en-US');
export const fmt2 = n => n == null || isNaN(n) ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = n => n == null || isNaN(n) ? '—' : (n * 100).toFixed(1) + '%';
export const pct0 = n => n == null || isNaN(n) ? '—' : Math.round(n * 100) + '%';
export const fmtN = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');

// ─── Icons (inline SVG) ───
export const ChevronLeft = ({ size = 14, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || T.text3} strokeWidth="2" strokeLinecap="round">
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

export const SearchIcon = ({ size = 13, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || T.text4} strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

// ─── Tool manifest ───
export const TOOLS = [
  { id: 'dcf', icon: '📊', title: 'DCF Modeler', desc: 'Multi-scenario discounted cash flow valuation with sensitivity tables.', cat: 'Finance', color: T.accent },
  { id: 'eng', icon: '📐', title: 'Engagement Economics', desc: 'Budget planning, ETC tracking, NSR, ANSR, margin monitoring.', cat: 'Operations', color: T.green },
  { id: 'lease', icon: '📋', title: 'Lease Accounting', desc: 'IFRS 16 and ASC 842 lease liability and ROU asset schedules.', cat: 'Finance', color: T.accent },
  { id: 'saas', icon: '📈', title: 'SaaS Planner', desc: 'ARR, MRR, churn, LTV, CAC — model unit economics across scenarios.', cat: 'Finance', color: T.purple },
  { id: 'vault', icon: '🔐', title: 'VaultMerge', desc: 'Merge Brave browser passwords into a Vaultwarden export.', cat: 'Utilities', color: T.text3 },
];
