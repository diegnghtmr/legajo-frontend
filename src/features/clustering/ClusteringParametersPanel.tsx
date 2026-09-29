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
import { AlgoTextList, type AlgoOption } from '../../shared/components/AlgoTextList';
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
import { cutKRange, isValidCutK } from './cutSchema';
import { ParameterColumn } from './ParameterColumn';

const REPRESENTATION_OPTIONS: readonly SegmentedOption<RepresentationId>[] =
  RepresentationIdSchema.options.map((id) => ({
    value: id,
    label: <span className="font-mono">{id}</span>,
  }));

/** The four fixed linkage criteria; no family concept for linkages. */
export const LINKAGE_IDS: readonly LinkageId[] = LinkageIdSchema.options;
const LINKAGE_OPTIONS: readonly AlgoOption[] = LINKAGE_IDS.map((id) => ({ id }));

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
  onSelectAllLinkages: () => void;
  cut: CutColumnState;
  appliedCut?: AppliedCut;
  onClearCut: () => void;
}

/** A linkage's display name without the trailing word ("Ward linkage" is "Ward"). */
function shortLinkageName(displayName: string): string {
  return displayName.replace(/\s+linkage$/i, '');
}

/**
 * The clustering parameter panel: one card with three numbered columns
 * (representation, linkage selection, free cut) and a status footer with the
 * corpus facts and the applied cut. From 1100px the columns share a
 * 1 : 1 : 1.35 grid split by hairline rules, with content kept at the top of each stretched column; below that
 * they stack. The footer sits on the sunken surface.
 */
export function ClusteringParametersPanel({
  panelRef,
  representation,
  onRepresentationChange,
  selectedLinkages,
  onToggleLinkage,
  onSelectAllLinkages,
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
          <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
            <ParameterColumn
              step="01"
              title={t('clustering.params.representation.title')}
              titleId={representationTitleId}
              hint={t('clustering.params.representation.hint')}
            >
              <SegmentedControl
                options={REPRESENTATION_OPTIONS}
                value={representation}
                onChange={onRepresentationChange}
                orientation={isAtLeastSm ? 'horizontal' : 'vertical'}
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
              <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-4">
                <AlgoTextList
                  options={LINKAGE_OPTIONS}
                  selectedIds={selectedLinkages}
                  onToggle={onToggleLinkage}
                  aria-label={t('clustering.linkageGroupLabel')}
                  withTick
                />
                {selectedCount < LINKAGE_IDS.length && (
                  <Button variant="ghost" className="enter-fade" onClick={onSelectAllLinkages}>
                    {t('clustering.params.linkages.selectAll')}
                  </Button>
                )}
              </div>
            </ParameterColumn>

            <ParameterColumn
              step="03"
              title={t('clustering.params.cut.title')}
              titleId={cutTitleId}
              aside={
                appliedMatchesControls ? (
                  <Badge variant="marker" className="enter-fade">
                    {t('clustering.params.cut.applied')}
                  </Badge>
                ) : undefined
              }
              hint={cut.status === 'unavailable' ? undefined : t('clustering.params.cut.hint')}
            >
              <CutColumn cut={cut} appliedMatchesControls={appliedMatchesControls} />
            </ParameterColumn>
          </div>

          <StatusFooter cut={cut} appliedCut={appliedCut} onClearCut={onClearCut} />
        </section>
      </Panel>
    </div>
  );
}

function CutColumn({
  cut,
  appliedMatchesControls,
}: {
  cut: CutColumnState;
  appliedMatchesControls: boolean;
}) {
  const { t } = useTranslation();

  if (cut.status === 'unavailable') {
    return cut.reason === 'no-linkage' ? (
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
    );
  }

  if (cut.status === 'pending') {
    return <CutColumnSkeleton sampleSizeEstimate={cut.sampleSizeEstimate} />;
  }

  return <ReadyCutColumn cut={cut} appliedMatchesControls={appliedMatchesControls} />;
}

function ReadyCutColumn({
  cut,
  appliedMatchesControls,
}: {
  cut: ReadyCutColumnState;
  appliedMatchesControls: boolean;
}) {
  const { t } = useTranslation();
  const { min, max, hasRange } = cutKRange(cut.n);
  const kIsValid = hasRange && isValidCutK(cut.k, cut.n);
  const canApply = kIsValid && !cut.isPending && !appliedMatchesControls;

  const linkageOptions: readonly SegmentedOption<LinkageId>[] = cut.linkages.map((linkage) => ({
    value: linkage.id,
    label: <span className="font-mono">{shortLinkageName(linkage.displayName)}</span>,
  }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canApply) {
      cut.onApply();
    }
  };

  const submit = (
    <Button type="submit" disabled={!canApply} className="w-fit">
      {cut.isPending ? t('clustering.cutForm.pending') : t('clustering.cutForm.submit')}
    </Button>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-ink-secondary">
          {t('clustering.cutForm.linkageGroupLabel')}
        </span>
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
          label={t('clustering.params.cut.kLabel', { max })}
          value={cut.k}
          min={min}
          max={max}
          onChange={cut.onKChange}
          decreaseLabel={t('clustering.params.cut.kDecrease')}
          increaseLabel={t('clustering.params.cut.kIncrease')}
          error={t('clustering.cutForm.errors.kRange', { min, max })}
          slider
          trailing={submit}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-label text-ink-muted">{t('clustering.cutForm.noValidRange')}</p>
          <div>{submit}</div>
        </div>
      )}

      {cut.error && (
        <Alert
          tone="danger"
          title={t('clustering.cutForm.errorTitle')}
          body={t(cut.error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        />
      )}
    </form>
  );
}

/**
 * Mirrors `ReadyCutColumn`'s own boxes with the same wrappers, the real
 * labels (the k range comes from the corpus-size estimate) and placeholder
 * blocks where a value or control will be — nothing here is focusable.
 */
function CutColumnSkeleton({ sampleSizeEstimate }: { sampleSizeEstimate: number }) {
  const { t } = useTranslation();
  const { max, hasRange } = cutKRange(sampleSizeEstimate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-ink-secondary">
          {t('clustering.cutForm.linkageGroupLabel')}
        </span>
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
        <div className="flex flex-col gap-1.5">
          <span className="text-label text-ink-secondary">
            {t('clustering.params.cut.kLabel', { max })}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-[110px] rounded-btn pointer-coarse:h-[46px]" />
            <Skeleton className="h-5 w-[140px]" />
            <Skeleton className="h-9 w-28 pointer-coarse:h-11" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-label text-ink-muted">{t('clustering.cutForm.noValidRange')}</p>
          <Skeleton className="h-9 w-28 pointer-coarse:h-11" />
        </div>
      )}
    </div>
  );
}

function StatusFooter({
  cut,
  appliedCut,
  onClearCut,
}: {
  cut: CutColumnState;
  appliedCut?: AppliedCut;
  onClearCut: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="params-status-footer"
      className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline bg-paper-sunken py-1.5 pr-3 pl-5"
    >
      <div className="flex items-center gap-4 font-mono text-mono text-ink-secondary">
        {cut.status === 'ready' && (
          <>
            <span>{t('clustering.params.footer.n', { n: cut.n })}</span>
            {cut.kRef !== undefined && (
              <span>{t('clustering.params.footer.kRef', { kRef: cut.kRef })}</span>
            )}
          </>
        )}
        {cut.status === 'pending' && (
          <>
            <Skeleton className="h-[17px] w-12" />
            <Skeleton className="h-[17px] w-16" />
          </>
        )}
      </div>

      {appliedCut ? (
        <div className="enter-fade flex items-center gap-2 text-label text-ink-secondary">
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
              i18nKey="clustering.params.footer.appliedCut"
              values={{ linkage: appliedCut.linkageId, k: appliedCut.k }}
              components={{ mono: <span className="font-mono text-ink" /> }}
            />
          </span>
          <Button
            variant="ghost"
            aria-label={t('clustering.params.footer.clearCut')}
            onClick={onClearCut}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <span className="text-label text-ink-secondary">{t('clustering.params.footer.noCut')}</span>
      )}
    </div>
  );
}
