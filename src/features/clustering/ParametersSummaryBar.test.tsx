import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ParametersSummaryBar } from './ParametersSummaryBar';

function renderBar(overrides: Partial<React.ComponentProps<typeof ParametersSummaryBar>> = {}) {
  const onEdit = vi.fn();
  const utils = render(
    <ParametersSummaryBar
      visible
      representation="tfidf-cosine"
      linkages={['single', 'ward']}
      onEdit={onEdit}
      {...overrides}
    />,
  );
  return { onEdit, ...utils };
}

describe('ParametersSummaryBar', () => {
  it('summarises the representation and the selected linkages when shown, as a labelled region', () => {
    renderBar();

    const bar = screen.getByRole('region', { name: 'Resumen de parámetros' });
    expect(bar).toHaveTextContent('Parámetros');
    expect(bar).toHaveTextContent('tfidf-cosine');
    expect(bar).toHaveTextContent('single, ward');
    expect(bar).not.toHaveTextContent('·');
  });

  it('names the applied cut when there is one, and omits it otherwise', () => {
    const { rerender } = renderBar();
    expect(screen.queryByText(/corte/)).not.toBeInTheDocument();

    rerender(
      <ParametersSummaryBar
        visible
        representation="tfidf-cosine"
        linkages={['single']}
        appliedCut={{ linkageId: 'ward', k: 3 }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('corte ward k = 3')).toBeInTheDocument();
  });

  it('shows a dash when no linkage is selected', () => {
    renderBar({ linkages: [] });

    expect(screen.getByRole('region', { name: 'Resumen de parámetros' })).toHaveTextContent('—');
  });

  it('exposes one focusable "Editar" button while shown, and calls onEdit', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderBar();

    const button = screen.getByRole('button', { name: 'Editar' });
    expect(button).not.toHaveAttribute('tabindex', '-1');
    await user.click(button);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('is aria-hidden and inert while hidden, and holds no control at all', () => {
    const { container } = renderBar({ visible: false });

    expect(screen.queryByRole('region', { name: 'Resumen de parámetros' })).not.toBeInTheDocument();
    const bar = container.querySelector('[data-visible]') as HTMLElement;
    expect(bar).toHaveAttribute('data-visible', 'false');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveAttribute('inert');
    // An aria-hidden subtree never contains a control, not even one taken
    // out of the tab order.
    expect(bar.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull();
  });

  it('pins under the top bar without reserving any space, with a light backdrop blur', () => {
    const { container } = renderBar();

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('sticky');
    expect(wrapper.className).toContain('top-(--shell-header-h)');
    expect(wrapper.className).toContain('h-0');
    const bar = container.querySelector('[data-visible]') as HTMLElement;
    expect(bar.className).toContain('backdrop-blur-[8px]');
    expect(bar.className).toContain('bg-paper-raised/85');
  });

  it('fades and slides only when the user has not asked for reduced motion', () => {
    const { container } = renderBar();

    const bar = container.querySelector('[data-visible]') as HTMLElement;
    expect(bar.className).toContain('motion-safe:transition');
    expect(bar.className).not.toMatch(/(^|\s)transition(\s|$)/);
  });
});
