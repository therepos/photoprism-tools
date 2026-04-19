import { useState } from 'react';
import ToolShell from '../components/ToolShell';
import KpiCard from '../components/KpiCard';
import { Section, Btn, InfoBox } from '../components/FormControls';
import { T, fmtN } from '../shared';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const splitLine = line => {
    const r = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { r.push(cur); cur = ''; }
      else cur += c;
    }
    r.push(cur); return r;
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(l => { const vals = splitLine(l); const obj = {}; headers.forEach((h, i) => obj[h] = vals[i] || ''); return obj; });
  return { headers, rows };
}

function DropZone({ label, onFile, loaded }) {
  return (
    <div onClick={() => document.getElementById(label).click()} style={{
      border: `2px dashed ${loaded ? T.green : T.border}`, borderRadius: T.radius, padding: 24,
      textAlign: 'center', cursor: 'pointer', background: loaded ? T.greenSoft : T.surface2,
      transition: 'all 0.2s', marginBottom: 14,
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: loaded ? T.greenDk : T.text2, marginBottom: 4 }}>{loaded ? 'File loaded ✓' : label}</div>
      <div style={{ fontSize: 12, color: T.text4 }}>Click to select .csv file</div>
      <input id={label} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} />
    </div>
  );
}

export default function VaultMerge({ onBack }) {
  const [vwFile, setVwFile] = useState(null);
  const [braveFile, setBraveFile] = useState(null);
  const [result, setResult] = useState(null);
  const [keepBlank, setKeepBlank] = useState(false);

  const handleFile = (file, setter) => {
    const reader = new FileReader();
    reader.onload = e => setter(parseCSV(e.target.result));
    reader.readAsText(file, 'UTF-8');
  };

  const merge = () => {
    if (!vwFile || !braveFile) return;
    const normalize = url => {
      try { let u = url.trim().toLowerCase(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u; const p = new URL(u); return p.hostname.replace(/^www\./, '') + p.pathname.replace(/\/+$/, ''); }
      catch { return url.trim().toLowerCase(); }
    };
    const convert = r => ({ folder: '', favorite: '', type: 'login', name: r.name || '', notes: r.note || '', fields: '', reprompt: '0', archivedDate: '', login_uri: r.url || '', login_username: r.username || '', login_password: r.password || '', login_totp: '' });
    const braveFiltered = braveFile.rows.filter(r => keepBlank || r.password?.trim());
    const skipped = braveFile.rows.length - braveFiltered.length;
    const combined = [...vwFile.rows, ...braveFiltered.map(convert)];
    const key = r => [normalize(r.login_uri || ''), (r.login_username || '').toLowerCase().trim(), (r.login_password || '').trim()].join('|||');
    const seen = new Set(); const merged = []; let dupes = 0;
    for (const row of combined) { const k = key(row); if (seen.has(k)) { dupes++; continue; } seen.add(k); merged.push(row); }
    setResult({ merged: merged.length, dupes, skipped, vw: vwFile.rows.length, brave: braveFile.rows.length });
  };

  const sidebar = (
    <>
      <Section title="Step 1 — Vaultwarden">
        <DropZone label="Upload Vaultwarden CSV" onFile={f => handleFile(f, setVwFile)} loaded={!!vwFile} />
      </Section>
      <Section title="Step 2 — Brave">
        <DropZone label="Upload Brave CSV" onFile={f => handleFile(f, setBraveFile)} loaded={!!braveFile} />
      </Section>
      <Section title="Options">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: T.text2, cursor: 'pointer' }}>
          <input type="checkbox" checked={keepBlank} onChange={e => setKeepBlank(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.accent }} />
          Keep blank passwords
        </label>
      </Section>
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <Btn onClick={merge} style={{ width: '100%', opacity: vwFile && braveFile ? 1 : 0.5 }}>Merge Passwords</Btn>
      </div>
    </>
  );

  return (
    <ToolShell title="VaultMerge" onBack={onBack} sidebar={sidebar}>
      {!result ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>Merge password databases</div>
            <div style={{ fontSize: 14, color: T.text3, lineHeight: 1.6 }}>Upload your Vaultwarden export and Brave passwords CSV. Everything runs in your browser — no data leaves your machine.</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Vaultwarden" value={fmtN(result.vw)} useMono={false} />
            <KpiCard label="Brave" value={fmtN(result.brave)} useMono={false} />
            <KpiCard label="Duplicates" value={fmtN(result.dupes)} useMono={false} />
            <KpiCard label="Final Merged" value={fmtN(result.merged)} useMono={false} />
          </div>
          <InfoBox>Merge complete. {result.dupes} duplicates removed, {result.skipped} blank-password entries skipped.</InfoBox>
          <Btn>Download Merged CSV</Btn>
        </>
      )}
    </ToolShell>
  );
}
