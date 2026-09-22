import { describe, expect, it } from 'vitest';

import { resolveCutLabelsForLinkage } from './cutLabels';

describe('resolveCutLabelsForLinkage', () => {
  it('maps each leaf to its cluster label by document id, not by array position', () => {
    // The cut response's own documentIds are in a different order than the
    // linkage's own documentIds -- an index-based lookup (cut.labels[i])
    // would silently pair leaf i with the wrong cluster.
    const cut = { documentIds: ['doc-03', 'doc-01', 'doc-02'], labels: [7, 5, 6] };
    const linkageDocumentIds = ['doc-01', 'doc-02', 'doc-03'];

    expect(resolveCutLabelsForLinkage(cut, linkageDocumentIds)).toEqual([5, 6, 7]);
  });

  it('resolves to undefined, never a fabricated cluster, for a document absent from the cut response', () => {
    const cut = { documentIds: ['doc-01'], labels: [0] };
    const linkageDocumentIds = ['doc-01', 'doc-02'];

    expect(resolveCutLabelsForLinkage(cut, linkageDocumentIds)).toEqual([0, undefined]);
  });
});
