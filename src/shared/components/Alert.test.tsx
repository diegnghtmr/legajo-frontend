import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, type AlertTone } from './Alert';

const TONES: ReadonlyArray<{
  tone: AlertTone;
  role: 'alert' | 'status';
  tile: string[];
  icon: string;
}> = [
  { tone: 'danger', role: 'alert', tile: ['bg-danger-soft', 'text-danger'], icon: 'circle-x' },
  {
    tone: 'warning',
    role: 'alert',
    tile: ['bg-warning-soft', 'text-warning'],
    icon: 'triangle-alert',
  },
  { tone: 'info', role: 'status', tile: ['bg-paper-sunken', 'text-ink'], icon: 'info' },
  { tone: 'success', role: 'status', tile: ['bg-success-soft', 'text-success'], icon: 'check' },
  { tone: 'offline', role: 'status', tile: ['bg-paper-sunken', 'text-ink'], icon: 'wifi-off' },
];

describe('Alert', () => {
  it.each(TONES)('$tone announces itself as role=$role', ({ tone, role }) => {
    render(<Alert tone={tone} title="No se pudo cargar" />);

    expect(screen.getByRole(role)).toHaveTextContent('No se pudo cargar');
  });

  it.each(TONES)(
    '$tone tints only its 32px icon tile, with a decorative $icon icon',
    ({ tone, tile, icon }) => {
      const { container } = render(<Alert tone={tone} title="Title" />);

      const tileElement = container.querySelector('[data-slot="alert-tile"]');
      expect(tileElement).not.toBeNull();
      for (const token of tile) {
        expect(tileElement?.className).toContain(token);
      }
      expect(tileElement?.className).toContain('size-8');
      expect(tileElement?.className).toContain('rounded-btn');
      const svg = tileElement?.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg?.getAttribute('class')).toContain(`lucide-${icon}`);
      // The tone lives in the tile, never in the card fill or border.
      const root = container.firstElementChild;
      expect(root?.className).toContain('bg-paper-raised');
      expect(root?.className).not.toMatch(/(bg|border|text)-(danger|warning|success)/);
    },
  );

  it('renders the title and, when given, the body that says why', () => {
    render(
      <Alert tone="danger" title="No se pudo aplicar el corte" body="El servidor no responde." />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('No se pudo aplicar el corte').className).toContain(
      'font-semibold',
    );
    const body = within(alert).getByText('El servidor no responde.');
    expect(body.className).toContain('text-ink-secondary');
  });

  it('omits the footer entirely when there is neither meta nor an action', () => {
    const { container } = render(<Alert tone="info" title="Title" body="Body" />);

    expect(container.querySelector('[data-slot="alert-foot"]')).toBeNull();
  });

  it('shows a mono meta line and an action in a dashed footer', () => {
    const { container } = render(
      <Alert
        tone="danger"
        title="Title"
        meta={['GET /api/v1/corpus', '503']}
        action={<button type="button">Reintentar</button>}
      />,
    );

    const foot = container.querySelector('[data-slot="alert-foot"]');
    expect(foot?.className).toContain('border-dashed');
    expect(
      within(foot as HTMLElement)
        .getByText('GET /api/v1/corpus')
        .closest('p')?.className,
    ).toContain('font-mono');
    expect(within(foot as HTMLElement).getByText('503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('enters with the gated rise, so reduced motion shows it in place', () => {
    const { container } = render(<Alert tone="warning" title="Title" />);

    expect(container.firstElementChild?.className).toContain('enter-rise');
    expect(container.firstElementChild?.className).not.toMatch(/animate-/);
  });

  it('forwards a caller className and other div props', () => {
    render(<Alert tone="danger" title="Title" className="mt-4" data-testid="region-alert" />);

    expect(screen.getByTestId('region-alert').className).toContain('mt-4');
  });
});
