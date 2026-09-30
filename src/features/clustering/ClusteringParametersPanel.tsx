import { type FormEvent, type Ref, useId } from 'react';
import { X } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import {
  LinkageIdSchema,
  RepresentationIdSchema,
  type LinkageId,
  type RepresentationId,
} from '../../infrastructure/schemas/clustering';
import { Alert } from '../../shared/components/Alert';
import { EmptyState } from '../../shared/components/EmptyState';
import { NumberStepper } from '../../shared/components/NumberStepper';
import { Panel } from '../../shared/components/Panel';
import {
  SegmentedControl,
  SegmentedControlSkeleton,
  type SegmentedOption,
} from '../../shared/components/SegmentedControl';
import { Badge } from '../../shared/components/ui/badge';
import { Button } from '../../shared/components/ui/button';
import { Skeleton } from '../../shared/components/ui/skeleton';
import { useIsAtLeastSm } from '../../shared/lib/useIsAtLeastSm';
import { cutKRange, defaultCutK, isValidCutK } from './cutSchema';
import { LinkageToggleGroup } from './LinkageToggle';
import { ParameterColumn, ParameterHeader } from './ParameterColumn';

const REPRESENTATION_OPTIONS: readonly SegmentedOption<RepresentationId>[] =
  RepresentationIdSchema.options.map((id) => ({
    value: id,
    label: <span className="font-mono">{id}</span>,
  }));

/** The four fixed linkage criteria; no family concept for linkages. */
export const LINKAGE_IDS: readonly LinkageId[] = LinkageIdSchema.options;

export interface CutLinkageOption {
  id: LinkageId;
  displayName: string;
}

export interface AppliedCut {
  linkageId: LinkageId;
  k: number;
}

export interface ReadyCutColumnState {
  status: 'ready';
  /** Only the linkages the loaded response carries. */
  linkages: readonly CutLinkageOption[];
  /** Sample size of the loaded response; bounds the free cut to k in [2, n - 1]. */
  n: number;
  /** Absent when the sample size leaves no principled reference cut. */
  kRef?: number;
  linkage: LinkageId;
  onLinkageChange: (linkage: LinkageId) => void;
  /** The edited k; `NaN` while the field is empty. */
  k: number;
  onKChange: (k: number) => void;
  onApply: () => void;
  isPending: boolean;
  error?: ApiError;
}

export type CutColumnState =
  | ReadyCutColumnState
  /** The clustering request is in flight: the column reserves its final box. */
  | { status: 'pending'; sampleSizeEstimate: number }
  | { status: 'unavailable'; reason: 'no-linkage' | 'error' };

export interface ClusteringParametersPanelProps {
  /** The wrapper element, so the page can watch it and scroll back to it. */
  panelRef?: Ref<HTMLDivElement>;
  representation: RepresentationId;
  onRepresentationChange: (representation: RepresentationId) => void;
  selectedLinkages: readonly LinkageId[];
  onToggleLinkage: (id: string) => void;
  cut: CutColumnState;
  appliedCut?: AppliedCut;
  onClearCut: () => void;
}

/**
 * The clustering parameter panel: one card in two rows. Row one is two
 * numbered columns (representation, linkage toggles) split by a hairline rule
 * from 1024px and stacked below. Row two is the free cut, a full-width band
 * on the sunken surface: header and hint, the linkage to cut, the k stepper
 * and, at the end, the apply button with the cut status under it.
 */
export function ClusteringParametersPanel({
  panelRef,
  representation,
  onRepresentationChange,
  selectedLinkages,
  onToggleLinkage,
  cut,
  appliedCut,
  onClearCut,
}: ClusteringParametersPanelProps) {
  const { t } = useTranslation();
  const isAtLeastSm = useIsAtLeastSm();
  const ids = useId();
  const representationTitleId = `${ids}-representation`;
  const linkagesTitleId = `${ids}-linkages`;
  const cutTitleId = `${ids}-cut`;
  const selectedCount = selectedLinkages.length;
  const appliedMatchesControls =
    cut.status === 'ready' &&
    appliedCut !== undefined &&
    appliedCut.linkageId === cut.linkage &&
    appliedCut.k === cut.k;

  const linkagesHint =
    selectedCount === 0
      ? t('clustering.noLinkages')
      : selectedCount < LINKAGE_IDS.length
        ? t('clustering.leadersRequireAllLinkages')
        : t('clustering.params.linkages.hintAll');

  return (
    <div ref={panelRef} className="scroll-mt-[calc(var(--shell-header-h)+1rem)]">
      <Panel className="overflow-hidden p-0">
        <section aria-label={t('clustering.params.label')}>
          <div data-testid="params-columns" className="grid grid-cols-1 min-[1024px]:grid-cols-2">
            <ParameterColumn
              step="01"
              title={t('clustering.params.representation.title')}
              titleId={representationTitleId}
              aside={
                <span className="font-mono text-mono text-ink-muted">
                  {t('clustering.params.representation.n', {
                    n: cut.status === 'ready' ? cut.n : '…',
                  })}
                </span>
              }
              hint={t('clustering.params.representation.hint')}
            >
              <SegmentedControl
                options={REPRESENTATION_OPTIONS}
                value={representation}
                onChange={onRepresentationChange}
                orientation={isAtLeastSm ? 'horizontal' : 'vertical'}
                fullWidth
                aria-label={t('clustering.representationGroupLabel')}
              />
            </ParameterColumn>

            <ParameterColumn
              step="02"
              title={t('clustering.params.linkages.title')}
              titleId={linkagesTitleId}
              aside={
                <span className="font-mono text-mono text-ink-muted">
                  {t('clustering.params.linkages.count', { count: selectedCount })}
                </span>
              }
              hint={linkagesHint}
            >
              <LinkageToggleGroup
                ids={LINKAGE_IDS}
                selectedIds={selectedLinkages}
                onToggle={onToggleLinkage}
                aria-label={t('clustering.linkageGroupLabel')}
              />
            </ParameterColumn>
          </div>

          <CutBand
            cut={cut}
            appliedCut={appliedCut}
            appliedMatchesControls={appliedMatchesControls}
            titleId={cutTitleId}
            onClearCut={onClearCut}
          />
        </section>
      </Panel>
    </div>
  );
}

/** The free-cut band: header and hint at the start, then the cut's controls (or why there are none). */
function CutBand({
  cut,
  appliedCut,
  appliedMatchesControls,
  titleId,
  onClearCut,
}: {
  cut: CutColumnState;
  appliedCut?: AppliedCut;
  appliedMatchesControls: boolean;
  titleId: string;
  onClearCut: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="params-cut-band"
      className="flex flex-col gap-3 border-t border-hairline bg-paper-sunken px-5 py-4"
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex w-full min-w-0 flex-col gap-2 min-[1024px]:w-[220px] min-[1024px]:shrink-0">
          <ParameterHeader
            step="03"
            // Muted ink falls just short of AA on the sunken surface.
            stepClassName="text-ink-secondary"
            title={t('clustering.params.cut.title')}
            titleId={titleId}
            marker={
              appliedMatchesControls ? (
                <Badge variant="marker" className="enter-fade self-center">
                  {t('clustering.params.cut.applied')}
                </Badge>
              ) : undefined
            }
          />
          {cut.status !== 'unavailable' && (
            <p className="text-label text-ink-secondary">{t('clustering.params.cut.hint')}</p>
          )}
        </div>

        {cut.status === 'ready' && (
          <ReadyCutControls cut={cut} appliedCut={appliedCut} onClearCut={onClearCut} />
        )}
        {cut.status === 'pending' && (
          <CutControlsSkeleton sampleSizeEstimate={cut.sampleSizeEstimate} />
        )}
        {cut.status === 'unavailable' && (
          <>
            <div className="min-w-0 grow">
              {cut.reason === 'no-linkage' ? (
                <EmptyState
                  glyph={t('clustering.params.cut.noLinkageGlyph')}
                  title={t('clustering.params.cut.noLinkageTitle')}
                  reason={t('clustering.cutForm.unavailableNoLinkage')}
                />
              ) : (
                <EmptyState
                  glyph={t('clustering.params.cut.errorGlyph')}
                  title={t('clustering.params.cut.errorTitle')}
                  reason={t('clustering.cutForm.unavailableError')}
                />
              )}
            </div>
            <div className="flex w-full flex-col items-start min-[1024px]:ml-auto min-[1024px]:w-auto min-[1024px]:items-end">
              <CutStatus appliedCut={appliedCut} onClearCut={onClearCut} />
            </div>
          </>
        )}
      </div>

      {cut.status === 'ready' && cut.error && (
        <Alert
          tone="danger"
          title={t('clustering.cutForm.errorTitle')}
          body={t(cut.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        />
      )}
    </div>
  );
}

/** The cut's fixed-width label above a control. */
function FieldLabel({ children }: { children: string }) {
  return <span className="text-label text-ink-secondary">{children}</span>;
}

function ReadyCutControls({
  cut,
  appliedCut,
  onClearCut,
}: {
  cut: ReadyCutColumnState;
  appliedCut?: AppliedCut;
  onClearCut: () => void;
}) {
  const { t } = useTranslation();
  const { min, max, hasRange } = cutKRange(cut.n);
  const kIsValid = hasRange && isValidCutK(cut.k, cut.n);
  const appliedMatchesControls =
    appliedCut !== undefined && appliedCut.linkageId === cut.linkage && appliedCut.k === cut.k;
  const canApply = kIsValid && !cut.isPending && !appliedMatchesControls;

  const linkageOptions: readonly SegmentedOption<LinkageId>[] = cut.linkages.map((linkage) => ({
    value: linkage.id,
    label: <span className="font-mono">{linkage.id}</span>,
  }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canApply) {
      cut.onApply();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-w-0 grow flex-wrap items-end gap-x-6 gap-y-4"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{t('clustering.params.cut.linkageLabel')}</FieldLabel>
        <SegmentedControl
          size="sm"
          options={linkageOptions}
          value={cut.linkage}
          onChange={cut.onLinkageChange}
          aria-label={t('clustering.cutForm.linkageGroupLabel')}
        />
      </div>

      {hasRange ? (
        <NumberStepper
          id="cut-k"
          label={t('clustering.params.cut.kLabel', { max, kRef: cut.kRef ?? defaultCutK(cut.n) })}
          value={cut.k}
          min={min}
          max={max}
          onChange={cut.onKChange}
          decreaseLabel={t('clustering.params.cut.kDecrease')}
          increaseLabel={t('clustering.params.cut.kIncrease')}
          error={t('clustering.cutForm.errors.kRange', { min, max })}
          slider
          className="min-w-0"
        />
      ) : (
        <p className="text-label text-ink-secondary">{t('clustering.cutForm.noValidRange')}</p>
      )}

      <div className="flex w-full flex-col items-start gap-1.5 min-[1024px]:ml-auto min-[1024px]:w-auto min-[1024px]:items-end">
        <Button type="submit" disabled={!canApply}>
          {cut.isPending ? t('clustering.cutForm.pending') : t('clustering.cutForm.submit')}
        </Button>
        <CutStatus appliedCut={appliedCut} onClearCut={onClearCut} />
      </div>
    </form>
  );
}

/**
 * Mirrors `ReadyCutControls`' own boxes with the same wrappers, the real
 * labels (the k range comes from the corpus-size estimate) and placeholder
 * blocks where a value or control will be; nothing here is focusable.
 */
function CutControlsSkeleton({ sampleSizeEstimate }: { sampleSizeEstimate: number }) {
  const { t } = useTranslation();
  const { max, hasRange } = cutKRange(sampleSizeEstimate);

  return (
    <div className="flex min-w-0 grow flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{t('clustering.params.cut.linkageLabel')}</FieldLabel>
        <SegmentedControlSkeleton
          size="sm"
          labels={LINKAGE_IDS.map((linkageId) => (
            <span key={linkageId} className="font-mono">
              {linkageId}
            </span>
          ))}
        />
      </div>

      {hasRange ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>
            {t('clustering.params.cut.kLabel', { max, kRef: defaultCutK(sampleSizeEstimate) })}
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-[110px] rounded-btn pointer-coarse:h-[46px]" />
            <Skeleton className="h-5 w-[140px]" />
          </div>
        </div>
      ) : (
        <p className="text-label text-ink-secondary">{t('clustering.cutForm.noValidRange')}</p>
      )}

      <div className="flex w-full flex-col items-start gap-1.5 min-[1024px]:ml-auto min-[1024px]:w-auto min-[1024px]:items-end">
        <Skeleton className="h-9 w-[107px] pointer-coarse:h-11" />
        <CutStatus />
      </div>
    </div>
  );
}

/**
 * The cut status under the apply button: no cut, or the dashed sample, the
 * cut's linkage and k, and the icon button that clears it.
 */
function CutStatus({
  appliedCut,
  onClearCut,
}: {
  appliedCut?: AppliedCut;
  onClearCut?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="cut-status"
      className="flex min-h-6 flex-wrap items-center gap-2 text-label text-ink-secondary"
    >
      {appliedCut ? (
        <div className="enter-fade flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true" className="shrink-0">
            <line
              x1="0"
              x2="18"
              y1="4"
              y2="4"
              className="stroke-warning"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          </svg>
          <span>
            <Trans
              i18nKey="clustering.params.status.appliedCut"
              values={{ linkage: appliedCut.linkageId, k: appliedCut.k }}
              components={{ mono: <span className="font-mono text-ink" /> }}
            />
          </span>
          <Button
            variant="ghost"
            aria-label={t('clustering.params.status.clearCut')}
            onClick={onClearCut}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <span>{t('clustering.params.status.noCut')}</span>
      )}
    </div>
  );
}
