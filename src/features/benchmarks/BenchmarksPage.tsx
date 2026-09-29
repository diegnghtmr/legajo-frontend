import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchBenchmarks, type BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { Alert } from '../../shared/components/Alert';
import { PanelHeader } from '../../shared/components/Panel';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import {
  BenchmarkCurveChart,
  BenchmarkCurveChartSkeleton,
  type FamilySlope,
} from './BenchmarkCurveChart';
import { EmbeddingTiles, EmbeddingTilesSkeleton } from './EmbeddingTiles';
import {
  HAC_LINKAGE_FAMILIES,
  INTERNAL_METRIC_FAMILIES,
  PAIRWISE_CLASSIC_FAMILIES,
  seriesForFamilies,
} from './grouping';
import { HarnessPanel, HarnessPanelSkeleton } from './HarnessPanel';
import { SloSection, SloSectionSkeleton } from './SloSection';

export const BENCHMARKS_QUERY_KEY = ['benchmarks'] as const;

type Scale = 'linear' | 'log-log';

/** The two fixed scale options (Lineal/Log-log) — a control that reacts to
 * charts not yet on screen stays a placeholder rather than a working
 * control with nothing to control. */
const SCALE_OPTION_SKELETON_COUNT = 2;

/** One column, then the given columns from the desktop breakpoint. */
const ROW_CLASS = 'grid grid-cols-1 gap-6';
const SCALE_LABEL_ID = 'benchmarks-scale-label';

/** The three curve groups: their card title, x-axis title and fixed families
 * (known before the request resolves, so the skeleton mirrors them exactly). */
const CURVE_GROUPS = {
  pairwise: {
    titleKey: 'benchmarks.curves.pairwiseTitle',
    xAxisKey: 'benchmarks.curves.xAxisLength',
    families: PAIRWISE_CLASSIC_FAMILIES,
  },
  hac: {
    titleKey: 'benchmarks.curves.hacTitle',
    xAxisKey: 'benchmarks.curves.xAxisN',
    families: HAC_LINKAGE_FAMILIES,
  },
  metrics: {
    titleKey: 'benchmarks.curves.internalMetricsTitle',
    xAxisKey: 'benchmarks.curves.xAxisN',
    families: INTERNAL_METRIC_FAMILIES,
  },
} as const;

type CurveGroupId = keyof typeof CURVE_GROUPS;

function ScaleSegmentedSkeleton() {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-paper-sunken p-[3px]">
      {Array.from({ length: SCALE_OPTION_SKELETON_COUNT }, (_unused, index) => (
        <Skeleton key={index} className="h-8 w-16 rounded-btn" />
      ))}
    </div>
  );
}

/** The page title on the left and the `Escala` control on the right (below it
 * on a narrow screen), so one control drives every curve card. */
function PageHeader({ control }: { control: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="benchmarks-header"
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <PanelHeader eyebrow={t('benchmarks.eyebrow')} title={t('benchmarks.title')} />
      <div className="mb-3 flex items-center gap-3">
        <span id={SCALE_LABEL_ID} className="text-label text-ink-secondary">
          {t('benchmarks.scaleGroupLabel')}
        </span>
        {control}
      </div>
    </div>
  );
}

function slopesByFamily(
  slopes: BenchmarkReportResponse['slopes'],
  families: readonly string[],
): Map<string, FamilySlope> {
  const familySet = new Set(families);
  return new Map(
    slopes
      .filter((slope) => familySet.has(slope.family))
      .map((slope) => [
        slope.family,
        { empiricalSlope: slope.empiricalSlope, theoreticalExponent: slope.theoreticalExponent },
      ]),
  );
}

function CurveSkeleton({ id }: { id: CurveGroupId }) {
  const { t } = useTranslation();
  const group = CURVE_GROUPS[id];
  const title = t(group.titleKey);

  return (
    <BenchmarkCurveChartSkeleton
      title={title}
      xAxisLabel={t(group.xAxisKey)}
      yAxisLabel={t('benchmarks.curves.yAxisLabel')}
      slopeTableCaption={t('benchmarks.curves.slopeTableCaption', { group: title })}
      families={group.families}
    />
  );
}

function CurveCard({
  id,
  report,
  scale,
}: {
  id: CurveGroupId;
  report: BenchmarkReportResponse;
  scale: Scale;
}) {
  const { t } = useTranslation();
  const group = CURVE_GROUPS[id];
  const title = t(group.titleKey);

  return (
    <BenchmarkCurveChart
      title={title}
      xAxisLabel={t(group.xAxisKey)}
      yAxisLabel={t('benchmarks.curves.yAxisLabel')}
      series={seriesForFamilies(report.results, group.families)}
      slopes={slopesByFamily(report.slopes, group.families)}
      scale={scale}
      dataTableCaption={t('benchmarks.curves.dataTableCaption', { group: title })}
      slopeTableCaption={t('benchmarks.curves.slopeTableCaption', { group: title })}
    />
  );
}

/**
 * Benchmarks screen (`GET /benchmarks`), in three rows from the desktop
 * breakpoint and one column below it: the reference machine beside the
 * embedding tiles (1.5fr / 1fr); the pairwise and HAC curve cards; the metrics
 * curve card beside the SLO evidence. Reads the versioned JMH numbers as-is —
 * this screen never runs a benchmark or recomputes a slope.
 */
export function BenchmarksPage() {
  const { t } = useTranslation();
  const [scale, setScale] = useState<Scale>('linear');

  const query = useQuery<BenchmarkReportResponse, ApiError>({
    queryKey: BENCHMARKS_QUERY_KEY,
    queryFn: fetchBenchmarks,
  });

  const scaleOptions: readonly SegmentedOption<Scale>[] = useMemo(
    () => [
      { value: 'linear', label: t('benchmarks.scaleLinear') },
      { value: 'log-log', label: t('benchmarks.scaleLogLog') },
    ],
    [t],
  );

  return (
    <div data-testid="benchmarks-page" className="flex flex-col gap-6">
      <PageHeader
        control={
          query.data ? (
            <SegmentedControl
              options={scaleOptions}
              value={scale}
              onChange={setScale}
              aria-labelledby={SCALE_LABEL_ID}
            />
          ) : (
            <ScaleSegmentedSkeleton />
          )
        }
      />

      {query.isPending && (
        <>
          <p role="status" className="sr-only">
            {t('benchmarks.loading')}
          </p>
          <div
            data-testid="benchmarks-row-machine"
            className={cn(ROW_CLASS, 'lg:grid-cols-[1.5fr_1fr]')}
          >
            <HarnessPanelSkeleton />
            <EmbeddingTilesSkeleton />
          </div>
          <div data-testid="benchmarks-row-curves" className={cn(ROW_CLASS, 'lg:grid-cols-2')}>
            <CurveSkeleton id="pairwise" />
            <CurveSkeleton id="hac" />
          </div>
          <div data-testid="benchmarks-row-metrics" className={cn(ROW_CLASS, 'lg:grid-cols-2')}>
            <CurveSkeleton id="metrics" />
            <SloSectionSkeleton />
          </div>
        </>
      )}
      {query.isError && (
        <Alert
          tone="danger"
          title={t('benchmarks.errorTitle')}
          body={t(query.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        />
      )}

      {query.data && (
        <>
          <div
            data-testid="benchmarks-row-machine"
            className={cn(ROW_CLASS, 'lg:grid-cols-[1.5fr_1fr]')}
          >
            <HarnessPanel harness={query.data.harness} />
            <EmbeddingTiles results={query.data.results} />
          </div>
          <div data-testid="benchmarks-row-curves" className={cn(ROW_CLASS, 'lg:grid-cols-2')}>
            <CurveCard id="pairwise" report={query.data} scale={scale} />
            <CurveCard id="hac" report={query.data} scale={scale} />
          </div>
          <div data-testid="benchmarks-row-metrics" className={cn(ROW_CLASS, 'lg:grid-cols-2')}>
            <CurveCard id="metrics" report={query.data} scale={scale} />
            <SloSection results={query.data.results} />
          </div>
        </>
      )}
    </div>
  );
}
