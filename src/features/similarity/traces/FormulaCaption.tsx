import { lazy, Suspense } from 'react';

const KatexFormula = lazy(() => import('./KatexFormula'));

export interface FormulaCaptionProps {
  tex: string;
  caption: string;
}

/**
 * KaTeX formula caption below a trace panel, never inside a matrix cell
 * (DESIGN.md §6 item 3). Lazy-loads the KaTeX chunk (`KatexFormula.tsx`) so
 * its font/JS weight only ships once a trace view actually renders one; the
 * raw TeX source is shown as a plain-text fallback while it loads.
 */
export function FormulaCaption({ tex, caption }: FormulaCaptionProps) {
  return (
    <figure className="mt-2 flex flex-col gap-1">
      <Suspense fallback={<p className="font-mono text-mono text-ink-muted">{tex}</p>}>
        <KatexFormula tex={tex} />
      </Suspense>
      <figcaption className="text-label text-ink-muted">{caption}</figcaption>
    </figure>
  );
}
