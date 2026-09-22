import { describe, expect, it } from 'vitest';

import { queryClient } from './queryClient';

describe('queryClient', () => {
  it('defaults staleTime to Infinity (the corpus and its derived results are static, TRD §6.7)', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(Infinity);
  });

  it('uses the shared retry policy', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBeTypeOf('function');
  });
});
