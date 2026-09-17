# p24-web-grader

Canonical public grader for the P-24 Web Technologies and Web Design practicals.
Each practical is scored out of **80 points** using eight observable behaviours
worth 10 points each. The same commit and grader version always produce the
same result.

Student repositories call the reusable workflow from the `semester-2026`
branch. A practical becomes active only when its id is added to
`published.json` on that branch.

PR01 is active now. PR02 is already implemented and tested in this repository,
but remains inactive until it is added to the release manifest.

## Layout

| Path | Purpose |
| --- | --- |
| `published.json` | Grader version and active practical ids. |
| `labs/<labId>/` | Public Vitest suite and rubric for one practical. |
| `src/run.mjs` | Runs the active checks and writes Markdown and JSON results. |
| `scripts/audit-submission.mjs` | Verifies the exact commit and grading workflow. |
| `canonical/student-grade.yml` | Canonical workflow for every student repository. |
| `fixtures/pass` | Known-good cumulative solution used by integration tests. |
| `fixtures/starter` | Incomplete starter used to verify partial scores. |

## Grade a checkout

```sh
node src/run.mjs \
  --student-root /absolute/path/to/p24-web-student \
  --sha <40-character-commit-sha> \
  --summary-file summary.md \
  --result-file result.json
```

The grader temporarily stages its tests in `.p24-web-grader/` inside the
checkout and removes them on every exit path.

| Exit code | Meaning |
| --- | --- |
| `0` | Every active practical reached its pass mark. |
| `1` | At least one active practical is below its pass mark. |
| `2` | Infrastructure error; no trustworthy grade was produced. |

## Audit an exact submission

```sh
node scripts/audit-submission.mjs \
  --student-root /absolute/path/to/p24-web-student \
  --expected-sha <40-character-commit-sha>
```

The audit requires a clean checkout at the submitted SHA and compares the
student workflow with `canonical/student-grade.yml` byte for byte.

## Development

```sh
npm ci
npm test
```

Node.js 22.13 or newer is required.
