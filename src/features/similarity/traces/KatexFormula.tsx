import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface KatexFormulaProps {
  tex: string;
}

/**
 * Renders one formula with real KaTeX (DESIGN.md `typography.formula`,
 * `--font-formula`). Split into its own module so `FormulaCaption` can
 * `React.lazy()`-load it: KaTeX ships its own font files and is meaningful
 * extra weight for a caption that only appears once a trace panel is open.
 */
export default function KatexFormula({ tex }: KatexFormulaProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { throwOnError: false, displayMode: true });
    }
  }, [tex]);

  return <span ref={ref} className="text-formula" style={{ fontFamily: 'var(--font-formula)' }} />;
}
