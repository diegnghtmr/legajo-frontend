import { ALGO_FAMILY, type AlgoFamily } from '../../shared/family';

/** The catalogue's own `kind` field (TRD §6.6), never a hardcoded id list. */
export type AlgorithmKind = 'CLASSIC' | 'AI';

/** Maps `GET /similarity/algorithms`' `kind` to the shared `AlgoFamily` used by table/family UI. */
export function algoFamilyFromKind(kind: AlgorithmKind): AlgoFamily {
  return kind === 'CLASSIC' ? ALGO_FAMILY.CLASSIC : ALGO_FAMILY.AI;
}
