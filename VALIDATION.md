# Validation record

## Observed on November 1, 2026

| Check | Result | Scope |
|---|---|---|
| Node test suite | 11 passed | Includes a separate exhaustive oracle on 400 seeded small rounds |
| Browser workflows | 10 passed | Google Chrome 156.0.8078.79 on macOS; synthetic data |
| Automated accessibility | No violations reported | axe WCAG 2 A/AA and 2.1 AA tags on plan, inputs and guide views |
| Responsive layout | No document overflow at 320, 390 and 768 CSS pixels | The equipment/date table intentionally scrolls within its own region |
| Visual inspection | Desktop and mobile captures reviewed | Actual rendered text, stock, counts and dated occupancy table |
| Walkthrough playback | Passed | 116.16-second captioned MP4; play, pause and seek to 64 seconds; six encoded frames reviewed |
| Video byte ranges | Passed | A 100-byte request returned 206; an out-of-bounds request returned 416 |
| Module syntax | Passed | `node --check src/app.js` |

Browser coverage: example rendering, keeping/releasing requests, conflicting keeps, extra-unit preview/apply, editing and deleting a request, invalid-date rejection, workspace export/restore, malformed import preservation, keyboard dialog closure/focus return, zero-stock planning, cross-tab stale-write protection, failed storage writes and preservation/replacement of unreadable saved bytes.

The initial browser harness made three assertions before asynchronous file or storage operations had finished. Completion-state waits fixed those test races. A Chrome headless capture problem repeated compositor tiles on narrow captures; a larger capture window and disabled GPU produced intact viewport images. The page itself contained one header and one main heading. Native disclosure of the allocation rule was added to keep the narrow layout focused on the plan.

The independent oracle enumerates all subsets of small generated inputs, counts equipment occupancy directly and ranks feasible subsets. It does not call the production planner's placement or comparison functions. Agreement on these cases is not a proof for arbitrary input, and a budget-limited result does not inherit an optimality claim from these tests.

The first video capture used an opaque-origin wrapper, which denied browser storage and failed to render the caption area in the video. It was rejected during frame review. The recording wrapper now navigates on the app origin, checks for unexpected storage errors before filming, and reserves a strip outside the app. The browser recorder still omitted that strip, so timed text cards were composited into it after capture. The app area was not altered. A local video-seeking failure was fixed by serving byte-range responses.

No real borrower data, user study, screen-reader session, physical phone, multi-device synchronization test, long-running deployment or official competition score is included in this evidence. The app does not claim those results.
