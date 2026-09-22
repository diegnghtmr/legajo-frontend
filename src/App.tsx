import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './AppLayout';
import { CorpusDetail } from './features/corpus/CorpusDetail';
import { CorpusDetailPlaceholder } from './features/corpus/CorpusDetailPlaceholder';
import { CorpusPage } from './features/corpus/CorpusPage';
import { ClusteringPage } from './features/clustering/ClusteringPage';
import { SimilarityPage } from './features/similarity/SimilarityPage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Top-level route table. `AppLayout` is the layout route (header, section
 * nav, language switch) that every screen renders inside via `Outlet`.
 * `/similarity` and `/clustering` are real, i18n-titled routes with a
 * placeholder screen until their features are built (W5, W8).
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
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
