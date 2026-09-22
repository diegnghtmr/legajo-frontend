import axios from 'axios';

import {
  LenientProblemDetailSchema,
  ProblemTypeSchema,
  type ProblemType,
} from './schemas/problemDetail';

/**
 * The seven fixed URNs (TRD §6.6) mapped to i18n keys the UI can render
 * directly. An unknown or absent `type` (Spring's `about:blank` handling)
 * falls back by HTTP status instead.
 */
const PROBLEM_TYPE_I18N_KEYS: Record<ProblemType, string> = {
  'urn:legajo:problem:unknown-document': 'errors.unknownDocument',
  'urn:legajo:problem:unknown-algorithm': 'errors.unknownAlgorithm',
  'urn:legajo:problem:unknown-representation': 'errors.unknownRepresentation',
  'urn:legajo:problem:unknown-linkage': 'errors.unknownLinkage',
  'urn:legajo:problem:invalid-cut': 'errors.invalidCut',
  'urn:legajo:problem:invalid-selection': 'errors.invalidSelection',
  'urn:legajo:problem:embedding-api-unavailable': 'errors.embeddingApiUnavailable',
};

const STATUS_FALLBACK_I18N_KEYS: Record<number, string> = {
  400: 'errors.badRequest',
  404: 'errors.notFound',
  500: 'errors.serverError',
  503: 'errors.serviceUnavailable',
};

export const DEFAULT_UNEXPECTED_I18N_KEY = 'errors.unexpected';

/**
 * Render's free tier suspends the backend when idle (TRD §14.4): the first
 * request after inactivity can legitimately take up to 60s (Appendix A). A
 * timeout or a response that never arrives must say so, not read as a
 * generic outage.
 */
export const NETWORK_ERROR_I18N_KEY = 'errors.network.coldStart';

export interface ApiProblemError {
  kind: 'problem';
  status: number;
  /** Absent for a framework-detected error (Spring's implicit `about:blank`). */
  type?: ProblemType;
  title: string;
  detail?: string;
  instance?: string;
  i18nKey: string;
}

export interface ApiNetworkError {
  kind: 'network';
  cause: 'timeout' | 'no-response';
  i18nKey: string;
}

export interface ApiUnexpectedError {
  kind: 'unexpected';
  status?: number;
  i18nKey: string;
  message: string;
}

export type ApiError = ApiProblemError | ApiNetworkError | ApiUnexpectedError;

function asKnownProblemType(type: string | undefined): ProblemType | undefined {
  if (type === undefined) {
    return undefined;
  }

  const parsed = ProblemTypeSchema.safeParse(type);
  return parsed.success ? parsed.data : undefined;
}

function i18nKeyForProblem(type: ProblemType | undefined, status: number): string {
  if (type) {
    return PROBLEM_TYPE_I18N_KEYS[type];
  }

  return STATUS_FALLBACK_I18N_KEYS[status] ?? DEFAULT_UNEXPECTED_I18N_KEY;
}

function isTimeout(error: { code?: string; message: string }): boolean {
  return error.code === 'ECONNABORTED' || /timeout/i.test(error.message);
}

/**
 * Maps any error thrown by the Axios HTTP client (`httpClient.ts`) into the
 * UI's `ApiError` model. Never throws itself: an error this function cannot
 * classify becomes `kind: 'unexpected'` rather than propagating a raw,
 * unhandled exception.
 */
export function mapAxiosErrorToApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return {
      kind: 'unexpected',
      i18nKey: DEFAULT_UNEXPECTED_I18N_KEY,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  if (!error.response) {
    return {
      kind: 'network',
      cause: isTimeout(error) ? 'timeout' : 'no-response',
      i18nKey: NETWORK_ERROR_I18N_KEY,
    };
  }

  const { status, data } = error.response;
  const parsedProblem = LenientProblemDetailSchema.safeParse(data);

  if (!parsedProblem.success) {
    return {
      kind: 'unexpected',
      status,
      i18nKey: STATUS_FALLBACK_I18N_KEYS[status] ?? DEFAULT_UNEXPECTED_I18N_KEY,
      message: `The server returned status ${status} with an unrecognized response body.`,
    };
  }

  const problem = parsedProblem.data;
  const knownType = asKnownProblemType(problem.type);

  return {
    kind: 'problem',
    status,
    type: knownType,
    title: problem.title ?? `HTTP ${status}`,
    detail: problem.detail,
    instance: problem.instance,
    i18nKey: i18nKeyForProblem(knownType, status),
  };
}
