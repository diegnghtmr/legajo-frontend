import { useTranslation } from 'react-i18next';

import { DEFAULT_UNEXPECTED_I18N_KEY, type ApiError } from '../../infrastructure/apiError';
import { Alert } from './Alert';
import { Button } from './ui/button';

export interface QueryErrorAlertProps {
  /** What failed, first. */
  title: string;
  error: ApiError;
  /** The request that failed, shown in the mono footer line (for example `GET /benchmarks`). */
  endpoint: string;
  /** Runs the failed request again (a query's `refetch`). */
  onRetry: () => void;
  className?: string;
}

function statusOf(error: ApiError): number | undefined {
  return error.kind === 'network' ? undefined : error.status;
}

/**
 * The danger Alert of a region whose request failed: the response's own
 * problem detail as the reason when it carries one (the mapped message
 * otherwise, never an invented cause), the endpoint and HTTP status as the
 * mono footer line, and a retry action that runs the request again.
 */
export function QueryErrorAlert({
  title,
  error,
  endpoint,
  onRetry,
  className,
}: QueryErrorAlertProps) {
  const { t } = useTranslation();
  const status = statusOf(error);
  const detail = error.kind === 'problem' ? error.detail : undefined;

  return (
    <Alert
      tone="danger"
      title={title}
      body={detail ?? t(error.i18nKey ?? DEFAULT_UNEXPECTED_I18N_KEY)}
      meta={status === undefined ? [endpoint] : [endpoint, `HTTP ${status}`]}
      action={
        <Button type="button" variant="secondary" className="h-7 px-3" onClick={onRetry}>
          {t('errors.retry')}
        </Button>
      }
      className={className}
    />
  );
}
