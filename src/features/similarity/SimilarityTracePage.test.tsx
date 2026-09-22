import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SimilarityTracePage } from './SimilarityTracePage';

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/similarity/:algorithmId/trace" element={<SimilarityTracePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SimilarityTracePage', () => {
  it('titles the placeholder with the algorithm id from the route (built in W6)', () => {
    renderAtRoute('/similarity/levenshtein/trace?documentIdA=doc-01&documentIdB=doc-02');

    expect(screen.getByRole('heading', { name: 'Traza: levenshtein' })).toBeInTheDocument();
  });
});
