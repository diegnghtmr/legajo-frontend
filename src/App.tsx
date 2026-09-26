import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './AppLayout';
import { BenchmarksPage } from './features/benchmarks/BenchmarksPage';
import { ClusteringPage } from './features/clustering/ClusteringPage';
import { CorpusArticleRedirect } from './features/corpus/CorpusArticleRedirect';
import { SimilarityMatrixPage } from './features/similarity/SimilarityMatrixPage';
import { SimilarityPage } from './features/similarity/SimilarityPage';
import { SimilarityTracePage } from './features/similarity/SimilarityTracePage';
import { SimilarityWorkbenchLayout } from './features/similarity/SimilarityWorkbenchLayout';
import { NotFoundPage } from './NotFoundPage';

/**
 * Top-level route table. `AppLayout` is the layout route (header, section
 * nav, language switch) every screen renders inside via `Outlet`.
 * `SimilarityWorkbenchLayout` nests inside it for the similarity screens
 * (compare, matrix, trace deep link, full-screen trace): it adds the
 * persistent corpus selection rail and the abstract/embeddings/trace detail
 * region around their own `Outlet`. Corpus selection now lives entirely in
 * that rail, so the former standalone `/corpus` route redirects into the
 * similarity workbench instead of rendering its own screen; `/corpus/:id`
 * does the same but forwards the id (`CorpusArticleRedirect`), so that
 * exact article's abstract still opens once the corpus list resolves and
 * confirms it, rather than the id being silently dropped.
 *
 * `similarity/:algorithmId/trace` renders the same `SimilarityPage` as plain
 * `similarity` — it never swaps the pairwise results out for a trace-only
 * screen — and `SimilarityWorkbenchLayout` opens that algorithm's trace in
 * the detail panel by matching this same path. The distinct
 * `similarity/:algorithmId/trace/full` route is the panel's own "full
 * screen" escape hatch: `SimilarityTracePage`, unconstrained by the panel's
 * 460px width.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/similarity" replace />} />
        <Route path="corpus" element={<Navigate to="/similarity" replace />} />
        <Route path="corpus/:id" element={<CorpusArticleRedirect />} />
        <Route element={<SimilarityWorkbenchLayout />}>
          <Route path="similarity" element={<SimilarityPage />} />
          <Route path="similarity/matrix" element={<SimilarityMatrixPage />} />
          <Route path="similarity/:algorithmId/trace" element={<SimilarityPage />} />
          <Route path="similarity/:algorithmId/trace/full" element={<SimilarityTracePage />} />
        </Route>
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
