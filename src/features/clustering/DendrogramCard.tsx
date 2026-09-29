import { useTranslation } from 'react-i18next';

import { useElementWidth } from '../../shared/hooks/useElementWidth';
import {
  Dendrogram,
  type DendrogramCut,
  type DendrogramLeafLabel,
} from '../../shared/components/Dendrogram';
import type { DendrogramRow } from '../../shared/components/dendrogramLayout';
import { Panel } from '../../shared/components/Panel';
import { Badge } from '../../shared/components/ui/badge';
import { Skeleton } from '../../shared/components/ui/skeleton';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { tryComputeCutDistance } from './cutLine';
import { dendrogramCardHeight } from './dendrogramGridSizing';
import { formatMetricValue } from './formatMetricValue';
import { LeaderBadge } from './LeaderBadge';

export interface DendrogramCardProps {
  linkageId: LinkageId;
  linkageDisplayName: string;
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  leafLabels?: readonly DendrogramLeafLabel[];
  /** The backend's cophenetic correlation for this linkage: the card subtitle. */
  cophenetic?: number;
  /** Which leader marks this linkage carries (the caller applies the ranking rule). */
  leaders?: { tree: boolean; partition: boolean };
  cut?: DendrogramCut;
  /** The `k` to preview on this card before it is applied (only the card of the linkage to cut gets one). */
  previewK?: number;
}

/**
 * One dendrogram grid card: a `Panel` headed by the linkage's display name,
 * with the `Dendrogram` sized to fill the card's own measured width
 * (`useElementWidth`, never a fixed pixel width) and to a height that
 * follows the leaf count (`dendrogramGridSizing.ts`). Drawing itself — the
 * merges, the cut line, the cluster labels — stays entirely `Dendrogram`'s
 * own responsibility; this only measures and sizes.
 */
export interface DendrogramCardSkeletonProps {
  linkageId: LinkageId;
  /** `dendrogramCardHeight(leafCount)` — the caller resolves `leafCount`
   * (the corpus size once known, or a sensible default before it is) so
   * this component stays a pure sizing mirror of the real card, never a
   * second place that guesses a leaf count of its own. */
  height: number;
}

/** Mirrors one `DendrogramCard`'s own chrome — the `Panel`, its title area
 * and its figure's own caption line — at the real card's own height, so
 * the grid causes no shift once the real dendrograms replace these
 * placeholders. The linkage id (already known from the selection) stands
 * in for the title area instead of a guessed display name. */
export function DendrogramCardSkeleton({ linkageId, height }: DendrogramCardSkeletonProps) {
  return (
    <div data-testid={`linkage-dendrogram-skeleton-${linkageId}`}>
      <Panel>
        <div className="mb-3 flex flex-col gap-1">
          {/* `h-[30px]`: a real `h2` title's own single-line box at this
           * font stack's own metrics (`text-title font-semibold`) —
           * measurably taller than the font's nominal size, the same
           * reasoning every other real-text-line placeholder in this
           * feature already follows. */}
          <Skeleton className="h-[30px] w-32" />
          {/* The subtitle ("Cofenética 0.951"): an invisible sizer of a
           * typical one reserves its real line, a block stands in for it. */}
          <div className="relative">
            <p aria-hidden="true" className="invisible text-body">
              Cofenética 0.000
            </p>
            <Skeleton className="absolute inset-y-0.5 left-0 w-28" />
          </div>
        </div>
        {/* `mt-3`: the real card's own chart wrapper (`DendrogramCard`'s
         * `<div ref className="mt-3">`) carries this same margin below
         * its header. */}
        <div className="mt-3 flex flex-col gap-2">
          {/* The real figure's own `figcaption` (`Dendrogram`'s own
           * `ariaLabel`, built from the response's own `linkageDisplayName`)
           * — its exact text is not yet known, but a single `text-label`
           * line's own real height already is. */}
          <Skeleton className="h-[18px] w-40" />
          <Skeleton
            data-testid="dendrogram-skeleton-chart"
            className="w-full rounded-md"
            style={{ height }}
          />
        </div>
      </Panel>
    </div>
  );
}

export function DendrogramCard({
  linkageId,
  linkageDisplayName,
  rows,
  leafOrder,
  leafLabels,
  cophenetic,
  leaders,
  cut,
  previewK,
}: DendrogramCardProps) {
  const { t } = useTranslation();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const height = dendrogramCardHeight(leafOrder.length);
  const previewDistance =
    previewK === undefined ? undefined : tryComputeCutDistance(rows, previewK);
  const hasActions = leaders?.tree || leaders?.partition || cut !== undefined;

  return (
    <div data-testid={`linkage-dendrogram-${linkageId}`}>
      <Panel>
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-title font-semibold text-ink">{linkageDisplayName}</h2>
            {cophenetic !== undefined && (
              <p className="text-body text-ink-muted">
                {t('clustering.dendrogram.cophenetic', { value: formatMetricValue(cophenetic) })}
              </p>
            )}
          </div>
          {hasActions && (
            <div className="flex flex-wrap items-center gap-1.5">
              {leaders?.tree && <LeaderBadge kind="tree" />}
              {leaders?.partition && <LeaderBadge kind="partition" />}
              {cut?.k !== undefined && <Badge variant="marker">{`k = ${cut.k}`}</Badge>}
            </div>
          )}
        </header>
        <div ref={containerRef} className="mt-3" style={{ minHeight: height }}>
          {width !== null && (
            <Dendrogram
              rows={rows}
              leafOrder={leafOrder}
              leafLabels={leafLabels}
              cut={cut}
              preview={
                previewK !== undefined && previewDistance !== undefined
                  ? { k: previewK, distance: previewDistance }
                  : undefined
              }
              width={width}
              height={height}
              ariaLabel={t('clustering.dendrogram.ariaLabel', { linkage: linkageDisplayName })}
            />
          )}
        </div>
      </Panel>
    </div>
  );
}
