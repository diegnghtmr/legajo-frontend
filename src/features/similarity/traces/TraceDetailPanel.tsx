import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../../infrastructure/apiError';
import {
  compareSimilarity,
  fetchSimilarityTrace,
  type CompareResponse,
  type SimilarityTraceResponse,
} from '../../../infrastructure/api/similarity';
import { algorithmsQueryOptions } from '../../../infrastructure/api/similarityCatalogue';
import type { AlgorithmId } from '../../../infrastructure/schemas/similarity';
import type { DpMatrixHandle } from '../../../shared/components/DpMatrix';
import { Button, buttonVariants } from '../../../shared/components/ui/button';
import { algoFamilyFromKind } from '../algorithmFamily';
import { formatRawValue, formatTraceNumber } from '../formatters';
import { TracePanel } from '../SimilarityTracePage';
import { cn } from '../../../shared/lib/cn';
import { TraceBodySkeleton } from './TraceBodySkeleton';
import { TraceMetaFieldSkeleton } from './TraceMetaFieldSkeleton';

export interface TraceDetailPanelProps {
  algorithmId: string;
  documentIdA: string;
  documentIdB: string;
  /** Closes the panel. Called on the header's close button and on `Esc`,
   * the same way regardless of whether this renders in the docked/overlay
   * panel or the below-`lg` sheet: this component never decides where it is
   * hosted or what closing navigates to, only that closing happened. */
  onClose: () => void;
}

function isDpAlgorithm(algorithmId: string): boolean {
  return algorithmId === 'levenshtein' || algorithmId === 'needleman-wunsch';
}

/** Whether this capability's own body already carries a focusable
 * descendant of its own (the DP matrix/operations regions, the TF-IDF
 * terms table region — each already its own labelled, `tabIndex={0}`
 * scroll viewport). Jaccard and both embedding bodies have none: their own
 * `dl`/`dt`/`dd` fields carry no control at all, so once this panel's own
 * bounded, scrollable body actually needs to scroll for a real response
 * (Jaccard's own token lists, well past this panel's fixed height), it
 * becomes a scrollable region no keyboard user can reach
 * (`scrollable-region-focusable`) unless it is made focusable itself. */
function hasOwnFocusableRegion(algorithmId: string): boolean {
  return isDpAlgorithm(algorithmId) || algorithmId === 'tfidf-cosine';
}

/**
 * The trace deep link's own detail panel content: header (eyebrow,
 * algorithm display name, mono pair subtitle, close button), a generic meta
 * row (Familia, the raw value, the normalized score, and — DP only — the
 * optimal path cost), the routed per-capability body (`TracePanel`, shared
 * with the standalone full trace view so the two never render two
 * different sets of panels for the same six capabilities), and a pinned
 * footer with "Full screen" and, for the DP capabilities, "Download CSV".
 *
 * Independently fetches the trace, the algorithm catalogue and a
 * single-algorithm compare result for this exact pair — the same trace
 * this component would need whether it opened from a row click (where the
 * pairwise table already holds this row's score) or a bookmarked deep link
 * (where nothing else in the tree has fetched anything yet) — so it never
 * depends on a sibling table having already mounted.
 */
export function TraceDetailPanel({
  algorithmId,
  documentIdA,
  documentIdB,
  onClose,
}: TraceDetailPanelProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const matrixRef = useRef<DpMatrixHandle>(null);
  const isDp = isDpAlgorithm(algorithmId);

  const algorithmsQuery = useQuery(algorithmsQueryOptions);
  const summary = algorithmsQuery.data?.find((algorithm) => algorithm.id === algorithmId);
  const family = summary ? algoFamilyFromKind(summary.kind) : undefined;
  const familyLabel =
    family === undefined
      ? undefined
      : family === 'classic'
        ? t('similarity.family.classic')
        : t('similarity.family.ai');

  const traceQuery = useQuery<SimilarityTraceResponse, ApiError>({
    queryKey: ['similarity', 'trace', algorithmId, documentIdA, documentIdB] as const,
    queryFn: () =>
      fetchSimilarityTrace({
        algorithmId: algorithmId as SimilarityTraceResponse['algorithmId'],
        documentIdA,
        documentIdB,
      }),
  });

  // A single-algorithm compare fetch for exactly this pair, independent of
  // whatever the pairwise table's own selection currently is — the meta
  // row's raw value and score must be correct even reached from a
  // bookmarked deep link the table never rendered.
  const metaQuery = useQuery<CompareResponse, ApiError>({
    queryKey: ['similarity', 'compareSingle', documentIdA, documentIdB, algorithmId] as const,
    queryFn: () =>
      compareSimilarity({
        documentIdA,
        documentIdB,
        algorithmIds: [algorithmId as AlgorithmId],
      }),
  });
  const metaResult = metaQuery.data?.[0]?.result;
  const rawValueText = metaResult ? formatRawValue(metaResult.rawValue) : null;
  const scoreText = metaResult ? formatTraceNumber(metaResult.normalizedScore) : undefined;

  const trace = traceQuery.data;
  // Narrowed by the trace's own discriminant, not the separate `isDp`
  // boolean above — TypeScript then knows `trace.matrix` exists here.
  const optimalPathCost =
    trace && (trace.algorithmId === 'levenshtein' || trace.algorithmId === 'needleman-wunsch')
      ? trace.matrix[trace.matrix.length - 1]?.[trace.matrix[trace.matrix.length - 1].length - 1]
      : undefined;

  // Each field shows a placeholder value bar while its own fetch is still
  // pending, instead of silently omitting the whole field until data
  // arrives (the previous behavior) — never for a field this pair's
  // algorithm can never have (a non-DP trace's optimal path, or a
  // resolved-but-degenerate raw value, which stays hidden exactly as
  // before).
  const showFamilyField = algorithmsQuery.isPending || familyLabel !== undefined;
  const showRawValueField = metaQuery.isPending || rawValueText !== null;
  const showScoreField = metaQuery.isPending || scoreText !== undefined;
  const showOptimalPathField = isDp && (traceQuery.isPending || optimalPathCost !== undefined);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const title = summary?.displayName ?? algorithmId;
  const fullScreenHref = `/similarity/${encodeURIComponent(algorithmId)}/trace/full?documentIdA=${encodeURIComponent(documentIdA)}&documentIdB=${encodeURIComponent(documentIdB)}`;

  return (
    <aside
      data-testid="trace-detail-panel"
      aria-label={`${t('similarity.trace.eyebrow')}: ${title}`}
      className="flex h-full flex-col"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline p-4">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
            {t('similarity.trace.eyebrow')}
          </p>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-title font-semibold text-ink focus-visible:outline-none"
          >
            {title}
          </h2>
          <p className="font-mono text-mono text-ink-muted">
            {t('similarity.trace.subtitle', { a: documentIdA, b: documentIdB })}
          </p>
        </div>
        <Button
          variant="secondary"
          aria-label={t('similarity.trace.panel.closeLabel')}
          onClick={onClose}
        >
          {t('similarity.trace.panel.closeLabel')}
        </Button>
      </header>

      {/* One status for the whole panel below the header — the meta row
       * and the body are both part of the same pending trace, never two
       * separate sentences for what is one loading region. */}
      {(algorithmsQuery.isPending || metaQuery.isPending || traceQuery.isPending) && (
        <p role="status" className="sr-only">
          {t('similarity.trace.loading')}
        </p>
      )}

      <dl className="flex shrink-0 flex-wrap gap-x-8 gap-y-2 border-b border-hairline p-4">
        {showFamilyField &&
          (familyLabel !== undefined ? (
            <div>
              <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
                {t('similarity.table.family')}
              </dt>
              <dd className="text-body font-semibold text-ink">{familyLabel}</dd>
            </div>
          ) : (
            <TraceMetaFieldSkeleton label={t('similarity.table.family')} valueVariant="body" />
          ))}
        {showRawValueField &&
          (rawValueText !== null ? (
            <div>
              <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
                {t('similarity.table.raw')}
              </dt>
              <dd className="font-mono text-mono font-semibold text-ink">{rawValueText}</dd>
            </div>
          ) : (
            <TraceMetaFieldSkeleton label={t('similarity.table.raw')} />
          ))}
        {showScoreField &&
          (scoreText !== undefined ? (
            <div>
              <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
                {t('similarity.table.score')}
              </dt>
              <dd className="font-mono text-mono font-semibold text-ink">{scoreText}</dd>
            </div>
          ) : (
            <TraceMetaFieldSkeleton label={t('similarity.table.score')} />
          ))}
        {showOptimalPathField &&
          (optimalPathCost !== undefined ? (
            <div>
              <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
                {t('similarity.trace.dp.optimalPathLabel')}
              </dt>
              <dd className="font-mono text-mono font-semibold text-ink">
                {formatTraceNumber(optimalPathCost)}
              </dd>
            </div>
          ) : (
            <TraceMetaFieldSkeleton label={t('similarity.trace.dp.optimalPathLabel')} />
          ))}
      </dl>

      {/* While the trace is pending the body holds only the skeleton, which
       * has no focusable element: it is clipped, never a scroll region. */}
      <div
        className={cn(
          'flex-1 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          traceQuery.isPending ? 'overflow-y-hidden' : 'overflow-y-auto',
        )}
        {...(!traceQuery.isPending &&
          !hasOwnFocusableRegion(algorithmId) && {
            role: 'region',
            'aria-label': `${t('similarity.trace.eyebrow')}: ${title}`,
            tabIndex: 0,
          })}
      >
        {traceQuery.isPending && (
          <TraceBodySkeleton algorithmId={algorithmId} hideDownloadButton hideDpMetaRow />
        )}
        {traceQuery.isError && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-body font-semibold text-danger">
              {t('similarity.trace.errorTitle')}
            </p>
            <p className="text-body text-ink-secondary">
              {t(traceQuery.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
            </p>
          </div>
        )}
        {trace && (
          <TracePanel
            trace={trace}
            family={family}
            dpMatrixRef={matrixRef}
            hideDpMetaRow
            hideDpDownloadButton
          />
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap gap-2 border-t border-hairline p-4">
        <Link to={fullScreenHref} className={buttonVariants({ variant: 'secondary' })}>
          {t('similarity.trace.panel.fullScreenLabel')}
        </Link>
        {isDp && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => matrixRef.current?.downloadCsv()}
          >
            {t('similarity.trace.dp.downloadCsv')}
          </Button>
        )}
      </footer>
    </aside>
  );
}
