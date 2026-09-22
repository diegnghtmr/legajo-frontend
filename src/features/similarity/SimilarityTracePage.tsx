import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { PanelHeader } from '../../shared/components/Panel';

/**
 * Placeholder route for one capability's audit trace (`/similarity/:algorithmId/trace`,
 * DESIGN.md §6.2 items 2–3). W5 only links each compare row to it; the DP
 * matrix, TF-IDF, Jaccard and embedding trace panels are built in W6.
 */
export function SimilarityTracePage() {
  const { t } = useTranslation();
  const { algorithmId } = useParams<{ algorithmId: string }>();

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        eyebrow={t('similarity.trace.eyebrow')}
        title={t('similarity.trace.title', { id: algorithmId ?? '' })}
      />
      <p className="text-body text-ink-secondary">{t('similarity.trace.comingSoon')}</p>
    </div>
  );
}
