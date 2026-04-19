import { useState, useMemo } from 'react';
import ToolShell from '../components/ToolShell';
import { NavBtn } from '../components/Navbar';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import { Input, Select, Segment, Section } from '../components/FormControls';
import { T, mono, fmt, fmt2 } from '../shared';

export default function DcfModeler({ onBack }) {
  const [step, setStep] = useState('inputs');
  const [h, setH] = useState({ revenue: 10000, cogs: 4000, sga: 1500, da: 700, tax: 21, capex: 800, wc: 200 });
  const [g, setG] = useState({ g1: 12, g2: 10, g3: 8, g4: 6, g5: 4, cogsPct: 40, sgaPct: 15, daPct: 7, capexPct: 8, wcPct: 2 });
  const [d, setD] = useState({ wacc: 10, tgr: 2.5, method: 'gordon', exitMult: 12 });
  const [v, setV] = useState({ cash: 2000, debt: 3000, shares: 1000, market: 25 });

  const upH = (k, val) => setH(p => ({ ...p, [k]: +val }));
  const upG = (k, val) => setG(p => ({ ...p, [k]: +val }));
  const upD = (k, val) => setD(p => ({ ...p, [k]: typeof val === 'string' && isNaN(val) ? val : +val }));
  const upV = (k, val) => setV(p => ({ ...p, [k]: +val }));

  const results = useMemo(() => {
    const growths = [g.g1, g.g2, g.g3, g.g4, g.g5].map(x => x / 100);
    const revs = [], cogs = [], sga = [], da = [], ebit = [], ebitda = [], capex = [], wc = [];
    let rev = h.revenue;
    for (let i = 0; i < 5; i++) {
      rev = i === 0 ? rev * (1 + growths[0]) : revs[i - 1] * (1 + growths[i]);
      revs.push(rev);
      cogs.push(rev * g.cogsPct / 100);
      sga.push(rev * g.sgaPct / 100);
      da.push(rev * g.daPct / 100);
      const eb = rev - rev * g.cogsPct / 100 - rev * g.sgaPct / 100 - rev * g.daPct / 100;
      ebit.push(eb);
      ebitda.push(eb + rev * g.daPct / 100);
      capex.push(rev * g.capexPct / 100);
      wc.push(rev * g.wcPct / 100);
    }
    const wacc = d.wacc / 100, tgr = d.tgr / 100;
    const fcfs = ebit.map((eb, i) => eb * (1 - h.tax / 100) + da[i] - capex[i] - wc[i]);
    let tv = d.method === 'gordon' ? fcfs[4] * (1 + tgr) / (wacc - tgr) : ebitda[4] * d.exitMult;
    if (!isFinite(tv)) tv = 0;
    const df = Array.from({ length: 5 }, (_, i) => 1 / Math.pow(1 + wacc, i + 1));
    const pvFcf = fcfs.map((f, i) => f * df[i]);
    const pvTv = tv * df[4];
    const npv = pvFcf.reduce((a, b) => a + b, 0);
    const ev = npv + pvTv;
    const eqVal = ev + v.cash - v.debt;
    const fairVal = eqVal / v.shares;
    const upside = ((fairVal - v.market) / v.market * 100);
    return { revs, cogs, sga, da, ebit, ebitda, capex, wc, fcfs, tv, df, pvFcf, pvTv, npv, ev, eqVal, fairVal, upside };
  }, [h, g, d, v]);

  const sensTable = useMemo(() => {
    const waccRange = [-2, -1, 0, 1, 2].map(x => d.wacc + x);
    const tgrRange = [-1, -0.5, 0, 0.5, 1].map(x => d.tgr + x);
    return waccRange.map(w => tgrRange.map(t => {
      const wacc = w / 100, tgr = t / 100;
      if (wacc <= tgr) return null;
      let tv = d.method === 'gordon' ? results.fcfs[4] * (1 + tgr) / (wacc - tgr) : results.ebitda[4] * d.exitMult;
      let ev = 0;
      for (let i = 0; i < 5; i++) ev += results.fcfs[i] / Math.pow(1 + wacc, i + 1);
      ev += tv / Math.pow(1 + wacc, 5);
      return (ev + v.cash - v.debt) / v.shares;
    }));
  }, [results, d, v]);

  const sidebar = (
    <>
      <Section title="Step">
        <Segment value={step} onChange={setStep} options={[
          { value: 'inputs', label: 'Inputs' }, { value: 'dcf', label: 'DCF' }, { value: 'value', label: 'Value' },
        ]} />
      </Section>
      {step === 'inputs' && <>
        <Section title="Historicals">
          <Input label="Revenue ($)" type="number" value={h.revenue} onChange={e => upH('revenue', e.target.value)} />
          <Input label="COGS ($)" type="number" value={h.cogs} onChange={e => upH('cogs', e.target.value)} />
          <Input label="SG&A ($)" type="number" value={h.sga} onChange={e => upH('sga', e.target.value)} />
          <Input label="D&A ($)" type="number" value={h.da} onChange={e => upH('da', e.target.value)} />
          <Input label="Tax Rate (%)" type="number" value={h.tax} onChange={e => upH('tax', e.target.value)} />
          <Input label="CapEx ($)" type="number" value={h.capex} onChange={e => upH('capex', e.target.value)} />
          <Input label="ΔWC ($)" type="number" value={h.wc} onChange={e => upH('wc', e.target.value)} />
        </Section>
        <Section title="Growth">
          {[1, 2, 3, 4, 5].map(i => <Input key={i} label={`Year ${i} (%)`} type="number" value={g[`g${i}`]} onChange={e => upG(`g${i}`, e.target.value)} />)}
          <Input label="COGS % Rev" type="number" value={g.cogsPct} onChange={e => upG('cogsPct', e.target.value)} />
          <Input label="SG&A % Rev" type="number" value={g.sgaPct} onChange={e => upG('sgaPct', e.target.value)} />
          <Input label="D&A % Rev" type="number" value={g.daPct} onChange={e => upG('daPct', e.target.value)} />
          <Input label="CapEx % Rev" type="number" value={g.capexPct} onChange={e => upG('capexPct', e.target.value)} />
          <Input label="ΔWC % Rev" type="number" value={g.wcPct} onChange={e => upG('wcPct', e.target.value)} />
        </Section>
      </>}
      {step === 'dcf' && <Section title="Discounting">
        <Input label="WACC (%)" type="number" value={d.wacc} onChange={e => upD('wacc', e.target.value)} />
        <Input label="Terminal Growth (%)" type="number" value={d.tgr} onChange={e => upD('tgr', e.target.value)} />
        <Select label="TV Method" value={d.method} onChange={e => upD('method', e.target.value)}
          options={[{ value: 'gordon', label: 'Gordon Growth' }, { value: 'exit', label: 'Exit Multiple' }]} />
        {d.method === 'exit' && <Input label="Exit EV/EBITDA" type="number" value={d.exitMult} onChange={e => upD('exitMult', e.target.value)} />}
      </Section>}
      {step === 'value' && <Section title="Bridge to equity">
        <Input label="Cash ($)" type="number" value={v.cash} onChange={e => upV('cash', e.target.value)} />
        <Input label="Total Debt ($)" type="number" value={v.debt} onChange={e => upV('debt', e.target.value)} />
        <Input label="Shares Outstanding" type="number" value={v.shares} onChange={e => upV('shares', e.target.value)} />
        <Input label="Market Price ($)" type="number" value={v.market} onChange={e => upV('market', e.target.value)} />
      </Section>}
    </>
  );

  return (
    <ToolShell title="DCF Modeler" onBack={onBack} sidebar={sidebar} actions={<NavBtn label="Reset" onClick={() => setH({ revenue: 10000, cogs: 4000, sga: 1500, da: 700, tax: 21, capex: 800, wc: 200 })} />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Enterprise Value" value={fmt(results.ev)} />
        <KpiCard label="Equity Value" value={fmt(results.eqVal)} />
        <KpiCard label="Fair Value / Share" value={fmt2(results.fairVal)} />
        <KpiCard label="Upside" value={`${results.upside >= 0 ? '+' : ''}${results.upside.toFixed(1)}%`} delta={results.upside >= 0 ? 'BUY' : 'SELL'} up={results.upside >= 0} />
      </div>
      <Section title="5-Year Forecast">
        <DataTable headers={['', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']} rows={[
          ['Revenue', ...results.revs.map(fmt)],
          ['COGS', ...results.cogs.map(v => fmt(-v))],
          ['SG&A', ...results.sga.map(v => fmt(-v))],
          ['D&A', ...results.da.map(v => fmt(-v))],
          ['EBIT', ...results.ebit.map(fmt)],
        ]} />
      </Section>
      <Section title="FCF & DCF">
        <DataTable headers={['', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Terminal']} rows={[
          ['FCF', ...results.fcfs.map(fmt), ''],
          ['Discount Factor', ...results.df.map(d => d.toFixed(4)), results.df[4].toFixed(4)],
          ['PV', ...results.pvFcf.map(fmt), fmt(results.pvTv)],
        ]} />
      </Section>
      <Section title="Sensitivity — Fair Value / Share">
        <div style={{ borderRadius: T.radius, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.white, boxShadow: T.shadow }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: mono }}>
            <thead><tr>
              <th style={{ background: T.surface2, padding: '8px 10px', fontSize: 11, color: T.text3, textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>WACC\TGR</th>
              {[-1, -0.5, 0, 0.5, 1].map(x => <th key={x} style={{ background: T.surface2, padding: '8px 10px', fontSize: 11, color: T.text3, textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>{(d.tgr + x).toFixed(1)}%</th>)}
            </tr></thead>
            <tbody>
              {sensTable.map((row, ri) => (
                <tr key={ri}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: T.text3, textAlign: 'center', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>{(d.wacc - 2 + ri).toFixed(1)}%</td>
                  {row.map((val, ci) => {
                    const isCenter = ri === 2 && ci === 2;
                    const bg = val === null ? 'transparent' : val > v.market ? T.greenSoft : T.redSoft;
                    const color = val === null ? T.text4 : val > v.market ? T.greenDk : T.red;
                    return <td key={ci} style={{ padding: '8px 10px', textAlign: 'center', background: isCenter ? T.accentSoft : bg, color, fontWeight: isCenter ? 700 : 400, borderBottom: `1px solid ${T.border}` }}>{val === null ? '—' : fmt2(val)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </ToolShell>
  );
}
