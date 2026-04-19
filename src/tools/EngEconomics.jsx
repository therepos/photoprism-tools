import { useState, useMemo } from 'react';
import ToolShell from '../components/ToolShell';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import { Input, Section } from '../components/FormControls';
import { fmt, fmt2, pct0, fmtN } from '../shared';

const RANKS = [
  { name: 'Partner/Principal', abbr: 'P', nsr: 621, cost: 993 },
  { name: 'Senior Manager', abbr: 'SM', nsr: 384, cost: 320 },
  { name: 'Manager', abbr: 'M', nsr: 223, cost: 128 },
  { name: 'Senior Associate', abbr: 'S1', nsr: 138, cost: 79 },
  { name: 'Associate / Staff', abbr: 'AA', nsr: 93, cost: 64 },
];

export default function EngEconomics({ onBack }) {
  const [fee, setFee] = useState(100000);
  const [target, setTarget] = useState(35);
  const [hours, setHours] = useState(RANKS.map(() => 0));
  const [billing, setBilling] = useState(0);

  const results = useMemo(() => {
    let totalNsr = 0, totalCost = 0, totalHours = 0;
    RANKS.forEach((r, i) => { totalNsr += hours[i] * r.nsr; totalCost += hours[i] * r.cost; totalHours += hours[i]; });
    const margin = totalNsr > 0 ? (totalNsr - totalCost) / totalNsr : 0;
    const ansr = totalHours > 0 ? totalNsr / totalHours : 0;
    const eaf = fee > 0 ? totalNsr / fee : 0;
    const nui = fee - billing;
    return { totalNsr, totalCost, totalHours, margin, ansr, eaf, nui };
  }, [hours, fee, billing]);

  const setHour = (i, val) => setHours(p => { const n = [...p]; n[i] = +val || 0; return n; });

  const sidebar = (
    <>
      <Section title="Engagement">
        <Input label="Agreed Fees ($)" type="number" value={fee} onChange={e => setFee(+e.target.value)} />
        <Input label="Target Margin (%)" type="number" value={target} onChange={e => setTarget(+e.target.value)} />
        <Input label="Billed to Date ($)" type="number" value={billing} onChange={e => setBilling(+e.target.value)} />
      </Section>
      <Section title="Hours by rank">
        {RANKS.map((r, i) => <Input key={r.name} label={`${r.abbr} — ${r.name}`} type="number" value={hours[i]} onChange={e => setHour(i, e.target.value)} />)}
      </Section>
    </>
  );

  return (
    <ToolShell title="Engagement Economics" onBack={onBack} sidebar={sidebar}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Net Service Revenue" value={fmt(results.totalNsr)} />
        <KpiCard label="Margin" value={pct0(results.margin)} delta={results.margin >= target / 100 ? 'On target' : 'Below target'} up={results.margin >= target / 100} />
        <KpiCard label="NUI" value={fmt(results.nui)} delta={results.nui > 0 ? 'Unbilled' : 'Overbilled'} up={results.nui <= 0} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard label="ANSR" value={fmt2(results.ansr)} />
        <KpiCard label="EAF" value={results.eaf.toFixed(2) + 'x'} />
        <KpiCard label="Total Hours" value={fmtN(results.totalHours)} />
      </div>
      <Section title="Rank Breakdown">
        <DataTable
          headers={['Rank', 'Hours', 'NSR/hr', 'Cost/hr', 'NSR', 'Cost', 'Margin']}
          rows={RANKS.map((r, i) => {
            const h = hours[i], nsr = h * r.nsr, cost = h * r.cost, m = nsr > 0 ? (nsr - cost) / nsr : 0;
            return [r.name, fmtN(h), fmt2(r.nsr), fmt2(r.cost), fmt(nsr), fmt(cost), pct0(m)];
          })}
        />
      </Section>
    </ToolShell>
  );
}
