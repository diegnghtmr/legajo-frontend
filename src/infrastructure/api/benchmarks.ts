import type { operations } from '../../shared/types/api';
import { httpClient } from '../httpClient';
import { parseResponse } from '../parseResponse';
import { BenchmarkReportSchema } from '../schemas/benchmarks';

export type BenchmarkReportResponse =
  operations['benchmarks']['responses'][200]['content']['application/json'];

/**
 * Reads the versioned JMH reference-run measurements: the
 * harness, every classified result (including the `slo-*` families and both
 * embedding-dimension points), and each curve's log-log slope. Never
 * triggers a JMH run and never recalculates anything server-side or here.
 */
export async function fetchBenchmarks(): Promise<BenchmarkReportResponse> {
  const { data } = await httpClient.get<BenchmarkReportResponse>('/api/v1/benchmarks');
  return parseResponse(BenchmarkReportSchema, data, 'GET /benchmarks');
}
