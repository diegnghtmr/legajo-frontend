import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkbenchLayout } from './WorkbenchLayout';

describe('WorkbenchLayout', () => {
  it('always renders the main content region', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    expect(screen.getByText('main content')).toBeInTheDocument();
  });

  it('omits the rail column entirely when no rail is given', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    expect(screen.queryByText('rail content')).not.toBeInTheDocument();
  });

  it('renders the rail region, hidden below the lg breakpoint and 320px docked at and above it', () => {
    render(<WorkbenchLayout rail={<p>rail content</p>}>{<p>main content</p>}</WorkbenchLayout>);

    const rail = screen.getByText('rail content').parentElement as HTMLElement;
    expect(rail.className).toContain('hidden');
    expect(rail.className).toContain('lg:block');
    expect(rail.className).toContain('lg:w-[320px]');
  });

  it('omits the detail column entirely when no detail is given', () => {
    render(<WorkbenchLayout>{<p>main content</p>}</WorkbenchLayout>);

    expect(screen.queryByText('detail content')).not.toBeInTheDocument();
  });

  it('renders the detail region docked at 460px from xl, overlaid from lg', () => {
    render(<WorkbenchLayout detail={<p>detail content</p>}>{<p>main content</p>}</WorkbenchLayout>);

    const detail = screen.getByText('detail content').parentElement as HTMLElement;
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
