import { useTranslation } from 'react-i18next';

import type { EmbeddingApiTrace } from '../../../infrastructure/schemas/similarity';
import { formatTraceNumber } from '../formatters';

export interface EmbeddingApiTracePanelProps {
  trace: EmbeddingApiTrace;
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
 * `embedding-api` trace panel (PRD HU-1.6): dimension + an 8-value excerpt
 * of each unit vector, the `preNormL2` provenance value, sum of squared
 * differences, Euclidean distance, the mapped normalized score and the
 * provider status (`cached`/`live`, TRD §6.3 "Modo en vivo").
 */
export function EmbeddingApiTracePanel({ trace }: EmbeddingApiTracePanelProps) {
  const { t } = useTranslation();
  const excerptA = trace.vectorAExcerpt.map(formatTraceNumber).join(', ');
  const excerptB = trace.vectorBExcerpt.map(formatTraceNumber).join(', ');

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <Field
        testId="embedding-api-provider"
        label={t('similarity.trace.embeddingApi.providerLabel')}
        value={trace.provider}
      />
      <Field
        testId="embedding-api-model"
        label={t('similarity.trace.embeddingApi.modelLabel')}
        value={trace.model}
      />
      <Field
        testId="embedding-api-dimension"
        label={t('similarity.trace.embeddingApi.dimensionLabel')}
        value={formatTraceNumber(trace.dimension)}
      />
      <div className="sm:col-span-2">
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.embeddingApi.vectorAExcerptLabel')}
        </dt>
        <dd
          data-testid="embedding-api-vectorA-excerpt"
          className="break-words font-mono text-mono text-ink"
        >
          {excerptA}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.embeddingApi.vectorBExcerptLabel')}
        </dt>
        <dd
          data-testid="embedding-api-vectorB-excerpt"
          className="break-words font-mono text-mono text-ink"
        >
          {excerptB}
        </dd>
      </div>
      <Field
        testId="embedding-api-preNormL2A"
        label={t('similarity.trace.embeddingApi.preNormL2ALabel')}
        value={formatTraceNumber(trace.preNormL2A)}
      />
      <Field
        testId="embedding-api-preNormL2B"
        label={t('similarity.trace.embeddingApi.preNormL2BLabel')}
        value={formatTraceNumber(trace.preNormL2B)}
      />
      <Field
        testId="embedding-api-sumSquaredDiff"
        label={t('similarity.trace.embeddingApi.sumSquaredDiffLabel')}
        value={formatTraceNumber(trace.sumSquaredDiff)}
      />
      <Field
        testId="embedding-api-distance"
        label={t('similarity.trace.embeddingApi.distanceLabel')}
        value={formatTraceNumber(trace.distance)}
      />
      <Field
        testId="embedding-api-normalizedScore"
        label={t('similarity.trace.embeddingApi.normalizedScoreLabel')}
        value={formatTraceNumber(trace.normalizedScore)}
      />
      <Field
        testId="embedding-api-providerStatus"
        label={t('similarity.trace.embeddingApi.providerStatusLabel')}
        value={trace.providerStatus}
      />
    </dl>
  );
}
