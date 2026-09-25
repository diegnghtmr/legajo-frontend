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
const MARGIN_SIDE = 24;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 44;
const LEAF_TICK_LENGTH = 6;
const LEAF_ID_LABEL_OFFSET = 18;
const LEAF_CLUSTER_LABEL_OFFSET = 34;
/**
 * Minimum horizontal room per leaf, in px, so a mono leaf label never has to
 * shrink to fit: a narrow container widens the chart past `width` instead
 * (the wrapping scroll region below absorbs the overflow), rather than the
 * old behavior of letting `max-w-full` downscale the whole SVG — labels and
 * all — to whatever the container happened to be.
 */
const MIN_LEAF_SPACING = 32;

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
  const requestedChartWidth = Math.max(width - MARGIN_SIDE * 2, 0);
  const leafCount = leafOrder.length;
  const minChartWidth = leafCount > 1 ? (leafCount - 1) * MIN_LEAF_SPACING : requestedChartWidth;
  const chartWidth = Math.max(requestedChartWidth, minChartWidth);
  const renderWidth = chartWidth + MARGIN_SIDE * 2;
  const chartHeight = Math.max(height - MARGIN_TOP - MARGIN_BOTTOM, 0);

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

  const cutY =
    cut?.distance !== undefined ? MARGIN_TOP + layout.distanceToY(cut.distance) : undefined;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={titleId} className="text-label text-ink-secondary">
        {ariaLabel}
      </figcaption>
      {/*
       * The scroll region — not the SVG itself — absorbs a narrow
       * container: the SVG below always renders at its own intrinsic
       * `renderWidth` (no `max-w-full`), so its 12px mono labels never get
       * scaled down by the browser mapping a smaller viewport onto the
       * `viewBox`'s coordinate space. `overflow-x-auto` lets this one
       * bounded, focusable, labelled region scroll horizontally instead of
       * the page.
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
          height={height}
          viewBox={`0 0 ${renderWidth} ${height}`}
        >
          {cutY !== undefined && (
            <line
              data-testid="dendrogram-cut-line"
              x1={0}
              y1={cutY}
              x2={renderWidth}
              y2={cutY}
              className="stroke-warning"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
          )}
          <g transform={`translate(${MARGIN_SIDE}, ${MARGIN_TOP})`}>
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
                <g key={leaf.id} data-leaf-id={leaf.id} data-leaf-x={leaf.x}>
                  <title>
                    {clusterNumber === undefined
                      ? leafTitle
                      : `${leafTitle} — ${t('clustering.dendrogram.clusterLabel', { id: clusterNumber })}`}
                  </title>
                  <line
                    x1={leaf.x}
                    y1={chartHeight}
                    x2={leaf.x}
                    y2={chartHeight + LEAF_TICK_LENGTH}
                    className="stroke-ink-secondary"
                  />
                  <text
                    x={leaf.x}
                    y={chartHeight + LEAF_ID_LABEL_OFFSET}
                    textAnchor="middle"
                    className="font-mono text-mono fill-ink-secondary"
                  >
                    {leafLabelFor(leafLabels, leaf.id)}
                  </text>
                  {clusterNumber !== undefined && (
                    // A compact number, not the full "Clúster N" word: at the
                    // default leaf spacing (chart width / (n - 1)) a full word
                    // overlaps its neighbours long before a projector-legible
                    // corpus size is reached. The full name stays available via
                    // this leaf's own `<title>` above and the caption legend
                    // below, so this mark is `aria-hidden` to avoid announcing
                    // a bare, out-of-context number.
                    <text
                      data-testid="cluster-marker"
                      aria-hidden="true"
                      x={leaf.x}
                      y={chartHeight + LEAF_CLUSTER_LABEL_OFFSET}
                      textAnchor="middle"
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
