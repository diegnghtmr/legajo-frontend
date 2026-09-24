import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useSelectionStore } from './selectionStore';

/**
 * Sticky primary CTA: disabled until ≥2 articles are
 * selected, with the disabled reason shown as text right under the button
 * ("Disabled: opacity ~0.45 + reason text nearby").
 */
export function CompareCta() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedCount = useSelectionStore((state) => state.selectedIds.length);
  const canCompare = useSelectionStore((state) => state.canCompare);

  const reasonKey =
    selectedCount === 0
      ? 'corpus.selection.reasonNone'
      : selectedCount === 1
        ? 'corpus.selection.reasonOne'
        : undefined;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canCompare}
        onClick={() => void navigate('/similarity')}
        className="rounded-btn bg-ink px-4 py-2 text-body font-semibold text-primary-foreground disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('corpus.selection.compareCta')}
      </button>
      {reasonKey && <p className="text-label text-ink-muted">{t(reasonKey)}</p>}
    </div>
  );
}
