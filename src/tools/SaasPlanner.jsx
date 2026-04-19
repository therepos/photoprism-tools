import { useState, useMemo } from 'react';
import ToolShell from '../components/ToolShell';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import { Input, Section } from '../components/FormControls';
import { fmt, fmtN } from '../shared';

export default function SaasPlanner({ onBack }) {
  const [s, setS] = useState({ pPrice: 29, pSubs: 500, pGrowth: 8, pChurn: 3, ePrice: 199, eSubs: 50, eGrowth: 5, eChurn: 1.5, months: 24 });
  const up = (k, val) => setS(p => ({ ...p, [k]: +val }));

  const data = useMemo(() => {
    const rows = [];
    let pSubs = s.pSubs, eSubs = s.eSubs, cumul = 0;
    for (let m = 1; m <= s.months; m++) {
      const pMRR = pSubs * s.pPrice, eMRR = eSubs * s.ePrice, totalMRR = pMRR + eMRR;
      cumul += totalMRR;
      rows.push({ m, pSubs: Math.round(pSubs), eSubs: Math.round(eSubs), pMRR, eMRR, totalMRR, cumul });
      pSubs = pSubs * (1 + s.pGrowth / 100) * (1 - s.pChurn / 100);
      eSubs = eSubs * (1 + s.eGrowth / 100) * (1 - s.eChurn / 100);
    }
    return rows;
  }, [s]);

  const first = data[0], last = data[data.length - 1];
  const sidebar = (
    <>
      <Section title="Personal plan">
        <Input label="Price ($/mo)" type="number" value={s.pPrice} onChange={e => up('pPrice', e.target.value)} />
        <Input label="Starting Subs" type="number" value={s.pSubs} onChange={e => up('pSubs', e.target.value)} />
        <Input label="Monthly Growth (%)" type="number" value={s.pGrowth} onChange={e => up('pGrowth', e.target.value)} />
        <Input label="Monthly Churn (%)" type="number" value={s.pChurn} onChange={e => up('pChurn', e.target.value)} />
      </Section>
      <Section title="Enterprise plan">
        <Input label="Price ($/mo)" type="number" value={s.ePrice} onChange={e => up('ePrice', e.target.value)} />
        <Input label="Starting Subs" type="number" value={s.eSubs} onChange={e => up('eSubs', e.target.value)} />
        <Input label="Monthly Growth (%)" type="number" value={s.eGrowth} onChange={e => up('eGrowth', e.target.value)} />
        <Input label="Monthly Churn (%)" type="number" value={s.eChurn} onChange={e => up('eChurn', e.target.value)} />
      </Section>
      <Section title="Horizon">
        <Input label="Months" type="number" value={s.months} onChange={e => up('months', e.target.value)} />
      </Section>
    </>
  );

  return (
    <ToolShell title="SaaS Scenario Planner" onBack={onBack} sidebar={sidebar}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Current MRR" value={fmt(first.totalMRR)} />
        <KpiCard label={`MRR at M${s.months}`} value={fmt(last.totalMRR)} delta={`${((last.totalMRR / first.totalMRR - 1) * 100).toFixed(0)}%`} up={last.totalMRR > first.totalMRR} />
        <KpiCard label="Cumulative Rev" value={fmt(last.cumul)} />
        <KpiCard label={`Subs at M${s.months}`} value={fmtN(last.pSubs + last.eSubs)} />
      </div>
      <Section title="Monthly Breakdown">
        <DataTable
          headers={['Month', 'P. Subs', 'P. MRR', 'E. Subs', 'E. MRR', 'Total MRR', 'Cumulative']}
          rows={data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 18)) === 0 || i === data.length - 1).map(d => [
            `M${d.m}`, fmtN(d.pSubs), fmt(d.pMRR), fmtN(d.eSubs), fmt(d.eMRR), fmt(d.totalMRR), fmt(d.cumul),
          ])}
        />
      </Section>
    </ToolShell>
  );
}
