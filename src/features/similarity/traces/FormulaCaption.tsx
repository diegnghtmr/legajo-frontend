import { Component, lazy, Suspense, useId, type ReactNode } from 'react';

const KatexFormula = lazy(() => import('./KatexFormula'));

export interface FormulaCaptionProps {
  tex: string;
  caption: string;
}

interface KatexErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface KatexErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches a failed KaTeX chunk load (a network error on the split bundle):
 * without it, the lazy import's rejection is an uncaught render error that
 * unmounts the whole trace page. React 19 still has no hook equivalent for
 * error boundaries, so this stays a class component. Falls back to the same
 * raw-TeX-in-mono presentation already used while the chunk is loading.
 */
class KatexErrorBoundary extends Component<KatexErrorBoundaryProps, KatexErrorBoundaryState> {
  state: KatexErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): KatexErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * KaTeX formula caption below a trace panel, never inside a matrix cell.
 * Lazy-loads the KaTeX chunk (`KatexFormula.tsx`) so
 * its font/JS weight only ships once a trace view actually renders one; the
 * raw TeX source is shown as a plain-text fallback while it loads, and again
 * if the chunk fails to load, so a network error never crashes the page.
 */
export function FormulaCaption({ tex, caption }: FormulaCaptionProps) {
  const captionId = useId();
  const rawTexFallback = <p className="font-mono text-mono text-ink-muted">{tex}</p>;

  return (
    <figure className="mt-2 flex flex-col gap-1">
      {/* A formula never widens the page: a wide one scrolls inside this
       * box, which is a labelled, focusable region so a keyboard can reach
       * the scrolling. */}
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <KatexErrorBoundary fallback={rawTexFallback}>
          <Suspense fallback={rawTexFallback}>
            <KatexFormula tex={tex} />
          </Suspense>
        </KatexErrorBoundary>
      </div>
      <figcaption id={captionId} className="text-label text-ink-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
