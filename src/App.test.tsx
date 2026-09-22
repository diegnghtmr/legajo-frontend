import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the Legajo page shell with a level-one heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /legajo/i })).toBeInTheDocument();
  });

  it('renders the app shell strings from i18n, in the default (Spanish) language', () => {
    render(<App />);

    expect(screen.getByText('Banco de similitud y agrupamiento')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aquí se cargan la selección de corpus, la comparación de similitud y las vistas de agrupamiento jerárquico.',
      ),
    ).toBeInTheDocument();
  });
});
