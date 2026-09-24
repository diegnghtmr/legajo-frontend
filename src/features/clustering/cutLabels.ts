/** The subset of `POST /clustering/cut`'s response this module needs. */
export interface CutLabelSource {
  readonly documentIds: readonly string[];
  readonly labels: readonly number[];
}

/**
 * Maps a `POST /clustering/cut` result onto one linkage's own leaf order —
 * by document id, never by array position. The cut response computes its
 * own `documentIds`/`labels` pair for its own request; nothing guarantees
 * that they share array positions with whichever linkage's dendrogram is
 * currently displaying the cut, and this deliberately refuses to assume so.
 * A leaf whose document is not present in the
 * cut's own `documentIds` resolves to `undefined` — never a cluster number
 * read from the wrong position.
 */
export function resolveCutLabelsForLinkage(
  cut: CutLabelSource,
  linkageDocumentIds: readonly string[],
): readonly (number | undefined)[] {
  const labelByDocumentId = new Map(
    cut.documentIds.map((id, index) => [id, cut.labels[index]] as const),
  );
  return linkageDocumentIds.map((id) => labelByDocumentId.get(id));
}
