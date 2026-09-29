import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ClusteringResponse } from '../../infrastructure/api/clustering';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { ClusteringMetricsTable, ClusteringMetricsTableSkeleton } from './ClusteringMetricsTable';
import type { ClusteringRankingResult } from './ranking';

function linkageResult(
  linkageId: LinkageId,
  cophenetic: number,
  meanSilhouette: Record<string, number>,
  daviesBouldin: Record<string, number | null>,
): ClusteringResponse[number] {
  return {
    linkageId,
    linkageDisplayName: linkageId[0]!.toUpperCase() + linkageId.slice(1),
    rows: [],
    leafOrder: [0, 1, 2, 3, 4, 5],
    documentIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    evaluation: { cophenetic, meanSilhouette, daviesBouldin },
  };
}

const KEYS = { '2': 0.15, '3': 0.25, '4': 0, '5': 0.35 };

function results(overrides: Partial<Record<LinkageId, number[]>> = {}): ClusteringResponse {
  const [singleCoph, singleSil, singleDb] = overrides.single ?? [0.95, 0.2, 0.5];
  const [completeCoph, completeSil, completeDb] = overrides.complete ?? [0.5, 0.9, 0.1];
  const [averageCoph, averageSil, averageDb] = overrides.average ?? [0.4, 0.3, 0.2];
  const [wardCoph, wardSil, wardDb] = overrides.ward ?? [0.3, 0.1, null as unknown as number];

  return [
    linkageResult('single', singleCoph!, { ...KEYS, '4': singleSil! }, { ...KEYS, '4': singleDb! }),
    linkageResult(
      'complete',
      completeCoph!,
      { ...KEYS, '4': completeSil! },
      { ...KEYS, '4': completeDb! },
    ),
    linkageResult(
      'average',
      averageCoph!,
      { ...KEYS, '4': averageSil! },
      { ...KEYS, '4': averageDb! },
    ),
    linkageResult('ward', wardCoph!, { ...KEYS, '4': wardSil! }, { ...KEYS, '4': wardDb ?? null }),
  ];
}

/** single: sole cophenetic leader; complete: sole silhouette leader at k_ref=4 -> leaders differ. */
const DIFFERING_RANKING: ClusteringRankingResult = {
  copheneticTieSet: ['single'],
  bestTreeFidelity: 'single',
  bestPartitionAtKRef: 'complete',
  leadersDiffer: true,
};

describe('ClusteringMetricsTable', () => {
  const renderTable = (props: Partial<React.ComponentProps<typeof ClusteringMetricsTable>> = {}) =>
    render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={6}
        {...props}
      />,
    );

  it('titles the card and reads the better direction in each metric header', () => {
    renderTable();

    expect(
      screen.getByRole('heading', { name: 'Comparación de métricas por enlace' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Enlace',
      'Cofenética ↑',
      'Silueta media (k = 4) ↑',
      'Davies–Bouldin (k = 4) ↓',
      'Líder',
    ]);
  });

  it('renders one row per linkage, in the fixed declaration order regardless of input order', () => {
    const [single, complete, average, ward] = results();
    renderTable({ results: [ward!, average!, complete!, single!] });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'metrics-row-single',
      'metrics-row-complete',
      'metrics-row-average',
      'metrics-row-ward',
    ]);
  });

  it('stacks the display name over the mono id', () => {
    renderTable();

    const row = screen.getByTestId('metrics-row-complete');
    const name = within(row).getByText('Complete');
    const id = within(row).getByText('complete');
    expect(id).toHaveClass('font-mono');
    expect(name.parentElement).toBe(id.parentElement);
  });

  it('shows the cophenetic value and the silhouette and Davies-Bouldin values at k_ref, three decimals', () => {
    renderTable();

    const singleRow = screen.getByTestId('metrics-row-single');
    expect(within(singleRow).getByText('0.950')).toBeInTheDocument();
    expect(within(singleRow).getByText('0.200')).toBeInTheDocument();
    expect(within(singleRow).getByText('0.500')).toBeInTheDocument();
  });

  it('shows "no definido" for a null Davies-Bouldin value at the viewed k', () => {
    renderTable();

    expect(
      within(screen.getByTestId('metrics-row-ward')).getByText('no definido'),
    ).toBeInTheDocument();
  });

  it('draws each bar relative to the column best: value / max for the higher-is-better columns', () => {
    renderTable();

    const fill = (linkage: string, column: number) => {
      const cell = within(screen.getByTestId(`metrics-row-${linkage}`)).getAllByRole('cell')[
        column
      ]!;
      return (cell.querySelector('[data-slot="metric-bar"]')!.firstElementChild as HTMLElement)
        .style.width;
    };
    // Cophenetic (column 1): single 0.95 is the best.
    expect(fill('single', 1)).toBe('100%');
    expect(parseFloat(fill('complete', 1))).toBeCloseTo((0.5 / 0.95) * 100, 5);
    // Silhouette at k = 4 (column 2): complete 0.9 is the best.
    expect(fill('complete', 2)).toBe('100%');
    expect(parseFloat(fill('single', 2))).toBeCloseTo((0.2 / 0.9) * 100, 5);
  });

  it('draws the lower-is-better Davies-Bouldin bar as min / value, with a 4% stub for an undefined value', () => {
    renderTable();

    const fill = (linkage: string) => {
      const cell = within(screen.getByTestId(`metrics-row-${linkage}`)).getAllByRole('cell')[3]!;
      return (cell.querySelector('[data-slot="metric-bar"]')!.firstElementChild as HTMLElement)
        .style.width;
    };
    // Best (smallest) is complete's 0.1.
    expect(fill('complete')).toBe('100%');
    expect(parseFloat(fill('single'))).toBeCloseTo((0.1 / 0.5) * 100, 5);
    expect(fill('ward')).toBe('4%');
  });

  it('adds a sparkline to the silhouette and Davies-Bouldin cells only, one point per k the response carries', () => {
    renderTable();

    const cells = within(screen.getByTestId('metrics-row-single')).getAllByRole('cell');
    expect(cells[1]!.querySelector('svg')).toBeNull();
    expect(cells[2]!.querySelectorAll('svg circle')).toHaveLength(4);
    expect(cells[3]!.querySelectorAll('svg circle')).toHaveLength(4);
    expect(cells[2]).toHaveTextContent(/Valores por k: k = 2: 0\.150, k = 3: 0\.250/);
  });

  describe('"Ver en k" selector', () => {
    it('offers every k the response carries, marks k_ref as "(ref)" and starts on it', () => {
      renderTable();

      const group = screen.getByRole('radiogroup', { name: 'Ver en k' });
      const radios = within(group).getAllByRole('radio');
      expect(radios.map((radio) => radio.textContent)).toEqual(['2', '3', '4 (ref)', '5']);
      expect(within(group).getByRole('radio', { name: '4 (ref)' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('re-reads the silhouette and Davies-Bouldin columns at the chosen k', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole('radio', { name: '3' }));

      expect(screen.getByRole('columnheader', { name: 'Silueta media (k = 3) ↑' })).toBeVisible();
      expect(screen.getByRole('columnheader', { name: 'Davies–Bouldin (k = 3) ↓' })).toBeVisible();
      const singleRow = screen.getByTestId('metrics-row-single');
      // k = 3 fixture values are 0.25 for both metrics.
      expect(within(singleRow).getAllByText('0.250').length).toBeGreaterThanOrEqual(2);
      expect(within(singleRow).queryByText('0.950')).toBeInTheDocument();
    });

    it('moves the larger sparkline point to the chosen k', async () => {
      const user = userEvent.setup();
      renderTable();
      const cell = () => within(screen.getByTestId('metrics-row-single')).getAllByRole('cell')[2]!;
      const activeIndex = () =>
        Array.from(cell().querySelectorAll('circle')).findIndex(
          (circle) => circle.getAttribute('r') === '2.5',
        );
      expect(activeIndex()).toBe(2);

      await user.click(screen.getByRole('radio', { name: '5' }));

      expect(activeIndex()).toBe(3);
    });

    it('never moves the leaders: they are always computed at k_ref', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole('radio', { name: '2' }));

      expect(within(screen.getByTestId('metrics-row-single')).getByText('Árbol')).toBeVisible();
      expect(
        within(screen.getByTestId('metrics-row-complete')).getByText('Partición'),
      ).toBeVisible();
    });

    it('is left out when the response carries no evaluated cut', () => {
      renderTable({
        results: results().map((result) => ({
          ...result,
          evaluation: { ...result.evaluation, meanSilhouette: {}, daviesBouldin: {} },
        })),
      });

      expect(screen.queryByRole('radiogroup', { name: 'Ver en k' })).not.toBeInTheDocument();
    });
  });

  describe('leaders', () => {
    it('marks the tree leader "Árbol" and, when it differs, the partition leader "Partición"', () => {
      renderTable();

      expect(within(screen.getByTestId('metrics-row-single')).getByText('Árbol')).toBeVisible();
      expect(
        within(screen.getByTestId('metrics-row-complete')).getByText('Partición'),
      ).toBeVisible();
    });

    it('marks a leader with the ink glyph badge and its icon', () => {
      renderTable();

      const badge = within(screen.getByTestId('metrics-row-single'))
        .getByText('Árbol')
        .closest('[data-slot="leader-badge"]');
      expect(badge).not.toBeNull();
      expect(badge!.querySelector('svg.lucide-network')).not.toBeNull();
    });

    it('marks only "Árbol" when the tree and partition leaders are the same linkage', () => {
      renderTable({
        ranking: {
          copheneticTieSet: ['single'],
          bestTreeFidelity: 'single',
          bestPartitionAtKRef: 'single',
          leadersDiffer: false,
        },
      });

      expect(within(screen.getByTestId('metrics-row-single')).getByText('Árbol')).toBeVisible();
      expect(screen.queryByText('Partición', { selector: 'span' })).not.toBeInTheDocument();
    });

    it('shows a dash in the rows that lead nothing', () => {
      renderTable();

      const cells = within(screen.getByTestId('metrics-row-average')).getAllByRole('cell');
      expect(cells[4]).toHaveTextContent('—');
    });

    it('marks no leader and asks for all four linkages when the ranking is undefined', () => {
      renderTable({ ranking: undefined });

      expect(screen.queryByText('Árbol')).not.toBeInTheDocument();
      expect(screen.queryByText('Partición', { selector: 'span' })).not.toBeInTheDocument();
      expect(
        screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('metrics-row-single')).getAllByRole('cell')[4],
      ).toHaveTextContent('—');
    });
  });

  describe('footer', () => {
    it('states the leaders in plain language, computed at k_ref', () => {
      renderTable();

      expect(screen.getByTestId('metrics-leader-line')).toHaveTextContent(
        'Árbol: mejor cofenética (single). Partición: mejor silueta en k_ref = 4 (complete).',
      );
    });

    it('adds the cophenetic tie set when it has more than one member', () => {
      renderTable({
        ranking: {
          copheneticTieSet: ['single', 'complete', 'ward'],
          bestTreeFidelity: 'single',
          bestPartitionAtKRef: 'complete',
          leadersDiffer: true,
        },
      });

      expect(screen.getByTestId('metrics-leader-line')).toHaveTextContent(
        /Empate en cofenética \(dentro de 1e-3\): single, complete, ward\./,
      );
    });

    it('shows the representation, distance-basis and sample-size caveat as a quiet line', () => {
      renderTable();

      const caveat = screen.getByText(/Tamaño muestral del corpus cargado: n = 6/);
      expect(caveat).toHaveClass('text-ink-muted');
      expect(caveat).toHaveTextContent('tfidf-cosine');
      expect(caveat).toHaveTextContent('D = 1 − coseno; Ward opera sobre 2·D.');
    });

    it('omits the caveat when the sample size is undefined', () => {
      renderTable({ kRef: undefined, ranking: undefined, sampleSize: undefined });

      expect(screen.queryByText(/n = /)).not.toBeInTheDocument();
    });
  });

  it('renders no table, but still explains that leaders need all four linkages, when k_ref cannot be resolved', () => {
    renderTable({ kRef: undefined, ranking: undefined, sampleSize: undefined });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Ver en k' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
    ).toBeInTheDocument();
  });

  it('scrolls inside its card when it does not fit, in a labelled focusable region', () => {
    renderTable();

    const region = screen.getByRole('region', { name: 'Comparación de métricas por enlace' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.className).toContain('overflow-x-auto');
    // Positioned, so the hidden sparkline sentences are clipped with it.
    expect(region.className).toContain('relative');
  });

  it('staggers the rows in, by row index', () => {
    renderTable();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.style.getPropertyValue('--i'))).toEqual(['0', '1', '2', '3']);
    for (const row of rows) {
      expect(row.className).toContain('enter-rise');
    }
  });
});

describe('ClusteringMetricsTableSkeleton', () => {
  const renderSkeleton = (
    props: Partial<React.ComponentProps<typeof ClusteringMetricsTableSkeleton>> = {},
  ) =>
    render(
      <ClusteringMetricsTableSkeleton
        linkageIds={['single', 'complete', 'average', 'ward']}
        representation="tfidf-cosine"
        sampleSizeEstimate={20}
        {...props}
      />,
    );

  it('renders the real column headers, k included, from the sample-size estimate', () => {
    renderSkeleton();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Enlace',
      'Cofenética ↑',
      'Silueta media (k = 4) ↑',
      'Davies–Bouldin (k = 4) ↓',
      'Líder',
    ]);
    expect(screen.queryByText(/k pendiente/)).not.toBeInTheDocument();
  });

  it('falls back to the "k pending" wording when no k_ref can be estimated', () => {
    renderSkeleton({ sampleSizeEstimate: 2 });

    expect(
      screen.getByRole('columnheader', { name: 'Silueta media (k pendiente) ↑' }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Davies–Bouldin (k pendiente) ↓' }),
    ).toBeVisible();
  });

  it('shows the real title and a "Ver en k" placeholder over the estimated cuts, k_ref marked "(ref)", holding no radio', () => {
    renderSkeleton();

    expect(
      screen.getByRole('heading', { name: 'Comparación de métricas por enlace' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ver en k')).toBeInTheDocument();
    for (const label of ['2', '3', '4 (ref)', '5']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('offers only the cuts that fit a small corpus', () => {
    renderSkeleton({ sampleSizeEstimate: 4 });

    expect(screen.getByText('3 (ref)')).toBeInTheDocument();
    expect(screen.queryByText('4 (ref)')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('renders one row per selected linkage with its real mono id, the name line reserved', () => {
    renderSkeleton({ linkageIds: ['single', 'ward'] });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(screen.getByTestId('metrics-row-skeleton-single')).toHaveTextContent('single');
    expect(screen.getByText('Single linkage')).toHaveClass('invisible');
    expect(screen.getByTestId('metrics-row-skeleton-ward')).toHaveTextContent('ward');
  });

  it('reserves the footer lines with sizers built from typical sentences', () => {
    renderSkeleton();

    const sizers = document.querySelectorAll('p.invisible');
    expect(sizers).toHaveLength(2);
    expect(sizers[0]).toHaveTextContent(/mejor cofenética/);
    expect(sizers[1]).toHaveTextContent(/Tamaño muestral del corpus cargado: n = 20/);
  });
});

describe('metrics table column layout', () => {
  function layoutOf(container: HTMLElement) {
    const table = container.querySelector('table')!;
    return {
      tableClassName: table.className,
      minWidth: table.style.minWidth,
      cols: Array.from(table.querySelectorAll('colgroup > col')).map((col) => col.className),
    };
  }

  it('gives the skeleton and the loaded table the same fixed column widths, so the header wraps identically whatever the body holds', () => {
    const loaded = render(
      <ClusteringMetricsTable
        results={results()}
        kRef={4}
        ranking={DIFFERING_RANKING}
        representation="tfidf-cosine"
        sampleSize={20}
      />,
    );
    const loadedLayout = layoutOf(loaded.container);
    loaded.unmount();

    const skeleton = render(
      <ClusteringMetricsTableSkeleton
        linkageIds={['single', 'complete', 'average', 'ward']}
        representation="tfidf-cosine"
        sampleSizeEstimate={20}
      />,
    );
    const skeletonLayout = layoutOf(skeleton.container);

    expect(loadedLayout.cols).toHaveLength(5);
    expect(loadedLayout.tableClassName).toContain('table-fixed');
    expect(loadedLayout.minWidth).not.toBe('');
    expect(skeletonLayout).toEqual(loadedLayout);
  });
});
