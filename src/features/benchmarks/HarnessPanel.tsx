import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { formatCpuModel, formatMeasuredAt, formatRamGib } from './formatHarness';

type BenchmarkHarness = BenchmarkReportResponse['harness'];

/**
 * A four-column ruled grid from 700px, two columns below. The `dl` is the
 * card's flexible child, so it grows to the row height the embedding card
 * sets, and its rows share the extra space equally. The ring is an inset
 * hairline drawn under the cells' own rules, with the corners clipped.
 */
const GRID_CLASS =
  'grid flex-1 grid-cols-2 overflow-hidden rounded-md ring-1 ring-inset ring-hairline min-[700px]:grid-cols-4';

const CELL_CLASS =
  'flex min-h-[68px] min-w-0 flex-col justify-center gap-1.5 border-b border-hairline px-3.5 py-3';

interface HarnessCell {
  key: string;
  label: string;
  /** Layout and rule classes: the wide cells span two columns, the last cell
   * of each row loses its right rule, the second row loses its bottom rule. */
  className: string;
}

function useHarnessCells(): readonly HarnessCell[] {
  const { t } = useTranslation();

  return [
    {
      key: 'cpu',
      label: t('benchmarks.harness.cpuModelLabel'),
      className: 'border-r min-[700px]:col-span-2',
    },
    {
      key: 'cores',
      label: t('benchmarks.harness.logicalCoresLabel'),
      className: 'min-[700px]:border-r',
    },
    {
      key: 'ram',
      label: t('benchmarks.harness.ramLabel'),
      className: 'border-r min-[700px]:border-r-0',
    },
    {
      key: 'jdk',
      label: t('benchmarks.harness.jdkLabel'),
      className: 'min-[700px]:border-r min-[700px]:border-b-0',
    },
    {
      key: 'os',
      label: t('benchmarks.harness.osLabel'),
      className: 'border-r min-[700px]:col-span-2 min-[700px]:border-b-0',
    },
    {
      key: 'measuredAt',
      label: t('benchmarks.harness.measuredAtLabel'),
      className: 'min-[700px]:border-b-0',
    },
  ];
}

/** The value's own type treatment, shared by the real value and its placeholder. */
const VALUE_CLASS = 'text-balance break-words font-mono text-[13px] leading-[1.35]';

/** Invisible stand-ins of a typical length, so a placeholder wraps over as many
 * lines as a real value does at the same width and the card keeps its height. */
const SKELETON_SAMPLES: Record<string, string> = {
  cpu: 'xxxx xxx xxxxx xxxx xx-xxxxxx',
  cores: 'xx',
  ram: 'xx.x xxx',
  jdk: 'xxxxxxx xxxxxxxx xx.x.x',
  os: 'xxxxx x.x.x-x-xxxxxxx (xxxxx)',
  measuredAt: 'xx xxx xxxx, xx:xx xxx',
};

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
    <Panel className="flex flex-col">
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <dl className={GRID_CLASS}>
        {cells.map(({ key, label, className }) => (
          <div key={key} className={cn(CELL_CLASS, className)}>
            <Term>{label}</Term>
            <dd>
              <Skeleton className={cn(VALUE_CLASS, 'w-fit max-w-full text-transparent')}>
                {SKELETON_SAMPLES[key]}
              </Skeleton>
            </dd>
          </div>
        ))}
      </dl>
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
    <Panel className="flex flex-col">
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <dl className={GRID_CLASS}>
        {cells.map(({ key, label, className }) => (
          <div key={key} className={cn(CELL_CLASS, className)}>
            <Term>{label}</Term>
            <dd className={cn(VALUE_CLASS, 'text-ink')}>{values[key]}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
