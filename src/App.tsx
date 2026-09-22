import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlgoTextList } from './shared/components/AlgoTextList';
import { FamilyStatus } from './shared/components/FamilyStatus';
import { MetricTile } from './shared/components/MetricTile';
import { Panel, PanelHeader } from './shared/components/Panel';
import { ScoreBar } from './shared/components/ScoreBar';
import { SegmentedControl } from './shared/components/SegmentedControl';

type FamilyFilter = 'all' | 'classic' | 'ai';

// Algorithm ids are never translated (DESIGN.md §4, workspace AGENTS.md).
const ALGO_OPTIONS = [
  { id: 'levenshtein', family: 'classic' as const },
  { id: 'needleman-wunsch', family: 'classic' as const },
  { id: 'jaccard', family: 'classic' as const },
  { id: 'cosine-tfidf', family: 'classic' as const },
  { id: 'embedding-local', family: 'ai' as const },
  { id: 'embedding-api', family: 'ai' as const },
];

/**
 * Temporary design-system showcase (W2) so the Playwright + axe e2e suite
 * exercises the shared primitives end to end. It renders through the real
 * app shell and is replaced once the corpus/similarity/clustering features
 * (W4+) compose these components with live data.
 */
function DesignSystemShowcase() {
  const { t } = useTranslation();
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [selectedAlgoIds, setSelectedAlgoIds] = useState<readonly string[]>(['levenshtein']);

  const familyOptions = [
    { value: 'all' as FamilyFilter, label: t('showcase.family.all') },
    { value: 'classic' as FamilyFilter, label: t('showcase.family.classic') },
    { value: 'ai' as FamilyFilter, label: t('showcase.family.ai') },
  ];

  const toggleAlgo = (id: string) => {
    setSelectedAlgoIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  };

  return (
    <Panel className="flex flex-col gap-6">
      <PanelHeader
        eyebrow={t('showcase.eyebrow')}
        title={t('showcase.title')}
        subtitle={t('showcase.subtitle')}
      />

      <SegmentedControl
        options={familyOptions}
        value={family}
        onChange={setFamily}
        aria-label={t('showcase.familyFilterLabel')}
      />

      <AlgoTextList
        options={ALGO_OPTIONS}
        selectedIds={selectedAlgoIds}
        onToggle={toggleAlgo}
        aria-label={t('showcase.algorithmsLabel')}
      />

      <div className="flex flex-col gap-2">
        <FamilyStatus family="classic" label={t('showcase.family.classic')} />
        <FamilyStatus family="ai" label={t('showcase.family.ai')} />
      </div>

      <div className="flex flex-col gap-2">
        <ScoreBar value={0.842} family="classic" label={t('showcase.scores.classicLabel')} />
        <ScoreBar value={0.611} family="ai" label={t('showcase.scores.aiLabel')} />
      </div>

      <div className="flex flex-wrap gap-3">
        <MetricTile
          eyebrow={t('showcase.metrics.cophenetic')}
          label="single"
          value="0.842"
          leader
          leaderLabel={t('showcase.metrics.leaderLabel')}
        />
        <MetricTile eyebrow={t('showcase.metrics.silhouette')} label="ward" value="0.611" />
        <MetricTile eyebrow={t('showcase.metrics.daviesBouldin')} label="complete" value="0.734" />
      </div>
    </Panel>
  );
}

export function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline bg-paper-raised px-6 py-4">
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('app.eyebrow')}
        </p>
        <h1 className="text-display font-semibold tracking-tight text-ink">{t('app.title')}</h1>
      </header>
      <main className="flex flex-col gap-6 p-6">
        <p className="text-body text-ink-secondary">{t('app.description')}</p>
        <DesignSystemShowcase />
      </main>
    </div>
  );
}

export default App;
