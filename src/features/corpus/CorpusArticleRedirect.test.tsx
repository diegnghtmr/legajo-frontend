import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CorpusArticleRedirect } from './CorpusArticleRedirect';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderAtRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route path="/corpus/:id" element={<CorpusArticleRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CorpusArticleRedirect', () => {
  it('forwards the id as an openAbstract query param on /similarity, never discarding it', async () => {
    renderAtRoute('/corpus/doc-05');

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/similarity?openAbstract=doc-05',
    );
  });

  it('encodes an id that needs it', async () => {
    renderAtRoute('/corpus/doc%2005');

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/similarity?openAbstract=doc%2005',
    );
  });
});
