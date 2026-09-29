import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { EMBEDDING_FAMILIES, embeddingResultsByDimension } from './grouping';
import { formatDuration } from './units';

/** The two fixed measurement points this report always targets — a
 * loading placeholder shows one tile per dimension the same way the
 * resolved section would for the common case, never a guessed count of
 * its own. */
const SKELETON_DIMENSIONS = [384, 1536] as const;

/** Two equal columns at every width; the grid grows to the row height the
 * harness card sets, and each tile stretches with it. */
const TILE_CLASS = 'flex min-w-0 flex-col gap-2.5 rounded-md bg-paper-sunken p-3';
const TILES_CLASS = 'grid flex-1 grid-cols-2 gap-2';

/** The family id without its `embedding-` prefix: the tile is already titled
 * as the embedding primitives. */
function primitiveName(family: string): string {
  return family.replace(/^embedding-/, '');
}

/** One line: the name at the start, the value at the end; a narrow tile lets
 * the value drop under the name instead of overflowing. */
const LINE_CLASS = 'flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-mono';
const NAME_CLASS = 'min-w-0 font-mono text-ink-secondary [overflow-wrap:anywhere]';

function TileTitle({ dimension }: { dimension: number }) {
  const { t } = useTranslation();
  return (
    <h3 className="font-mono text-[14px] font-semibold text-ink">
      {t('benchmarks.embedding.tileTitle', { dimension })}
    </h3>
  );
}

/** Mirrors `EmbeddingTiles`' own card: one sunken tile per fixed dimension,
 * each with one row per embedding-primitive family. The family id itself is a
 * fixed constant (`EMBEDDING_FAMILIES`), never response data — real text, at
 * its own real width, so a row wraps at exactly the width the real id would. */
export function EmbeddingTilesSkeleton() {
  const { t } = useTranslation();

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={t('benchmarks.embedding.title')} />
      <div className={TILES_CLASS}>
        {SKELETON_DIMENSIONS.map((dimension) => (
          <div
            key={dimension}
            data-testid={`embedding-tile-skeleton-${dimension}`}
            className={TILE_CLASS}
          >
            <TileTitle dimension={dimension} />
            <dl className="flex flex-col gap-2.5">
              {EMBEDDING_FAMILIES.map((family) => (
                <div key={family} className={LINE_CLASS}>
                  <dt className={NAME_CLASS}>{primitiveName(family)}</dt>
                  <dd className="ml-auto text-right tabular-nums">
                    <Skeleton className="text-transparent">xxx ns ±xx ns</Skeleton>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/**
 * One tile per embedding dimension, no curve: the embedding-primitive O(d)
 * measurement is a single timing per dimension, not a curve over sizes, so it
 * never joins the `BenchmarkCurveChart` groups. Each primitive shows its mono
 * id over its duration, with the JMH error muted beside it.
 */
export function EmbeddingTiles({ results }: { results: readonly BenchmarkResult[] }) {
  const { t } = useTranslation();
  const tiles = embeddingResultsByDimension(results);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={t('benchmarks.embedding.title')} />
      <div className={TILES_CLASS}>
        {tiles.map((tile) => (
          <div
            key={tile.dimension}
            data-testid={`embedding-tile-${tile.dimension}`}
            className={TILE_CLASS}
          >
            <TileTitle dimension={tile.dimension} />
            <dl className="flex flex-col gap-2.5">
              {tile.entries.map((entry) => (
                <div key={`${entry.family}-${tile.dimension}`} className={LINE_CLASS}>
                  <dt className={NAME_CLASS}>{primitiveName(entry.family)}</dt>
                  <dd className="ml-auto text-right tabular-nums text-ink">
                    {formatDuration(entry.valueNs)}
                    {entry.errorNs > 0 && (
                      <span className="text-ink-secondary"> ±{formatDuration(entry.errorNs)}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Panel>
  );
}
