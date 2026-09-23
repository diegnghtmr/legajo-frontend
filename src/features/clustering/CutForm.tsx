import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { LinkageIdSchema, type LinkageId } from '../../infrastructure/schemas/clustering';
import { SegmentedControl, type SegmentedOption } from '../../shared/components/SegmentedControl';

export interface CutFormLinkageOption {
  id: LinkageId;
  displayName: string;
}

export interface CutFormValues {
  linkage: LinkageId;
  k: number;
}

export interface CutFormProps {
  /** Only the linkages currently shown on the page (TRD §6.6: `linkage` must be one conforming value). */
  linkages: readonly CutFormLinkageOption[];
  /** Sample size of the loaded corpus; bounds the free cut to k ∈ [2, n-1] (TRD §6.6). */
  n: number;
  defaultLinkage: LinkageId;
  onSubmit: (values: CutFormValues) => void;
  isPending: boolean;
  error?: ApiError;
}

/**
 * `k` is validated purely against the contract's own bound (TRD §6.6); the
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
 * The free cut form (DESIGN.md §6 item 4, §7.3, TRD §6.6/§6.7): reuses
 * `SegmentedControl` (already accessible + arrow-key tested) for the
 * single-select linkage choice instead of hand-rolling a new radiogroup.
 * Submits `{linkage, k}`; the caller supplies `representation` since this
 * form has no opinion on it (the page's own current selection).
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
      ) : (
        <p className="text-label text-ink-muted">{t('clustering.cutForm.noValidRange')}</p>
      )}

      {hasValidCutRange && errors.k && (
        <p role="alert" className="text-body text-danger">
          {t('clustering.cutForm.errors.kRange', { min: 2, max: n - 1 })}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !hasValidCutRange}
        className="w-fit rounded-btn bg-primary px-3 py-1.5 text-body text-primary-foreground hover:opacity-90 disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {isPending ? t('clustering.cutForm.pending') : t('clustering.cutForm.submit')}
      </button>

      {error && !errors.k && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-danger">
            {t('clustering.cutForm.errorTitle')}
          </p>
          <p className="text-body text-ink-secondary">
            {t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
          </p>
        </div>
      )}
    </form>
  );
}
