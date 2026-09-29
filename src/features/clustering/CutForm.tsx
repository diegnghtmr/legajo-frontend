import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { LinkageIdSchema, type LinkageId } from '../../infrastructure/schemas/clustering';
import { Alert } from '../../shared/components/Alert';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';
import { Button } from '../../shared/components/ui/button';
import { Skeleton } from '../../shared/components/ui/skeleton';

export interface CutFormLinkageOption {
  id: LinkageId;
  displayName: string;
}

export interface CutFormValues {
  linkage: LinkageId;
  k: number;
}

export interface CutFormProps {
  /** Only the linkages currently shown on the page (`linkage` must be one conforming value). */
  linkages: readonly CutFormLinkageOption[];
  /** Sample size of the loaded corpus; bounds the free cut to k ∈ [2, n-1]. */
  n: number;
  defaultLinkage: LinkageId;
  onSubmit: (values: CutFormValues) => void;
  isPending: boolean;
  error?: ApiError;
}

/**
 * `k` is validated purely against the contract's own bound; the
 * exact rejection reason is not surfaced from Zod's own message (it would
 * need `t()` inside the schema), so the form always shows the same
 * translated range message for any `k` failure — there is only one way `k`
 * can be wrong.
 */
function buildCutSchema(n: number) {
  return z.object({
    linkage: LinkageIdSchema,
    k: z
      .number()
      .int()
      .min(2)
      .max(n - 1),
  });
}

/**
 * The free cut form: reuses
 * `SegmentedControl` (already accessible + arrow-key tested) for the
 * single-select linkage choice instead of hand-rolling a new radiogroup.
 * Submits `{linkage, k}`; the caller supplies `representation` since this
 * form has no opinion on it (the page's own current selection).
 *
 * Its own fields (the linkage choice, the k input, `Aplicar corte`) sit in
 * one row when there is room, each keeping its intrinsic width — so this
 * whole group stays close to the height of the control bar's other two
 * groups instead of stacking into a visibly taller column — and wrap onto
 * their own lines as the width shrinks, the same rule the control bar
 * itself follows. The k-range error stays inside the k field's own column,
 * directly under the input, never widening the row on its own.
 */
export function CutForm({ linkages, n, defaultLinkage, onSubmit, isPending, error }: CutFormProps) {
  const { t } = useTranslation();
  /** No k in [2, n-1] exists once n-1 < 2 (n < 3): the range would be inverted (e.g. "between 2 and 1"). */
  const hasValidCutRange = n - 1 >= 2;
  const schema = useMemo(() => buildCutSchema(n), [n]);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { linkage: defaultLinkage, k: 2 },
  });

  const linkageOptions: readonly SegmentedOption<LinkageId>[] = linkages.map((linkage) => ({
    value: linkage.id,
    label: <span className="font-mono">{linkage.displayName}</span>,
  }));

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values))}
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-label text-ink-secondary">
            {t('clustering.cutForm.linkageGroupLabel')}
          </span>
          <Controller
            control={control}
            name="linkage"
            render={({ field }) => (
              <SegmentedControl
                options={linkageOptions}
                value={field.value}
                onChange={field.onChange}
                aria-label={t('clustering.cutForm.linkageGroupLabel')}
              />
            )}
          />
        </div>

        {hasValidCutRange ? (
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-label text-ink-secondary" htmlFor="cut-k">
              {t('clustering.cutForm.kLabel', { min: 2, max: n - 1 })}
              <input
                id="cut-k"
                type="number"
                min={2}
                max={n - 1}
                step={1}
                {...register('k', { valueAsNumber: true })}
                className="w-24 rounded-md border border-hairline-strong bg-paper-raised px-2 py-1 text-body text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </label>
            {errors.k && (
              // `max-w-40`: a fixed width, not the field column's own
              // shrink-to-fit one, so a longer localized message wraps
              // onto more lines within this same column instead of
              // growing the column to fit one long line — which is what
              // used to widen this whole group and push "Aplicar corte"
              // away from it.
              <p role="alert" className="max-w-40 text-body text-danger">
                {t('clustering.cutForm.errors.kRange', { min: 2, max: n - 1 })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-label text-ink-muted">{t('clustering.cutForm.noValidRange')}</p>
        )}

        <Button type="submit" disabled={isPending || !hasValidCutRange} className="w-fit">
          {isPending ? t('clustering.cutForm.pending') : t('clustering.cutForm.submit')}
        </Button>
      </div>

      {error && !errors.k && (
        <Alert
          tone="danger"
          title={t('clustering.cutForm.errorTitle')}
          body={t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
        />
      )}
    </form>
  );
}

export interface CutFormSkeletonProps {
  /** The page's own current linkage selection — already known before the
   * clustering request resolves, unlike the linkages' own `displayName`
   * (the response's own text). The mono id itself is shown as real text
   * (never a generic bar): its width already tracks a real segment's own
   * width closely enough that the control wraps at the same point the real
   * one, with its real `displayName`, eventually will. */
  linkageIds: readonly string[];
  /** The same corpus-size estimate the caller already builds for
   * `ClusteringMetricsTableSkeleton`'s own invisible sizer (see that
   * prop's own doc comment) — the k field's own label interpolates the
   * exact same `n - 1` upper bound, and at this width that label's own
   * real length is what decides whether the k field and the submit button
   * still fit on the segmented control's own row or wrap below it. */
  sampleSizeEstimate: number;
}

/** The real per-linkage display names, captured against the reference
 * corpus: a fixed "<Name> linkage" shape for each of the four canonical
 * ids, always noticeably longer than the mono id alone
 * ("single" vs "Single linkage"). Used only to size each segmented item's
 * own invisible sizer below — the fake control still shows the already-
 * known mono id as its visible text, never this string. Reserving the mono
 * id's own (shorter) width instead left this whole segmented control
 * narrower than the real one once its `displayName` labels arrived,
 * changing where the row wraps its `k` field and submit button relative to
 * it — moving them here without moving the metrics table below, which is
 * what actually produced the residual. */
const TYPICAL_LINKAGE_DISPLAY_NAME: Record<string, string> = {
  single: 'Single linkage',
  complete: 'Complete linkage',
  average: 'Average linkage',
  ward: 'Ward linkage',
};

/**
 * Mirrors `CutForm`'s own three-field row (the linkage segmented control,
 * the k input, `Aplicar corte`) in the same responsive `flex flex-wrap
 * items-end gap-4` row, so this placeholder wraps exactly the way the real
 * form does at any width — a fixed pixel height cannot, since the real
 * form's own height changes with the viewport once its fields stack.
 */
export function CutFormSkeleton({ linkageIds, sampleSizeEstimate }: CutFormSkeletonProps) {
  const { t } = useTranslation();
  const hasValidCutRangeEstimate = sampleSizeEstimate - 1 >= 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-label text-ink-secondary">
            {t('clustering.cutForm.linkageGroupLabel')}
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-paper-sunken p-[3px]">
            {linkageIds.map((linkageId) => (
              <span
                key={linkageId}
                className="relative rounded-btn px-3 py-1.5 font-mono text-label font-medium text-ink-secondary"
              >
                {/* No `whitespace-nowrap`: the real `ToggleGroupItem` never
                 * sets it either, so its own label can wrap onto a second
                 * line and let the item itself shrink at a narrow
                 * viewport — forcing this sizer to stay unwrapped instead
                 * kept this whole segmented control, and the flex row
                 * around it, wider than the real one ever needs to be,
                 * which is what pushed the page into a horizontal scroll
                 * the real one never has. */}
                <span aria-hidden="true" className="invisible">
                  {TYPICAL_LINKAGE_DISPLAY_NAME[linkageId] ?? linkageId}
                </span>
                <span className="absolute inset-0 flex items-center justify-center px-3 py-1.5">
                  {linkageId}
                </span>
              </span>
            ))}
          </div>
        </div>

        {hasValidCutRangeEstimate ? (
          <div className="flex flex-col gap-1">
            {/* The real label's own text, built from the same estimate —
             * its real width is exactly what decides this row's own wrap
             * point at a narrow viewport; a generic bar guessed too
             * narrow and left the button one row higher than the real
             * form ever puts it. */}
            <span className="flex flex-col gap-1 text-label text-ink-secondary">
              {t('clustering.cutForm.kLabel', { min: 2, max: sampleSizeEstimate - 1 })}
              <Skeleton className="h-8 w-24 rounded-md" />
            </span>
          </div>
        ) : (
          <span className="text-label text-ink-muted">{t('clustering.cutForm.noValidRange')}</span>
        )}

        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
