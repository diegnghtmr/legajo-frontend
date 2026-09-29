import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '../../infrastructure/i18n';

import { HarnessPanel, HarnessPanelSkeleton } from './HarnessPanel';

const HARNESS = {
  cpuModel: '12th Gen Intel(R) Core(TM) i9-12900H',
  logicalCores: 20,
  totalRamBytes: 33_363_460_096,
  jdk: 'Eclipse Adoptium 25.0.4',
  os: 'Linux 7.2.5-3-omarchy (amd64)',
  measuredAt: '2026-09-23T00:43:04.800549029Z',
};

afterEach(async () => {
  await i18n.changeLanguage('es');
});

describe('HarnessPanel', () => {
  it('shows every harness field as a labeled key-value row', () => {
    render(<HarnessPanel harness={HARNESS} />);

    expect(screen.getByText('12th Gen Intel® Core™ i9-12900H')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('31.1 GiB')).toBeInTheDocument();
    expect(screen.getByText('Eclipse Adoptium 25.0.4')).toBeInTheDocument();
    expect(screen.getByText('Linux 7.2.5-3-omarchy (amd64)')).toBeInTheDocument();
    expect(screen.getByText(/^23 .+ 2026,? 00:43 UTC$/)).toBeInTheDocument();
  });

  it('is a grid of cells, each a small term over a mono value', () => {
    render(<HarnessPanel harness={HARNESS} />);

    const cpuTerm = screen.getByText('CPU');
    expect(cpuTerm.tagName).toBe('DT');
    expect(cpuTerm.className).toContain('uppercase');
    const cpuValue = screen.getByText('12th Gen Intel® Core™ i9-12900H');
    expect(cpuValue.tagName).toBe('DD');
    expect(cpuValue.className).toContain('font-mono');
  });

  it('lays out six cells in order inside one description list', () => {
    render(<HarnessPanel harness={HARNESS} />);

    const cells = Array.from(document.querySelectorAll('dl > div'));
    expect(cells.map((cell) => cell.querySelector('dt')?.textContent)).toEqual([
      'CPU',
      'Núcleos lógicos',
      'RAM',
      'JDK',
      'Sistema operativo',
      'Medido el',
    ]);
  });

  it('gives the CPU and the operating system two columns, the other cells one', () => {
    render(<HarnessPanel harness={HARNESS} />);

    const cell = (label: string) => screen.getByText(label).parentElement!;
    expect(cell('CPU').className).toContain('min-[700px]:col-span-2');
    expect(cell('Sistema operativo').className).toContain('min-[700px]:col-span-2');
    for (const label of ['Núcleos lógicos', 'RAM', 'JDK', 'Medido el']) {
      expect(cell(label).className).not.toContain('col-span-2');
    }
  });

  it('draws a right rule on every cell but the last of each row and a bottom rule on the first row only', () => {
    render(<HarnessPanel harness={HARNESS} />);

    const cell = (label: string) => screen.getByText(label).parentElement!.className.split(' ');
    const hasRightRule = (label: string) => {
      const classes = cell(label);
      return (
        !classes.includes('min-[700px]:border-r-0') &&
        (classes.includes('border-r') || classes.includes('min-[700px]:border-r'))
      );
    };
    for (const label of ['CPU', 'Núcleos lógicos', 'JDK', 'Sistema operativo']) {
      expect(hasRightRule(label)).toBe(true);
    }
    for (const label of ['RAM', 'Medido el']) {
      expect(hasRightRule(label)).toBe(false);
    }
    for (const label of ['CPU', 'Núcleos lógicos', 'RAM']) {
      expect(cell(label)).toContain('border-b');
      expect(cell(label)).not.toContain('min-[700px]:border-b-0');
    }
    for (const label of ['JDK', 'Sistema operativo', 'Medido el']) {
      expect(cell(label)).toContain('min-[700px]:border-b-0');
    }
  });

  it('frames the grid in a hairline ring and grows it to fill the card', () => {
    render(<HarnessPanel harness={HARNESS} />);

    const grid = document.querySelector('dl')!;
    expect(grid.className).toContain('flex-1');
    expect(grid.className).toContain('min-[700px]:grid-cols-4');
    expect(grid.className).toContain('ring-hairline');
    expect(grid.className).toContain('overflow-hidden');
  });

  it('localizes the measured-at date to the active language', async () => {
    await i18n.changeLanguage('en');
    render(<HarnessPanel harness={HARNESS} />);

    expect(screen.getByText('Measured at')).toBeInTheDocument();
    expect(screen.getByText(/^Sep 23, 2026,? 00:43 UTC$/)).toBeInTheDocument();
  });

  it('renders the harness title', () => {
    render(<HarnessPanel harness={HARNESS} />);
    expect(screen.getByRole('heading', { name: /Máquina de referencia/ })).toBeInTheDocument();
  });
});

describe('HarnessPanelSkeleton', () => {
  it('mirrors the real grid: the same spans, every label as real text, only the values as bars', () => {
    render(<HarnessPanelSkeleton />);

    for (const label of [
      'CPU',
      'Núcleos lógicos',
      'RAM',
      'JDK',
      'Sistema operativo',
      'Medido el',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
    expect(screen.getByText('CPU').parentElement!.className).toContain('min-[700px]:col-span-2');
    expect(screen.getByText('Sistema operativo').parentElement!.className).toContain(
      'min-[700px]:col-span-2',
    );
    expect(document.querySelector('dl')!.className).toContain('flex-1');
  });
});
