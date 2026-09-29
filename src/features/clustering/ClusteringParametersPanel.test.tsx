import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiError } from '../../infrastructure/apiError';
import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import {
  ClusteringParametersPanel,
  type ClusteringParametersPanelProps,
  type CutColumnState,
} from './ClusteringParametersPanel';

const ALL_FOUR: readonly LinkageId[] = ['single', 'complete', 'average', 'ward'];

const LINKAGES = [
  { id: 'single' as const, displayName: 'Single' },
  { id: 'complete' as const, displayName: 'Complete' },
  { id: 'average' as const, displayName: 'Average' },
  { id: 'ward' as const, displayName: 'Ward' },
];

function readyCut(overrides: Partial<Extract<CutColumnState, { status: 'ready' }>> = {}) {
  return {
    status: 'ready' as const,
    linkages: LINKAGES,
    n: 6,
    kRef: 4,
    linkage: 'single' as LinkageId,
    onLinkageChange: vi.fn(),
    k: 3,
    onKChange: vi.fn(),
    onApply: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<ClusteringParametersPanelProps> = {}) {
  const props: ClusteringParametersPanelProps = {
    representation: 'tfidf-cosine' as RepresentationId,
    onRepresentationChange: vi.fn(),
    selectedLinkages: ALL_FOUR,
    onToggleLinkage: vi.fn(),
    onSelectAllLinkages: vi.fn(),
    cut: readyCut(),
    onClearCut: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ClusteringParametersPanel {...props} />) };
}

describe('ClusteringParametersPanel', () => {
  it('is one card with three numbered columns, each titled after its control', () => {
    renderPanel();

    const card = screen.getByRole('region', { name: 'Parámetros del agrupamiento' });
    for (const [step, title] of [
      ['01', 'Representación'],
      ['02', 'Selección de enlaces'],
      ['03', 'Corte libre'],
    ] as const) {
      expect(within(card).getByRole('heading', { name: title, level: 3 })).toBeInTheDocument();
      expect(within(card).getByText(step)).toBeInTheDocument();
    }
    expect(within(card).getByRole('radiogroup', { name: 'Representación' })).toBeInTheDocument();
    expect(within(card).getByRole('group', { name: 'Selección de enlaces' })).toBeInTheDocument();
    expect(within(card).getByRole('radiogroup', { name: 'Enlace a cortar' })).toBeInTheDocument();
  });

  it('states the distance basis as the representation hint', () => {
    renderPanel();

    expect(screen.getByText('D = 1 − coseno; Ward opera sobre 2·D.')).toBeInTheDocument();
  });

  it('reports a representation change', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('radio', { name: 'embedding-local' }));

    expect(props.onRepresentationChange).toHaveBeenCalledWith('embedding-local');
  });

  describe('linkage selection', () => {
    it('counts the selected linkages out of four and offers no "Todos" while all are selected', () => {
      renderPanel();

      expect(screen.getByText('4 / 4')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
      expect(
        screen.getByText(
          'Se comparan los cuatro enlaces: se marcan los líderes de árbol y de partición.',
        ),
      ).toBeInTheDocument();
    });

    it('offers a quiet "Todos" action and the leaders hint while fewer than four are selected', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel({ selectedLinkages: ['single', 'ward'] });

      expect(screen.getByText('2 / 4')).toBeInTheDocument();
      expect(
        screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Todos' }));
      expect(props.onSelectAllLinkages).toHaveBeenCalledOnce();
    });

    it('says a linkage is needed when none is selected, and still offers "Todos"', () => {
      renderPanel({ selectedLinkages: [], cut: { status: 'unavailable', reason: 'no-linkage' } });

      const header = screen.getByRole('heading', { name: 'Selección de enlaces' }).parentElement
        ?.parentElement as HTMLElement;
      expect(within(header).getByText('0 / 4')).toBeInTheDocument();
      expect(screen.getByText('Selecciona al menos un enlace para agrupar.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
    });

    it('reports a toggled linkage', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'ward' }));

      expect(props.onToggleLinkage).toHaveBeenCalledWith('ward');
    });
  });

  describe('free cut column', () => {
    it('offers the linkages to cut as a small radiogroup, with the current one checked', () => {
      renderPanel({ cut: readyCut({ linkage: 'complete' }) });

      const group = screen.getByRole('radiogroup', { name: 'Enlace a cortar' });
      expect(within(group).getByRole('radio', { name: 'Complete' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('reports the chosen linkage to cut', async () => {
      const user = userEvent.setup();
      const onLinkageChange = vi.fn();
      renderPanel({ cut: readyCut({ onLinkageChange }) });

      await user.click(screen.getByRole('radio', { name: 'Ward' }));

      expect(onLinkageChange).toHaveBeenCalledWith('ward');
    });

    it('labels the k stepper with its range, bounded by n - 1', () => {
      renderPanel();

      const field = screen.getByLabelText('k: entre 2 y 5');
      expect(field).toHaveValue(3);
      expect(screen.getByRole('button', { name: 'Disminuir k' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Aumentar k' })).toBeEnabled();
    });

    it('reports k edits from the stepper buttons and from typing', async () => {
      const user = userEvent.setup();
      const onKChange = vi.fn();
      renderPanel({ cut: readyCut({ onKChange }) });

      await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
      expect(onKChange).toHaveBeenLastCalledWith(4);

      await user.type(screen.getByLabelText('k: entre 2 y 5'), '1');
      expect(onKChange).toHaveBeenLastCalledWith(31);
    });

    it('shows the range error only while k is invalid, and disables "Aplicar corte"', () => {
      renderPanel({ cut: readyCut({ k: 9 }) });

      expect(screen.getByLabelText('k: entre 2 y 5')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('k debe ser un entero entre 2 y 5.');
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();
    });

    it('applies the cut from the button and from Enter inside the k field', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderPanel({ cut: readyCut({ onApply }) });

      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));
      expect(onApply).toHaveBeenCalledTimes(1);

      await user.type(screen.getByLabelText('k: entre 2 y 5'), '{Enter}');
      expect(onApply).toHaveBeenCalledTimes(2);
    });

    it('does not apply an invalid k on Enter', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderPanel({ cut: readyCut({ k: 9, onApply }) });

      await user.type(screen.getByLabelText('k: entre 2 y 5'), '{Enter}');

      expect(onApply).not.toHaveBeenCalled();
    });

    it('disables the button and shows the pending label while the cut is in flight', () => {
      renderPanel({ cut: readyCut({ isPending: true }) });

      expect(screen.getByRole('button', { name: 'Aplicando el corte…' })).toBeDisabled();
    });

    it('shows the mapped API error as an Alert inside the column', () => {
      const error: ApiError = {
        kind: 'problem',
        status: 400,
        type: 'urn:legajo:problem:invalid-cut',
        title: 'Invalid cut',
        i18nKey: 'errors.invalidCut',
      };
      renderPanel({ cut: readyCut({ error }) });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('No se pudo aplicar el corte');
    });

    it('explains there is no valid k for a corpus of fewer than three documents', () => {
      renderPanel({ cut: readyCut({ n: 2, kRef: 1 }) });

      expect(
        screen.getByText('No hay una cantidad de clústeres válida para cortar este corpus.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();
    });

    it('offers the range slider aria-hidden and unfocusable', () => {
      const { container } = renderPanel();

      const slider = container.querySelector('input[type="range"]');
      expect(slider).toHaveAttribute('aria-hidden', 'true');
      expect(slider).toHaveAttribute('tabindex', '-1');
    });

    it('marks the controls "aplicado" and disables the button once they match the applied cut', () => {
      renderPanel({
        cut: readyCut({ linkage: 'complete', k: 3 }),
        appliedCut: { linkageId: 'complete', k: 3 },
      });

      expect(screen.getByText('aplicado')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();
    });

    it('re-enables the button when k or the linkage differ from the applied cut', () => {
      renderPanel({
        cut: readyCut({ linkage: 'complete', k: 4 }),
        appliedCut: { linkageId: 'complete', k: 3 },
      });

      expect(screen.queryByText('aplicado')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeEnabled();
    });

    it('explains why there is nothing to cut when no linkage is selected', () => {
      renderPanel({ selectedLinkages: [], cut: { status: 'unavailable', reason: 'no-linkage' } });

      expect(screen.getByText('Sin enlaces para cortar')).toBeInTheDocument();
      expect(
        screen.getByText('El corte no está disponible porque no hay ningún enlace seleccionado.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aplicar corte' })).not.toBeInTheDocument();
    });

    it('names the failure as the reason when the clustering request failed', () => {
      renderPanel({ cut: { status: 'unavailable', reason: 'error' } });

      expect(screen.getByText('Corte no disponible')).toBeInTheDocument();
      expect(
        screen.getByText('El corte no está disponible porque el agrupamiento falló.'),
      ).toBeInTheDocument();
    });

    it('reserves the column with skeleton blocks while the clustering loads, holding nothing focusable', () => {
      renderPanel({ cut: { status: 'pending', sampleSizeEstimate: 20 } });

      const label = screen.getByText('Enlace a cortar');
      expect(label).toBeInTheDocument();
      expect(screen.getByText('k: entre 2 y 19')).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup', { name: 'Enlace a cortar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aplicar corte' })).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  describe('status footer', () => {
    it('lists n and k_ref as two separate items', () => {
      renderPanel();

      const footer = screen.getByTestId('params-status-footer');
      expect(within(footer).getByText('n = 6')).toBeInTheDocument();
      expect(within(footer).getByText('k_ref = 4')).toBeInTheDocument();
      expect(footer).not.toHaveTextContent('·');
    });

    it('says no cut is applied when there is none', () => {
      renderPanel();

      expect(screen.getByText('Sin corte aplicado')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Quitar corte' })).not.toBeInTheDocument();
    });

    it('names the applied cut and lets the user clear it', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel({ appliedCut: { linkageId: 'ward', k: 3 } });

      const footer = screen.getByTestId('params-status-footer');
      expect(footer).toHaveTextContent('Corte en ward, k = 3');
      expect(within(footer).queryByText('Sin corte aplicado')).not.toBeInTheDocument();

      await user.click(within(footer).getByRole('button', { name: 'Quitar corte' }));
      expect(props.onClearCut).toHaveBeenCalledOnce();
    });

    it('omits n and k_ref while nothing is known about the corpus', () => {
      renderPanel({ cut: { status: 'unavailable', reason: 'error' } });

      const footer = screen.getByTestId('params-status-footer');
      expect(footer).not.toHaveTextContent('n =');
      expect(footer).toHaveTextContent('Sin corte aplicado');
    });
  });

  it('stays controlled by its owner: the stepper shows whatever k the owner holds', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [k, setK] = useState(2);
      return (
        <ClusteringParametersPanel
          representation="tfidf-cosine"
          onRepresentationChange={() => {}}
          selectedLinkages={ALL_FOUR}
          onToggleLinkage={() => {}}
          onSelectAllLinkages={() => {}}
          cut={readyCut({ k, onKChange: setK })}
          onClearCut={() => {}}
        />
      );
    }
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
    expect(screen.getByLabelText('k: entre 2 y 5')).toHaveValue(3);
  });
});
