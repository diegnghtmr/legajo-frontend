import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as corpusApi from '../../infrastructure/api/corpus';
import { ArticleAbstract } from './ArticleAbstract';

vi.mock('../../infrastructure/api/corpus');

function renderAbstract(id = 'doc-01') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ArticleAbstract id={id} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('ArticleAbstract', () => {
  it('shows the id and authors as stacked subtitle lines, and the abstract body, once loaded', async () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockResolvedValue({
      id: 'doc-01',
      title: 'A survey of string similarity',
      authors: ['A. One', 'B. Two'],
      abstract: 'This paper surveys classic and embedding-based similarity measures.',
    });

    renderAbstract();

    expect(
      await screen.findByRole('heading', { name: 'A survey of string similarity' }),
    ).toBeInTheDocument();
    expect(screen.getByText('doc-01')).toBeInTheDocument();
    expect(screen.getByText('A. One, B. Two')).toBeInTheDocument();
    expect(
      screen.getByText('This paper surveys classic and embedding-based similarity measures.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('shows a loading status before the document resolves', () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockReturnValue(new Promise(() => {}));

    renderAbstract();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an alert when the document fails to load', async () => {
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockRejectedValue({
      kind: 'network',
      cause: 'timeout',
      i18nKey: 'errors.network.coldStart',
    });

    renderAbstract();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('calls onClose when the close button is activated', async () => {
    const user = userEvent.setup();
    vi.spyOn(corpusApi, 'fetchCorpusDocument').mockReturnValue(new Promise(() => {}));

    const { onClose } = renderAbstract();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
