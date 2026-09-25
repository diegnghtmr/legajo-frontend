import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
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
import { algorithmIdFromSloFamily, evaluateSlo, type SloEvaluation } from './sloEvaluation';
import { formatDuration } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/** All C(n,2) classic comparisons per algorithm, < 5 s. */
const CLASSIC_THRESHOLD_MS = 5_000;
/** All four linkages from cached matrices/vectors, < 1 s. */
const CLUSTERING_THRESHOLD_MS = 1_000;

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

function StatusLabel({ evaluation }: { evaluation: SloEvaluation }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'text-label font-semibold',
        evaluation.withinThreshold ? 'text-success' : 'text-danger',
      )}
    >
      {evaluation.withinThreshold
        ? t('benchmarks.slo.statusWithin')
        : t('benchmarks.slo.statusExceeds')}
    </span>
  );
}

function SloTable({
  title,
  evaluations,
  algorithmLabel,
}: {
  title: string;
  evaluations: readonly { evaluation: SloEvaluation; label: string }[];
  algorithmLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader title={title} />
      <Table aria-label={title}>
        <TableCaption className="sr-only">{title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{algorithmLabel}</TableHead>
            <TableHead>{t('benchmarks.slo.valueLabel')}</TableHead>
            <TableHead>{t('benchmarks.slo.thresholdLabel')}</TableHead>
            <TableHead>{t('benchmarks.slo.statusLabel')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evaluations.map(({ evaluation, label }) => (
            <TableRow key={`${evaluation.family}-${evaluation.size}`}>
              <TableCell className="font-mono text-mono text-ink">{label}</TableCell>
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
    </Panel>
  );
}

/** The fixed measurement size for every `slo-*` family ("n = 20"). */
const SLO_FIXED_SIZE = 20;

/**
 * SLO evidence in the UI: the classic comparisons table per classic
 * algorithm and the clustering table for the four linkages, each value
 * against its fixed threshold with a text within/exceeds label — never
 * color alone.
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
    <section aria-labelledby="slo-heading" className="flex flex-col gap-4">
      <h2 id="slo-heading" className="text-title font-semibold text-ink">
        {t('benchmarks.slo.title')}
      </h2>
      {classicEvaluations.length > 0 && (
        <SloTable
          title={t('benchmarks.slo.classicTitle')}
          evaluations={classicEvaluations}
          algorithmLabel={t('benchmarks.slo.algorithmLabel')}
        />
      )}
      {clusteringEvaluations.length > 0 && (
        <SloTable
          title={t('benchmarks.slo.clusteringTitle')}
          evaluations={clusteringEvaluations}
          algorithmLabel={t('benchmarks.slo.familyLabel')}
        />
      )}
    </section>
  );
}
