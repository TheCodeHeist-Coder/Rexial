# Initial dependency-audit triage

Observed 2026-11-25 22:57 UTC against main `dc7a83c` and pnpm 9.0.0, Node 22. The lockfile SHA-256 is `79905560a909a29ff2e4667dfbeb97ce3a7a56e28ae7b90600e5be0fcb68abdf`. No dependency or lockfile change is included here.

| Scope | Low | Moderate | High | Critical | Advisory records |
| --- | ---: | ---: | ---: | ---: | ---: |
| Workspace | 14 | 132 | 86 | 1 | 216 |
| `--prod` dependency selection | 10 | 110 | 54 | 1 | 165 |

The registry metadata counts affected dependency entries; advisory records can cover multiple versions or paths and are not a count of exploitable application bugs. `--prod` excludes declared development dependencies, but Prisma CLI and some build tooling are themselves declared regular dependencies, so this is not proof that every remaining package is deployed or reachable.

## Triage decisions

- **Existing bot fixes:** Dependabot has already opened [#263](https://github.com/TheCodeHeist-Coder/Rexial/pull/263) for `nodemailer` and [#264](https://github.com/TheCodeHeist-Coder/Rexial/pull/264) for `zod`. Review those changes rather than opening duplicate upgrade PRs. These are evidence that npm security updates are operating; they do not prove pip updates are operating.
- **Critical transitive entry:** [`proxy-addr` GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) is reported at 2.0.7 through `apps/admin-server > express > proxy-addr`; the advisory lists 2.0.8 as patched. Prioritize a compatible dependency update and regression tests. The installed-version match is confirmed; application exploitability has not been demonstrated here.
- **Tooling versus service code:** Prisma-related `hono`, `@hono/node-server`, `effect` and `mysql2` findings come through the Prisma toolchain, not direct application imports of those packages. Vite/Vitest/ESLint findings need build/dev-server context rather than being assumed to expose the production API. They remain tracked, not suppressed.
- **Direct application packages:** Review the remaining `axios`, `react-router`, `ws` and other direct-package advisories against their deployed usage and patched versions. Do not equate registry severity with demonstrated reachability.
- **Transitive fixes:** The table identifies the first parents reported by pnpm. Update the appropriate parent or use an explicitly reviewed compatible resolution, then rerun tests and both audit selections. No transitive advisory is declared permanently accepted or unfixable without checking the parent constraint.
- **Python:** `apps/genAI/requirements*.txt` is currently unpinned. A Dependabot configuration entry is useful, but does not establish resolved installed versions, a clean Python baseline, or a successfully opened pip security update. Establish compatible constraints/resolution separately before claiming that coverage.
- **Gate:** Keep this first audit report-only. Agree on remediation and any narrowly justified temporary exceptions before making high severity a required gate. Do not introduce a blanket ignore.

## Complete module inventory

Counts below are advisory records from the captured registry response, not distinct CVEs. All modules remain in the remediation inventory. “Direct” means declared in a workspace manifest, not proven runtime reachability.

| Module | Records | Highest severity | In `--prod` selection | Dependency relationship |
| --- | ---: | --- | --- | --- |
| `@babel/core` | 1 | low | no | Transitive via `apps/frontend>eslint-plugin-react-hooks` |
| `@hono/node-server` | 4 | high | yes | Transitive via `packages/db>prisma` |
| `@humanfs/node` | 1 | moderate | no | Transitive via `apps/frontend>eslint` |
| `@vitest/mocker` | 2 | moderate | no | Transitive via `apps/frontend>vitest`, `apps/http-server>vitest` |
| `ajv` | 1 | moderate | no | Transitive via `packages/eslint-config>eslint` |
| `axios` | 34 | high | yes | Direct: `apps/frontend:dependencies` |
| `baseline-browser-mapping` | 1 | moderate | no | Transitive via `apps/frontend>eslint-plugin-react-hooks` |
| `body-parser` | 2 | high | yes | Transitive via `apps/admin-server>express` |
| `brace-expansion` | 22 | high | yes | Transitive via `apps/frontend>eslint`, `apps/frontend>typescript-eslint`, `packages/eslint-config>typescript-eslint` |
| `browserslist` | 2 | high | no | Transitive via `apps/frontend>eslint-plugin-react-hooks` |
| `deepmerge-ts` | 1 | high | yes | Transitive via `packages/db>prisma` |
| `defu` | 1 | high | yes | Transitive via `packages/db>prisma` |
| `effect` | 2 | high | yes | Transitive via `packages/db>prisma` |
| `esbuild` | 1 | low | yes | Transitive via  |
| `flatted` | 2 | high | no | Transitive via `apps/frontend>eslint` |
| `follow-redirects` | 1 | moderate | yes | Transitive via `apps/frontend>axios` |
| `form-data` | 1 | high | yes | Transitive via `apps/frontend>axios` |
| `hono` | 43 | high | yes | Transitive via `packages/db>prisma` |
| `joi` | 6 | high | no | Transitive via `apps/http-server>wait-on` |
| `js-yaml` | 5 | high | no | Transitive via `apps/frontend>eslint`, `packages/eslint-config>eslint` |
| `lodash` | 2 | high | yes | Transitive via `packages/db>prisma` |
| `minimatch` | 7 | high | yes | Transitive via `apps/frontend>typescript-eslint`, `packages/eslint-config>eslint`, `packages/eslint-config>typescript-eslint` |
| `mysql2` | 2 | high | yes | Transitive via `packages/db>prisma` |
| `nanoid` | 3 | high | yes | Transitive via `apps/admin>vite` |
| `nodemailer` | 18 | high | yes | Direct: `apps/http-server:dependencies` |
| `path-to-regexp` | 2 | high | yes | Transitive via `apps/admin-server>express` |
| `picomatch` | 4 | high | yes | Transitive via `apps/admin>vite`, `apps/http-server>ts-node-dev` |
| `postcss` | 4 | high | yes | Transitive via `apps/admin>vite` |
| `proxy-addr` | 1 | critical | yes | Transitive via `apps/admin-server>express` |
| `qs` | 4 | moderate | yes | Transitive via `apps/admin-server>express` |
| `react-router` | 10 | high | yes | Direct: `apps/frontend:dependencies` |
| `source-map-js` | 1 | high | yes | Transitive via `apps/admin>vite` |
| `turbo` | 2 | moderate | no | Direct: `.:devDependencies` |
| `undici` | 8 | high | no | Transitive via `apps/frontend>jsdom` |
| `uuid` | 1 | moderate | yes | Direct: `apps/http-server:dependencies` |
| `valibot` | 1 | moderate | yes | Transitive via `packages/db>prisma` |
| `vite` | 10 | high | yes | Direct: `apps/frontend:devDependencies`, `apps/admin:devDependencies` |
| `ws` | 2 | high | yes | Direct: `apps/ws-server:dependencies` |
| `zod` | 1 | high | yes | Direct: `apps/http-server:dependencies` |

CodeQL source findings are a separate scan and require their own triage. Follow [SECURITY.md](../SECURITY.md) for exploitable source findings; do not publish a live exploit in the PR or this baseline.
