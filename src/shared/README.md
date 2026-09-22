# shared

- `components/` — presentational primitives used by two or more features
  (task W2): `SegmentedControl`, `AlgoTextButton` / `AlgoTextList`,
  `FamilyStatus`, `ScoreBar`, `Panel` / `PanelHeader`, `MetricTile`. Each
  component is co-located with its `*.test.tsx`.
- `family.ts` — the `AlgoFamily` (`classic` | `ai`) type shared by the
  components above.
- `lib/cn.ts` — minimal class-name joiner (no `clsx`/`tailwind-merge`;
  neither is in the TRD's fixed stack).
- `types/api.ts` — generated from the OpenAPI contract by `npm run
api:types`. Never hand-edit it.
