import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './AppLayout';
import { BenchmarksPage } from './features/benchmarks/BenchmarksPage';
import { CorpusDetail } from './features/corpus/CorpusDetail';
import { CorpusDetailPlaceholder } from './features/corpus/CorpusDetailPlaceholder';
import { CorpusPage } from './features/corpus/CorpusPage';
import { ClusteringPage } from './features/clustering/ClusteringPage';
import { SimilarityMatrixPage } from './features/similarity/SimilarityMatrixPage';
import { SimilarityPage } from './features/similarity/SimilarityPage';
import { SimilarityTracePage } from './features/similarity/SimilarityTracePage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Top-level route table. `AppLayout` is the layout route (header, section
 * nav, language switch) that every screen renders inside via `Outlet`.
 * `/similarity/matrix` is a real screen from the start — no
 * catalogue/algorithm-id path segment, since the matrix reads the shared
 * corpus selection instead of two fixed document ids.
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
        <Route path="similarity/matrix" element={<SimilarityMatrixPage />} />
        <Route path="similarity/:algorithmId/trace" element={<SimilarityTracePage />} />
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
