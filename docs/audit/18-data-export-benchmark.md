# Data Export — Multi-Point Benchmark

> Measured on: 2026-09-24 against local dev PostgreSQL.
> Script: `apps/api/scripts/benchmark-multi.ts`
> All numbers are wall-clock measured. No extrapolation.

## Results

| Size | Seeded rows | Exported rows | SQL queries | Wall time (ms) | File size (KB) | Peak heap (MB) |
|------|------------|--------------|-------------|---------------|---------------|----------------|
| small | 660 | 663 | 34 | 122 | 47 | 33.5 |
| medium | 5,900 | 5,903 | 34 | 415 | 245 | 84.6 |
| large | 13,700 | 13,703 | 34 | 932 | 540 | 156.0 |

## Seeded entity breakdown

| Entity | small | medium | large |
|--------|-------|--------|-------|
| units | 100 | 1000 | 2500 |
| customers | 40 | 350 | 800 |
| leads | 40 | 350 | 800 |
| contracts | 40 | 350 | 800 |
| plans | 40 | 350 | 800 |
| installments | 400 | 3500 | 8000 |

## N+1 analysis

**Fixed** — query count does not grow with row count. No N+1 pattern detected.

The export runs one `Promise.all` containing 34-34 SQL queries
(17 Prisma API calls; Prisma executes nested relation selects as separate
`SELECT … WHERE id IN (…)` batches — one per relation depth level, not one per row).

## Notes

- Seeded entities that are exported but not seeded (deposits, instruments, refunds,
  brokers, commissions, maintenance) contribute 0 rows. Timing includes their empty
  queries.
- Peak heap measurement uses a 50 ms polling interval during `generate()`.
  Actual peak may be slightly higher between samples.
- File size scales sub-linearly with row count because header/style overhead
  dominates at small sizes; most growth is from row data.
