import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { formatCpuModel, formatMeasuredAt, formatRamGib } from './formatHarness';

type BenchmarkHarness = BenchmarkReportResponse['harness'];

/** The CPU and the operating system are the long values: they take two columns. */
const WIDE_CELL_CLASS = '@sm:col-span-2';

/**
 * The column count follows the card's own width (a container query), not the
 * viewport's, since the card shares its row with another: one column when
 * narrow, two from 24rem, four from 48rem. `dense` lets a one-column cell fill
 * the hole a two-column one leaves. Every value fits its column on one line at
 * each count, so the loading placeholder has the same height.
 */
const GRID_CLASS =
  'grid grid-flow-dense grid-cols-1 gap-x-6 gap-y-3 @sm:grid-cols-2 @3xl:grid-cols-4';

interface HarnessCell {
  key: string;
  label: string;
  wide?: boolean;
}

function useHarnessCells(): readonly HarnessCell[] {
  const { t } = useTranslation();

  return [
    { key: 'cpu', label: t('benchmarks.harness.cpuModelLabel'), wide: true },
    { key: 'cores', label: t('benchmarks.harness.logicalCoresLabel') },
    { key: 'ram', label: t('benchmarks.harness.ramLabel') },
    { key: 'jdk', label: t('benchmarks.harness.jdkLabel') },
    { key: 'os', label: t('benchmarks.harness.osLabel'), wide: true },
    { key: 'measuredAt', label: t('benchmarks.harness.measuredAtLabel') },
  ];
}

function Term({ children }: { children: string }) {
  return (
    <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
      {children}
    </dt>
  );
}

/** Mirrors `HarnessPanel`'s own header and spec grid, before the report
 * resolves: every cell's own label is fixed chrome (never response data), so
 * it renders as real text immediately — only the six values themselves stay
 * placeholder bars. */
export function HarnessPanelSkeleton() {
  const { t } = useTranslation();
  const cells = useHarnessCells();

  return (
    <Panel>
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <div className="@container">
        <dl className={GRID_CLASS}>
          {cells.map(({ key, label, wide }) => (
            <div key={key} className={cn('min-w-0', wide && WIDE_CELL_CLASS)}>
              <Term>{label}</Term>
              <dd>
                <Skeleton className="mt-1 h-3.5 w-24" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

/**
 * The reference machine the versioned JMH numbers were measured on, as a
 * spec grid: each cell an eyebrow term over a mono value, read as-is from the
 * `GET /benchmarks` response — never recomputed.
 */
export function HarnessPanel({ harness }: { harness: BenchmarkHarness }) {
  const { t, i18n } = useTranslation();
  const cells = useHarnessCells();

  const values: Record<string, string> = {
    cpu: formatCpuModel(harness.cpuModel),
    cores: String(harness.logicalCores),
    ram: formatRamGib(harness.totalRamBytes),
    jdk: harness.jdk,
    os: harness.os,
    measuredAt: formatMeasuredAt(harness.measuredAt, i18n.language),
  };

  return (
    <Panel>
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <div className="@container">
        <dl className={GRID_CLASS}>
          {cells.map(({ key, label, wide }) => (
            <div key={key} className={cn('min-w-0', wide && WIDE_CELL_CLASS)}>
              <Term>{label}</Term>
              <dd className="break-words font-mono text-mono text-ink">{values[key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}
