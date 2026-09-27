import { useTranslation } from 'react-i18next';

import { useElementWidth } from '../../shared/hooks/useElementWidth';
import {
  Dendrogram,
  type DendrogramCut,
  type DendrogramLeafLabel,
} from '../../shared/components/Dendrogram';
import type { DendrogramRow } from '../../shared/components/dendrogramLayout';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { dendrogramCardHeight } from './dendrogramGridSizing';

export interface DendrogramCardProps {
  linkageId: LinkageId;
  linkageDisplayName: string;
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  leafLabels?: readonly DendrogramLeafLabel[];
  cut?: DendrogramCut;
}

/** Same as `Dendrogram`'s own `DEFAULT_WIDTH`: what a card renders at before
 * its `ResizeObserver` ever reports a real measurement. */
const INITIAL_WIDTH = 640;

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
        </div>
        {/* `mt-3`: the real card's own chart wrapper (`DendrogramCard`'s
         * `<div ref className="mt-3">`) carries this same margin below
         * `PanelHeader` — left out here, the chart sat 12px closer to the
         * title than the real one does. */}
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
  cut,
}: DendrogramCardProps) {
  const { t } = useTranslation();
  const [containerRef, width] = useElementWidth<HTMLDivElement>(INITIAL_WIDTH);
  const height = dendrogramCardHeight(leafOrder.length);

  return (
    <div data-testid={`linkage-dendrogram-${linkageId}`}>
      <Panel>
        <PanelHeader title={linkageDisplayName} />
        <div ref={containerRef} className="mt-3">
          <Dendrogram
            rows={rows}
            leafOrder={leafOrder}
            leafLabels={leafLabels}
            cut={cut}
            width={width}
            height={height}
            ariaLabel={t('clustering.dendrogram.ariaLabel', { linkage: linkageDisplayName })}
          />
        </div>
      </Panel>
    </div>
  );
}
