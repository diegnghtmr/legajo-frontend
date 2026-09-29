import { useTranslation } from 'react-i18next';

import { cn } from '../../shared/lib/cn';
import { Skeleton } from '../../shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/components/ui/table';
import type { FamilySlope } from './plotModel';
import { hueForIndex } from './seriesStyle';

/** The strip's axis runs from 0 to this exponent; ticks mark 1, 2 and 3. */
const AXIS_MAX = 3.5;
const AXIS_TICKS = [1, 2, 3] as const;
const STRIP_HEIGHT_CLASS = 'h-4';
const STRIP_MIN_WIDTH_CLASS = 'min-w-24';

/*
 * A card narrower than `@lg` (512px) has no room for the strip beside the
 * family and the two values, so each row becomes a small grid: the family
 * and both values on the first line, the strip across the whole row on the
 * second, with the column headers folded into the values. The table, its
 * rows and its cells keep their ARIA roles, which the display change would
 * otherwise drop.
 */
const NARROW_TABLE_CLASS = '@max-lg:block';
const NARROW_ROW_CLASS =
  '@max-lg:grid @max-lg:grid-cols-[minmax(0,1fr)_auto_auto] @max-lg:items-center @max-lg:gap-x-3';
const NARROW_HEADER_CLASS = '@max-lg:sr-only';
const NARROW_FAMILY_CELL_CLASS = '@max-lg:col-start-1 @max-lg:row-start-1 @max-lg:pb-0';
const NARROW_STRIP_CELL_CLASS = '@max-lg:col-span-3 @max-lg:row-start-2 @max-lg:pt-1';
const NARROW_EMPIRICAL_CELL_CLASS = '@max-lg:col-start-2 @max-lg:row-start-1 @max-lg:pb-0';
const NARROW_THEORETICAL_CELL_CLASS = '@max-lg:col-start-3 @max-lg:row-start-1 @max-lg:pb-0';
const DOT_SIZE = 10;
const SEGMENT_OPACITY = 0.35;

/**
 * Where a slope sits on the strip, as a fraction of its length. A value past
 * either end pins to that end; the number shown beside the strip stays exact.
 */
export function slopePosition(value: number): number {
  return Math.min(Math.max(value / AXIS_MAX, 0), 1);
}

function percent(fraction: number): string {
  return `${fraction * 100}%`;
}

function formatSlope(value: number): string {
  return value.toFixed(2);
}

function StripKey() {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t('benchmarks.curves.slopeKey')}
      className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-muted"
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-ink-secondary" />
        {t('benchmarks.curves.slopeKeyEmpirical')}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-ink" />
        {t('benchmarks.curves.slopeKeyTheoretical')}
      </li>
    </ul>
  );
}

function StripHeader() {
  const { t } = useTranslation();

  return (
    <TableHeader className={NARROW_HEADER_CLASS} role="rowgroup">
      <TableRow role="row">
        <TableHead>{t('benchmarks.curves.slopeTableFamily')}</TableHead>
        <TableHead>{t('benchmarks.curves.slopeTableStrip')}</TableHead>
        <TableHead className="text-right">{t('benchmarks.curves.slopeTableEmpirical')}</TableHead>
        <TableHead className="text-right">{t('benchmarks.curves.slopeTableTheoretical')}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** The column name a narrow row carries inline, since its header row is folded away. */
function InlineLabel({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="mr-1.5 font-sans text-label text-ink-muted @lg:hidden">
      {children}
    </span>
  );
}

function FamilyCell({ family, hue }: { family: string; hue?: string }) {
  return (
    <TableCell role="cell" className={NARROW_FAMILY_CELL_CLASS}>
      <span className="flex items-center gap-2 font-mono text-mono text-ink">
        {hue ? (
          <span
            data-testid={`slope-swatch-${family}`}
            aria-hidden="true"
            className="size-2 shrink-0 rounded-sm"
            style={{ background: hue }}
          />
        ) : (
          <Skeleton className="size-2 shrink-0" />
        )}
        {family}
      </span>
    </TableCell>
  );
}

interface StripMarksProps {
  family: string;
  hue: string;
  slope: FamilySlope;
  index: number;
}

/** The drawn strip: the theoretical exponent as an ink tick, the empirical slope as a hue dot. */
function StripMarks({ family, hue, slope, index }: StripMarksProps) {
  const empirical = slopePosition(slope.empiricalSlope);
  const theoretical = slopePosition(slope.theoreticalExponent);

  return (
    <div aria-hidden="true" className={cn('relative', STRIP_HEIGHT_CLASS, STRIP_MIN_WIDTH_CLASS)}>
      <span className="absolute inset-x-0 top-[7.5px] h-px bg-hairline-strong" />
      {AXIS_TICKS.map((tick) => (
        <span
          key={tick}
          className="absolute top-1 h-2 w-px bg-hairline-strong"
          style={{ left: percent(tick / AXIS_MAX) }}
        />
      ))}
      <span
        data-testid={`slope-segment-${family}`}
        className="absolute top-[7px] h-0.5"
        style={{
          left: percent(Math.min(empirical, theoretical)),
          width: percent(Math.abs(empirical - theoretical)),
          background: hue,
          opacity: SEGMENT_OPACITY,
        }}
      />
      <span
        data-testid={`slope-tick-${family}`}
        className="absolute top-0.5 h-3 w-0.5 -translate-x-px bg-ink"
        style={{ left: percent(theoretical) }}
      />
      <span
        data-testid={`slope-dot-${family}`}
        className="enter-rise absolute top-[3px] rounded-full ring-2 ring-paper-raised"
        style={{
          left: percent(empirical),
          width: DOT_SIZE,
          height: DOT_SIZE,
          marginLeft: -DOT_SIZE / 2,
          background: hue,
          ['--i' as string]: index,
        }}
      />
    </div>
  );
}

export interface SlopeStripProps {
  /** Every series of the chart above, in chart order: a row keeps its series' hue. */
  families: readonly string[];
  slopes: ReadonlyMap<string, FamilySlope>;
  /** Accessible name of the table and of its scroll region. */
  caption: string;
}

/**
 * Under each curve chart, one row per series that has a slope: the empirical
 * log–log slope (a hue dot) against the theoretical exponent (an ink tick) on
 * a 0–3.5 axis, with both values in mono as the text equivalent. The table is
 * the single, focusable scroll region when it is wider than its card.
 */
export function SlopeStrip({ families, slopes, caption }: SlopeStripProps) {
  const { t } = useTranslation();
  const rows = families.flatMap((family, index) => {
    const slope = slopes.get(family);
    return slope ? [{ family, slope, index }] : [];
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className="@container overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Table wrap={false} role="table" className={NARROW_TABLE_CLASS}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <StripHeader />
          <TableBody role="rowgroup" className="@max-lg:block">
            {rows.map(({ family, slope, index }) => (
              <TableRow key={family} role="row" className={NARROW_ROW_CLASS}>
                <FamilyCell family={family} hue={hueForIndex(index)} />
                <TableCell role="cell" className={NARROW_STRIP_CELL_CLASS}>
                  <StripMarks
                    family={family}
                    hue={hueForIndex(index)}
                    slope={slope}
                    index={index}
                  />
                </TableCell>
                <TableCell
                  role="cell"
                  className={cn(
                    'text-right font-mono text-mono text-ink',
                    NARROW_EMPIRICAL_CELL_CLASS,
                  )}
                >
                  <InlineLabel>{t('benchmarks.curves.slopeTableEmpirical')}</InlineLabel>
                  {formatSlope(slope.empiricalSlope)}
                </TableCell>
                <TableCell
                  role="cell"
                  className={cn(
                    'text-right font-mono text-mono text-ink-muted',
                    NARROW_THEORETICAL_CELL_CLASS,
                  )}
                >
                  <InlineLabel>{t('benchmarks.curves.slopeTableTheoretical')}</InlineLabel>
                  {formatSlope(slope.theoreticalExponent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <StripKey />
    </div>
  );
}

export interface SlopeStripSkeletonProps {
  /** The group's fixed families: every one carries a slope, so each is one row. */
  families: readonly string[];
  caption: string;
}

/** Mirrors `SlopeStrip` before the report resolves: real ids, header and key; bars for the values. */
export function SlopeStripSkeleton({ families, caption }: SlopeStripSkeletonProps) {
  return (
    <div className="mt-3">
      <div className="@container overflow-hidden rounded-md">
        <Table wrap={false} role="table" className={NARROW_TABLE_CLASS}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <StripHeader />
          <TableBody role="rowgroup" className="@max-lg:block">
            {families.map((family) => (
              <TableRow key={family} role="row" className={NARROW_ROW_CLASS}>
                <FamilyCell family={family} />
                <TableCell role="cell" className={NARROW_STRIP_CELL_CLASS}>
                  <Skeleton className={cn('w-full', STRIP_HEIGHT_CLASS, STRIP_MIN_WIDTH_CLASS)} />
                </TableCell>
                <TableCell role="cell" className={cn('text-right', NARROW_EMPIRICAL_CELL_CLASS)}>
                  <Skeleton className="ml-auto h-3 w-10 @max-lg:w-[5.25rem]" />
                </TableCell>
                <TableCell role="cell" className={cn('text-right', NARROW_THEORETICAL_CELL_CLASS)}>
                  <Skeleton className="ml-auto h-3 w-10 @max-lg:w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <StripKey />
    </div>
  );
}
