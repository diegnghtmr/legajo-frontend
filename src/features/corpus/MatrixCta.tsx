import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useSelectionStore } from './selectionStore';

/**
 * Secondary CTA for the ≥3-selected similarity matrix,
 * alongside the primary `CompareCta` (≥2). A second, less prominent
 * button rather than a mode switch: the corpus screen's one sticky primary CTA slot is already fixed for "Comparar" and defines
 * no mode-switch control there, so adding a quieter secondary button (the
 * same outline style as `DpMatrix`'s CSV download button) keeps both
 * actions independently reachable without redesigning that screen or
 * changing what its documented primary CTA does.
 */
export function MatrixCta() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedCount = useSelectionStore((state) => state.selectedIds.length);
  const canMatrix = useSelectionStore((state) => state.canMatrix);

  const reasonKey =
    selectedCount === 0
      ? 'corpus.selection.matrixReasonNone'
      : selectedCount === 1
        ? 'corpus.selection.matrixReasonOne'
        : selectedCount === 2
          ? 'corpus.selection.matrixReasonTwo'
          : undefined;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canMatrix}
        onClick={() => void navigate('/similarity/matrix')}
        className="w-fit rounded-btn border border-hairline-strong bg-paper-raised px-4 py-2 text-body font-semibold text-ink hover:bg-paper-sunken disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('corpus.selection.matrixCta')}
      </button>
      {reasonKey && <p className="text-label text-ink-muted">{t(reasonKey)}</p>}
    </div>
  );
}
