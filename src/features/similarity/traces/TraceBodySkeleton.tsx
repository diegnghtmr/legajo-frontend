import { Skeleton } from '../../../shared/components/ui/skeleton';

/**
 * A generic placeholder for a trace's own body — shared by the docked
 * detail panel and the standalone full-screen view, since which of the six
 * capability panels (DP matrix, TF-IDF term table, Jaccard sets, or an
 * embedding excerpt) will render is not yet known while the trace request
 * is still pending. One formula-height bar over one generic block mirrors
 * every panel's own two-part shape (a KaTeX caption over its main content)
 * without guessing a size specific to any one of them.
 */
export function TraceBodySkeleton() {
  return (
    <div data-testid="trace-body-skeleton" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}
