import { useTranslation } from 'react-i18next';

import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { MetricTile } from '../../shared/components/MetricTile';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { embeddingResultsByDimension } from './grouping';
import { formatDuration } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/**
 * One tile per embedding dimension, no curve (DESIGN.md §6 item 6): the
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
                    key={entry.family}
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
