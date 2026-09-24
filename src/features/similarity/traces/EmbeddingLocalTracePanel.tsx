import { useTranslation } from 'react-i18next';

import type { EmbeddingLocalTrace } from '../../../infrastructure/schemas/similarity';
import { formatTraceNumber } from '../formatters';

export interface EmbeddingLocalTracePanelProps {
  trace: EmbeddingLocalTrace;
}

function Field({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd data-testid={testId} className="font-mono text-mono text-ink">
        {value}
      </dd>
    </div>
  );
}

/**
 * `embedding-local` trace panel: dimension + an 8-value excerpt
 * of each stored unit vector (never the full 384-dimension vector), the
 * `preNormL2` provenance value recorded at precompute time (not recomputed
 * here), dot product, cosine, angle and the mapped normalized score.
 */
export function EmbeddingLocalTracePanel({ trace }: EmbeddingLocalTracePanelProps) {
  const { t } = useTranslation();
  const excerptA = trace.vectorAExcerpt.map(formatTraceNumber).join(', ');
  const excerptB = trace.vectorBExcerpt.map(formatTraceNumber).join(', ');

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <Field
        testId="embedding-local-provider"
        label={t('similarity.trace.embeddingLocal.providerLabel')}
        value={trace.provider}
      />
      <Field
        testId="embedding-local-model"
        label={t('similarity.trace.embeddingLocal.modelLabel')}
        value={trace.model}
      />
      <Field
        testId="embedding-local-dimension"
        label={t('similarity.trace.embeddingLocal.dimensionLabel')}
        value={formatTraceNumber(trace.dimension)}
      />
      <div className="sm:col-span-2">
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.embeddingLocal.vectorAExcerptLabel')}
        </dt>
        <dd
          data-testid="embedding-local-vectorA-excerpt"
          className="break-words font-mono text-mono text-ink"
        >
          {excerptA}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.embeddingLocal.vectorBExcerptLabel')}
        </dt>
        <dd
          data-testid="embedding-local-vectorB-excerpt"
          className="break-words font-mono text-mono text-ink"
        >
          {excerptB}
        </dd>
      </div>
      <Field
        testId="embedding-local-preNormL2A"
        label={t('similarity.trace.embeddingLocal.preNormL2ALabel')}
        value={formatTraceNumber(trace.preNormL2A)}
      />
      <Field
        testId="embedding-local-preNormL2B"
        label={t('similarity.trace.embeddingLocal.preNormL2BLabel')}
        value={formatTraceNumber(trace.preNormL2B)}
      />
      <Field
        testId="embedding-local-dotProduct"
        label={t('similarity.trace.embeddingLocal.dotProductLabel')}
        value={formatTraceNumber(trace.dotProduct)}
      />
      <Field
        testId="embedding-local-cosine"
        label={t('similarity.trace.embeddingLocal.cosineLabel')}
        value={formatTraceNumber(trace.cosine)}
      />
      <Field
        testId="embedding-local-angleDegrees"
        label={t('similarity.trace.embeddingLocal.angleLabel')}
        value={formatTraceNumber(trace.angleDegrees)}
      />
      <Field
        testId="embedding-local-normalizedScore"
        label={t('similarity.trace.embeddingLocal.normalizedScoreLabel')}
        value={formatTraceNumber(trace.normalizedScore)}
      />
    </dl>
  );
}
