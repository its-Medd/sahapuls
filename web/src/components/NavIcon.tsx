const paths: Record<string, string> = {
  Overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  Devices: 'M6 4h12v16H6z M10 17h4 M3 8h3 M18 8h3 M3 12h3 M18 12h3',
  Analytics: 'M4 3v17h17 M8 15l4-5 4 3 5-8',
  Alerts: 'M12 3 2 21h20z M12 9v5 M12 17h.01',
  History: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  Simulator: 'M8 5v14l12-7z M3 7v10',
  Settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
};
export function NavIcon({ name }: { name: string }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.Overview} />
    </svg>
  );
}
