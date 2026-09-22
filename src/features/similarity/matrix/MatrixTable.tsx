import { useTranslation } from 'react-i18next';

import type { SimilarityResult } from '../../../infrastructure/schemas/similarity';
import { cn } from '../../../shared/lib/cn';
import { matrixHeatClassName } from './matrixHeat';

export interface MatrixTableProps {
  /** Same order as sent in the request body; row i / column j is `documentIds[i]`/`documentIds[j]`. */
  documentIds: readonly string[];
  /** Title lookup for the sr-only text next to each mono id header; missing ids degrade to id-only. */
  titleById: ReadonlyMap<string, string>;
  /** The backend's own m x m grid (TRD §6.6) — this component computes nothing, only formats and buckets. */
  cells: readonly (readonly SimilarityResult[])[];
}

/**
 * The m×m similarity matrix (PRD HU-1.4, DESIGN.md `matrix-*` heat ladder).
 * Every cell always shows its own `normalizedScore` in mono text (3
 * decimals) — the heat fill is presentation on top of that number, never a
 * replacement for it (DESIGN.md §7.6 "color is not the only channel"), and
 * `cached`/`degenerate` get both a small visible glyph and sr-only text for
 * the same reason.
 */
export function MatrixTable({ documentIds, titleById, cells }: MatrixTableProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-full overflow-auto rounded-md border border-hairline">
      <table className="border-collapse text-center">
        <caption className="sr-only">{t('similarity.matrix.table.caption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 left-0 z-20 bg-paper-sunken p-1" />
            {documentIds.map((id) => (
              <th
                key={id}
                scope="col"
                className="sticky top-0 z-10 min-w-16 bg-paper-sunken p-1 font-mono text-mono text-ink-secondary"
              >
                {id}
                <span className="sr-only"> {titleById.get(id) ?? ''}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, rowIndex) => {
            const rowId = documentIds[rowIndex];
            return (
              <tr key={rowId}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-16 bg-paper-sunken p-1 font-mono text-mono text-ink-secondary"
                >
                  {rowId}
                  <span className="sr-only"> {titleById.get(rowId) ?? ''}</span>
                </th>
                {row.map((result, colIndex) => (
                  <td
                    key={documentIds[colIndex]}
                    className={cn(
                      'min-w-16 p-1 font-mono text-mono',
                      matrixHeatClassName(result.normalizedScore),
                    )}
                  >
                    <span>{result.normalizedScore.toFixed(3)}</span>
                    {result.cached && (
                      <>
                        <span aria-hidden="true" className="ml-0.5 align-super text-[9px]">
                          •
                        </span>
                        <span className="sr-only">{t('similarity.table.cachedMarker')}</span>
                      </>
                    )}
                    {result.degenerate && (
                      <>
                        <span aria-hidden="true" className="ml-0.5 align-super text-[9px]">
                          †
                        </span>
                        <span className="sr-only">
                          {t('similarity.matrix.table.degenerateMarker')}
                        </span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
