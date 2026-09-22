import { useState } from 'react';

import { AlgoTextList } from './shared/components/AlgoTextList';
import { FamilyStatus } from './shared/components/FamilyStatus';
import { MetricTile } from './shared/components/MetricTile';
import { Panel, PanelHeader } from './shared/components/Panel';
import { ScoreBar } from './shared/components/ScoreBar';
import { SegmentedControl } from './shared/components/SegmentedControl';

type FamilyFilter = 'all' | 'classic' | 'ai';

const FAMILY_OPTIONS = [
  { value: 'all' as FamilyFilter, label: 'All' },
  { value: 'classic' as FamilyFilter, label: 'Classic' },
  { value: 'ai' as FamilyFilter, label: 'AI' },
];

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
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [selectedAlgoIds, setSelectedAlgoIds] = useState<readonly string[]>(['levenshtein']);

  const toggleAlgo = (id: string) => {
    setSelectedAlgoIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  };

  return (
    <Panel className="flex flex-col gap-6">
      <PanelHeader eyebrow="Design system" title="Shared primitives" subtitle="W2 showcase" />

      <SegmentedControl
        options={FAMILY_OPTIONS}
        value={family}
        onChange={setFamily}
        aria-label="Family filter"
      />

      <AlgoTextList
        options={ALGO_OPTIONS}
        selectedIds={selectedAlgoIds}
        onToggle={toggleAlgo}
        aria-label="Algorithms"
      />

      <div className="flex flex-col gap-2">
        <FamilyStatus family="classic" label="Classic" />
        <FamilyStatus family="ai" label="AI" />
      </div>

      <div className="flex flex-col gap-2">
        <ScoreBar value={0.842} family="classic" label="Levenshtein score" />
        <ScoreBar value={0.611} family="ai" label="Embedding-local score" />
      </div>

      <div className="flex flex-wrap gap-3">
        <MetricTile eyebrow="Cophenetic" label="single" value="0.842" leader leaderLabel="Tree" />
        <MetricTile eyebrow="Silhouette" label="ward" value="0.611" />
        <MetricTile eyebrow="Davies-Bouldin" label="complete" value="0.734" />
      </div>
    </Panel>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline bg-paper-raised px-6 py-4">
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          Similarity and clustering workbench
        </p>
        <h1 className="text-display font-semibold tracking-tight text-ink">Legajo</h1>
      </header>
      <main className="flex flex-col gap-6 p-6">
        <p className="text-body text-ink-secondary">
          Corpus selection, similarity comparison and hierarchical clustering views load here.
        </p>
        <DesignSystemShowcase />
      </main>
    </div>
  );
}

export default App;
