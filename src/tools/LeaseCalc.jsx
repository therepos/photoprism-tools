import { useState, useMemo } from 'react';
import ToolShell from '../components/ToolShell';
import { NavBtn } from '../components/Navbar';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';
import { Input, Select, Segment, Section } from '../components/FormControls';
import { T, fmt, fmt2 } from '../shared';

export default function LeaseCalc({ onBack }) {
  const [lease, setLease] = useState({ term: 60, payment: 5000, rate: 5, idc: 0, incentive: 0, rvg: 0, freq: 'monthly', timing: 'arrears' });
  const [view, setView] = useState('both');
  const up = (k, val) => setLease(p => ({ ...p, [k]: typeof val === 'string' && isNaN(val) ? val : +val }));

  const results = useMemo(() => {
    const monthlyRate = lease.rate / 100 / 12;
    const n = lease.term;
    const pmt = lease.payment;
    let pvLiab = 0;
    for (let i = 1; i <= n; i++) pvLiab += pmt / Math.pow(1 + monthlyRate, lease.timing === 'advance' ? i - 1 : i);
    pvLiab += lease.idc - lease.incentive;
    const rouAsset = pvLiab + lease.idc;
    const monthlyDep = rouAsset / n;
    const totalPayments = pmt * n;
    const straightLine = totalPayments / n;

    const ifrsRows = [], ascRows = [];
    let iLiab = pvLiab, iRou = rouAsset, iCumDep = 0;
    let aLiab = pvLiab, aRou = rouAsset, aCumDep = 0;
    for (let m = 1; m <= n; m++) {
      // IFRS 16
      const iInt = iLiab * monthlyRate;
      const iClose = Math.max(0, iLiab + iInt - pmt);
      const iDep = monthlyDep;
      iCumDep += iDep;
      ifrsRows.push({ month: m, openLiab: iLiab, interest: iInt, closeLiab: iClose, dep: iDep, plCharge: iInt + iDep });
      iLiab = iClose;
      // ASC 842
      const aInt = aLiab * monthlyRate;
      const aClose = Math.max(0, aLiab + aInt - pmt);
      const aDep = straightLine - aInt;
      aCumDep += aDep;
      ascRows.push({ month: m, openLiab: aLiab, interest: aInt, closeLiab: aClose, dep: aDep, plCharge: straightLine });
      aLiab = aClose;
    }
    return { ifrs: ifrsRows, asc: ascRows, pvLiab, rouAsset, monthlyDep, totalPayments };
  }, [lease]);

  const showIFRS = view !== 'asc', showASC = view !== 'ifrs';
  const sidebar = (
    <>
      <Section title="Lease terms">
        <Input label="Term (months)" type="number" value={lease.term} onChange={e => up('term', e.target.value)} />
        <Input label="Payment ($)" type="number" value={lease.payment} onChange={e => up('payment', e.target.value)} />
        <Input label="Discount Rate (%)" type="number" value={lease.rate} onChange={e => up('rate', e.target.value)} step="0.1" />
        <Select label="Frequency" value={lease.freq} onChange={e => up('freq', e.target.value)} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} />
        <Select label="Timing" value={lease.timing} onChange={e => up('timing', e.target.value)} options={[{ value: 'arrears', label: 'In Arrears' }, { value: 'advance', label: 'In Advance' }]} />
      </Section>
      <Section title="Adjustments">
        <Input label="Initial Direct Costs ($)" type="number" value={lease.idc} onChange={e => up('idc', e.target.value)} />
        <Input label="Lease Incentive ($)" type="number" value={lease.incentive} onChange={e => up('incentive', e.target.value)} />
        <Input label="RVG ($)" type="number" value={lease.rvg} onChange={e => up('rvg', e.target.value)} />
      </Section>
      <Section title="View">
        <Segment value={view} onChange={setView} options={[
          { value: 'both', label: 'Both' }, { value: 'ifrs', label: 'IFRS 16' }, { value: 'asc', label: 'ASC 842' },
        ]} />
      </Section>
    </>
  );

  return (
    <ToolShell title="Lease Accounting" onBack={onBack} sidebar={sidebar} actions={<NavBtn label="Export CSV" onClick={() => {}} />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <KpiCard label="PV of Liability" value={fmt2(results.pvLiab)} />
        <KpiCard label="ROU Asset" value={fmt2(results.rouAsset)} />
        <KpiCard label="Monthly Dep." value={fmt2(results.monthlyDep)} />
        <KpiCard label="Total Payments" value={fmt(results.totalPayments)} />
      </div>
      <Section title="Amortization Schedule">
        <DataTable
          headers={['Month', ...(showIFRS ? ['IFRS Liab', 'IFRS Int', 'IFRS P&L'] : []), ...(showASC ? ['ASC Liab', 'ASC Int', 'ASC P&L'] : [])]}
          rows={results.ifrs.slice(0, 24).map((ir, i) => {
            const ar = results.asc[i];
            return [`M${ir.month}`, ...(showIFRS ? [fmt2(ir.closeLiab), fmt2(ir.interest), fmt2(ir.plCharge)] : []), ...(showASC ? [fmt2(ar.closeLiab), fmt2(ar.interest), fmt2(ar.plCharge)] : [])];
          })}
        />
        {results.ifrs.length > 24 && <div style={{ fontSize: 12, color: T.text4, marginTop: 8, textAlign: 'center' }}>Showing first 24 of {results.ifrs.length} months</div>}
      </Section>
    </ToolShell>
  );
}
