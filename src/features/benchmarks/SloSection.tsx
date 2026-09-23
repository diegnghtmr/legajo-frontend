import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { SLO_CLASSIC_FAMILIES, SLO_CLUSTERING_FAMILY } from './grouping';
import { algorithmIdFromSloFamily, evaluateSlo, type SloEvaluation } from './sloEvaluation';
import { formatDuration } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/** NFR-QA-01: all C(n,2) classic comparisons per algorithm, < 5 s. */
const CLASSIC_THRESHOLD_MS = 5_000;
/** NFR-QA-02: all four linkages from cached matrices/vectors, < 1 s. */
const CLUSTERING_THRESHOLD_MS = 1_000;

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
      <table aria-label={title} className="w-full text-body">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left font-medium text-ink-secondary">
              {algorithmLabel}
            </th>
            <th scope="col" className="text-left font-medium text-ink-secondary">
              {t('benchmarks.slo.valueLabel')}
            </th>
            <th scope="col" className="text-left font-medium text-ink-secondary">
              {t('benchmarks.slo.thresholdLabel')}
            </th>
            <th scope="col" className="text-left font-medium text-ink-secondary">
              {t('benchmarks.slo.statusLabel')}
            </th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map(({ evaluation, label }) => (
            <tr key={label}>
              <td className="font-mono text-mono text-ink">{label}</td>
              <td className="font-mono text-mono text-ink">
                {formatDuration(evaluation.valueMs * 1_000_000)}
              </td>
              <td className="font-mono text-mono text-ink-secondary">
                {formatDuration(evaluation.thresholdMs * 1_000_000)}
              </td>
              <td>
                <StatusLabel evaluation={evaluation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/**
 * TAC-07 evidence in the UI (DESIGN.md §6 item 6): NFR-QA-01 per classic
 * algorithm and NFR-QA-02 for the four linkages, each value against its
 * fixed threshold with a text within/exceeds label — never color alone.
 */
export function SloSection({ results }: { results: readonly BenchmarkResult[] }) {
  const { t } = useTranslation();

  const classicEvaluations = SLO_CLASSIC_FAMILIES.flatMap((family) =>
    results
      .filter((result) => result.family === family)
      .map((result) => ({
        evaluation: evaluateSlo(result, CLASSIC_THRESHOLD_MS),
        label: algorithmIdFromSloFamily(family),
      })),
  );

  const clusteringEvaluations = results
    .filter((result) => result.family === SLO_CLUSTERING_FAMILY)
    .map((result) => ({
      evaluation: evaluateSlo(result, CLUSTERING_THRESHOLD_MS),
      label: algorithmIdFromSloFamily(SLO_CLUSTERING_FAMILY),
    }));

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
