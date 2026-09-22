import { describe, expect, it } from 'vitest';

import { leafLabelsFromDocumentIds } from './leafLabels';

describe('leafLabelsFromDocumentIds', () => {
  it('labels each leaf with its own documentIds entry, by position in that array', () => {
    const documentIds = ['doc-03', 'doc-01', 'doc-02'];
    const titleById = new Map([
      ['doc-01', 'First article'],
      ['doc-02', 'Second article'],
      ['doc-03', 'Third article'],
    ]);

    expect(leafLabelsFromDocumentIds(documentIds, titleById)).toEqual([
      { label: 'doc-03', title: 'Third article' },
      { label: 'doc-01', title: 'First article' },
      { label: 'doc-02', title: 'Second article' },
    ]);
  });

  it('shows the document id with no title when the corpus lookup is unavailable (fetch failed or still loading)', () => {
    expect(leafLabelsFromDocumentIds(['doc-01', 'doc-02'], undefined)).toEqual([
      { label: 'doc-01', title: undefined },
      { label: 'doc-02', title: undefined },
    ]);
  });

  it('shows the document id with no title when that id is missing from the corpus lookup, never a guess from position', () => {
    const titleById = new Map([['doc-02', 'Second article']]);

    expect(leafLabelsFromDocumentIds(['doc-01', 'doc-02'], titleById)).toEqual([
      { label: 'doc-01', title: undefined },
      { label: 'doc-02', title: 'Second article' },
    ]);
  });
});
