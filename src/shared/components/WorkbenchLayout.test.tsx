import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkbenchLayout } from './WorkbenchLayout';

/** True when `className` contains `token` as its own whitespace-delimited
 * word — not merely as a substring (`toContain('flex')` would also match
 * `flex-col`, `lg:flex`, or `flex-1`, so it can never fail even for the
 * wrong display value). */
function hasClassToken(element: HTMLElement, token: string): boolean {
  return element.className.split(/\s+/).includes(token);
}

describe('WorkbenchLayout', () => {
  it('always renders the main content region', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    expect(screen.getByText('main content')).toBeInTheDocument();
  });

  it('omits the rail wrapper element entirely when no rail is given', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    // Passing no `rail` prop trivially has no "rail content" text either
    // way — that alone never proves the wrapper `<div>` itself is
    // conditionally omitted (a mutation that always renders an empty
    // wrapper would still pass a text-only assertion). Querying the
    // wrapper's own stable test id is what actually exercises the `rail &&`
    // guard.
    expect(screen.queryByTestId('workbench-rail')).not.toBeInTheDocument();
  });

  it('renders the rail region stacked (never hidden) below the lg breakpoint, and 320px docked with its own scroll at and above it', () => {
    render(<WorkbenchLayout rail={<p>rail content</p>}>{<p>main content</p>}</WorkbenchLayout>);

    const rail = screen.getByTestId('workbench-rail');
    expect(screen.getByText('rail content')).toBeInTheDocument();
    // Below `lg` there is no persistent side rail, but its content still
    // stacks above the results in normal flow — it must never be `hidden`.
    expect(hasClassToken(rail, 'hidden')).toBe(false);
    expect(rail.className).toContain('lg:w-[320px]');
    expect(rail.className).toContain('lg:h-full');
    expect(rail.className).toContain('lg:overflow-y-auto');
  });

  it('omits the detail wrapper element entirely when no detail is given', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    expect(screen.queryByTestId('workbench-detail')).not.toBeInTheDocument();
  });

  it('hides the detail region below the lg breakpoint (no persistent side panel there), and docks it at 460px from xl, overlaid from lg', () => {
    render(<WorkbenchLayout detail={<p>detail content</p>}>{<p>main content</p>}</WorkbenchLayout>);

    const detail = screen.getByTestId('workbench-detail');
    // Below `lg` there is no side panel at all here — a consumer shows its
    // detail content inline or as a sheet instead of through this slot.
    expect(hasClassToken(detail, 'hidden')).toBe(true);
    expect(detail.className).toContain('lg:block');
    expect(detail.className).toContain('lg:absolute');
    expect(detail.className).toContain('xl:static');
    expect(detail.className).toContain('xl:w-[460px]');
  });

  it('renders all three regions together', () => {
    render(
      <WorkbenchLayout rail={<p>rail content</p>} detail={<p>detail content</p>}>
        {<p>main content</p>}
      </WorkbenchLayout>,
    );

    expect(screen.getByText('rail content')).toBeInTheDocument();
    expect(screen.getByText('main content')).toBeInTheDocument();
    expect(screen.getByText('detail content')).toBeInTheDocument();
  });
});
