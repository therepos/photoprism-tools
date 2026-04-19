import { useState } from 'react';
import Home from './Home';
import DcfModeler from './tools/DcfModeler';
import LeaseCalc from './tools/LeaseCalc';
import SaasPlanner from './tools/SaasPlanner';
import EngEconomics from './tools/EngEconomics';
import VaultMerge from './tools/VaultMerge';

export default function App() {
  const [page, setPage] = useState('home');
  const goHome = () => setPage('home');

  switch (page) {
    case 'dcf': return <DcfModeler onBack={goHome} />;
    case 'lease': return <LeaseCalc onBack={goHome} />;
    case 'saas': return <SaasPlanner onBack={goHome} />;
    case 'eng': return <EngEconomics onBack={goHome} />;
    case 'vault': return <VaultMerge onBack={goHome} />;
    default: return <Home onNavigate={setPage} />;
  }
}
