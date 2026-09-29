import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { JaccardTrace } from '../../../infrastructure/schemas/similarity';
import { cn } from '../../../shared/lib/cn';
import { formatTraceNumber } from '../formatters';
import { partitionJaccardSets } from './jaccardSets';

export interface JaccardTracePanelProps {
  trace: JaccardTrace;
}

/** The chip shared by the panel and its skeleton, so the placeholder sizes
 * itself with the exact box a real token takes. */
export const JACCARD_TOKEN_CLASS =
  'rounded-sm border px-1.5 py-0.5 font-mono text-mono leading-4 break-all';
const OWN_TOKEN_CLASS = 'border-hairline bg-paper-raised text-ink-secondary';
const SHARED_TOKEN_CLASS = 'border-ink bg-paper-sunken text-ink';

export const JACCARD_GROUP_HEADING_CLASS =
  'flex items-baseline gap-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary';

function TokenGroup({
  label,
  tokens,
  shared = false,
}: {
  label: string;
  tokens: readonly string[];
  shared?: boolean;
}) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={headingId} className={JACCARD_GROUP_HEADING_CLASS}>
        {label}
        <span className="font-mono text-mono normal-case tracking-normal text-ink">
          {tokens.length}
        </span>
      </h3>
      {tokens.length === 0 ? (
        <p className="font-mono text-mono text-ink-muted">—</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-wrap gap-1">
          {tokens.map((token) => (
            <li
              key={token}
              className={cn(JACCARD_TOKEN_CLASS, shared ? SHARED_TOKEN_CLASS : OWN_TOKEN_CLASS)}
            >
              {token}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Jaccard trace panel: the coefficient as the formula with the backend's own
 * sizes, then the union read as a partition (only in A, in both, only in B),
 * each group listing its tokens alphabetically so the shared words stand out.
 */
export function JaccardTracePanel({ trace }: JaccardTracePanelProps) {
  const { t } = useTranslation();
  const { onlyA, both, onlyB } = partitionJaccardSets(trace);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="break-words font-mono text-mono text-ink">
          {`|S_A ∩ S_B| / |S_A ∪ S_B| = ${formatTraceNumber(trace.intersectionSize)} / ${formatTraceNumber(trace.unionSize)} = ${formatTraceNumber(trace.coefficient)}`}
        </p>
        {trace.unionSize === 0 && (
          <p className="text-label text-ink-muted">
            {t('similarity.trace.jaccard.degenerateReason')}
          </p>
        )}
      </div>

      <dl data-testid="jaccard-set-sizes" className="flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-2">
          <dt className="font-mono text-label text-ink-secondary">
            {t('similarity.trace.jaccard.sizeALabel')}
          </dt>
          <dd className="font-mono text-mono text-ink">{formatTraceNumber(trace.setA.length)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-mono text-label text-ink-secondary">
            {t('similarity.trace.jaccard.sizeBLabel')}
          </dt>
          <dd className="font-mono text-mono text-ink">{formatTraceNumber(trace.setB.length)}</dd>
        </div>
      </dl>

      <TokenGroup label={t('similarity.trace.jaccard.onlyALabel')} tokens={onlyA} />
      <TokenGroup label={t('similarity.trace.jaccard.bothLabel')} tokens={both} shared />
      <TokenGroup label={t('similarity.trace.jaccard.onlyBLabel')} tokens={onlyB} />
    </div>
  );
}
