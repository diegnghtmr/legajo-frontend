import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '../../../shared/components/ui/skeleton';
import { cn } from '../../../shared/lib/cn';
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
import { JACCARD_GROUP_HEADING_CLASS, JACCARD_TOKEN_CLASS } from './JaccardTracePanel';
import { TF_IDF_FORMULA } from './TfIdfTracePanel';
import { TraceFieldSkeleton } from './TraceFieldSkeleton';
import { TraceMetaFieldSkeleton } from './TraceMetaFieldSkeleton';

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
  /** Set by the docked/overlay trace panel, whose own header already
   * renders the generic Familia/raw-value/score/optimal-path meta row —
   * mirrors `DpTracePanel`'s own `hideOwnMetaRow`, so the two never
   * disagree about whether this row's box is reserved here or there. The
   * standalone full trace view leaves this unset, reserving the same
   * `Familia`/`Camino óptimo` row `DpTracePanel` renders for real once the
   * trace and the algorithm catalogue have both resolved. */
  hideDpMetaRow?: boolean;
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
  hideMetaRow = false,
}: {
  algorithmId: DpAlgorithmId;
  hideDownloadButton: boolean;
  hideMetaRow: boolean;
}) {
  const { t } = useTranslation();
  const legendHeadingId = useId();
  const legend = DP_OPERATION_LEGEND[algorithmId];

  return (
    <div className="flex flex-col gap-4">
      {!hideMetaRow && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <TraceMetaFieldSkeleton
            label={t('similarity.trace.dp.familyLabel')}
            valueVariant="body"
          />
          <TraceMetaFieldSkeleton label={t('similarity.trace.dp.optimalPathLabel')} />
        </dl>
      )}

      <div className="flex flex-col gap-2">
        <div className="max-h-[420px] max-w-full overflow-hidden rounded-md border border-hairline">
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
        <div className="max-h-64 overflow-hidden rounded-md border border-hairline">
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

/** Eight comma-joined placeholder numbers at this field's own typical
 * length (a signed 6-decimal value, e.g. `-0.021680`, the longest shape
 * `formatTraceNumber` produces for a raw embedding component) — sized so
 * the invisible sizer below wraps exactly the way a real excerpt of eight
 * such numbers would, at whatever width this render actually has, rather
 * than guessing a fixed line count that only holds at one viewport. */
const TYPICAL_VECTOR_EXCERPT = Array.from({ length: 8 }, () => '-0.000000').join(', ');

/** The real `embedding-api` model id, captured against the reference
 * corpus — this app talks to one configured provider model, so this
 * length is not really "typical", it is the actual value; used only to
 * size the invisible sizer below, never asserted as the real response. */
const TYPICAL_EMBEDDING_API_MODEL = 'gemini-embedding-2-preview';

/**
 * Mirrors `EmbeddingLocalTracePanel`/`EmbeddingApiTracePanel`: every field
 * this shape ever has is fixed (never a variable-length list), so every
 * label renders as real text immediately, over a placeholder value. The
 * two vector excerpts and (for `embedding-api`) the model id size their
 * own placeholder from a representative real value instead of a fixed
 * line count: whether either actually wraps onto a second line depends on
 * the viewport's own current width, which a fixed count can only ever
 * match at one width and overshoot or undershoot at every other.
 */
function EmbeddingTraceBodySkeleton({ algorithmId }: { algorithmId: EmbeddingAlgorithmId }) {
  const { t } = useTranslation();
  const ns = algorithmId === 'embedding-local' ? 'embeddingLocal' : 'embeddingApi';

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.providerLabel`)} />
      <TraceFieldSkeleton
        label={t(`similarity.trace.${ns}.modelLabel`)}
        typicalValue={algorithmId === 'embedding-api' ? TYPICAL_EMBEDDING_API_MODEL : undefined}
      />
      <TraceFieldSkeleton label={t(`similarity.trace.${ns}.dimensionLabel`)} />
      <TraceFieldSkeleton
        className="sm:col-span-2"
        label={t(`similarity.trace.${ns}.vectorAExcerptLabel`)}
        typicalValue={TYPICAL_VECTOR_EXCERPT}
      />
      <TraceFieldSkeleton
        className="sm:col-span-2"
        label={t(`similarity.trace.${ns}.vectorBExcerptLabel`)}
        typicalValue={TYPICAL_VECTOR_EXCERPT}
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

/**
 * How many tokens the real corpus's own document pairs typically produce for
 * each Jaccard group — derived from the corpus-wide medians over every one of
 * the reference corpus's 190 possible pairs: `setA` 100 (range 64–142),
 * `setB` 105 (64–142), `intersection` 16 (5–31) and `union` 180 (118–248).
 * The groups are those sets minus the intersection and the intersection
 * itself; because medians of different fields do not add up (84 + 16 + 89 is
 * 189), the two "only" groups are scaled to sum with the intersection to the
 * union's own median: 80 only in A, 16 in both, 84 only in B. Deliberately NOT measured from one single pair: d01/d02 is the
 * SMALLEST of all 190 pairs, so sizing from it undershoots almost every real
 * response. The exact response still differs by pair, but reserving this
 * typical, corpus-wide shape — rather than one fixed-width bar — is what keeps
 * the full-screen trace view from shifting by hundreds of pixels once the
 * token chips (which wrap over many lines) actually arrive.
 */
const JACCARD_TYPICAL_TOKEN_COUNTS = {
  onlyA: 80,
  both: 16,
  onlyB: 84,
} as const;

/**
 * A representative English-token length distribution (the reference corpus's
 * own tokens average 7–8 characters, sampled across several pairs), not one
 * uniform length: same-length filler packs measurably more chips per wrapped
 * line than a real list of varied-length words does, which under-reserves the
 * placeholder's own real height. Cycling through a small spread of lengths
 * reproduces that same per-line waste without shipping real corpus words.
 */
const JACCARD_TYPICAL_TOKEN_LENGTHS = [5, 7, 9, 6, 11, 8, 4, 10, 7, 12, 6, 8];

/** Mirrors a real token group's box. A real group's wrapped height depends on
 * the response, so an invisible run of chips of the typical count and length
 * (the exact chip classes the real tokens use) sizes this placeholder at
 * whatever height that many chips wrap to at the current width, under a
 * `Skeleton` overlay — the same "invisible sizer" technique the clustering
 * metrics header skeleton uses for its own response-dependent width. */
function TokenGroupSkeleton({ label, tokenCount }: { label: string; tokenCount: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={JACCARD_GROUP_HEADING_CLASS}>
        {label}
        <Skeleton className="h-3 w-6" />
      </h3>
      <div className="relative">
        <div data-token-sizer aria-hidden="true" className="invisible flex flex-wrap gap-1">
          {Array.from({ length: tokenCount }, (_unused, index) => (
            <span key={index} className={cn(JACCARD_TOKEN_CLASS, 'border-hairline')}>
              {'x'.repeat(
                JACCARD_TYPICAL_TOKEN_LENGTHS[index % JACCARD_TYPICAL_TOKEN_LENGTHS.length],
              )}
            </span>
          ))}
        </div>
        <Skeleton className="absolute inset-0" />
      </div>
    </div>
  );
}

/** Mirrors `JaccardTracePanel`'s own fixed text (the set-size names and the
 * three group headings) as real text; the formula, the counts and the token
 * groups — all response-dependent — stay placeholder boxes. */
function JaccardTraceBodySkeleton() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-2">
          <dt className="font-mono text-label text-ink-secondary">
            {t('similarity.trace.jaccard.sizeALabel')}
          </dt>
          <dd>
            <Skeleton className="h-3 w-8" />
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-mono text-label text-ink-secondary">
            {t('similarity.trace.jaccard.sizeBLabel')}
          </dt>
          <dd>
            <Skeleton className="h-3 w-8" />
          </dd>
        </div>
      </dl>
      <TokenGroupSkeleton
        label={t('similarity.trace.jaccard.onlyALabel')}
        tokenCount={JACCARD_TYPICAL_TOKEN_COUNTS.onlyA}
      />
      <TokenGroupSkeleton
        label={t('similarity.trace.jaccard.bothLabel')}
        tokenCount={JACCARD_TYPICAL_TOKEN_COUNTS.both}
      />
      <TokenGroupSkeleton
        label={t('similarity.trace.jaccard.onlyBLabel')}
        tokenCount={JACCARD_TYPICAL_TOKEN_COUNTS.onlyB}
      />
    </div>
  );
}

/**
 * The terms table carries no bounded viewport of its own (unlike the DP
 * matrix/operations regions): on the docked panel that is absorbed by the
 * panel's own scrollable body, but on the full-screen view every row
 * this table ends up with pushes the whole page taller. The term count is
 * always the union of the two documents' own vocabularies, whose corpus-wide
 * median over all 190 pairs is 180 (range 118–248, quartiles 169/197).
 */
const TFIDF_TYPICAL_TERM_ROW_COUNT = 180;

/** Mirrors `TfIdfTracePanel`'s own fixed corpus-size field and the terms
 * table's real header row (every column label is fixed chrome); the term
 * rows themselves depend on the union of the two documents' own tokens, so
 * they stay placeholder bars inside the table's own scrollable region,
 * sized to this corpus's own typical term count
 * (`TFIDF_TYPICAL_TERM_ROW_COUNT`). */
function TfIdfTraceBodySkeleton() {
  const { t } = useTranslation();
  const termsHeadingId = useId();

  return (
    <div className="flex flex-col gap-4">
      {/* A `<div>`, not a `<p>`: see the identical fix on the Jaccard
       * skeleton's own size-label lines above. */}
      <div className="flex items-baseline gap-2 text-label text-ink-secondary">
        <span>{t('similarity.trace.tfidf.corpusSizeLabel')}</span>
        <Skeleton className="h-3 w-10" />
      </div>
      <div>
        <h3
          id={termsHeadingId}
          className="mb-1 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.tfidf.termsHeading')}
        </h3>
        <div className="max-w-full overflow-hidden rounded-md border border-hairline">
          <Table wrap={false}>
            <TableHeader>
              <TableRow>
                {/* Every real column (`TfIdfTracePanel`'s own eleven
                 * `TableHead`s) — the previous four-column shell left the
                 * table's own natural width one third of its real one,
                 * changing how much the "Término" column itself wraps at a
                 * narrow viewport once every other column also claims
                 * space. */}
                <TableHead className="p-2">{t('similarity.trace.tfidf.termLabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.frequencyALabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.frequencyBLabel')}</TableHead>
                <TableHead className="p-2">
                  {t('similarity.trace.tfidf.documentFrequencyLabel')}
                </TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.tfALabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.tfBLabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.idfLabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.rawWeightALabel')}</TableHead>
                <TableHead className="p-2">{t('similarity.trace.tfidf.rawWeightBLabel')}</TableHead>
                <TableHead className="p-2">
                  {t('similarity.trace.tfidf.normalizedWeightALabel')}
                </TableHead>
                <TableHead className="p-2">
                  {t('similarity.trace.tfidf.normalizedWeightBLabel')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: TFIDF_TYPICAL_TERM_ROW_COUNT }, (_unused, index) => (
                <TableRow key={index}>
                  <TableCell className="p-2">
                    <Skeleton className="h-[18px] w-16" />
                  </TableCell>
                  {Array.from({ length: 10 }, (_unused2, column) => (
                    <TableCell key={column} className="p-2">
                      <Skeleton className="h-[18px] w-8" />
                    </TableCell>
                  ))}
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

      {/* Needs no fetched data at all (the same reasoning `DpTraceBodySkeleton`
       * already applies to its own formula caption) — omitted here
       * entirely until now, which the docked panel's own bounded,
       * scrollable body absorbed silently but the full-screen view could
       * not. */}
      <FormulaCaption tex={TF_IDF_FORMULA} caption={t('similarity.trace.tfidf.formula')} />
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
  hideDpMetaRow = false,
}: TraceBodySkeletonProps) {
  return (
    <div data-testid="trace-body-skeleton">
      {isDpAlgorithmId(algorithmId) ? (
        <DpTraceBodySkeleton
          algorithmId={algorithmId}
          hideDownloadButton={hideDownloadButton}
          hideMetaRow={hideDpMetaRow}
        />
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
