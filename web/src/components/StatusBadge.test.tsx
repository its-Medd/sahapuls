import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders a text label alongside the color so status is never color-only', () => {
    render(<StatusBadge status="alert" />);
    expect(screen.getByText('Alert')).toBeInTheDocument();
  });

  it.each([
    ['normal', 'Normal'],
    ['warning', 'Warning'],
    ['alert', 'Alert'],
  ] as const)('renders the %s status as "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
