import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { TfIdfCosineTrace } from '../../../infrastructure/schemas/similarity';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui/table';
import { formatTraceNumber } from '../formatters';
import { FormulaCaption } from './FormulaCaption';

const TF_IDF_FORMULA =
  '\\cos\\theta=\\dfrac{\\sum_t w(t,A)\\,w(t,B)}{\\lVert w_A\\rVert\\,\\lVert w_B\\rVert},\\quad \\theta=\\arccos(\\cos\\theta)';

export interface TfIdfTracePanelProps {
  trace: TfIdfCosineTrace;
}

const NUMERIC_TH_CLASS = 'p-2';
const NUMERIC_TD_CLASS = 'p-2 font-mono text-mono text-ink';

/**
 * TF-IDF / cosine trace panel: term-by-term frequencies and
 * weights over the union of the two documents' tokens (the "scope of
 * the trace" rule — not the full corpus vocabulary), then the dot product,
 * both raw norms, cosine and angle. Every number is the backend's own value,
 * rendered verbatim.
 */
export function TfIdfTracePanel({ trace }: TfIdfTracePanelProps) {
  const { t } = useTranslation();
  const termsHeadingId = useId();

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2 text-label text-ink-secondary">
        <span>{t('similarity.trace.tfidf.corpusSizeLabel')}</span>
        <span className="font-mono text-mono text-ink">{formatTraceNumber(trace.corpusSize)}</span>
      </p>

      <div>
        <h3
          id={termsHeadingId}
          className="mb-1 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary"
        >
          {t('similarity.trace.tfidf.termsHeading')}
        </h3>
        {/* The single scroll container for this table (both the region's own
         * name and its keyboard focusability — WCAG 2.1.1's
         * `scrollable-region-focusable`): `Table`'s own default wrapper is
         * skipped (`wrap={false}`) so this stays the only `overflow`
         * ancestor, the same technique `MatrixTable`/`DpTracePanel`'s
         * operations table already use, rather than nesting two scrollable
         * divs with only the inner one ever reachable by keyboard. */}
        <div
          role="region"
          aria-labelledby={termsHeadingId}
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-md border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Table wrap={false}>
            <TableHeader>
              <TableRow>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.termLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.frequencyALabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.frequencyBLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.documentFrequencyLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.tfALabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.tfBLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.idfLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.rawWeightALabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.rawWeightBLabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.normalizedWeightALabel')}
                </TableHead>
                <TableHead className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.normalizedWeightBLabel')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trace.terms.map((row) => (
                <TableRow key={row.term}>
                  <TableCell className="p-2 font-mono text-mono text-ink">{row.term}</TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.frequencyA)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.frequencyB)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.documentFrequency)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.tfA)}</TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.tfB)}</TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.idf)}</TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.rawWeightA)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.rawWeightB)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.normalizedWeightA)}
                  </TableCell>
                  <TableCell className={NUMERIC_TD_CLASS}>
                    {formatTraceNumber(row.normalizedWeightB)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {(
          [
            ['dotProductLabel', trace.dotProduct],
            ['rawNormALabel', trace.rawNormA],
            ['rawNormBLabel', trace.rawNormB],
            ['cosineLabel', trace.cosine],
            ['angleLabel', trace.angleDegrees],
          ] as const
        ).map(([key, value]) => (
          <div key={key}>
            <dt className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
              {t(`similarity.trace.tfidf.${key}`)}
            </dt>
            <dd className="font-mono text-mono text-ink">{formatTraceNumber(value)}</dd>
          </div>
        ))}
      </dl>

      <FormulaCaption tex={TF_IDF_FORMULA} caption={t('similarity.trace.tfidf.formula')} />
    </div>
  );
}
