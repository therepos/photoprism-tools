import Navbar from './Navbar';
import { T } from '../shared';

export default function ToolShell({ title, onBack, sidebar, children, actions }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Navbar title={title} onBack={onBack} actions={actions} />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 'calc(100vh - 48px)' }}>
        <div style={{
          borderRight: `0.5px solid ${T.border}`, padding: 24, background: T.white,
          overflowY: 'auto', maxHeight: 'calc(100vh - 48px)',
        }}>
          {sidebar}
        </div>
        <div style={{ padding: 28, overflowY: 'auto', maxHeight: 'calc(100vh - 48px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
