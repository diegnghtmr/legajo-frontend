import type { MarkerShape } from './seriesStyle';

export const MARKER_RADIUS = 4;

export interface SeriesMarkerProps {
  shape: MarkerShape;
  cx: number;
  cy: number;
  /** Half the marker's extent, in px. */
  radius?: number;
  fill: string;
  stroke?: string;
  opacity?: number;
  /** Tags the element with its shape so a test can count the plotted marks. */
  tagged?: boolean;
}

/** One marker shape, centered on (`cx`, `cy`): the series' second, colour-independent channel. */
export function SeriesMarker({
  shape,
  cx,
  cy,
  radius = MARKER_RADIUS,
  fill,
  stroke,
  opacity,
  tagged = true,
}: SeriesMarkerProps) {
  const common = {
    fill,
    stroke,
    opacity,
    ...(tagged ? { 'data-shape': shape } : {}),
  };

  switch (shape) {
    case 'circle':
      return <circle {...common} cx={cx} cy={cy} r={radius} />;
    case 'square':
      return (
        <rect {...common} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} />
      );
    case 'diamond':
      return (
        <rect
          {...common}
          x={cx - radius}
          y={cy - radius}
          width={radius * 2}
          height={radius * 2}
          transform={`rotate(45 ${cx} ${cy})`}
        />
      );
    case 'triangle':
      return (
        <polygon
          {...common}
          points={`${cx},${cy - radius} ${cx - radius},${cy + radius} ${cx + radius},${cy + radius}`}
        />
      );
  }
}
