import { useTranslation } from 'react-i18next';

import type { TfIdfCosineTrace } from '../../../infrastructure/schemas/similarity';
import { formatTraceNumber } from '../formatters';
import { FormulaCaption } from './FormulaCaption';

const TF_IDF_FORMULA =
  '\\cos\\theta=\\dfrac{\\sum_t w(t,A)\\,w(t,B)}{\\lVert w_A\\rVert\\,\\lVert w_B\\rVert},\\quad \\theta=\\arccos(\\cos\\theta)';

export interface TfIdfTracePanelProps {
  trace: TfIdfCosineTrace;
}

const NUMERIC_TH_CLASS =
  'p-2 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary';
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

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2 text-label text-ink-secondary">
        <span>{t('similarity.trace.tfidf.corpusSizeLabel')}</span>
        <span className="font-mono text-mono text-ink">{formatTraceNumber(trace.corpusSize)}</span>
      </p>

      <div>
        <h3 className="mb-1 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          {t('similarity.trace.tfidf.termsHeading')}
        </h3>
        <div className="max-w-full overflow-x-auto rounded-md border border-hairline">
          <table className="border-collapse text-left">
            <thead>
              <tr className="bg-paper-sunken">
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.termLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.frequencyALabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.frequencyBLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.documentFrequencyLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.tfALabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.tfBLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.idfLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.rawWeightALabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.rawWeightBLabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.normalizedWeightALabel')}
                </th>
                <th scope="col" className={NUMERIC_TH_CLASS}>
                  {t('similarity.trace.tfidf.normalizedWeightBLabel')}
                </th>
              </tr>
            </thead>
            <tbody>
              {trace.terms.map((row) => (
                <tr key={row.term} className="border-b border-hairline">
                  <td className="p-2 font-mono text-mono text-ink">{row.term}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.frequencyA)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.frequencyB)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.documentFrequency)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.tfA)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.tfB)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.idf)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.rawWeightA)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.rawWeightB)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.normalizedWeightA)}</td>
                  <td className={NUMERIC_TD_CLASS}>{formatTraceNumber(row.normalizedWeightB)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
