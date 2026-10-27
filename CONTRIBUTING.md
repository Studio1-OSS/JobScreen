# Contributing to JobScreen

Thanks for helping. Issues and pull requests are welcome.

## Set up

```sh
pnpm install
cp .env.example .env    # NEBIUS_API_KEY is needed for anything that calls the model
pnpm dev                # http://localhost:3300
```

## Before you open a pull request

```sh
pnpm typecheck
pnpm test               # no API key needed
pnpm build
```

If you change prompts, the reader, the scorer or `src/lib/pdf-core.ts`, also run the model checks and say what changed:

```sh
pnpm fixtures && pnpm bench    # 3 fixture resumes, about 30 seconds: hidden text caught, ranking, consistency, profile, call
pnpm demo:test   # drives the real UI in a browser (both flows) on the made-up pile in fixtures/demo; needs pnpm dev
pnpm bench:fetch && pnpm bench:50 --limit 5   # a slice of the 50-resume benchmark
```

## Ground rules

- **Never commit real resumes.** Use `pnpm fixtures`, or the public benchmark data, which stays in the gitignored `bench/data/`.
- Keep scoring deterministic where it can be: totals, recommendations and evidence checks live in `src/lib/text.ts`, not in prompts.
- Prompts must not use protected or proxy attributes (age, gender, nationality, photos, school prestige, employment gaps).
- Match the surrounding style. The UI uses the design tokens in `src/app/globals.css`.
