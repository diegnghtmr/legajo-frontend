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
import { Skeleton } from '../../../shared/components/ui/skeleton';
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
 * `Table` primitive with its own `overflow-x-auto` wrapper skipped
 * (`wrap={false}`): this component supplies the single scroll container
 * itself (bounded height + `overflow-auto`, the same technique `DpMatrix`
 * already uses), so both the sticky header row and the sticky first column
 * stick to the one container that actually scrolls in both axes — nesting
 * this primitive's own wrapper inside another `overflow` ancestor left the
 * sticky cells attached to whichever div happened to be the nearest
 * scrolling one, which was not reliably this outer container. A wide *and*
 * tall matrix therefore still scrolls inside its own container, never the
 * page, in either direction.
 * Every cell always shows its own `normalizedScore` in mono text (3
 * decimals) — the heat fill is presentation on top of that number, never a
 * replacement for it (color is never the only channel), and
 * `cached`/`degenerate` get both a small visible glyph and sr-only text for
 * the same reason.
 *
 * That sr-only text is `position: absolute` (Tailwind's own `sr-only`
 * recipe) with no offset, so its containing block is whichever ancestor is
 * itself positioned — with none, that is the initial containing block (the
 * viewport), which is never clipped by this container's own `overflow-auto`.
 * At 20 selected, with any cached/degenerate cell present, those escaped
 * spans' static position (derived from their place in a 1300+px-wide table)
 * widened `document.documentElement.scrollWidth` past the viewport even
 * though the table itself scrolled correctly inside this region. `relative`
 * below makes this container the positioned ancestor instead, so every
 * absolutely-positioned marker is confined to its own already-scrollable
 * overflow — verified live: adding it alone drops the page's scroll width
 * back to the viewport width with 20×20 cells and cached markers present.
 */
export interface MatrixTableSkeletonProps {
  /** The selected document count — the real m×n grid is always square, so
   * this one count also fixes the row and column total. */
  documentCount: number;
}

/**
 * Mirrors `MatrixTable`'s own sticky corner/header/row boxes and cell grid,
 * at the one size already known before the request resolves: the selected
 * document count.
 */
export function MatrixTableSkeleton({ documentCount }: MatrixTableSkeletonProps) {
  const { t } = useTranslation();
  const indices = Array.from({ length: documentCount }, (_unused, index) => index);

  return (
    <div
      data-testid="matrix-skeleton"
      className="relative max-h-[420px] max-w-full overflow-hidden rounded-md border border-hairline"
    >
      <Table wrap={false} className="text-center">
        <TableHeader>
          <TableRow className="border-b-0">
            <TableHead scope="col" className={STICKY_CORNER_CLASS}>
              <span className="sr-only">{t('similarity.matrix.table.cornerLabel')}</span>
            </TableHead>
            {indices.map((index) => (
              <TableHead key={index} scope="col" className={STICKY_COLUMN_HEADER_CLASS}>
                {/* Never an empty `<th>` (axe `empty-table-header`): the
                 * real header's own document id is unknown yet, but the
                 * axis it stands for (a document) already is. */}
                <span className="sr-only">{t('similarity.matrix.table.cornerLabel')}</span>
                <Skeleton className="mx-auto h-4.5 w-10" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {indices.map((rowIndex) => (
            <TableRow key={rowIndex}>
              <TableHead scope="row" className={STICKY_ROW_HEADER_CLASS}>
                <span className="sr-only">{t('similarity.matrix.table.cornerLabel')}</span>
                <Skeleton className="mx-auto h-4.5 w-10" />
              </TableHead>
              {indices.map((colIndex) => (
                <TableCell key={colIndex} className="min-w-16 p-1">
                  <Skeleton className="mx-auto h-4.5 w-10" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MatrixTable({ documentIds, titleById, cells }: MatrixTableProps) {
  const { t } = useTranslation();

  return (
    <div
      role="region"
      aria-label={t('similarity.matrix.table.caption')}
      tabIndex={0}
      className="relative max-h-[420px] max-w-full overflow-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Table wrap={false} className="text-center">
        <TableCaption className="sr-only">{t('similarity.matrix.table.caption')}</TableCaption>
        <TableHeader>
          <TableRow className="border-b-0">
            {/* Otherwise-empty `<th>` (`empty-table-header`): this corner
             * sits at the intersection of the row axis and the column axis,
             * both the same document-id list, so a generic axis label reads
             * accurately from either side. */}
            <TableHead scope="col" className={STICKY_CORNER_CLASS}>
              <span className="sr-only">{t('similarity.matrix.table.cornerLabel')}</span>
            </TableHead>
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
