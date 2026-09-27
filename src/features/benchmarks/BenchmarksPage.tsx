import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { fetchBenchmarks, type BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { PanelHeader } from '../../shared/components/Panel';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { Skeleton } from '../../shared/components/ui/skeleton';
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

function ScaleSegmentedSkeleton() {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-paper-sunken p-[3px]">
      {Array.from({ length: SCALE_OPTION_SKELETON_COUNT }, (_unused, index) => (
        <Skeleton key={index} className="h-6 w-16 rounded-btn" />
      ))}
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

/**
 * Benchmarks screen (`GET /benchmarks`): the reference harness, one curve
 * chart per group (pairwise classic, HAC linkages, internal metrics), one
 * tile per embedding dimension, and SLO evidence. Reads the versioned JMH
 * numbers as-is — this screen never runs a benchmark or recomputes a slope.
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
    <div className="flex flex-col gap-6">
      <PanelHeader eyebrow={t('benchmarks.eyebrow')} title={t('benchmarks.title')} />

      {query.isPending && (
        <>
          <p role="status" className="sr-only">
            {t('benchmarks.loading')}
          </p>
          <HarnessPanelSkeleton />
          <ScaleSegmentedSkeleton />
          <BenchmarkCurveChartSkeleton
            title={t('benchmarks.curves.pairwiseTitle')}
            seriesCount={PAIRWISE_CLASSIC_FAMILIES.length}
          />
          <BenchmarkCurveChartSkeleton
            title={t('benchmarks.curves.hacTitle')}
            seriesCount={HAC_LINKAGE_FAMILIES.length}
          />
          <BenchmarkCurveChartSkeleton
            title={t('benchmarks.curves.internalMetricsTitle')}
            seriesCount={INTERNAL_METRIC_FAMILIES.length}
          />
          <EmbeddingTilesSkeleton />
          <SloSectionSkeleton />
        </>
      )}
      {query.isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">{t('benchmarks.errorTitle')}</p>
          <p className="text-body text-ink-secondary">
            {t(query.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}

      {query.data && (
        <>
          <HarnessPanel harness={query.data.harness} />

          <SegmentedControl
            options={scaleOptions}
            value={scale}
            onChange={setScale}
            aria-label={t('benchmarks.scaleGroupLabel')}
          />

          <BenchmarkCurveChart
            title={t('benchmarks.curves.pairwiseTitle')}
            xAxisLabel={t('benchmarks.curves.xAxisLength')}
            yAxisLabel={t('benchmarks.curves.yAxisLabel')}
            series={seriesForFamilies(query.data.results, PAIRWISE_CLASSIC_FAMILIES)}
            slopes={slopesByFamily(query.data.slopes, PAIRWISE_CLASSIC_FAMILIES)}
            scale={scale}
            dataTableCaption={t('benchmarks.curves.dataTableCaption', {
              group: t('benchmarks.curves.pairwiseTitle'),
            })}
            slopeTableCaption={t('benchmarks.curves.slopeTableCaption', {
              group: t('benchmarks.curves.pairwiseTitle'),
            })}
          />

          <BenchmarkCurveChart
            title={t('benchmarks.curves.hacTitle')}
            xAxisLabel={t('benchmarks.curves.xAxisN')}
            yAxisLabel={t('benchmarks.curves.yAxisLabel')}
            series={seriesForFamilies(query.data.results, HAC_LINKAGE_FAMILIES)}
            slopes={slopesByFamily(query.data.slopes, HAC_LINKAGE_FAMILIES)}
            scale={scale}
            dataTableCaption={t('benchmarks.curves.dataTableCaption', {
              group: t('benchmarks.curves.hacTitle'),
            })}
            slopeTableCaption={t('benchmarks.curves.slopeTableCaption', {
              group: t('benchmarks.curves.hacTitle'),
            })}
          />

          <BenchmarkCurveChart
            title={t('benchmarks.curves.internalMetricsTitle')}
            xAxisLabel={t('benchmarks.curves.xAxisN')}
            yAxisLabel={t('benchmarks.curves.yAxisLabel')}
            series={seriesForFamilies(query.data.results, INTERNAL_METRIC_FAMILIES)}
            slopes={slopesByFamily(query.data.slopes, INTERNAL_METRIC_FAMILIES)}
            scale={scale}
            dataTableCaption={t('benchmarks.curves.dataTableCaption', {
              group: t('benchmarks.curves.internalMetricsTitle'),
            })}
            slopeTableCaption={t('benchmarks.curves.slopeTableCaption', {
              group: t('benchmarks.curves.internalMetricsTitle'),
            })}
          />

          <EmbeddingTiles results={query.data.results} />

          <SloSection results={query.data.results} />
        </>
      )}
    </div>
  );
}
