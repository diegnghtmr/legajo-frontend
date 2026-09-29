import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ApiError } from '../../infrastructure/apiError';
import { QueryErrorAlert } from './QueryErrorAlert';

const PROBLEM: ApiError = {
  kind: 'problem',
  status: 503,
  title: 'Service Unavailable',
  detail: 'The benchmark report is being regenerated.',
  i18nKey: 'errors.serviceUnavailable',
};

describe('QueryErrorAlert', () => {
  it('shows the problem detail as the reason when the response carries one', () => {
    render(
      <QueryErrorAlert
        title="Failed"
        error={PROBLEM}
        endpoint="GET /benchmarks"
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Failed')).toBeInTheDocument();
    expect(
      within(alert).getByText('The benchmark report is being regenerated.'),
    ).toBeInTheDocument();
  });

  it('falls back to the mapped message when there is no detail', () => {
    render(
      <QueryErrorAlert
        title="Failed"
        error={{ ...PROBLEM, detail: undefined }}
        endpoint="GET /benchmarks"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('El servicio no está disponible');
  });

  it('carries the endpoint and the HTTP status in the mono footer line', () => {
    render(
      <QueryErrorAlert
        title="Failed"
        error={PROBLEM}
        endpoint="GET /benchmarks"
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('GET /benchmarks')).toBeInTheDocument();
    expect(within(alert).getByText('HTTP 503')).toBeInTheDocument();
  });

  it('omits the status when the request never got a response', () => {
    render(
      <QueryErrorAlert
        title="Failed"
        error={{ kind: 'network', cause: 'timeout', i18nKey: 'errors.network.coldStart' }}
        endpoint="GET /benchmarks"
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('GET /benchmarks')).toBeInTheDocument();
    expect(within(alert).queryByText(/^HTTP /)).toBeNull();
    expect(alert).toHaveTextContent('No se pudo contactar al servidor');
  });

  it('retries through the secondary action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <QueryErrorAlert
        title="Failed"
        error={PROBLEM}
        endpoint="GET /benchmarks"
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
