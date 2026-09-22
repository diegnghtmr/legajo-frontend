import { useTranslation } from 'react-i18next';

import { PanelHeader } from '../../shared/components/Panel';

/** Placeholder route for the clustering screen (built in W8+). */
export function ClusteringPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader eyebrow={t('clustering.eyebrow')} title={t('clustering.title')} />
      <p className="text-body text-ink-secondary">{t('clustering.comingSoon')}</p>
    </div>
  );
}
