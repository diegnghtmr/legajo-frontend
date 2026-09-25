import { useTranslation } from 'react-i18next';

import type { SimilarityResult } from '../../../infrastructure/schemas/similarity';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui/table';
import { cn } from '../../../shared/lib/cn';
import { matrixHeatClassName } from './matrixHeat';

export interface MatrixTableProps {
  /** Same order as sent in the request body; row i / column j is `documentIds[i]`/`documentIds[j]`. */
  documentIds: readonly string[];
  /** Title lookup for the sr-only text next to each mono id header; missing ids degrade to id-only. */
  titleById: ReadonlyMap<string, string>;
  /** The backend's own m x m grid — this component computes nothing, only formats and buckets. */
  cells: readonly (readonly SimilarityResult[])[];
}

const STICKY_CORNER_CLASS = 'sticky top-0 left-0 z-20 bg-paper-sunken p-1';
const STICKY_COLUMN_HEADER_CLASS =
  'sticky top-0 z-10 min-w-16 bg-paper-sunken p-1 text-center font-mono text-mono text-ink-secondary normal-case tracking-normal';
const STICKY_ROW_HEADER_CLASS =
  'sticky left-0 z-10 min-w-16 bg-paper-sunken p-1 text-center font-mono text-mono text-ink-secondary normal-case tracking-normal';

/**
 * The m×m similarity matrix (a `matrix-*` heat ladder), on the shadcn
 * `Table` primitive — its own scroll container (`overflow-x-auto`) still
 * wraps every cell, so a wide matrix scrolls inside itself, never the page.
 * Every cell always shows its own `normalizedScore` in mono text (3
 * decimals) — the heat fill is presentation on top of that number, never a
 * replacement for it (color is never the only channel), and
 * `cached`/`degenerate` get both a small visible glyph and sr-only text for
 * the same reason.
 */
export function MatrixTable({ documentIds, titleById, cells }: MatrixTableProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-full overflow-auto rounded-md border border-hairline">
      <Table className="text-center">
        <TableCaption className="sr-only">{t('similarity.matrix.table.caption')}</TableCaption>
        <TableHeader>
          <TableRow className="border-b-0">
            <TableHead scope="col" className={STICKY_CORNER_CLASS} />
            {documentIds.map((id) => (
              <TableHead key={id} scope="col" className={STICKY_COLUMN_HEADER_CLASS}>
                {id}
                <span className="sr-only"> {titleById.get(id) ?? ''}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cells.map((row, rowIndex) => {
            const rowId = documentIds[rowIndex];
            return (
              <TableRow key={rowId}>
                <TableHead scope="row" className={STICKY_ROW_HEADER_CLASS}>
                  {rowId}
                  <span className="sr-only"> {titleById.get(rowId) ?? ''}</span>
                </TableHead>
                {row.map((result, colIndex) => (
                  <TableCell
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
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
