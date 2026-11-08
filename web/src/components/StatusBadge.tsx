import type { Severity } from '../types';

const STATUS_CONFIG: Record<Severity, { label: string; dotClass: string; textClass: string }> = {
  normal: {
    label: 'Normal',
    dotClass: 'bg-status-good',
    textClass: 'text-ink-secondary dark:text-ink-secondary-dark',
  },
  warning: {
    label: 'Warning',
    dotClass: 'bg-status-warning',
    textClass: 'text-ink-secondary dark:text-ink-secondary-dark',
  },
  alert: {
    label: 'Alert',
    dotClass: 'bg-status-critical',
    textClass: 'text-status-critical font-medium',
  },
};

/**
 * Status is always shown as a colored dot *plus* a text label - never color
 * alone - since warning/serious hues don't clear text-contrast on a light
 * surface (see dataviz skill: status palette relief rule).
 */
export function StatusBadge({ status }: { status: Severity }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${config.textClass}`}>
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
