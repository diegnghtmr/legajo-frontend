import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import { FamilyStatus } from '../../shared/components/FamilyStatus';
import { cardSurfaceClassName } from '../../shared/components/ui/card';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import { algoFamilyFromKind } from './algorithmFamily';
import { rememberTraceTrigger } from './traceFocusReturn';

type AlgorithmSummary = ListSimilarityAlgorithmsResponse[number];

const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

export interface ScoreStripProps {
  rows: CompareResponse;
  catalogueById: ReadonlyMap<string, AlgorithmSummary>;
  /** Opens `algorithmId`'s trace, the same callback a table row uses. */
  onOpenTrace: (algorithmId: string) => void;
  openAlgorithmId?: string | null;
  /** Dots are pointer shortcuts only where the table is on screen; below
   * `lg` the strip is purely visual and holds no controls. */
  interactive: boolean;
}

/** The header, the 0 to 1 axis and its ticks; the dots are its children. The
 * loaded strip and its skeleton share this frame, so their boxes match. */
function ScoreStripFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    // Decorative: the table rows already carry every score and are the
    // keyboard and assistive-technology path, so this holds no tab stops.
    <div data-testid="score-strip" aria-hidden="true" className={cn(cardSurfaceClassName, 'pb-1')}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.scoreStrip.eyebrow')}
        </p>
        <div className="flex items-center gap-4">
          <FamilyStatus family="classic" label={t('similarity.family.classic')} />
          <FamilyStatus family="ai" label={t('similarity.family.ai')} />
        </div>
      </div>
      <div className="relative mx-6 h-11">
        <div className="absolute inset-x-0 top-5 h-px bg-hairline-strong" />
        {AXIS_TICKS.map((tick) => (
          <span
            key={tick}
            style={{ left: `${tick * 100}%` }}
            className="absolute top-7 -translate-x-1/2 font-mono text-[10px] leading-none text-ink-muted"
          >
            {tick.toFixed(2)}
          </span>
        ))}
        {children}
      </div>
    </div>
  );
}

/**
 * One card that places every visible result on a single 0 to 1 axis, one dot
 * per row in its family colour, the open row larger and ringed in ink. A dot
 * is a pointer shortcut to that row's trace; the row stays the accessible
 * control, so the whole strip is `aria-hidden` and its dots are not tab
 * stops. Each dot keeps a 24 by 24 hit area around its 10px mark.
 */
export function ScoreStrip({
  rows,
  catalogueById,
  onOpenTrace,
  openAlgorithmId = null,
  interactive,
}: ScoreStripProps) {
  return (
    <ScoreStripFrame>
      {rows.map(({ algorithmId, result }) => {
        const family = algoFamilyFromKind(catalogueById.get(algorithmId)?.kind ?? 'CLASSIC');
        const isOpen = openAlgorithmId === algorithmId;
        const position: CSSProperties = { left: `${result.normalizedScore * 100}%` };
        const title = `${algorithmId}: ${result.normalizedScore.toFixed(3)}`;
        const dot = (
          <>
            <span className="sr-only">{algorithmId}</span>
            <span
              data-dot=""
              data-open={isOpen ? 'true' : undefined}
              className={cn(
                'block rounded-full shadow-[0_0_0_2px_var(--color-paper-raised)]',
                family === 'classic' ? 'bg-classic' : 'bg-ai',
                isOpen
                  ? 'size-3.5 shadow-[0_0_0_2px_var(--color-paper-raised),0_0_0_4px_var(--color-ink)]'
                  : 'size-2.5',
              )}
            />
          </>
        );
        const slot = cn(
          'absolute top-5 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
          isOpen ? 'z-10' : 'z-0',
        );

        return interactive ? (
          <button
            key={algorithmId}
            type="button"
            tabIndex={-1}
            title={title}
            style={position}
            onClick={() => {
              // The row's own button is the focus-return target, found by id.
              rememberTraceTrigger(null, algorithmId);
              onOpenTrace(algorithmId);
            }}
            className={cn(slot, 'cursor-pointer')}
          >
            {dot}
          </button>
        ) : (
          <span key={algorithmId} title={title} style={position} className={slot}>
            {dot}
          </span>
        );
      })}
    </ScoreStripFrame>
  );
}

/** Keeps the header and the axis and draws one hairline dot per selected
 * algorithm, evenly spaced, in the exact box of the loaded strip. */
export function ScoreStripSkeleton({ count }: { count: number }) {
  return (
    <ScoreStripFrame>
      {Array.from({ length: count }, (_unused, index) => (
        <Skeleton
          key={index}
          data-skeleton-dot=""
          style={{ left: `${((index + 1) / (count + 1)) * 100}%` }}
          className="absolute top-5 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      ))}
    </ScoreStripFrame>
  );
}
