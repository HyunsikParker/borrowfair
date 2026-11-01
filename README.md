# BorrowFair

A local equipment-lending planner for a small student club or lending desk. Compare future requests, inspect conflicts and see what one extra unit would change before making reservations.

BorrowFair is a planning prototype. It does not reserve equipment, contact borrowers, manage checkout or synchronize between devices. The included film-club round is fictional.

[Open the app](https://hyunsikparker.github.io/borrowfair/) · [Watch the walkthrough](https://hyunsikparker.github.io/borrowfair/demo.html)

## Run

Use Node.js 22 or later. There are no runtime packages to install.

```sh
npm start
```

Open **http://127.0.0.1:4193**. Choose another port with `BORROWFAIR_PORT=4194 npm start`. To host the app as static files, serve `index.html`, `styles.css` and `src/` together. Relative module paths support a repository subdirectory. Opening the HTML directly with `file://` is not supported.

## Walkthrough

[Watch the captioned recording](demo.html) or read its [transcript](media/TRANSCRIPT.md). The recording shows actual browser interactions using the fictional example. It has no audio.

## Try the fictional round

1. The example contains 12 requests from 11 borrowers, with one camera, one microphone and two tripods. The complete search selects nine borrowers; the first-come comparison selects six under the same capacity and keep constraints.
2. Open **Why not selected?** on Dara's camera-and-microphone request. Its equipment must be available together, and the explanation lists the conflicting dates and selected requests.
3. Choose **Keep** on Nora's long request, R01. The plan preserves that choice and serves six borrowers. Release the keep to compare all requests again.
4. In **Would one extra unit help?**, compare an extra tripod. Ten borrowers fit, including Ian. Inventory remains unchanged until **Apply extra unit** is selected.
5. Edit requests and equipment, or use **Workspace options → Start a blank workspace**. Export a workspace backup before replacing existing work.

These counts demonstrate the algorithm on one constructed example. They are not measured improvements at a real lending desk.

## Allocation rule

The planner applies these priorities in order:

1. Include every request explicitly kept by the coordinator. Conflicting keeps stop the plan with an explanation.
2. Maximize the number of distinct borrowers served, allowing one request per borrower in the round.
3. Among equal-size plans, minimize the total previous-loan count of the selected borrowers.
4. If still tied, prefer the smaller sum of request dates, then the lexicographically earlier set of request IDs.

Multiple requests under the same borrower alias are alternatives, not multiple entitlements. Aliases are matched case-insensitively, and their previous-loan counts must agree. The app does not infer identity or verify the supplied history.

This rule can favor several short loans over one long loan. It does not evaluate need, disability or project importance, and it is not a universal definition of fairness. The coordinator can review the trade-offs and keep a request that must be included.

Each requested equipment quantity must fit on every occupied date. Pickup is inclusive and return is exclusive: a November 9–11 loan occupies November 9 and 10. Enter a later return date if handover or inspection needs an extra day. This model has no partial-day slots or live stock feed.

## Search and limits

The branch-and-bound search runs in a Web Worker, keeping editing separate from computation. It starts with a feasible first-come plan and searches up to 120,000 states. A complete search reports completion for the entered problem. A limited search reports the best feasible plan found so far without claiming optimality. Every result is checked for capacity, unique borrowers and mandatory keeps.

The prototype accepts at most 48 requests, eight equipment types, 20 units per type and a 31-day span. Dates must be valid dates in 2000–2099. Larger or time-of-day scheduling problems are outside its scope.

Adding one unit is a counterfactual comparison. The display names both added and displaced borrowers, and **Apply extra unit** is a separate action. An extra camera may not help when a bundled request also needs an unavailable microphone.

## Save, export and restore

The browser stores the workspace locally. No application endpoint receives the request contents. Use aliases rather than contact details. Browser data and exported JSON are not encrypted.

- **Export workspace** downloads a restorable workspace file.
- **Export plan** downloads the input, selected IDs, rule, search-completion flag and per-request explanations. It is a draft allocation, not a reservation receipt.
- Import validates a file and previews its contents before explicit replacement. Plan reports are not workspace-backup files.
- A storage failure leaves the current draft available for export and displays **Not saved**.
- Unreadable saved bytes remain intact until an explicit recovery or replacement action.
- A change in another tab blocks stale writes. Web Locks serialize cooperative writes where available; a value check is used as a fallback. This is not multi-user synchronization.

The local server binds to loopback. Static hosting may log ordinary visitor requests according to the host's privacy policy; that is separate from the app's local workspace storage. There is no analytics script, external font or runtime model API.

## Verification

```sh
npm test
```

Eleven Node tests passed, including 400 deterministic small rounds compared with a separate exhaustive subset oracle. Tests cover quantities, return boundaries, keeps, conflicting aliases, invalid dates, limited search, input order and the extra-unit comparison.

The browser checks use Playwright and an installed Google Chrome:

```sh
# With Playwright available in your Node environment and npm start running:
node test/ui.mjs
```

Ten browser scenarios passed on Chrome 156.0.8078.79. The recorded checks include editing, deletion, previewed restore, malformed import, export round trips, cross-tab stale writes, unavailable storage, damaged saved data, keyboard dialog handling and layout widths down to 320 CSS pixels. Automated axe checks found no violations in the three main views for the selected WCAG A/AA rules. This does not establish full accessibility conformance, screen-reader usability or physical-device support. See [VALIDATION.md](VALIDATION.md).

## Context and authorship

[Cornell Mann Library's equipment page](https://mann.library.cornell.edu/laptops-equipment) describes a real equipment-lending service with limited loan periods and first-come availability. It is background context, not an endorsement, integration or claim that the library needs this prototype. No institutional or borrower data is used.

BorrowFair was started on November 1, 2026, after the GenHacks build window opened. OpenAI Codex generated and revised the implementation, tests, interface copy and documentation. No earlier finished hackathon application was copied. The allocation engine is deterministic; it does not use an AI model at runtime. No user interviews, field deployment, official judging result or award is claimed.

Released under the [MIT License](LICENSE).
