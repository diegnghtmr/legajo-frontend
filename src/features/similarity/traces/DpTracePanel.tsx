import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { DpMatrixTrace } from '../../../infrastructure/schemas/similarity';
import type { AlgoFamily } from '../../../shared/family';
import { DpMatrix } from '../../../shared/components/DpMatrix';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui/table';
import { formatTraceNumber } from '../formatters';
import { DP_OPERATION_LEGEND, type DpOperationKind } from './dpOperationLegend';
import { FormulaCaption } from './FormulaCaption';

const DP_FORMULAS: Record<'levenshtein' | 'needleman-wunsch', string> = {
  levenshtein:
    'D_{i,j}=\\min\\begin{cases}D_{i-1,j}+1\\\\D_{i,j-1}+1\\\\D_{i-1,j-1}+[a_i\\neq b_j]\\end{cases}',
  'needleman-wunsch':
    'S_{i,j}=\\max\\begin{cases}S_{i-1,j-1}+\\mathrm{score}(a_i,b_j)\\\\S_{i-1,j}-1\\\\S_{i,j-1}-1\\end{cases}',
};

export interface DpTracePanelProps {
  trace: DpMatrixTrace;
  /**
   * The catalogue's family for this algorithm (both DP capabilities are
   * `classic`), resolved by the caller from `GET /similarity/algorithms` —
   * this panel never guesses it. Optional: while that catalogue fetch is
   * still pending, the meta row is simply not rendered yet rather than
   * showing a placeholder value.
   */
  family?: AlgoFamily;
}

/**
 * DP trace panel (Levenshtein / Needleman–Wunsch): the meta row required by
 * the design (`Familia`, `Camino óptimo` — the matrix's own bottom-right
 * cell, i.e. the same edit distance / alignment score the compare table's
 * raw value shows, never recomputed here), then the complete matrix with
 * its optimal path (`DpMatrix`), the algorithm-specific operation legend and
 * the full ordered operations sequence — both required for auditability —
 * plus one KaTeX recurrence caption per algorithm family.
 */
export function DpTracePanel({ trace, family }: DpTracePanelProps) {
  const { t } = useTranslation();
  const legendHeadingId = useId();
  const legend = DP_OPERATION_LEGEND[trace.algorithmId];
  const lastRow = trace.matrix[trace.matrix.length - 1];
  const optimalPathCost = lastRow?.[lastRow.length - 1];
  const familyLabel =
    family === undefined
      ? undefined
      : family === 'classic'
        ? t('similarity.family.classic')
        : t('similarity.family.ai');

  return (
    <div className="flex flex-col gap-4">
      {familyLabel !== undefined && optimalPathCost !== undefined && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
              {t('similarity.trace.dp.familyLabel')}
            </dt>
            <dd data-testid="dp-trace-family" className="text-body font-semibold text-ink">
              {familyLabel}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
              {t('similarity.trace.dp.optimalPathLabel')}
            </dt>
            <dd
              data-testid="dp-trace-optimal-path"
              className="font-mono text-mono font-semibold text-ink"
            >
              {formatTraceNumber(optimalPathCost)}
            </dd>
          </div>
        </dl>
      )}

      <DpMatrix
        rowLabels={trace.rowLabels}
        columnLabels={trace.columnLabels}
        matrix={trace.matrix}
        optimalPath={trace.optimalPath}
        ariaLabel={t('similarity.trace.dp.matrixCaption', { id: trace.algorithmId })}
        downloadLabel={t('similarity.trace.dp.downloadCsv')}
        downloadFileName={`${trace.algorithmId}-matrix.csv`}
        pathCellLabel={t('similarity.trace.dp.pathCellSuffix')}
      />

      <div>
        <h3
          id={legendHeadingId}
          className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.dp.legendHeading')}
        </h3>
        <ul
          aria-labelledby={legendHeadingId}
          className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body text-ink-secondary"
        >
          {legend.map((operation) => (
            <li key={operation}>{t(`similarity.trace.dp.operation.${operation}`)}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.dp.operationsHeading')}
        </h3>
        <div
          role="region"
          aria-label={t('similarity.trace.dp.operationsTableCaption', { id: trace.algorithmId })}
          tabIndex={0}
          className="max-h-64 overflow-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Table>
            <TableCaption className="sr-only">
              {t('similarity.trace.dp.operationsTableCaption', { id: trace.algorithmId })}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('similarity.trace.dp.fromLabel')}</TableHead>
                <TableHead>{t('similarity.trace.dp.toLabel')}</TableHead>
                <TableHead>{t('similarity.trace.dp.operationLabel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trace.operations.map((step, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-mono text-ink-muted">
                    ({step.from.row}, {step.from.col})
                  </TableCell>
                  <TableCell className="font-mono text-mono text-ink-muted">
                    ({step.to.row}, {step.to.col})
                  </TableCell>
                  <TableCell>
                    {t(`similarity.trace.dp.operation.${step.operation as DpOperationKind}`)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <FormulaCaption
        tex={DP_FORMULAS[trace.algorithmId]}
        caption={t(
          trace.algorithmId === 'levenshtein'
            ? 'similarity.trace.dp.formula.levenshtein'
            : 'similarity.trace.dp.formula.needlemanWunsch',
        )}
      />
    </div>
  );
}
