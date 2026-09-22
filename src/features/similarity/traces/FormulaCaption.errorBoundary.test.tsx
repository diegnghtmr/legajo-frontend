import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Simulates a failed KaTeX chunk load (e.g. a network error on the split
// bundle): the dynamic import behind `React.lazy` rejects, exactly like it
// would in production when the chunk request fails.
vi.mock('./KatexFormula', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

import { FormulaCaption } from './FormulaCaption';

describe('FormulaCaption when the lazy KaTeX chunk fails to load', () => {
  it('keeps rendering the trace content and falls back to the raw TeX source instead of unmounting', async () => {
    // React logs the caught render error to the console; keep test output clean.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<FormulaCaption tex="a^2+b^2=c^2" caption="Pythagorean theorem" />);

    // Let the rejected dynamic import settle and retry-render the lazy
    // component. Without an error boundary this unmounts the whole tree —
    // that is the failure this test guards against.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(screen.getByText('Pythagorean theorem')).toBeInTheDocument();
    expect(screen.getByText('a^2+b^2=c^2')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
