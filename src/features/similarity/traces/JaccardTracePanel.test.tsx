import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { JaccardTracePanel } from './JaccardTracePanel';

const TRACE: JaccardTrace = {
  algorithmId: 'jaccard',
  stemming: false,
  setA: ['token-c', 'token-a', 'token-b'],
  setB: ['token-b', 'token-d', 'token-c'],
  intersectionSize: 2,
  unionSize: 4,
  intersection: ['token-b', 'token-c'],
  union: ['token-a', 'token-b', 'token-c', 'token-d'],
  coefficient: 0.5,
};

function group(name: RegExp) {
  return screen.getByRole('heading', { name }).parentElement as HTMLElement;
}

describe('JaccardTracePanel', () => {
  it('states the formula with the backend sizes and coefficient', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    expect(
      screen.getByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 2 / 4 = 0.500000', { exact: true }),
    ).toBeInTheDocument();
  });

  it('keeps the size of each set visible', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    const sizes = screen.getByTestId('jaccard-set-sizes');
    expect(sizes).toHaveTextContent('|S_A|');
    expect(sizes).toHaveTextContent('|S_B|');
    expect(within(sizes).getAllByText('3')).toHaveLength(2);
  });

  it('lists three groups in order, each with its count and its tokens sorted', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Solo en A1',
      'En ambos2',
      'Solo en B1',
    ]);

    expect(
      within(group(/^Solo en A/))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['token-a']);
    expect(
      within(group(/^En ambos/))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['token-b', 'token-c']);
    expect(
      within(group(/^Solo en B/))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['token-d']);
  });

  it('names each list by its heading, so assistive technology hears the count', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    expect(screen.getByRole('list', { name: /^En ambos/ })).toBeInTheDocument();
  });

  it('marks the shared tokens apart from the others without colour families', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    const shared = within(group(/^En ambos/)).getAllByRole('listitem')[0]!;
    const own = within(group(/^Solo en A/)).getAllByRole('listitem')[0]!;
    expect(shared.className).toContain('bg-paper-sunken');
    expect(shared.className).toContain('border-ink');
    expect(own.className).toContain('bg-paper-raised');
    expect(own.className).toContain('border-hairline');
  });

  it('shows a dash for a group with no tokens', () => {
    render(
      <JaccardTracePanel
        trace={{
          ...TRACE,
          setA: ['x'],
          setB: ['x'],
          intersection: ['x'],
          union: ['x'],
          intersectionSize: 1,
          unionSize: 1,
          coefficient: 1,
        }}
      />,
    );

    expect(within(group(/^Solo en A/)).getByText('—')).toBeInTheDocument();
    expect(within(group(/^Solo en B/)).getByText('—')).toBeInTheDocument();
    expect(within(group(/^En ambos/)).queryByText('—')).not.toBeInTheDocument();
  });

  it('shows 0 / 0 and the coefficient with its reason when both sets are empty', () => {
    render(
      <JaccardTracePanel
        trace={{
          ...TRACE,
          setA: [],
          setB: [],
          intersection: [],
          union: [],
          intersectionSize: 0,
          unionSize: 0,
          coefficient: 1,
        }}
      />,
    );

    expect(screen.getByText('|S_A ∩ S_B| / |S_A ∪ S_B| = 0 / 0 = 1')).toBeInTheDocument();
    expect(screen.getByText(/ambos conjuntos están vacíos/i)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('does not show the reason when the sets have tokens', () => {
    render(<JaccardTracePanel trace={TRACE} />);

    expect(screen.queryByText(/ambos conjuntos están vacíos/i)).not.toBeInTheDocument();
  });
});
