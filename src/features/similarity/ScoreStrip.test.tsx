import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type {
  CompareResponse,
  ListSimilarityAlgorithmsResponse,
} from '../../infrastructure/api/similarity';
import es from '../../infrastructure/i18n/locales/es.json';
import { restoreTraceTrigger } from './traceFocusReturn';
import { collisionOffsets, ScoreStrip, ScoreStripSkeleton } from './ScoreStrip';

const CATALOGUE = new Map<string, ListSimilarityAlgorithmsResponse[number]>([
  ['levenshtein', { id: 'levenshtein', displayName: 'Levenshtein distance', kind: 'CLASSIC' }],
  ['embedding-api', { id: 'embedding-api', displayName: 'Live embedding API', kind: 'AI' }],
]);

function row(algorithmId: string, normalizedScore: number): CompareResponse[number] {
  return {
    algorithmId,
    result: {
      normalizedScore,
      rawValue: 1,
      computedNanos: 10,
      cached: false,
      degenerate: false,
    },
  } as CompareResponse[number];
}

const ROWS: CompareResponse = [row('levenshtein', 0.25), row('embedding-api', 0.9)];

function renderStrip(overrides: Partial<Parameters<typeof ScoreStrip>[0]> = {}) {
  const onOpenTrace = vi.fn();
  const view = render(
    <ScoreStrip
      rows={ROWS}
      catalogueById={CATALOGUE}
      onOpenTrace={onOpenTrace}
      openAlgorithmId={null}
      interactive
      {...overrides}
    />,
  );
  return { onOpenTrace, ...view };
}

describe('ScoreStrip', () => {
  it('is hidden from assistive technology, since the table rows carry every score', () => {
    const { container } = renderStrip();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the eyebrow and a legend with both family labels', () => {
    renderStrip();
    expect(screen.getByText(es.similarity.scoreStrip.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(es.similarity.family.classic)).toBeInTheDocument();
    expect(screen.getByText(es.similarity.family.ai)).toBeInTheDocument();
  });

  it('labels the 0 to 1 axis with five ticks', () => {
    renderStrip();
    for (const tick of ['0.00', '0.25', '0.50', '0.75', '1.00']) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
  });

  it('places one dot per result at its normalized score, titled with id and score', () => {
    renderStrip();
    const classic = screen.getByTitle('levenshtein: 0.250');
    const ai = screen.getByTitle('embedding-api: 0.900');
    expect(classic.style.left).toBe('25%');
    expect(ai.style.left).toBe('90%');
    expect(within(classic).getByText('levenshtein')).toHaveClass('sr-only');
  });

  it('fills each dot with its family colour', () => {
    renderStrip();
    expect(screen.getByTitle('levenshtein: 0.250').querySelector('[data-dot]')).toHaveClass(
      'bg-classic',
    );
    expect(screen.getByTitle('embedding-api: 0.900').querySelector('[data-dot]')).toHaveClass(
      'bg-ai',
    );
  });

  it('rings the open result in ink and enlarges it', () => {
    renderStrip({ openAlgorithmId: 'embedding-api' });
    expect(screen.getByTitle('embedding-api: 0.900').querySelector('[data-dot]')).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(screen.getByTitle('levenshtein: 0.250').querySelector('[data-dot]')).not.toHaveAttribute(
      'data-open',
    );
  });

  it('opens that row trace when a dot is clicked, remembering the row as the focus target', async () => {
    const user = userEvent.setup();
    const { onOpenTrace } = renderStrip();
    const trigger = document.createElement('button');
    trigger.setAttribute('data-algorithm-trigger', 'embedding-api');
    document.body.append(trigger);

    await user.click(screen.getByTitle('embedding-api: 0.900'));

    expect(onOpenTrace).toHaveBeenCalledExactlyOnceWith('embedding-api');
    restoreTraceTrigger();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('keeps dots out of the tab order', () => {
    renderStrip();
    for (const dot of screen.getAllByTitle(/: \d\.\d{3}$/)) {
      expect(dot).toHaveAttribute('tabindex', '-1');
    }
  });

  it('gives every dot a hit area of at least 24 by 24 pixels', () => {
    renderStrip();
    expect(screen.getByTitle('levenshtein: 0.250')).toHaveClass('size-6');
  });

  it('is visual only when not interactive: no buttons at all', () => {
    renderStrip({ interactive: false });
    expect(screen.queryAllByRole('button', { hidden: true })).toHaveLength(0);
    expect(screen.getByTitle('levenshtein: 0.250')).toBeInTheDocument();
  });

  it('shows exactly the rows it is given', () => {
    renderStrip({ rows: [ROWS[0]] });
    expect(screen.queryByTitle('embedding-api: 0.900')).not.toBeInTheDocument();
  });
});

describe('ScoreStripSkeleton', () => {
  it('keeps the header and axis and draws one inert dot per selected algorithm', () => {
    const { container } = render(<ScoreStripSkeleton count={3} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(es.similarity.scoreStrip.eyebrow)).toBeInTheDocument();
    expect(screen.getByText('0.50')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-skeleton-dot]')).toHaveLength(3);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('collisionOffsets', () => {
  it('leaves well-separated scores on the axis line', () => {
    expect(collisionOffsets([0.1, 0.5, 0.9])).toEqual([0, 0, 0]);
  });

  it('lifts a dot that would sit on a close lower neighbour, whatever the input order', () => {
    expect(collisionOffsets([0.071, 0.057, 0.9])).toEqual([-8, 0, 0]);
  });

  it('reuses the line once the neighbours are far enough behind', () => {
    expect(collisionOffsets([0.05, 0.06, 0.07, 0.5])).toEqual([0, -8, 0, 0]);
  });
});

describe('ScoreStrip collisions', () => {
  it('keeps every dot at its exact score, moving only close ones vertically', () => {
    renderStrip({ rows: [row('levenshtein', 0.057), row('embedding-api', 0.071)] });

    const first = screen.getByTitle('levenshtein: 0.057');
    const second = screen.getByTitle('embedding-api: 0.071');
    expect(first.style.left).toBe('5.7%');
    expect(second.style.left).toBe('7.1%');
    expect(first.style.marginTop).toBe('0px');
    expect(second.style.marginTop).toBe('-8px');
  });
});
