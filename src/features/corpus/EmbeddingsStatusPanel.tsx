import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  fetchEmbeddingsStatus,
  type EmbeddingsStatusResponse,
} from '../../infrastructure/api/embeddings';
import { cn } from '../../shared/lib/cn';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { shortenHash } from './shortenHash';

export const EMBEDDINGS_STATUS_QUERY_KEY = ['embeddings', 'status'] as const;

function Field({ label, value, testId }: { label: string; value: string; testId?: string }) {
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

function HashField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd title={value} className="font-mono text-mono text-ink">
        <span aria-hidden="true">{shortenHash(value)}</span>
        <span className="sr-only">{value}</span>
      </dd>
    </div>
  );
}

function MatchField({
  testId,
  label,
  matchesCorpus,
  matchesText,
  mismatchText,
  className,
}: {
  testId: string;
  label: string;
  matchesCorpus: boolean;
  matchesText: string;
  mismatchText: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
        {label}
      </dt>
      <dd
        data-testid={testId}
        className={cn(
          'text-label',
          matchesCorpus ? 'text-ink-secondary' : 'text-danger font-semibold',
        )}
      >
        {matchesCorpus ? matchesText : mismatchText}
      </dd>
    </div>
  );
}

interface FamilySectionProps {
  familyId: string;
  headingId: string;
  provider: string;
  model: string;
  dimension: number;
  corpusSha256: string;
  matchesCorpus: boolean;
  matchesText: string;
  mismatchText: string;
  matchLabel: string;
  matchTestId: string;
  providerLabel: string;
  modelLabel: string;
  dimensionLabel: string;
  corpusSha256Label: string;
  extraField?: { label: string; value: string; testId: string };
}

function FamilySection({
  familyId,
  headingId,
  provider,
  model,
  dimension,
  corpusSha256,
  matchesCorpus,
  matchesText,
  mismatchText,
  matchLabel,
  matchTestId,
  providerLabel,
  modelLabel,
  dimensionLabel,
  corpusSha256Label,
  extraField,
}: FamilySectionProps) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3
        id={headingId}
        className="flex items-center gap-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
      >
        <span aria-hidden="true" className="inline-block h-[6px] w-[6px] rounded-full bg-ai" />
        <span className="font-mono text-mono normal-case tracking-normal">{familyId}</span>
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <Field label={providerLabel} value={provider} />
        <Field label={modelLabel} value={model} />
        <Field label={dimensionLabel} value={String(dimension)} />
        {extraField && (
          <Field label={extraField.label} value={extraField.value} testId={extraField.testId} />
        )}
        <HashField className="sm:col-span-2" label={corpusSha256Label} value={corpusSha256} />
        <MatchField
          className="sm:col-span-2"
          testId={matchTestId}
          label={matchLabel}
          matchesCorpus={matchesCorpus}
          matchesText={matchesText}
          mismatchText={mismatchText}
        />
      </dl>
    </section>
  );
}

/** One label/value bar, mirroring `Field`'s box so the swap to real data
 * causes no shift. */
function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-1 h-3.5 w-28" />
    </div>
  );
}

/** Mirrors one `FamilySection`: a heading bar over the same `dl` 2-column
 * grid, with the hash and match fields spanning both columns like their
 * real counterparts. */
function FamilySectionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-32" />
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton className="sm:col-span-2" />
        <FieldSkeleton className="sm:col-span-2" />
      </div>
    </div>
  );
}

/** Both embedding families, before either has resolved. */
function EmbeddingsStatusSkeleton() {
  return (
    <div data-testid="embeddings-status-skeleton" className="flex flex-col gap-6">
      <FamilySectionSkeleton />
      <FamilySectionSkeleton />
    </div>
  );
}

function EmbeddingsStatusContent({ data }: { data: EmbeddingsStatusResponse }) {
  const { t } = useTranslation();
  const modeLabel =
    data.embeddingApi.mode === 'live'
      ? t('corpus.embeddingsStatus.modeLive')
      : data.embeddingApi.mode === 'cached'
        ? t('corpus.embeddingsStatus.modeCached')
        : t('corpus.embeddingsStatus.modeUnknown');

  return (
    <div className="flex flex-col gap-6">
      <FamilySection
        familyId="embedding-local"
        headingId="embeddings-status-local-heading"
        provider={data.embeddingLocal.provider}
        model={data.embeddingLocal.model}
        dimension={data.embeddingLocal.dimension}
        corpusSha256={data.embeddingLocal.corpusSha256}
        matchesCorpus={data.embeddingLocal.matchesCorpus}
        matchesText={t('corpus.embeddingsStatus.matches')}
        mismatchText={t('corpus.embeddingsStatus.mismatch')}
        matchLabel={t('corpus.embeddingsStatus.matchLabel')}
        matchTestId="embeddings-status-local-match"
        providerLabel={t('corpus.embeddingsStatus.providerLabel')}
        modelLabel={t('corpus.embeddingsStatus.modelLabel')}
        dimensionLabel={t('corpus.embeddingsStatus.dimensionLabel')}
        corpusSha256Label={t('corpus.embeddingsStatus.corpusSha256Label')}
        extraField={{
          label: t('corpus.embeddingsStatus.deviceLabel'),
          value: data.embeddingLocal.device,
          testId: 'embeddings-status-local-device',
        }}
      />
      <FamilySection
        familyId="embedding-api"
        headingId="embeddings-status-api-heading"
        provider={data.embeddingApi.provider}
        model={data.embeddingApi.model}
        dimension={data.embeddingApi.dimension}
        corpusSha256={data.embeddingApi.corpusSha256}
        matchesCorpus={data.embeddingApi.matchesCorpus}
        matchesText={t('corpus.embeddingsStatus.matches')}
        mismatchText={t('corpus.embeddingsStatus.mismatch')}
        matchLabel={t('corpus.embeddingsStatus.matchLabel')}
        matchTestId="embeddings-status-api-match"
        providerLabel={t('corpus.embeddingsStatus.providerLabel')}
        modelLabel={t('corpus.embeddingsStatus.modelLabel')}
        dimensionLabel={t('corpus.embeddingsStatus.dimensionLabel')}
        corpusSha256Label={t('corpus.embeddingsStatus.corpusSha256Label')}
        extraField={{
          label: t('corpus.embeddingsStatus.modeLabel'),
          value: modeLabel,
          testId: 'embeddings-status-api-mode',
        }}
      />
    </div>
  );
}

/**
 * Status of both embedding families (`embedding-local`,
 * `embedding-api`) in one panel on the corpus screen. Independent
 * `useQuery` from the article list — a failure here is shown only inside
 * this panel and never blocks or hides the corpus list (author decision,
 * 2026-09-22, since this panel's placement is not otherwise fixed).
 */
export function EmbeddingsStatusPanel() {
  const { t } = useTranslation();

  const { data, isPending, isError, error } = useQuery<EmbeddingsStatusResponse, ApiError>({
    queryKey: EMBEDDINGS_STATUS_QUERY_KEY,
    queryFn: fetchEmbeddingsStatus,
  });

  return (
    <Panel>
      <PanelHeader
        eyebrow={t('corpus.embeddingsStatus.eyebrow')}
        title={t('corpus.embeddingsStatus.title')}
      />
      {isPending && (
        <>
          <p role="status" className="sr-only">
            {t('corpus.embeddingsStatus.loading')}
          </p>
          <EmbeddingsStatusSkeleton />
        </>
      )}
      {isError && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">
            {t('corpus.embeddingsStatus.errorTitle')}
          </p>
          <p className="text-body text-ink-secondary">
            {t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
      {data && <EmbeddingsStatusContent data={data} />}
    </Panel>
  );
}
