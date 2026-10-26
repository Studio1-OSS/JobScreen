# Job fit: who ends up at the top of the pile

Model: `deepseek-ai/DeepSeek-V4.1-Flash-1017` · 2026-10-23 · 50 resumes × 10 roles · 1300 scorings

| Pile | Pipeline | Fits in top 5 (P@5) | 95% CI | Right resume at #1 | Ranking quality (AUC) | 95% CI | Fits scored 0 |
|---|---|---|---|---|---|---|---|
| Clean PDFs | vision | 52% | 36%–68% | 70% | 0.87 | 0.80–0.93 | 0 |
| Clean PDFs | library | 52% | 36%–68% | 65% | 0.87 | 0.81–0.93 | 0 |
| Mixed (15 scans) | vision | 50% | 36%–62% | 70% | 0.87 | 0.80–0.93 | 0 |
| Mixed (15 scans) | library | 41% | 27%–57% | 55% | 0.70 | 0.60–0.81 | 15 |

Paired by role (vision minus library, P@5):

- clean: P@5 0 points (95% CI -6 to 6; vision better on 1 roles, library on 1, tied on 8) · AUC -0.00 (95% CI -0.03 to 0.02; vision better on 5 of 10 roles)
- mixed: P@5 +9 points (95% CI -3 to 25; vision better on 3 roles, library on 2, tied on 5) · AUC +0.17 (95% CI 0.05 to 0.29; vision better on 7 of 10 roles)

Per role, P@5 (vision / library):

| Role | Clean | Mixed |
|---|---|---|
| INFORMATION-TECHNOLOGY | 40% / 40% | 40% / 40% |
| ENGINEERING | 40% / 40% | 40% / 40% |
| FINANCE | 60% / 60% | 60% / 60% |
| ACCOUNTANT | 20% / 40% | 40% / 40% |
| HR | 80% / 80% | 80% / 20% |
| SALES | 60% / 40% | 40% / 40% |
| HEALTHCARE | 60% / 60% | 60% / 40% |
| TEACHER | 100% / 100% | 80% / 100% |
| DESIGNER | 60% / 60% | 60% / 20% |
| CONSULTANT | 0% / 0% | 0% / 7% |
