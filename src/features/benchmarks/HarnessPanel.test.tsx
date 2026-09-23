import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HarnessPanel } from './HarnessPanel';

const HARNESS = {
  cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
  logicalCores: 20,
  totalRamBytes: 33_363_460_096,
  jdk: 'Eclipse Adoptium 25.0.4',
  os: 'Linux 7.2.5-3-omarchy (amd64)',
  measuredAt: '2026-09-23T00:43:04.800549029Z',
};

describe('HarnessPanel', () => {
  it('shows every harness field as a labeled key-value row', () => {
    render(<HarnessPanel harness={HARNESS} />);

    expect(screen.getByText('12th Gen Intel(R) Core(TM) i9-12900H')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('31.1 GB')).toBeInTheDocument();
    expect(screen.getByText('Eclipse Adoptium 25.0.4')).toBeInTheDocument();
    expect(screen.getByText('Linux 7.2.5-3-omarchy (amd64)')).toBeInTheDocument();
    expect(screen.getByText('2026-09-23T00:43:04Z')).toBeInTheDocument();
  });

  it('renders the harness title', () => {
    render(<HarnessPanel harness={HARNESS} />);
    expect(screen.getByRole('heading', { name: /Máquina de referencia/ })).toBeInTheDocument();
  });
});
