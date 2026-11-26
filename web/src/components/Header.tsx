export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="topbar">
      <span>
        <span className="topbar-dot" aria-hidden="true" /> Field operations{' '}
        <span className="subtle">/ Monitoring workspace</span>
      </span>
      <span className={`connection ${connected ? 'online' : 'offline'}`} role="status">
        <span aria-hidden="true">●</span> {connected ? 'Live feed connected' : 'Reconnecting'}
      </span>
    </header>
  );
}
