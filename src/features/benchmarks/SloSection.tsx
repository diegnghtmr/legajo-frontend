import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import { SLO_CLASSIC_FAMILIES, SLO_CLUSTERING_FAMILY } from './grouping';
import {
  algorithmIdFromSloFamily,
  evaluateSlo,
  formatHeadroomFactor,
  headroomFactor,
  sloBarFraction,
  type SloEvaluation,
} from './sloEvaluation';
import { formatDuration } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/** All C(n,2) classic comparisons per algorithm, < 5 s. */
const CLASSIC_THRESHOLD_MS = 5_000;
/** All four linkages from cached matrices/vectors, < 1 s. */
const CLUSTERING_THRESHOLD_MS = 1_000;
/** The fixed measurement size for every `slo-*` family ("n = 20"). */
const SLO_FIXED_SIZE = 20;

const BAR_MIN_WIDTH_CLASS = 'min-w-30';
const STATUS_ICON_CLASS = 'size-3.5 shrink-0';

/**
 * `evaluateSlo` throws on a schema-valid-but-unrecognized `unit` (any string
 * passes `BenchmarkResultSchema.unit`). No component may throw during
 * render, so a malformed record is skipped here — the same omit-don't-abort
 * rule `grouping.ts` applies to its own families.
 */
function tryEvaluateSlo(result: BenchmarkResult, thresholdMs: number): SloEvaluation | undefined {
  try {
    return evaluateSlo(result, thresholdMs);
  } catch {
    return undefined;
  }
}

/**
 * Text plus a shape, in `success` or `danger`: never colour alone. "Within"
 * states the headroom factor (how many times the measurement fits under the
 * threshold); "exceeds" states nothing more.
 */
function StatusLabel({ evaluation }: { evaluation: SloEvaluation }) {
  const { t } = useTranslation();
  const { withinThreshold, valueMs, thresholdMs } = evaluation;
  const Icon = withinThreshold ? Check : X;

  return (
    <span
      data-status={withinThreshold ? 'within' : 'exceeds'}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-label font-semibold',
        withinThreshold ? 'text-success' : 'text-danger',
      )}
    >
      <Icon aria-hidden="true" className={STATUS_ICON_CLASS} />
      <span>
        {withinThreshold
          ? t('benchmarks.slo.statusWithin', {
              factor: formatHeadroomFactor(headroomFactor(valueMs, thresholdMs)),
            })
          : t('benchmarks.slo.statusExceeds')}
      </span>
    </span>
  );
}

/**
 * The measurement on a log track from 1 µs to the threshold (its right end,
 * marked by a 1px ink tick): `success` up to the measurement when within, and
 * `danger` across the whole track when it exceeds. Drawn only; the values sit
 * beside it as text.
 */
function ThresholdBar({
  evaluation,
  id,
  index,
}: {
  evaluation: SloEvaluation;
  id: string;
  index: number;
}) {
  const { withinThreshold, valueMs, thresholdMs } = evaluation;
  const fraction = withinThreshold ? sloBarFraction(valueMs, thresholdMs) : 1;

  return (
    <div
      aria-hidden="true"
      className={cn('relative h-2 rounded-sm bg-paper-sunken', BAR_MIN_WIDTH_CLASS)}
    >
      <span
        data-testid={`slo-fill-${id}`}
        className={cn(
          'enter-grow absolute inset-y-0 left-0 rounded-sm',
          withinThreshold ? 'bg-success' : 'bg-danger',
        )}
        style={{ width: `${fraction * 100}%`, ['--i' as string]: index }}
      />
      <span
        data-testid={`slo-threshold-${id}`}
        className="absolute -top-0.5 right-0 h-3 w-px bg-ink"
      />
    </div>
  );
}

function SloTableHeader({ algorithmLabel }: { algorithmLabel: string }) {
  const { t } = useTranslation();

  return (
    <TableHeader>
      <TableRow>
        <TableHead>{algorithmLabel}</TableHead>
        <TableHead>{t('benchmarks.slo.barLabel')}</TableHead>
        <TableHead>{t('benchmarks.slo.valueLabel')}</TableHead>
        <TableHead>{t('benchmarks.slo.thresholdLabel')}</TableHead>
        <TableHead>{t('benchmarks.slo.statusLabel')}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function SloGroup({
  title,
  evaluations,
  algorithmLabel,
}: {
  title: string;
  evaluations: readonly { evaluation: SloEvaluation; label: string }[];
  algorithmLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-semibold text-ink">{title}</h3>
      {/* The single scroll container for this table (its own keyboard
       * focusability and accessible name — WCAG 2.1.1's
       * `scrollable-region-focusable`): none of its cells are themselves
       * focusable, so this region needs to be the one reachable, focusable
       * ancestor itself. `Table`'s own default wrapper is skipped
       * (`wrap={false}`) so this stays the only `overflow` ancestor. */}
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Table wrap={false}>
          <TableCaption className="sr-only">{title}</TableCaption>
          <SloTableHeader algorithmLabel={algorithmLabel} />
          <TableBody>
            {evaluations.map(({ evaluation, label }, index) => (
              <TableRow key={`${evaluation.family}-${evaluation.size}`}>
                <TableCell className="font-mono text-mono text-ink">{label}</TableCell>
                <TableCell>
                  <ThresholdBar evaluation={evaluation} id={label} index={index} />
                </TableCell>
                <TableCell className="font-mono text-mono text-ink">
                  {formatDuration(evaluation.valueMs * 1_000_000)}
                </TableCell>
                <TableCell className="font-mono text-mono text-ink-secondary">
                  {formatDuration(evaluation.thresholdMs * 1_000_000)}
                </TableCell>
                <TableCell>
                  <StatusLabel evaluation={evaluation} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SloGroupSkeleton({
  title,
  labels,
  algorithmLabel,
}: {
  title: string;
  /** Every row's own real label, already known from `grouping.ts`'s fixed
   * family list: real text, since it never depends on the response. */
  labels: readonly string[];
  algorithmLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-semibold text-ink">{title}</h3>
      <div className="overflow-hidden rounded-md">
        <Table wrap={false}>
          <TableCaption className="sr-only">{title}</TableCaption>
          <SloTableHeader algorithmLabel={algorithmLabel} />
          <TableBody>
            {labels.map((label) => (
              <TableRow key={label}>
                <TableCell className="font-mono text-mono text-ink">{label}</TableCell>
                <TableCell>
                  <Skeleton className={cn('h-2', BAR_MIN_WIDTH_CLASS)} />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell>
                  {/* The status's own real width (an invisible sizer, never
                   * announced) reserves this cell's real wrap point: the
                   * other columns' not-yet-known values can squeeze it
                   * below its single-line width, and a fixed-width bar
                   * would silently miss that. */}
                  <span className="relative inline-flex">
                    <span
                      aria-hidden="true"
                      className="invisible inline-flex items-center gap-1.5 whitespace-nowrap text-label font-semibold"
                    >
                      <span className={STATUS_ICON_CLASS} />
                      {t('benchmarks.slo.statusWithin', { factor: '000' })}
                    </span>
                    <Skeleton className="absolute inset-0" />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Mirrors `SloSection`'s own card: the heading, the subtitle, and the two
 * groups (one row per fixed classic family; the one `slo-clustering` row) —
 * both the row counts and each row's label already known from
 * `grouping.ts`'s fixed families, unlike the measured values themselves. */
export function SloSectionSkeleton() {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader title={t('benchmarks.slo.title')} subtitle={t('benchmarks.slo.subtitle')} />
      <div className="flex flex-col gap-4">
        <SloGroupSkeleton
          title={t('benchmarks.slo.classicTitle')}
          labels={SLO_CLASSIC_FAMILIES.map(algorithmIdFromSloFamily)}
          algorithmLabel={t('benchmarks.slo.algorithmLabel')}
        />
        <SloGroupSkeleton
          title={t('benchmarks.slo.clusteringTitle')}
          labels={[algorithmIdFromSloFamily(SLO_CLUSTERING_FAMILY)]}
          algorithmLabel={t('benchmarks.slo.familyLabel')}
        />
      </div>
    </Panel>
  );
}

/**
 * SLO evidence in the UI: the classic comparisons per classic algorithm and
 * the four linkages together, each measurement on a log bar against its fixed
 * threshold, with a text within/exceeds status — never colour alone.
 */
export function SloSection({ results }: { results: readonly BenchmarkResult[] }) {
  const { t } = useTranslation();

  const classicEvaluations = SLO_CLASSIC_FAMILIES.flatMap((family) =>
    results
      .filter((result) => result.family === family && result.size === SLO_FIXED_SIZE)
      .flatMap((result) => {
        const evaluation = tryEvaluateSlo(result, CLASSIC_THRESHOLD_MS);
        return evaluation === undefined
          ? []
          : [{ evaluation, label: algorithmIdFromSloFamily(family) }];
      }),
  );

  const clusteringEvaluations = results
    .filter((result) => result.family === SLO_CLUSTERING_FAMILY && result.size === SLO_FIXED_SIZE)
    .flatMap((result) => {
      const evaluation = tryEvaluateSlo(result, CLUSTERING_THRESHOLD_MS);
      return evaluation === undefined
        ? []
        : [{ evaluation, label: algorithmIdFromSloFamily(SLO_CLUSTERING_FAMILY) }];
    });

  if (classicEvaluations.length === 0 && clusteringEvaluations.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader title={t('benchmarks.slo.title')} subtitle={t('benchmarks.slo.subtitle')} />
      <div className="flex flex-col gap-4">
        {classicEvaluations.length > 0 && (
          <SloGroup
            title={t('benchmarks.slo.classicTitle')}
            evaluations={classicEvaluations}
            algorithmLabel={t('benchmarks.slo.algorithmLabel')}
          />
        )}
        {clusteringEvaluations.length > 0 && (
          <SloGroup
            title={t('benchmarks.slo.clusteringTitle')}
            evaluations={clusteringEvaluations}
            algorithmLabel={t('benchmarks.slo.familyLabel')}
          />
        )}
      </div>
    </Panel>
  );
}
