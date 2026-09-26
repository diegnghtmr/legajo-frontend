import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { computeDendrogramLayout, type DendrogramRow } from './dendrogramLayout';

export interface DendrogramLeafLabel {
  /** Mono id shown on the chart (e.g. the document id). */
  label: string;
  /** Full text exposed to assistive tech only; falls back to `label`. */
  title?: string;
}

export interface DendrogramCut {
  /**
   * Merge distance where the dashed cut line is drawn (`cutLine.ts`'s own
   * rule; never computed here). `undefined` when the caller could not
   * resolve a distance for the currently loaded rows (e.g. a stale/
   * malformed response) — the labels below still render, only the line
   * itself is skipped.
   */
  distance?: number;
  /**
   * Cluster number per original leaf id (`0..n-1`), from the backend's own
   * `POST /clustering/cut` — never computed here. Callers resolve this array
   * by document id against the cut response's own `documentIds`
   * (`cutLabels.ts`), not by assuming array position; an `undefined` entry
   * means that leaf's document could not be resolved from the cut result,
   * so no cluster number is shown for it.
   */
  labels: readonly (number | undefined)[];
}

export interface DendrogramProps {
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  /** Visible + accessible chart title, e.g. the linkage's display name. */
  ariaLabel: string;
  /** Indexed by original leaf id (`0..n-1`); a missing entry falls back to the plain numeric id. */
  leafLabels?: readonly DendrogramLeafLabel[];
  cut?: DendrogramCut;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 220;
/** Small, label-free padding around the leaf (vertical) axis. */
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 12;
/** Small, label-free padding on the root side of the distance (horizontal) axis. */
const MARGIN_LEFT = 16;
/** Room on the leaf side of the distance axis for the tick, the mono id
 * label and the cluster number, all on the leaf's own row (never stacked
 * under it — see `MIN_LEAF_SPACING`'s own doc comment for why). */
const MARGIN_RIGHT = 90;
const LEAF_TICK_LENGTH = 6;
const LEAF_ID_LABEL_OFFSET = 10;
const LEAF_CLUSTER_LABEL_OFFSET = 64;
/**
 * Minimum vertical room per leaf, in px, so a mono leaf label never has to
 * shrink to fit: a corpus with too many leaves for the requested height
 * grows the chart past `height` instead, rather than cramming leaf rows
 * together. Leaves run along the vertical axis precisely so this growth
 * only ever makes a card taller — never wider than the card itself, which
 * is what used to force a horizontal scroll on a large corpus.
 */
const MIN_LEAF_SPACING = 24;

function leafLabelFor(leafLabels: readonly DendrogramLeafLabel[] | undefined, id: number): string {
  return leafLabels?.[id]?.label ?? String(id);
}

/** Count of distinct cluster numbers actually present in a cut's labels (never a computed metric — just how many distinct values the caller handed in). */
function distinctClusterCount(labels: readonly (number | undefined)[]): number {
  return new Set(labels.filter((label): label is number => label !== undefined)).size;
}

/**
 * D3 wrapper: draws only from the
 * backend's own linkage matrix and `leafOrder` (`dendrogramLayout.ts`),
 * never recomputes a merge or a cut. A malformed matrix (see
 * `dendrogramLayout.ts`'s own validation) fails loudly with a visible,
 * translated error instead of drawing something wrong.
 *
 * Accessible text alternative: the `<svg>` carries `role="img"` with an
 * `aria-labelledby` visible title, plus a `sr-only` `<table>` listing every
 * merge step (its two members and distance) in order. A structured table
 * was chosen over a single long `aria-label`/`<desc>` string because it
 * gives screen-reader users the same row-by-row navigation this codebase
 * already relies on for other visual/tabular pairings (`DpMatrix`'s
 * scrollable table, the DP operations sequence, the embedding vector
 * excerpts) — an audit trail, not a condensed summary a reader cannot
 * inspect merge by merge.
 */
export function Dendrogram({
  rows,
  leafOrder,
  ariaLabel,
  leafLabels,
  cut,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: DendrogramProps) {
  const { t } = useTranslation();
  const titleId = useId();
  // The distance (horizontal) axis always renders at exactly the given
  // `width` — the card's own measured, responsive width — and is never
  // grown past it: a continuous distance scale always fits any width, so
  // there is no per-unit minimum the way the leaf axis has.
  const chartWidth = Math.max(width - MARGIN_LEFT - MARGIN_RIGHT, 0);
  const renderWidth = width;
  const leafCount = leafOrder.length;
  const requestedChartHeight = Math.max(height - MARGIN_TOP - MARGIN_BOTTOM, 0);
  const minChartHeight = leafCount > 1 ? (leafCount - 1) * MIN_LEAF_SPACING : requestedChartHeight;
  const chartHeight = Math.max(requestedChartHeight, minChartHeight);
  const renderHeight = chartHeight + MARGIN_TOP + MARGIN_BOTTOM;

  let layout;
  try {
    layout = computeDendrogramLayout({ rows, leafOrder, width: chartWidth, height: chartHeight });
  } catch {
    return (
      <p role="alert" className="text-body text-danger">
        {t('clustering.dendrogram.malformed')}
      </p>
    );
  }

  const n = leafOrder.length;
  const memberLabel = (id: number): string =>
    id < n ? leafLabelFor(leafLabels, id) : t('clustering.dendrogram.clusterLabel', { id });

  const cutX =
    cut?.distance !== undefined ? MARGIN_LEFT + layout.distanceToX(cut.distance) : undefined;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={titleId} className="text-label text-ink-secondary">
        {ariaLabel}
      </figcaption>
      {/*
       * The SVG always renders at its own intrinsic `renderWidth`/
       * `renderHeight` (no `max-w-full`), so its 12px mono labels never get
       * scaled down by the browser mapping a smaller viewport onto the
       * `viewBox`'s coordinate space. `renderWidth` always equals the given
       * `width` (the card's own responsive width, never grown past it);
       * only `renderHeight` can exceed the given `height`, when the leaf
       * count needs more room than that — a card growing taller reflows
       * the page normally, in the leaf (vertical) axis, so this region's
       * own `overflow-x-auto` below is now a defensive no-op rather than a
       * load-bearing scroll path (kept for a pathological caller-supplied
       * `width` narrower than `MARGIN_LEFT + MARGIN_RIGHT`).
       */}
      <div
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg
          role="img"
          aria-labelledby={titleId}
          width={renderWidth}
          height={renderHeight}
          viewBox={`0 0 ${renderWidth} ${renderHeight}`}
        >
          {cutX !== undefined && (
            <line
              data-testid="dendrogram-cut-line"
              x1={cutX}
              y1={0}
              x2={cutX}
              y2={renderHeight}
              className="stroke-warning"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
          )}
          <g transform={`translate(${MARGIN_LEFT}, ${MARGIN_TOP})`}>
            {layout.links.map((link) => (
              <path
                key={link.id}
                d={link.path}
                className="fill-none stroke-ink"
                strokeWidth={1.5}
              />
            ))}
            {layout.leaves.map((leaf) => {
              const clusterNumber = cut?.labels[leaf.id];
              const leafTitle = leafLabels?.[leaf.id]?.title ?? leafLabelFor(leafLabels, leaf.id);
              return (
                <g key={leaf.id} data-leaf-id={leaf.id} data-leaf-y={leaf.y}>
                  <title>
                    {clusterNumber === undefined
                      ? leafTitle
                      : `${leafTitle} — ${t('clustering.dendrogram.clusterLabel', { id: clusterNumber })}`}
                  </title>
                  <line
                    x1={chartWidth}
                    y1={leaf.y}
                    x2={chartWidth + LEAF_TICK_LENGTH}
                    y2={leaf.y}
                    className="stroke-ink-secondary"
                  />
                  <text
                    x={chartWidth + LEAF_ID_LABEL_OFFSET}
                    y={leaf.y}
                    dominantBaseline="middle"
                    className="font-mono text-mono fill-ink-secondary"
                  >
                    {leafLabelFor(leafLabels, leaf.id)}
                  </text>
                  {clusterNumber !== undefined && (
                    // A compact number, not the full "Clúster N" word: on
                    // the leaf's own row, right of its id label, a full
                    // word would overlap the next leaf's row long before a
                    // projector-legible corpus size is reached. The full
                    // name stays available via this leaf's own `<title>`
                    // above and the caption legend below, so this mark is
                    // `aria-hidden` to avoid announcing a bare,
                    // out-of-context number.
                    <text
                      data-testid="cluster-marker"
                      aria-hidden="true"
                      x={chartWidth + LEAF_CLUSTER_LABEL_OFFSET}
                      y={leaf.y}
                      dominantBaseline="middle"
                      className="text-mono fill-ink"
                    >
                      {clusterNumber}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {cut && distinctClusterCount(cut.labels) > 0 && (
        <p className="text-label text-ink-secondary">
          {t('clustering.dendrogram.clusterLegend', { k: distinctClusterCount(cut.labels) })}
        </p>
      )}

      {/*
       * `table-fixed` alone is not enough: an auto-layout table ignores an
       * explicit CSS width when its content's min-content width is wider,
       * so `table-layout: fixed` is required to stop the browser from
       * growing the table to fit its content. But `sr-only` itself sets
       * `white-space: nowrap`, and a fixed-layout table still sizes each
       * column to its widest *unbreakable* run of text (verified against a
       * live render) — with `nowrap`, every cell's full text counts as one
       * such run, defeating `table-fixed` on its own. `whitespace-normal`
       * lets that text wrap instead, so the table collapses to its
       * narrowest single word rather than its widest full cell, keeping the
       * merge table off the page's own scrollable width while it stays
       * fully readable to assistive tech regardless of its rendered size.
       */}
      <table className="sr-only table-fixed whitespace-normal">
        <caption>{t('clustering.dendrogram.mergeTableCaption', { linkage: ariaLabel })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('clustering.dendrogram.mergeTableStep')}</th>
            <th scope="col">{t('clustering.dendrogram.mergeTableLeft')}</th>
            <th scope="col">{t('clustering.dendrogram.mergeTableRight')}</th>
            <th scope="col">{t('clustering.dendrogram.mergeTableDistance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{memberLabel(row.idx1)}</td>
              <td>{memberLabel(row.idx2)}</td>
              <td>{row.mergeDistance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
