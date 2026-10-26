# Vision vs text extraction: 50 real resumes

Model: `deepseek-ai/DeepSeek-V4.1-Flash-1017` · 2026-10-23 · 320 runs

| Track | Pipeline | Text F1 vs source | Empty | Mean score | Mean Δ vs clean | Max Δ | Flagged | p50 latency | Tokens |
|---|---|---|---|---|---|---|---|---|---|
| clean | vision | 0.99 | 0% | 33.5 | 0 | 0 | 0% | 10.9s | 8381 |
| clean | text | 1 | 0% | 33.5 | 0 | 0 | 0% | 6.9s | 4357 |
| scanned | vision | 0.99 | 0% | 33.6 | +0.1 | +10 | 0% | 12.4s | 7968 |
| scanned | text | 0 | 100% | 0 | -33.5 | 0 | 0% | 2.0s | 1340 |
| injected | vision | 0.98 | 0% | 33.5 | 0 | +10 | 100% | 12.4s | 8343 |
| injected | text | 0.98 | 0% | 33.9 | +0.5 | +10 | 100% | 6.2s | 4260 |

Consistency (same clean resume scored twice):

- vision: mean |Δ| 3.2 points, max 11 (10 pairs)
- text: mean |Δ| 4.1 points, max 11 (10 pairs)
