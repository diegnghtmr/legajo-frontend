import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button } from '../../shared/components/ui/button';
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
      <Button disabled={!canCompare} onClick={() => void navigate('/similarity')}>
        {t('corpus.selection.compareCta')}
      </Button>
      {reasonKey && <p className="text-label text-ink-muted">{t(reasonKey)}</p>}
    </div>
  );
}
