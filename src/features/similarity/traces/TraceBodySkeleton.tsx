import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '../../../shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui/table';
import { DP_FORMULAS } from './DpTracePanel';
import { DP_OPERATION_LEGEND } from './dpOperationLegend';
import { FormulaCaption } from './FormulaCaption';
import { TraceFieldSkeleton } from './TraceFieldSkeleton';

export interface TraceBodySkeletonProps {
  /** Already known before the trace fetch resolves (the route param or the
   * row that opened this panel) — enough, on its own, to know exactly
   * which of the six capability panels this trace body will become. */
  algorithmId: string;
  /** Set by the docked/overlay trace panel, whose own pinned footer
   * reserves the download action instead — mirrors `DpTracePanel`'s own
   * `hideDownloadButton`, so the two never disagree about where that
   * control's box lives. */
  hideDownloadButton?: boolean;
}

const DP_ALGORITHM_IDS = ['levenshtein', 'needleman-wunsch'] as const;
type DpAlgorithmId = (typeof DP_ALGORITHM_IDS)[number];

function isDpAlgorithmId(algorithmId: string): algorithmId is DpAlgorithmId {
  return (DP_ALGORITHM_IDS as readonly string[]).includes(algorithmId);
}

/**
 * Mirrors `DpTracePanel`'s own matrix viewport, operation legend and
 * operations region: the legend and the KaTeX formula need no fetched
 * data at all (both are fixed per algorithm id), so they render for real
 * immediately; only the matrix and the operations sequence — whose actual
 * size depends on the two compared documents — stay placeholder boxes,
 * each at its own real bounded viewport height (`DpMatrix`'s own
 * `max-h-[420px]`, the operations region's own `max-h-64`), so a viewport
 * that real content already fills causes no shift once it arrives.
 */
function DpTraceBodySkeleton({
  algorithmId,
  hideDownloadButton = false,
}: {
  algorithmId: DpAlgorithmId;
  hideDownloadButton: boolean;
}) {
  const { t } = useTranslation();
  const legendHeadingId = useId();
  const legend = DP_OPERATION_LEGEND[algorithmId];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          role="region"
          aria-label={t('similarity.trace.dp.matrixCaption', { id: algorithmId })}
          tabIndex={0}
          className="max-h-[420px] max-w-full overflow-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Skeleton className="h-[420px] w-full rounded-none" />
        </div>
        {!hideDownloadButton && (
          // The download button's own fixed 36px height (`Button`'s own
          // `h-9`), so its box reserves the same space before the trace
          // resolves.
          <Skeleton data-testid="trace-body-skeleton-download-button" className="h-9 w-40" />
        )}
      </div>

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
          aria-label={t('similarity.trace.dp.operationsTableCaption', { id: algorithmId })}
          tabIndex={0}
          className="max-h-64 overflow-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Skeleton className="h-64 w-full rounded-none" />
        </div>
      </div>

      <FormulaCaption
        tex={DP_FORMULAS[algorithmId]}
        caption={t(
          algorithmId === 'levenshtein'
            ? 'similarity.trace.dp.formula.levenshtein'
            : 'similarity.trace.dp.formula.needlemanWunsch',
        )}
      />
    </div>
  );
}

const EMBEDDING_ALGORITHM_IDS = ['embedding-local', 'embedding-api'] as const;
type EmbeddingAlgorithmId = (typeof EMBEDDING_ALGORITHM_IDS)[number];

function isEmbeddingAlgorithmId(algorithmId: string): algorithmId is EmbeddingAlgorithmId {
  return (EMBEDDING_ALGORITHM_IDS as readonly string[]).includes(algorithmId);
}

/**
 * Mirrors `EmbeddingLocalTracePanel`/`EmbeddingApiTracePanel`: every field
 * this shape ever has is fixed (never a variable-length list), so every
 * label renders as real text immediately, over a placeholder value bar.
 * The two vector excerpts and (for `embedding-api`) the configured model id
 * reserve a second line — both are known to wrap at this grid's own column
 * width, unlike the shorter fixed-precision numeric fields.
 */
function EmbeddingTraceBodySkeleton({ algorithmId }: { algorithmId: EmbeddingAlgorithmId }) {
  const { t } = useTranslation();
  const ns = algorithmId === 'embedding-local' ? 'embeddingLocal' : 'embeddingApi';

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.providerLabel`)} />
      <TraceFieldSkeleton
        label={t(`similarity.trace.${ns}.modelLabel`)}
        valueLines={algorithmId === 'embedding-api' ? 2 : 1}
      />
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.dimensionLabel`)} />
      <TraceFieldSkeleton
        className="sm:col-span-2"
        label={t(`similarity.trace.${ns}.vectorAExcerptLabel`)}
        valueLines={2}
      />
      <TraceFieldSkeleton
        className="sm:col-span-2"
        label={t(`similarity.trace.${ns}.vectorBExcerptLabel`)}
        valueLines={2}
      />
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.preNormL2ALabel`)} />
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.preNormL2BLabel`)} />
      {algorithmId === 'embedding-local' ? (
        <>
          <TraceFieldSkeleton label={t('similarity.trace.embeddingLocal.dotProductLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingLocal.cosineLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingLocal.angleLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingLocal.normalizedScoreLabel')} />
        </>
      ) : (
        <>
          <TraceFieldSkeleton label={t('similarity.trace.embeddingApi.sumSquaredDiffLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingApi.distanceLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingApi.normalizedScoreLabel')} />
          <TraceFieldSkeleton label={t('similarity.trace.embeddingApi.providerStatusLabel')} />
        </>
      )}
    </dl>
  );
}

/** Mirrors `JaccardTracePanel`'s own fixed labels (both set names, the
 * intersection/union headings and the coefficient) as real text; only the
 * token sets themselves — a variable-length list per document pair — stay
 * placeholder bars. */
function JaccardTraceBodySkeleton() {
  const { t } = useTranslation();
  const intersectionHeadingId = useId();
  const unionHeadingId = useId();

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-4">
        <TraceFieldSkeleton label={t('similarity.trace.jaccard.setALabel')} />
        <TraceFieldSkeleton label={t('similarity.trace.jaccard.setBLabel')} />
      </dl>
      <div className="flex flex-col gap-1">
        <h3
          id={intersectionHeadingId}
          className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.jaccard.intersectionLabel')}
        </h3>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <h3
          id={unionHeadingId}
          className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.jaccard.unionLabel')}
        </h3>
        <Skeleton className="h-3 w-40" />
      </div>
      <dl>
        <TraceFieldSkeleton label={t('similarity.trace.jaccard.coefficientLabel')} />
      </dl>
    </div>
  );
}

/** Mirrors `TfIdfTracePanel`'s own fixed corpus-size field and the terms
 * table's real header row (every column label is fixed chrome); the term
 * rows themselves depend on the union of the two documents' own tokens, so
 * they stay placeholder bars inside the table's own scrollable region. */
function TfIdfTraceBodySkeleton() {
  const { t } = useTranslation();
  const termsHeadingId = useId();

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2 text-label text-ink-secondary">
        <span>{t('similarity.trace.tfidf.corpusSizeLabel')}</span>
        <Skeleton className="h-3 w-10" />
      </p>
      <div>
        <h3
          id={termsHeadingId}
          className="mb-1 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.tfidf.termsHeading')}
        </h3>
        <div
          role="region"
          aria-labelledby={termsHeadingId}
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Table wrap={false}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('similarity.trace.tfidf.termLabel')}</TableHead>
                <TableHead>{t('similarity.trace.tfidf.frequencyALabel')}</TableHead>
                <TableHead>{t('similarity.trace.tfidf.frequencyBLabel')}</TableHead>
                <TableHead>{t('similarity.trace.tfidf.documentFrequencyLabel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }, (_unused, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <TraceFieldSkeleton label={t('similarity.trace.tfidf.dotProductLabel')} />
        <TraceFieldSkeleton label={t('similarity.trace.tfidf.rawNormALabel')} />
        <TraceFieldSkeleton label={t('similarity.trace.tfidf.rawNormBLabel')} />
        <TraceFieldSkeleton label={t('similarity.trace.tfidf.cosineLabel')} />
        <TraceFieldSkeleton label={t('similarity.trace.tfidf.angleLabel')} />
      </dl>
    </div>
  );
}

/**
 * A placeholder for a trace's own body — shared by the docked detail panel
 * and the standalone full-screen view. The algorithm id is always known
 * before the trace fetch resolves (the route param, or the row that opened
 * this panel), so this routes to the exact shape that algorithm's own body
 * will take instead of one generic block guessing at every capability's
 * layout at once — the same routing `TracePanel` itself does once the
 * trace has actually resolved.
 */
export function TraceBodySkeleton({
  algorithmId,
  hideDownloadButton = false,
}: TraceBodySkeletonProps) {
  return (
    <div data-testid="trace-body-skeleton">
      {isDpAlgorithmId(algorithmId) ? (
        <DpTraceBodySkeleton algorithmId={algorithmId} hideDownloadButton={hideDownloadButton} />
      ) : isEmbeddingAlgorithmId(algorithmId) ? (
        <EmbeddingTraceBodySkeleton algorithmId={algorithmId} />
      ) : algorithmId === 'jaccard' ? (
        <JaccardTraceBodySkeleton />
      ) : (
        <TfIdfTraceBodySkeleton />
      )}
    </div>
  );
}
