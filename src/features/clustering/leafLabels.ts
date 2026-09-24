import type { DendrogramLeafLabel } from '../../shared/components/Dendrogram';

/**
 * Builds one dendrogram leaf label per observation straight from a
 * `POST /clustering` linkage result's own `documentIds`:
 * position *i* is always the document behind observation *i*, the same
 * index `idx1`/`idx2` and `leafOrder` use — never assumed from `GET
 * /corpus`'s own list order or length. `titleById` supplies the display
 * title purely for accessibility/readability; a missing map (the corpus
 * query failed or has not resolved yet) or a missing id in it (the corpus
 * no longer contains that document) both fall back to showing the document
 * id itself with no title, never a guess derived from array position.
 */
export function leafLabelsFromDocumentIds(
  documentIds: readonly string[],
  titleById: ReadonlyMap<string, string> | undefined,
): readonly DendrogramLeafLabel[] {
  return documentIds.map((id) => ({ label: id, title: titleById?.get(id) }));
}
