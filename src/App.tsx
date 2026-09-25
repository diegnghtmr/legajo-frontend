import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './AppLayout';
import { BenchmarksPage } from './features/benchmarks/BenchmarksPage';
import { ClusteringPage } from './features/clustering/ClusteringPage';
import { SimilarityMatrixPage } from './features/similarity/SimilarityMatrixPage';
import { SimilarityPage } from './features/similarity/SimilarityPage';
import { SimilarityTracePage } from './features/similarity/SimilarityTracePage';
import { SimilarityWorkbenchLayout } from './features/similarity/SimilarityWorkbenchLayout';
import { NotFoundPage } from './NotFoundPage';

/**
 * Top-level route table. `AppLayout` is the layout route (header, section
 * nav, language switch) every screen renders inside via `Outlet`.
 * `SimilarityWorkbenchLayout` nests inside it for the three similarity
 * screens (compare, matrix, trace): it adds the persistent corpus selection
 * rail and the abstract/embeddings detail region around their own `Outlet`.
 * Corpus selection now lives entirely in that rail, so the former standalone
 * `/corpus` and `/corpus/:id` routes redirect into the similarity workbench
 * instead of rendering their own screen.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/similarity" replace />} />
        <Route path="corpus" element={<Navigate to="/similarity" replace />} />
        <Route path="corpus/:id" element={<Navigate to="/similarity" replace />} />
        <Route element={<SimilarityWorkbenchLayout />}>
          <Route path="similarity" element={<SimilarityPage />} />
          <Route path="similarity/matrix" element={<SimilarityMatrixPage />} />
          <Route path="similarity/:algorithmId/trace" element={<SimilarityTracePage />} />
        </Route>
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
