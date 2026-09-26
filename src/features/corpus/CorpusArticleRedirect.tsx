import { Navigate, useParams } from 'react-router';

/**
 * `/corpus/:id` has no screen of its own any more — the corpus rail now
 * lives inside the similarity workbench. This forwards the id as a query
 * param (`openAbstract`) instead of discarding it, so
 * `SimilarityWorkbenchLayout` can open that exact article's abstract once
 * the corpus list resolves and confirms the id (an unknown or missing id
 * simply falls back to the plain guidance screen there, the same as
 * `/corpus` itself already does).
 */
export function CorpusArticleRedirect() {
  const { id } = useParams<{ id: string }>();
  const to = id ? `/similarity?openAbstract=${encodeURIComponent(id)}` : '/similarity';
  return <Navigate to={to} replace />;
}
