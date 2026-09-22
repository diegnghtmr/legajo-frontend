import { useTranslation } from 'react-i18next';

import { PanelHeader } from '../../shared/components/Panel';

/** Placeholder route for the similarity screen (built in W5+). */
export function SimilarityPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader eyebrow={t('similarity.eyebrow')} title={t('similarity.title')} />
      <p className="text-body text-ink-secondary">{t('similarity.comingSoon')}</p>
    </div>
  );
}
