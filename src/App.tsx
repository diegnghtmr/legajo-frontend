import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './AppLayout';
import { CorpusDetail } from './features/corpus/CorpusDetail';
import { CorpusDetailPlaceholder } from './features/corpus/CorpusDetailPlaceholder';
import { CorpusPage } from './features/corpus/CorpusPage';
import { ClusteringPage } from './features/clustering/ClusteringPage';
import { SimilarityPage } from './features/similarity/SimilarityPage';
import { SimilarityTracePage } from './features/similarity/SimilarityTracePage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Top-level route table. `AppLayout` is the layout route (header, section
 * nav, language switch) that every screen renders inside via `Outlet`.
 * `/clustering` is a real, i18n-titled route with a placeholder screen until
 * W8; `/similarity/:algorithmId/trace` is a real, i18n-titled placeholder
 * route until W6 builds its trace panels.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/corpus" replace />} />
        <Route path="corpus" element={<CorpusPage />}>
          <Route index element={<CorpusDetailPlaceholder />} />
          <Route path=":id" element={<CorpusDetail />} />
        </Route>
        <Route path="similarity" element={<SimilarityPage />} />
        <Route path="similarity/:algorithmId/trace" element={<SimilarityTracePage />} />
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
