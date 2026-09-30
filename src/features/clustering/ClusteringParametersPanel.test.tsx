import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { stubMatchMedia } from '../../test/matchMedia';
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
    cut: readyCut(),
    onClearCut: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ClusteringParametersPanel {...props} />) };
}

describe('ClusteringParametersPanel', () => {
  it('stacks the representation options below 640px and keeps them in a row from 640px', () => {
    const narrow = stubMatchMedia(false);
    const { unmount } = renderPanel();
    expect(screen.getByRole('radiogroup', { name: 'Representación' })).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
    unmount();
    narrow.fireChange(true);
    vi.unstubAllGlobals();

    renderPanel();
    expect(screen.getByRole('radiogroup', { name: 'Representación' })).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
  });

  it('lays the representation and linkage columns in two equal tracks from 1024px, split by a hairline rule', () => {
    renderPanel();

    const grid = screen.getByTestId('params-columns');
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'min-[1024px]:grid-cols-2');
    const columns = ['Representación', 'Enlaces'].map((name) =>
      screen.getByRole('heading', { name, level: 3 }).closest('.min-w-0'),
    );
    for (const [index, column] of columns.entries()) {
      expect(column).toHaveClass('min-w-0', 'px-5', 'pt-4', 'pb-[18px]', 'border-hairline');
      if (index === 0) {
        expect(column).not.toHaveClass('border-t');
      } else {
        expect(column).toHaveClass(
          'not-first:border-t',
          'min-[1024px]:not-first:border-t-0',
          'min-[1024px]:not-first:border-l',
        );
      }
    }
  });

  it('puts the free cut in a full-width sunken band under the columns, not inside them', () => {
    renderPanel();

    const band = screen.getByTestId('params-cut-band');
    expect(band).toHaveClass('bg-paper-sunken', 'border-t', 'border-hairline');
    expect(screen.getByTestId('params-columns')).not.toContainElement(band);
    expect(
      within(band).getByRole('heading', { name: 'Corte libre', level: 3 }),
    ).toBeInTheDocument();
    expect(within(band).getByText('03')).toBeInTheDocument();
    expect(within(band).getByRole('radiogroup', { name: 'Enlace a cortar' })).toBeInTheDocument();
    expect(within(band).getByRole('button', { name: 'Aplicar corte' })).toBeInTheDocument();
    expect(screen.queryByTestId('params-status-footer')).not.toBeInTheDocument();
  });

  it('is one card with two numbered columns and the numbered cut band, each titled after its control', () => {
    renderPanel();

    const card = screen.getByRole('region', { name: 'Parámetros del agrupamiento' });
    for (const [step, title] of [
      ['01', 'Representación'],
      ['02', 'Enlaces'],
      ['03', 'Corte libre'],
    ] as const) {
      expect(within(card).getByRole('heading', { name: title, level: 3 })).toBeInTheDocument();
      expect(within(card).getByText(step)).toBeInTheDocument();
    }
    expect(within(card).getByRole('radiogroup', { name: 'Representación' })).toBeInTheDocument();
    expect(within(card).getByRole('group', { name: 'Selección de enlaces' })).toBeInTheDocument();
    expect(within(card).getByRole('radiogroup', { name: 'Enlace a cortar' })).toBeInTheDocument();
  });

  it('stretches the representation options over the whole column when they sit in a row', () => {
    renderPanel();

    expect(screen.getByRole('radiogroup', { name: 'Representación' })).toHaveClass('w-full');
    expect(screen.getByRole('radio', { name: 'tfidf-cosine' })).toHaveClass('flex-1');
  });

  it('shows the loaded corpus size as the representation aside, and an ellipsis while it is unknown', () => {
    const { unmount } = renderPanel();
    const header = () =>
      screen.getByRole('heading', { name: 'Representación', level: 3 }).parentElement
        ?.parentElement as HTMLElement;
    expect(within(header()).getByText('n = 6')).toBeInTheDocument();
    unmount();

    const pending = renderPanel({ cut: { status: 'pending', sampleSizeEstimate: 20 } });
    expect(within(header()).getByText('n = …')).toBeInTheDocument();
    pending.unmount();

    renderPanel({ cut: { status: 'unavailable', reason: 'error' } });
    expect(within(header()).getByText('n = …')).toBeInTheDocument();
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
    it('shows four boxed toggles with the mono count and the all-linkages hint while all are selected', () => {
      renderPanel();

      const group = screen.getByRole('group', { name: 'Selección de enlaces' });
      expect(
        within(group)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['single', 'complete', 'average', 'ward']);
      for (const button of within(group).getAllByRole('button')) {
        expect(button).toHaveAttribute('aria-pressed', 'true');
      }
      expect(screen.getByText('4 / 4')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
      expect(
        screen.getByText('Se marcan los líderes de árbol y de partición.'),
      ).toBeInTheDocument();
    });

    it('presses only the selected toggles and explains when leaders appear while fewer than four are selected', () => {
      renderPanel({ selectedLinkages: ['single', 'ward'] });

      expect(screen.getByText('2 / 4')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'single' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'complete' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(
        screen.getByText('Los líderes se muestran cuando se comparan los cuatro enlaces.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
    });

    it('says a linkage is needed when none is selected', () => {
      renderPanel({ selectedLinkages: [], cut: { status: 'unavailable', reason: 'no-linkage' } });

      const header = screen.getByRole('heading', { name: 'Enlaces' }).parentElement
        ?.parentElement as HTMLElement;
      expect(within(header).getByText('0 / 4')).toBeInTheDocument();
      expect(screen.getByText('Selecciona al menos un enlace para agrupar.')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4);
    });

    it('reports a toggled linkage', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'ward' }));

      expect(props.onToggleLinkage).toHaveBeenCalledWith('ward');
    });
  });

  describe('free cut column', () => {
    it('labels the linkage group "Enlace" and offers the linkages as lowercase mono ids', () => {
      renderPanel({ cut: readyCut({ linkage: 'complete' }) });

      const band = screen.getByTestId('params-cut-band');
      expect(within(band).getByText('Enlace')).toBeInTheDocument();
      const radios = within(
        screen.getByRole('radiogroup', { name: 'Enlace a cortar' }),
      ).getAllByRole('radio');
      expect(radios.map((radio) => radio.textContent)).toEqual([
        'single',
        'complete',
        'average',
        'ward',
      ]);
      expect(within(radios[0]!).getByText('single')).toHaveClass('font-mono');
    });

    it('offers the linkages to cut as a small radiogroup, with the current one checked', () => {
      renderPanel({ cut: readyCut({ linkage: 'complete' }) });

      const group = screen.getByRole('radiogroup', { name: 'Enlace a cortar' });
      expect(within(group).getByRole('radio', { name: 'complete' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('reports the chosen linkage to cut', async () => {
      const user = userEvent.setup();
      const onLinkageChange = vi.fn();
      renderPanel({ cut: readyCut({ onLinkageChange }) });

      await user.click(screen.getByRole('radio', { name: 'ward' }));

      expect(onLinkageChange).toHaveBeenCalledWith('ward');
    });

    it('labels the k stepper with its range, bounded by n - 1', () => {
      renderPanel();

      const field = screen.getByLabelText('k: 2 a 5 (ref. 4)');
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

      await user.type(screen.getByLabelText('k: 2 a 5 (ref. 4)'), '1');
      expect(onKChange).toHaveBeenLastCalledWith(31);
    });

    it('shows the range error only while k is invalid, and disables "Aplicar corte"', () => {
      renderPanel({ cut: readyCut({ k: 9 }) });

      expect(screen.getByLabelText('k: 2 a 5 (ref. 4)')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('k debe ser un entero entre 2 y 5.');
      expect(screen.getByRole('button', { name: 'Aplicar corte' })).toBeDisabled();
    });

    it('applies the cut from the button and from Enter inside the k field', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderPanel({ cut: readyCut({ onApply }) });

      await user.click(screen.getByRole('button', { name: 'Aplicar corte' }));
      expect(onApply).toHaveBeenCalledTimes(1);

      await user.type(screen.getByLabelText('k: 2 a 5 (ref. 4)'), '{Enter}');
      expect(onApply).toHaveBeenCalledTimes(2);
    });

    it('does not apply an invalid k on Enter', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderPanel({ cut: readyCut({ k: 9, onApply }) });

      await user.type(screen.getByLabelText('k: 2 a 5 (ref. 4)'), '{Enter}');

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

      const label = screen.getByText('Enlace');
      expect(label).toBeInTheDocument();
      expect(screen.getByText('k: 2 a 19 (ref. 4)')).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup', { name: 'Enlace a cortar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aplicar corte' })).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  describe('cut status', () => {
    it('sits under "Aplicar corte", right-aligned in the band, and says no cut is applied when there is none', () => {
      renderPanel();

      const status = screen.getByTestId('cut-status');
      expect(status).toHaveTextContent('Sin corte aplicado');
      expect(screen.queryByRole('button', { name: 'Quitar corte' })).not.toBeInTheDocument();
      const action = screen.getByRole('button', { name: 'Aplicar corte' }).parentElement!;
      expect(action).toContainElement(status);
      expect(action).toHaveClass('min-[1024px]:ml-auto');
      expect(screen.getByTestId('params-cut-band')).toContainElement(action);
    });

    it('names the applied cut and lets the user clear it, with no middle dot anywhere', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel({ appliedCut: { linkageId: 'ward', k: 3 } });

      const status = screen.getByTestId('cut-status');
      expect(status).toHaveTextContent('Corte en ward, k = 3');
      expect(status).not.toHaveTextContent('Sin corte aplicado');
      expect(screen.getByTestId('params-cut-band')).not.toHaveTextContent('·');

      await user.click(within(status).getByRole('button', { name: 'Quitar corte' }));
      expect(props.onClearCut).toHaveBeenCalledOnce();
    });

    it('marks "aplicado" next to the band title and not in the status', () => {
      renderPanel({
        cut: readyCut({ linkage: 'complete', k: 3 }),
        appliedCut: { linkageId: 'complete', k: 3 },
      });

      const title = screen.getByRole('heading', { name: 'Corte libre', level: 3 });
      expect(within(title.parentElement!).getByText('aplicado')).toBeInTheDocument();
    });

    it('keeps the status and the clear button when there is no linkage to cut', () => {
      renderPanel({
        selectedLinkages: [],
        cut: { status: 'unavailable', reason: 'error' },
        appliedCut: { linkageId: 'ward', k: 3 },
      });

      expect(screen.getByTestId('cut-status')).toHaveTextContent('Corte en ward, k = 3');
    });
  });

  it('keeps the keyboard order: representation, linkage toggles, cut linkage, k, apply, clear', async () => {
    const user = userEvent.setup();
    renderPanel({ appliedCut: { linkageId: 'ward', k: 3 } });

    const names: string[] = [];
    for (let step = 0; step < 15; step += 1) {
      await user.tab();
      const focused = document.activeElement as HTMLElement;
      names.push(focused.getAttribute('aria-label') ?? focused.textContent ?? '');
      if (names.at(-1) === 'Quitar corte') break;
    }
    expect(names).toEqual([
      'tfidf-cosine',
      'single',
      'complete',
      'average',
      'ward',
      'single',
      'Disminuir k',
      '',
      'Aumentar k',
      'Aplicar corte',
      'Quitar corte',
    ]);
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
          cut={readyCut({ k, onKChange: setK })}
          onClearCut={() => {}}
        />
      );
    }
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Aumentar k' }));
    expect(screen.getByLabelText('k: 2 a 5 (ref. 4)')).toHaveValue(3);
  });
});
