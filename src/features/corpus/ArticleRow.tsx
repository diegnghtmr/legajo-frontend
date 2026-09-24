import { Link } from 'react-router';

import { cn } from '../../shared/lib/cn';

export interface ArticleRowProps {
  id: string;
  title: string;
  authors: readonly string[];
  selected: boolean;
  onToggle: (id: string) => void;
}

/**
 * One corpus article: a native checkbox drives selection (fully accessible
 * and keyboard-operable on its own), the title
 * links to `/corpus/:id` for the full abstract. Meta (mono id, authors) is
 * stacked on its own lines, never joined by `·`.
 *
 * Colocated in `features/corpus` rather than `shared/`: today it has exactly
 * one importer (this feature's article list). The Scope Rule promotes on
 * actual second use, not anticipated reuse — when `similarity` also
 * needs to render selected articles, move it to `shared/components/` then.
 */
export function ArticleRow({ id, title, authors, selected, onToggle }: ArticleRowProps) {
  return (
    <li className={cn('rounded-md p-3', selected && 'ring-[1.5px] ring-inset ring-ink')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(id)}
          aria-label={title}
          className="mt-1 h-4 w-4 accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <div className="flex flex-col gap-1">
          <Link
            to={`/corpus/${encodeURIComponent(id)}`}
            className="text-body font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {title}
          </Link>
          <p className="font-mono text-mono text-ink-muted">{id}</p>
          <p className="text-label text-ink-muted">{authors.join(', ')}</p>
        </div>
      </div>
    </li>
  );
}
