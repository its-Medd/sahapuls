export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4 dark:border-line-dark">
      <div>
        <h1 className="text-lg font-semibold text-ink-primary dark:text-ink-primary-dark">
          LoRa Sensor Dashboard
        </h1>
        <p className="text-xs text-ink-muted">
          Simulated environmental monitoring fleet - reference architecture
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-status-good' : 'bg-status-critical'}`}
          aria-hidden="true"
        />
        <span className="text-ink-secondary dark:text-ink-secondary-dark">
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}
