import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../lib/cn';
import { fitDistanceDomain, niceTicks, tickDecimals } from './distanceAxis';
import { computeDendrogramLayout, type DendrogramRow } from './dendrogramLayout';

export interface DendrogramLeafLabel {
  /** Mono id shown on the chart (e.g. the document id). */
  label: string;
  /** The document title: shown in the leaf's tooltip and exposed to assistive tech; falls back to `label`. */
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
   * by document id, not by assuming array position; an `undefined` entry
   * means that leaf's document could not be resolved from the cut result,
   * so no cluster number is shown for it.
   */
  labels: readonly (number | undefined)[];
  /** The cut's own `k`, as the backend answered it; counted from the labels when absent. */
  k?: number;
}

export interface DendrogramPreview {
  /** The `k` being previewed, before it is applied. */
  k: number;
  /** Where the preview line sits (`cutLine.ts`'s rule); presentation only. */
  distance: number;
}

export interface DendrogramProps {
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  /** Visible + accessible chart title, e.g. the linkage's display name. */
  ariaLabel: string;
  /** Indexed by original leaf id (`0..n-1`); a missing entry falls back to the plain numeric id. */
  leafLabels?: readonly DendrogramLeafLabel[];
  cut?: DendrogramCut;
  /** A dotted line showing where a cut for this `k` would fall; drawn even alongside a cut. */
  preview?: DendrogramPreview;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 220;
/** Room above the plot for the cut chip and the preview label. */
const MARGIN_TOP = 28;
/** Room below the plot for the tick labels and the axis title. */
const MARGIN_BOTTOM = 32;
const MARGIN_LEFT = 12;
/** Room on the leaf side for the tick, the mono id label and the cluster chip,
 * all on the leaf's own row. */
const MARGIN_RIGHT = 104;
const LEAF_TICK_LENGTH = 6;
const LEAF_ID_LABEL_OFFSET = 10;
const LEAF_CHIP_OFFSET = 58;
const CHIP_WIDTH = 22;
const CHIP_HEIGHT = 16;
/** One tick roughly every this many px of plot width. */
const TICK_SPACING_PX = 90;
/**
 * Vertical room per leaf: a card whose requested height leaves less than this
 * per leaf grows past it instead of cramming labels together — `(n - 1) x 22 +
 * 60` in all. Leaves run along the vertical axis so growth only ever makes a
 * card taller, never wider than the card itself.
 */
const LEAF_SPACING = 22;
const TOOLTIP_WIDTH_ESTIMATE = 230;
const CLUSTER_HUES = 8;

const BRANCH_STROKE = [
  'stroke-cluster-1',
  'stroke-cluster-2',
  'stroke-cluster-3',
  'stroke-cluster-4',
  'stroke-cluster-5',
  'stroke-cluster-6',
  'stroke-cluster-7',
  'stroke-cluster-8',
] as const;
const CHIP_FILL = [
  'fill-cluster-1',
  'fill-cluster-2',
  'fill-cluster-3',
  'fill-cluster-4',
  'fill-cluster-5',
  'fill-cluster-6',
  'fill-cluster-7',
  'fill-cluster-8',
] as const;

/** The cluster number people read: the backend numbers clusters from 0. */
function clusterNumberOf(label: number): number {
  return label + 1;
}

/** `cluster-{(label mod 8) + 1}`, as a zero-based index. */
function hueIndex(label: number): number {
  return ((label % CLUSTER_HUES) + CLUSTER_HUES) % CLUSTER_HUES;
}

function leafLabelFor(leafLabels: readonly DendrogramLeafLabel[] | undefined, id: number): string {
  return leafLabels?.[id]?.label ?? String(id);
}

/** Count of distinct cluster numbers actually present in a cut's labels (never a computed metric — just how many distinct values the caller handed in). */
function distinctClusterCount(labels: readonly (number | undefined)[]): number {
  return new Set(labels.filter((label): label is number => label !== undefined)).size;
}

type Hover = { kind: 'leaf'; id: number } | { kind: 'merge'; id: number };

/**
 * D3 wrapper: draws only from the backend's own linkage matrix and `leafOrder`
 * (`dendrogramLayout.ts`), never recomputes a merge or a cut. A malformed
 * matrix (see `dendrogramLayout.ts`'s own validation) fails loudly with a
 * visible, translated error instead of drawing something wrong.
 *
 * On top of the branches: a distance axis fitted to the merge range; a dotted
 * preview line for a `k` not yet applied; after a cut, the dashed cut line
 * with its `k = n` chip, cluster-coloured branches (never without the numbered
 * chips beside the leaves) and a caption; hover tooltips on leaves and merges
 * with subtree highlighting; and a staggered draw-in on first render. All
 * motion is off under reduced motion.
 *
 * Accessible text alternative: the `<svg>` carries `role="img"` with an
 * `aria-labelledby` visible title, plus a `sr-only` `<table>` listing every
 * merge step (its two members and distance) in order — an audit trail the
 * tooltips never carry more than.
 */
export function Dendrogram({
  rows,
  leafOrder,
  ariaLabel,
  leafLabels,
  cut,
  preview,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: DendrogramProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [hover, setHover] = useState<Hover | null>(null);
  // The distance (horizontal) axis always renders at exactly the given
  // `width` — the card's own measured, responsive width — and is never
  // grown past it: a continuous distance scale always fits any width.
  const chartWidth = Math.max(width - MARGIN_LEFT - MARGIN_RIGHT, 0);
  const leafCount = leafOrder.length;
  const requestedChartHeight = Math.max(height - MARGIN_TOP - MARGIN_BOTTOM, 0);
  const minChartHeight = leafCount > 1 ? (leafCount - 1) * LEAF_SPACING : requestedChartHeight;
  const chartHeight = Math.max(requestedChartHeight, minChartHeight);
  const renderHeight = chartHeight + MARGIN_TOP + MARGIN_BOTTOM;

  let layout;
  try {
    layout = computeDendrogramLayout({
      rows,
      leafOrder,
      width: chartWidth,
      height: chartHeight,
      domain: fitDistanceDomain(rows.map((row) => row.mergeDistance)),
    });
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

  const [domainStart, domainEnd] = fitDistanceDomain(rows.map((row) => row.mergeDistance));
  const ticks = niceTicks(
    domainStart,
    domainEnd,
    Math.max(2, Math.floor(chartWidth / TICK_SPACING_PX)),
  );
  const tickStep = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  const tickFormat = (value: number) => value.toFixed(tickDecimals(tickStep));

  const cutLabels = cut?.labels;
  const clusterOf = (nodeId: number): number | undefined => {
    if (!cutLabels) {
      return undefined;
    }
    const labels = (layout.leavesOf.get(nodeId) ?? []).map((leaf) => cutLabels[leaf]);
    const first = labels[0];
    return first !== undefined && labels.every((label) => label === first) ? first : undefined;
  };
  const cutK = cut ? (cut.k ?? distinctClusterCount(cut.labels)) : undefined;
  const cutX = cut?.distance !== undefined ? layout.distanceToX(cut.distance) : undefined;
  const previewX = preview ? layout.distanceToX(preview.distance) : undefined;

  const highlighted =
    hover?.kind === 'merge' ? new Set(layout.leavesOf.get(hover.id) ?? []) : undefined;
  const leafById = new Map(layout.leaves.map((leaf) => [leaf.id, leaf] as const));
  const hoveredNode = hover ? layout.nodes.get(hover.id) : undefined;

  const tooltipPosition = hoveredNode && {
    left: Math.max(4, Math.min(MARGIN_LEFT + hoveredNode.x + 12, width - TOOLTIP_WIDTH_ESTIMATE)),
    top: MARGIN_TOP + hoveredNode.y + 10,
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={titleId} className="text-label text-ink-secondary">
        {ariaLabel}
      </figcaption>
      {/*
       * The SVG always renders at its own intrinsic width and height (no
       * `max-w-full`), so its 12px mono labels never get scaled down by the
       * browser mapping a smaller viewport onto the `viewBox`. `relative`:
       * the tooltip is positioned against this scroll region and clipped by
       * it, so it never leaves the chart's box.
       */}
      <div
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerLeave={() => setHover(null)}
        className="relative max-w-full overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg
          role="img"
          aria-labelledby={titleId}
          width={width}
          height={renderHeight}
          viewBox={`0 0 ${width} ${renderHeight}`}
        >
          <g transform={`translate(${MARGIN_LEFT}, ${MARGIN_TOP})`}>
            {ticks.map((tick) => {
              const x = layout.distanceToX(tick);
              return (
                <g key={tick} data-axis-tick transform={`translate(${x}, 0)`}>
                  <line
                    y1={-4}
                    y2={chartHeight + 4}
                    className="stroke-chart-grid"
                    strokeDasharray="2 3"
                  />
                  <text
                    y={chartHeight + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-ink-secondary font-mono text-mono"
                  >
                    {tickFormat(tick)}
                  </text>
                </g>
              );
            })}
            <text
              data-axis-title
              x={0}
              y={chartHeight + MARGIN_BOTTOM - 3}
              className="fill-ink-secondary text-eyebrow font-semibold uppercase tracking-wide"
            >
              {t('clustering.dendrogram.mergeTableDistance')}
            </text>

            {hover?.kind === 'leaf' && leafById.get(hover.id) && (
              <rect
                x={-MARGIN_LEFT}
                y={leafById.get(hover.id)!.y - LEAF_SPACING / 2}
                width={width}
                height={LEAF_SPACING}
                rx={4}
                className="fill-paper-sunken"
              />
            )}

            {layout.links.map((link, index) => {
              const cluster = clusterOf(link.id);
              const coloured = cluster !== undefined;
              const dimmed =
                highlighted !== undefined &&
                !(layout.leavesOf.get(link.id) ?? []).every((leaf) => highlighted.has(leaf));
              return (
                <path
                  key={link.id}
                  data-merge-id={link.id}
                  d={link.path}
                  pathLength={1}
                  fill="none"
                  strokeLinejoin="round"
                  strokeWidth={coloured ? 2 : 1.5}
                  className={cn(
                    'draw-in motion-safe:transition-[stroke,opacity] motion-safe:duration-(--dur-base)',
                    coloured
                      ? BRANCH_STROKE[hueIndex(cluster)]
                      : cutLabels
                        ? 'stroke-ink-muted'
                        : 'stroke-ink',
                  )}
                  style={{ '--i': index, opacity: dimmed ? 0.25 : 1 } as CSSProperties}
                />
              );
            })}

            {layout.links.map((link) => (
              <g
                key={`hit-${link.id}`}
                onPointerEnter={() => setHover({ kind: 'merge', id: link.id })}
              >
                <circle data-merge-hit={link.id} cx={link.x} cy={link.y} r={8} fill="transparent" />
                <circle
                  cx={link.x}
                  cy={link.y}
                  r={hover?.kind === 'merge' && hover.id === link.id ? 3.5 : 0}
                  className="fill-ink motion-safe:transition-[r] motion-safe:duration-(--dur-fast)"
                />
              </g>
            ))}

            {layout.leaves.map((leaf) => {
              const clusterNumber = cutLabels?.[leaf.id];
              const leafTitle = leafLabels?.[leaf.id]?.title ?? leafLabelFor(leafLabels, leaf.id);
              const dimmed = highlighted !== undefined && !highlighted.has(leaf.id);
              return (
                <g
                  key={leaf.id}
                  data-leaf-id={leaf.id}
                  data-leaf-y={leaf.y}
                  onPointerEnter={() => setHover({ kind: 'leaf', id: leaf.id })}
                  className="motion-safe:transition-opacity motion-safe:duration-(--dur-base)"
                  style={{ opacity: dimmed ? 0.35 : 1 }}
                >
                  <title>
                    {clusterNumber === undefined
                      ? leafTitle
                      : `${leafTitle} — ${t('clustering.dendrogram.clusterLabel', { id: clusterNumberOf(clusterNumber) })}`}
                  </title>
                  <rect
                    x={chartWidth}
                    y={leaf.y - LEAF_SPACING / 2}
                    width={MARGIN_RIGHT}
                    height={LEAF_SPACING}
                    fill="transparent"
                  />
                  <line
                    x1={chartWidth}
                    y1={leaf.y}
                    x2={chartWidth + LEAF_TICK_LENGTH}
                    y2={leaf.y}
                    className="stroke-ink-secondary"
                  />
                  <text
                    data-leaf-label
                    x={chartWidth + LEAF_ID_LABEL_OFFSET}
                    y={leaf.y}
                    dominantBaseline="middle"
                    className={cn(
                      'font-mono text-mono',
                      hover?.kind === 'leaf' && hover.id === leaf.id
                        ? 'fill-ink'
                        : 'fill-ink-secondary',
                    )}
                  >
                    {leafLabelFor(leafLabels, leaf.id)}
                  </text>
                  {clusterNumber !== undefined && (
                    // The hue never appears without its number: a numbered
                    // chip after the label, `aria-hidden` because the full
                    // name is on the leaf's own `<title>` and the caption.
                    <g className="enter-fade">
                      <rect
                        x={chartWidth + LEAF_CHIP_OFFSET}
                        y={leaf.y - CHIP_HEIGHT / 2}
                        width={CHIP_WIDTH}
                        height={CHIP_HEIGHT}
                        rx={4}
                        className={CHIP_FILL[hueIndex(clusterNumber)]}
                      />
                      <text
                        data-testid="cluster-marker"
                        aria-hidden="true"
                        x={chartWidth + LEAF_CHIP_OFFSET + CHIP_WIDTH / 2}
                        y={leaf.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-paper-raised text-[10px] font-medium"
                      >
                        {clusterNumberOf(clusterNumber)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {previewX !== undefined && preview && (
              <g className="pointer-events-none">
                <line
                  data-testid="dendrogram-preview-line"
                  x1={previewX}
                  y1={-2}
                  x2={previewX}
                  y2={chartHeight + 2}
                  strokeWidth={1}
                  strokeDasharray="1 3"
                  className="stroke-ink-muted"
                />
                <text
                  data-testid="dendrogram-preview-label"
                  x={previewX}
                  y={-6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-ink-muted text-[10px]"
                >
                  {`k = ${preview.k}`}
                </text>
              </g>
            )}

            {cutX !== undefined && (
              <g className="pointer-events-none">
                <line
                  data-testid="dendrogram-cut-line"
                  x1={cutX}
                  y1={-12}
                  x2={cutX}
                  y2={chartHeight + 2}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  className="stroke-warning"
                />
                <g data-testid="dendrogram-cut-chip">
                  <rect
                    x={cutX - 22}
                    y={-MARGIN_TOP}
                    width={44}
                    height={CHIP_HEIGHT}
                    rx={4}
                    strokeWidth={1}
                    className="fill-warning-soft stroke-warning"
                  />
                  <text
                    x={cutX}
                    y={-MARGIN_TOP + CHIP_HEIGHT / 2 + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-ink text-[10px] font-medium"
                  >
                    {`k = ${cutK}`}
                  </text>
                </g>
              </g>
            )}
          </g>
        </svg>

        {hover && hoveredNode && tooltipPosition && (
          <div
            role="tooltip"
            style={tooltipPosition}
            className="pointer-events-none absolute z-10 max-w-[280px] min-w-[140px] rounded-md bg-ink px-2.5 py-2 text-label leading-[1.45] text-primary-foreground shadow-pop"
          >
            {hover.kind === 'leaf' ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono">{leafLabelFor(leafLabels, hover.id)}</span>
                  {cutLabels?.[hover.id] !== undefined && (
                    <span>
                      {t('clustering.dendrogram.clusterLabel', {
                        id: clusterNumberOf(cutLabels[hover.id]!),
                      })}
                    </span>
                  )}
                </div>
                {leafLabels?.[hover.id]?.title && (
                  <div className="mt-1">{leafLabels[hover.id]!.title}</div>
                )}
              </>
            ) : (
              <MergeTooltip
                step={hover.id - n + 1}
                total={n - 1}
                distance={rows[hover.id - n]!.mergeDistance}
                size={(layout.leavesOf.get(hover.id) ?? []).length}
              />
            )}
          </div>
        )}
      </div>

      {cut && cutK !== undefined && cutK > 0 && (
        <p className="text-label text-ink-secondary">
          {t('clustering.dendrogram.clusterLegend', { k: cutK })}
        </p>
      )}

      {/*
       * `sr-only` on the wrapping `<div>`, never on the `<table>` element
       * itself: a table generates two boxes, an anonymous "table wrapper
       * box" that takes `position`/`margin`, and the "table box" proper
       * that takes `width`/`height`/`overflow` — so `sr-only`'s own
       * `overflow: hidden` and 1px box would only ever clip the grid of
       * rows/cells, never this table's own `<caption>`, which is laid out
       * as a sibling of the table box *inside* that unclipped wrapper box.
       * A plain `<div>` has no such wrapper/table split, so `sr-only` clips
       * its whole subtree — caption included — to a single 1x1px box.
       */}
      <div className="sr-only">
        <table>
          <caption>{t('clustering.dendrogram.mergeTableCaption', { label: ariaLabel })}</caption>
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
      </div>
    </figure>
  );
}

function MergeTooltip({
  step,
  total,
  distance,
  size,
}: {
  step: number;
  total: number;
  distance: number;
  size: number;
}) {
  const { t } = useTranslation();
  const line = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-primary-foreground/70">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );

  return (
    <>
      {line(t('clustering.dendrogram.mergeTableStep'), `${step} / ${total}`)}
      {line(t('clustering.dendrogram.mergeTableDistance'), distance.toFixed(4))}
      {line(t('clustering.dendrogram.tooltipSize'), String(size))}
    </>
  );
}
