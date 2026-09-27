import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { MetricTile } from '../../shared/components/MetricTile';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { cardSurfaceClassName } from '../../shared/components/ui/card';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { cn } from '../../shared/lib/cn';
import { EMBEDDING_FAMILIES, embeddingResultsByDimension } from './grouping';
import { formatDuration } from './units';

/** The two fixed measurement points this report always targets — a
 * loading placeholder shows one tile per dimension the same way the
 * resolved section would for the common case, never a guessed count of
 * its own. */
const SKELETON_DIMENSIONS = [384, 1536] as const;

/** Mirrors `EmbeddingTiles`' own section: one card per fixed dimension,
 * each with one placeholder chip per embedding-primitive family. */
export function EmbeddingTilesSkeleton() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="embedding-tiles-skeleton-heading" className="flex flex-col gap-3">
      <h2 id="embedding-tiles-skeleton-heading" className="text-title font-semibold text-ink">
        {t('benchmarks.embedding.title')}
      </h2>
      <div className="flex flex-wrap gap-4">
        {SKELETON_DIMENSIONS.map((dimension) => (
          <div key={dimension} data-testid={`embedding-tile-skeleton-${dimension}`}>
            <Panel>
              <PanelHeader title={t('benchmarks.embedding.tileTitle', { dimension })} />
              <div className="flex flex-wrap gap-3">
                {EMBEDDING_FAMILIES.map((family) => (
                  <div key={family} className={cn(cardSurfaceClassName, 'flex flex-col gap-1 p-3')}>
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ))}
      </div>
    </section>
  );
}

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/**
 * One tile per embedding dimension, no curve: the
 * embedding-primitive O(d) measurement is a single timing per dimension,
 * not a curve over sizes, so it never joins the `BenchmarkCurveChart`
 * groups above.
 */
export function EmbeddingTiles({ results }: { results: readonly BenchmarkResult[] }) {
  const { t } = useTranslation();
  const tiles = embeddingResultsByDimension(results);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="embedding-tiles-heading" className="flex flex-col gap-3">
      <h2 id="embedding-tiles-heading" className="text-title font-semibold text-ink">
        {t('benchmarks.embedding.title')}
      </h2>
      <div className="flex flex-wrap gap-4">
        {tiles.map((tile) => (
          <div key={tile.dimension} data-testid={`embedding-tile-${tile.dimension}`}>
            <Panel>
              <PanelHeader
                title={t('benchmarks.embedding.tileTitle', { dimension: tile.dimension })}
              />
              <div className="flex flex-wrap gap-3">
                {tile.entries.map((entry) => (
                  <MetricTile
                    key={`${entry.family}-${tile.dimension}`}
                    label={entry.family}
                    value={formatDuration(entry.valueNs)}
                  />
                ))}
              </div>
            </Panel>
          </div>
        ))}
      </div>
    </section>
  );
}
