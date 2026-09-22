import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { formatTraceNumber } from '../formatters';

export interface JaccardTracePanelProps {
  trace: JaccardTrace;
}

function TokenSet({ tokens }: { tokens: readonly string[] }) {
  return (
    <p className="break-words font-mono text-mono text-ink-secondary">
      {tokens.length === 0 ? '—' : tokens.join(', ')}
    </p>
  );
}

function SizeLabel({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex items-baseline gap-2 text-label text-ink-secondary">
      <span>{label}</span>
      <span className="font-mono text-mono text-ink">{formatTraceNumber(value)}</span>
    </p>
  );
}

/**
 * Jaccard trace panel (PRD HU-1.6): the two token sets, their intersection
 * and union (both listed, not only sized), and the coefficient — every
 * field the backend sends, rendered verbatim.
 */
export function JaccardTracePanel({ trace }: JaccardTracePanelProps) {
  const { t } = useTranslation();
  const intersectionHeadingId = useId();
  const unionHeadingId = useId();

  return (
    <dl className="flex flex-col gap-4">
      <div>
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.jaccard.setALabel')}
        </dt>
        <dd>
          <TokenSet tokens={trace.setA} />
        </dd>
      </div>
      <div>
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.jaccard.setBLabel')}
        </dt>
        <dd>
          <TokenSet tokens={trace.setB} />
        </dd>
      </div>

      <div role="region" aria-labelledby={intersectionHeadingId}>
        <dt
          id={intersectionHeadingId}
          className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.jaccard.intersectionLabel')}
        </dt>
        <dd className="flex flex-col gap-1">
          <SizeLabel
            label={t('similarity.trace.jaccard.intersectionSizeLabel')}
            value={trace.intersectionSize}
          />
          <TokenSet tokens={trace.intersection} />
        </dd>
      </div>

      <div role="region" aria-labelledby={unionHeadingId}>
        <dt
          id={unionHeadingId}
          className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.jaccard.unionLabel')}
        </dt>
        <dd className="flex flex-col gap-1">
          <SizeLabel label={t('similarity.trace.jaccard.unionSizeLabel')} value={trace.unionSize} />
          <TokenSet tokens={trace.union} />
        </dd>
      </div>

      <div>
        <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.jaccard.coefficientLabel')}
        </dt>
        <dd className="font-mono text-mono text-ink">{formatTraceNumber(trace.coefficient)}</dd>
      </div>
    </dl>
  );
}
