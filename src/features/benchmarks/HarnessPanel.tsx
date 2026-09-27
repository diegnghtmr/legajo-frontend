import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { formatMeasuredAt, formatRamBytes } from './formatHarness';

/** The harness's own 6 fixed fields (CPU, cores, RAM, JDK, OS, measured
 * at), mirrored one label/value pair at a time. */
const HARNESS_FIELD_COUNT = 6;

/** Mirrors `HarnessPanel`'s own header and `dl` grid, before the report
 * resolves. */
export function HarnessPanelSkeleton() {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: HARNESS_FIELD_COUNT }, (_unused, index) => (
          <div key={index}>
            <dt>
              <Skeleton className="h-3 w-16" />
            </dt>
            <dd>
              <Skeleton className="mt-1 h-3.5 w-24" />
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

type BenchmarkHarness = BenchmarkReportResponse['harness'];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd className="font-mono text-mono text-ink">{value}</dd>
    </div>
  );
}

/**
 * Reference-harness key-value rows: the machine the
 * versioned JMH numbers were measured on, read as-is from the
 * `GET /benchmarks` response — never recomputed.
 */
export function HarnessPanel({ harness }: { harness: BenchmarkHarness }) {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader
        eyebrow={t('benchmarks.harness.eyebrow')}
        title={t('benchmarks.harness.title')}
      />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
        <Row label={t('benchmarks.harness.cpuModelLabel')} value={harness.cpuModel} />
        <Row
          label={t('benchmarks.harness.logicalCoresLabel')}
          value={String(harness.logicalCores)}
        />
        <Row
          label={t('benchmarks.harness.ramLabel')}
          value={formatRamBytes(harness.totalRamBytes)}
        />
        <Row label={t('benchmarks.harness.jdkLabel')} value={harness.jdk} />
        <Row label={t('benchmarks.harness.osLabel')} value={harness.os} />
        <Row
          label={t('benchmarks.harness.measuredAtLabel')}
          value={formatMeasuredAt(harness.measuredAt)}
        />
      </dl>
    </Panel>
  );
}
