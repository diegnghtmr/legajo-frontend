import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as benchmarksApi from '../../infrastructure/api/benchmarks';

vi.mock('../../infrastructure/api/benchmarks');

import { BenchmarksPage } from './BenchmarksPage';

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function result(overrides: Partial<benchmarksApi.BenchmarkReportResponse['results'][number]>) {
  return {
    benchmark: 'x',
    family: 'levenshtein',
    parameter: 'length',
    size: 50,
    score: 1,
    error: 0,
    unit: 'us/op',
    ...overrides,
  };
}

const REPORT: benchmarksApi.BenchmarkReportResponse = {
  harness: {
    cpuModel: '12th Gen Intel® Core™ i9-12900H',
    logicalCores: 20,
    totalRamBytes: 33_363_460_096,
    jdk: 'Eclipse Adoptium 25.0.4',
    os: 'Linux 7.2.5-3-omarchy (amd64)',
    measuredAt: '2026-09-23T00:43:04.800549029Z',
  },
  results: [
    result({ family: 'levenshtein', size: 50, score: 7.9 }),
    result({ family: 'levenshtein', size: 100, score: 29.6 }),
    result({ family: 'hac-single', parameter: 'n', size: 5, score: 0.31 }),
    result({ family: 'hac-single', parameter: 'n', size: 10, score: 0.93 }),
    result({ family: 'mean-silhouette', parameter: 'n', size: 5, score: 0.21 }),
    result({ family: 'mean-silhouette', parameter: 'n', size: 10, score: 0.79 }),
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 384,
      score: 195,
      unit: 'ns/op',
    }),
    result({
      family: 'embedding-dot-product',
      parameter: 'dimension',
      size: 1536,
      score: 843,
      unit: 'ns/op',
    }),
    result({
      family: 'slo-classic-levenshtein',
      parameter: 'n',
      size: 20,
      score: 11.6,
      unit: 'ms/op',
    }),
    result({ family: 'slo-clustering', parameter: 'n', size: 20, score: 0.017, unit: 'ms/op' }),
  ],
  slopes: [
    { family: 'levenshtein', points: 2, empiricalSlope: 2.04, theoreticalExponent: 2 },
    { family: 'hac-single', points: 2, empiricalSlope: 2.24, theoreticalExponent: 3 },
    { family: 'mean-silhouette', points: 2, empiricalSlope: 1.46, theoreticalExponent: 2 },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BenchmarksPage', () => {
  it('shows a hidden loading status and a full skeleton layout before the query resolves', () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<BenchmarksPage />);

    const status = screen.getByRole('status');
    expect(status.className).toContain('sr-only');

    // The harness, the three curve-chart cards (each reserving exactly its
    // real chart height) and the SLO tables all show a placeholder before
    // any request resolves — never an empty gap, and never the real
    // interactive scale control with nothing yet to control.
    expect(screen.getByText('Máquina de referencia')).toBeInTheDocument();
    const charts = screen.getAllByTestId('benchmark-chart-skeleton');
    expect(charts).toHaveLength(3);
    for (const chart of charts) {
      expect(chart.style.height).toBe('280px');
    }
    expect(
      screen.getByRole('heading', { name: 'Primitivas de embeddings (O(d))' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Objetivos de rendimiento (SLO)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows the mapped error message when the query rejects', async () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });

    renderWithProviders(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveAttribute('data-slot', 'alert');
    expect(
      screen.getByText(
        'No se pudo contactar al servidor. Si es la primera solicitud en un rato, el servidor gratuito puede estar despertando: puede tardar hasta un minuto en responder.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the generic unexpected-error message when the query rejects with a plain Error', async () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockRejectedValue(new Error('boom'));

    renderWithProviders(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ocurrió un error inesperado.')).toBeInTheDocument();
  });

  it('renders the harness, every curve group, embedding tiles and the SLO section', async () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockResolvedValue(REPORT);

    renderWithProviders(<BenchmarksPage />);

    expect(await screen.findByText('12th Gen Intel® Core™ i9-12900H')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Algoritmos clásicos por pares' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enlaces jerárquicos (HAC)' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Métricas internas de agrupamiento' }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('embedding-tile-384')).toBeInTheDocument();
    expect(screen.getByTestId('embedding-tile-1536')).toBeInTheDocument();

    expect(screen.getByRole('table', { name: /clásicas por pares/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /cuatro enlaces/ })).toBeInTheDocument();
  });

  it('offers a linear/log–log Segmented scale toggle applied to the curve charts', async () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockResolvedValue(REPORT);

    renderWithProviders(<BenchmarksPage />);
    await screen.findByText('12th Gen Intel® Core™ i9-12900H');

    const scaleGroup = screen.getByRole('radiogroup', { name: 'Escala' });
    const logLogOption = within(scaleGroup).getByRole('radio', { name: 'Log–log' });
    expect(logLogOption).toBeInTheDocument();

    await userEvent.click(logLogOption);
    expect(logLogOption).toHaveAttribute('aria-checked', 'true');
  });

  it('switches every curve chart’s data-scale attribute when the toggle is clicked', async () => {
    vi.spyOn(benchmarksApi, 'fetchBenchmarks').mockResolvedValue(REPORT);

    const { container } = renderWithProviders(<BenchmarksPage />);
    await screen.findByText('12th Gen Intel® Core™ i9-12900H');

    const chartGroups = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[role="group"][data-scale]'));
    expect(chartGroups()).toHaveLength(3);
    for (const group of chartGroups()) {
      expect(group).toHaveAttribute('data-scale', 'linear');
    }

    const scaleGroup = screen.getByRole('radiogroup', { name: 'Escala' });
    await userEvent.click(within(scaleGroup).getByRole('radio', { name: 'Log–log' }));

    expect(chartGroups()).toHaveLength(3);
    for (const group of chartGroups()) {
      expect(group).toHaveAttribute('data-scale', 'log');
    }
  });
});
