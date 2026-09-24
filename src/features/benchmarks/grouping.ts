import type { BenchmarkReportResponse } from '../../infrastructure/api/benchmarks';
import { toNanoseconds } from './units';

type BenchmarkResult = BenchmarkReportResponse['results'][number];

/** Pairwise classic algorithms, curve x = L (synthetic sequence length). */
export const PAIRWISE_CLASSIC_FAMILIES = [
  'levenshtein',
  'needleman-wunsch',
  'jaccard',
  'tfidf-cosine',
] as const;

/** The four fixed HAC linkages, curve x = n. */
export const HAC_LINKAGE_FAMILIES = [
  'hac-single',
  'hac-complete',
  'hac-average',
  'hac-ward',
] as const;

/** Internal clustering-evaluation metrics, curve x = n. */
export const INTERNAL_METRIC_FAMILIES = ['mean-silhouette', 'davies-bouldin'] as const;

/** Embedding O(d) primitives, one timing per dimension, no curve. */
export const EMBEDDING_FAMILIES = [
  'embedding-dot-product',
  'embedding-euclidean-sum-squared',
] as const;

/** All C(n,2) classic comparisons per algorithm, fixed n = 20. */
export const SLO_CLASSIC_FAMILIES = [
  'slo-classic-levenshtein',
  'slo-classic-needleman-wunsch',
  'slo-classic-jaccard',
  'slo-classic-tfidf-cosine',
] as const;

/** All four linkages from cached matrices/vectors, fixed n = 20. */
export const SLO_CLUSTERING_FAMILY = 'slo-clustering';

export interface FamilySeries {
  family: string;
  points: Array<{ size: number; valueNs: number }>;
}

/**
 * Converts one result's score to nanoseconds, or `undefined` when the unit is
 * unrecognized. `toNanoseconds` throws on a schema-valid-but-unrecognized
 * unit (any string passes `BenchmarkResultSchema.unit`); a single malformed
 * record must never abort every other family's chart, so callers treat it as
 * omitted, the same rule `seriesForFamilies`'s own contract already applies
 * to a family absent from the response.
 */
function toNanosecondsOrSkip(result: BenchmarkResult): number | undefined {
  try {
    return toNanoseconds(result.score, result.unit);
  } catch {
    return undefined;
  }
}

/**
 * Groups the flat `results[]` by family for the families requested, sorted
 * ascending by `size` and converted to nanoseconds so every family in a
 * chart shares one axis. A requested family absent from the response (e.g. a
 * malformed or partial export), or one individual result with an
 * unrecognized unit, is simply omitted, never fabricated and never fatal to
 * the rest of the group.
 */
export function seriesForFamilies(
  results: readonly BenchmarkResult[],
  families: readonly string[],
): FamilySeries[] {
  const series: FamilySeries[] = [];

  for (const family of families) {
    const points = results
      .filter((result) => result.family === family)
      .flatMap((result) => {
        const valueNs = toNanosecondsOrSkip(result);
        return valueNs === undefined ? [] : [{ size: result.size, valueNs }];
      })
      .sort((a, b) => a.size - b.size);

    if (points.length > 0) {
      series.push({ family, points });
    }
  }

  return series;
}

/**
 * Merges per-family series sharing an x-domain (`size`) into one row per
 * distinct size, keyed by family id — the shape Recharts' `LineChart` needs
 * (one `dataKey` per `<Line>`, one shared `size` per row). A family with no
 * point at a given size simply has no key on that row (a gap in its line),
 * never an invented value.
 */
export function mergeSeriesIntoRows(
  series: readonly FamilySeries[],
): Array<Record<string, number>> {
  const rowsBySize = new Map<number, Record<string, number>>();

  for (const { family, points } of series) {
    for (const { size, valueNs } of points) {
      const row = rowsBySize.get(size) ?? { size };
      row[family] = valueNs;
      rowsBySize.set(size, row);
    }
  }

  return [...rowsBySize.values()].sort((a, b) => a.size - b.size);
}

export interface EmbeddingDimensionTile {
  dimension: number;
  entries: Array<{ family: string; valueNs: number }>;
}

/**
 * Both embedding-primitive families grouped by dimension (a single timing
 * tile per embedding dimension, no curve). `d = 384`
 * and `d = 1536` are the fixed measurement points; any other
 * dimension present in the response is still grouped, never dropped. A
 * result with an unrecognized unit is omitted, same rule as `seriesForFamilies`.
 */
export function embeddingResultsByDimension(
  results: readonly BenchmarkResult[],
): EmbeddingDimensionTile[] {
  const byDimension = new Map<number, EmbeddingDimensionTile>();

  for (const family of EMBEDDING_FAMILIES) {
    for (const result of results.filter((entry) => entry.family === family)) {
      const valueNs = toNanosecondsOrSkip(result);
      if (valueNs === undefined) {
        continue;
      }
      const tile = byDimension.get(result.size) ?? { dimension: result.size, entries: [] };
      tile.entries.push({ family, valueNs });
      byDimension.set(result.size, tile);
    }
  }

  return [...byDimension.values()].sort((a, b) => a.dimension - b.dimension);
}
