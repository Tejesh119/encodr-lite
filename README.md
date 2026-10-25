# Encodr Lite — Intern Take-Home

Thanks for taking the time on this. **Encodr Lite** is a small media-transcoding dashboard: a
signed-in user creates an encode **job** from a media URL, presses **Start encode**, watches the
progress update live, and sees the output files when it finishes.

The full brief — the six tasks, what we look for, and the ground rules — is in **`BRIEF.md`**.
**Read that first.** This file is just how to run things, and it's where you write up your work when
you're done.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:run     # tests (one example test is included and passes)
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

Requires **Node 20+** (`.nvmrc` says 20).

**Demo login:** `demo@encodr.dev` / `password123`

On a fresh checkout, sign-in works and the app loads, but the jobs list shows an error and the two
main screens are placeholders. That's expected — `GET /api/jobs` returns a 501 until you write it.
Search the project for `TODO(candidate)` to find everything that's yours; there are six.

Nothing here needs a database. State lives in memory, so restarting the dev server wipes your jobs.
That's fine — don't work around it.

## Where things are

```
app/
  signin/page.tsx              working sign-in — your example of RHF + Zod
  (app)/layout.tsx             route guard for everything signed-in
  (app)/jobs/page.tsx          TASK 4 — the create-job form
  (app)/jobs/[id]/page.tsx     TASK 5 — run controls, progress, results
  api/auth/login/route.ts      provided
  api/jobs/route.ts            TASK 2 — list + create
  api/jobs/[id]/route.ts       provided — your example route handler
  api/runs/route.ts            provided — starts a run
  api/runs/[id]/route.ts       provided — the endpoint you'll poll
lib/
  types.ts                     the data model + the run TIMELINE. Read this first.
  schemas.ts                   TASK 1 — source-URL validation
  server/auth.ts               provided — token signing
  server/http.ts               provided — json / error / withAuth / validationError
  server/store.ts              TASK 3 — computeRun()
  client/api.ts                provided — the fetch wrapper
  client/auth-context.tsx      provided
  client/hooks.ts              worked React Query examples + two TODOs
  client/use-run-polling.ts    TASK 5 — the polling hook
components/                    provided — StatusBadge, ProgressBar
__tests__/                     TASK 6 — your tests go here
```

## A suggested first hour

If you're not sure where to start:

1. `npm install && npm run dev`, sign in, look around. The jobs list will show an error — good, that's
   your first task.
2. Read `lib/types.ts` top to bottom. It's short and it's the whole data model.
3. Read `app/api/jobs/[id]/route.ts` — a complete route handler — then write Task 2 in the same style
   and check it with the curl commands in the file.
4. The list page lights up. Now do Task 1, then Task 3 (tests first).

## Useful to know

- `https://cdn.example.com/videos/corrupt.mp4` is rigged to **fail** partway through its run. Use it
  to build the error path.
- A run takes about **12 seconds** from start to finish, so you won't be waiting around.
- Run timings are constants in `TIMELINE` (`lib/types.ts`). Use them instead of typing numbers, so
  your tests and ours agree.
- `computeRun` takes `now` as an argument on purpose — you can test the 8-second mark without
  waiting eight seconds.

---

# Your write-up

### What's working

All six tasks are done and nothing is knowingly broken.

- **Source URL validation (`lib/schemas.ts`)**: `sourceUrlSchema` rejects an empty value, something that isn't a URL, any protocol other than http or https, and a URL with no path (for example `https://cdn.example.com`). The create-job form and the `POST /api/jobs` route use the same schema.
- **Jobs API (`app/api/jobs/route.ts`)**: `GET` lists jobs and `POST` creates one. Both go through `withAuth`. A body that fails validation, including malformed JSON, gets a 422 with per-field messages. A valid one gets a 201.
- **Run state machine (`computeRun` in `lib/server/store.ts`)**: A pure function of the run record and the current time, so it can be tested without waiting.
- **Create-job form (`components/create-job-form.tsx`, used on `/jobs`)**: Errors show under the field before anything is sent, the list updates without a reload, and a 422 from the server is mapped back onto the right field.
- **Live progress (`lib/client/use-run-polling.ts` and `app/(app)/jobs/[id]/page.tsx`)**: Start, live stage, progress bar and log, a failure panel with Retry, and a results table when the run completes.
- **Tests (`__tests__/`)**: 24 tests: 5 for the URL schema, 15 for `computeRun`, 4 for the form. `npm run typecheck`, `npm run test:run` and `npm run build` all pass.

The jobs API has no automated tests of its own. I checked it by hand with curl: 401 without a token, 200 with an empty list, 422 for a bad URL, 201 for a good one, and the new job showing up in the list.

### How to see the failure path

Use the corrupt URL: `https://cdn.example.com/videos/corrupt.mp4`

1. Sign in (`demo@encodr.dev` / `password123`) and go to `/jobs`.
2. Create a job with that URL.
3. Open the job and click Start encode.
4. It goes through `QUEUED` and `DOWNLOADING` and into `TRANSCODING` like a normal run. At 8 seconds it turns `FAILED`. The progress bar turns red and stays at about 67%, a red panel shows the error message, and the job's badge changes to `FAILED`.
5. Click Retry encode to start a fresh run. The log starts empty again.

### Decisions and assumptions

**Validation**
- One schema for both sides. The form and the server both use `createJobSchema`, so they can't drift apart, and the server still checks because the form isn't the only way to call the API.
- `sourceUrlSchema` uses a single `superRefine` that returns after the first problem. In Zod 4, chaining `.min(1)` and `.refine(...)` gives an empty string two messages, which looks wrong under one field. Now each bad input gets exactly one message.
- A bare domain counts as "no path". `new URL("https://cdn.example.com").pathname` is `/`, so I reject that.
- If someone calls the API without a `sourceUrl` key at all, they get Zod's generic type message ("Invalid input: expected string, received undefined") instead of "Source URL is required". The form always sends a string, so it never hits this. I left it.

**computeRun**
- Elapsed time is `now - startedAt`, clamped to 0 so a clock that is slightly behind can't give negative progress.
- Stage boundaries are half-open, so exactly 2000 ms is `DOWNLOADING` and exactly 12000 ms is `COMPLETED`. All boundaries use the `TIMELINE` constants.
- The failure check for the corrupt URL comes before the completion check. Otherwise a corrupt run that is polled after 12 seconds would wrongly show `COMPLETED`.
- Progress is `Math.round(elapsed / 12000 * 100)`, capped at 100. For a failed run, elapsed is capped at the failure time, so the bar freezes at about 67%. One side effect: the last ~60 ms of `TRANSCODING` round up to 100%, so the bar can read 100% a moment before the stage becomes `COMPLETED`. `Math.floor` would avoid that. I left it because a one-second poll will almost never land in that window.
- I wrote the tests first and committed them separately, so the history shows them failing before the implementation.

**Create-job form**
- The form is its own component so it can be tested without the page around it.
- It submits with `mutateAsync` inside try/catch, clears the form error at the start of each submit, and resets only after a success.
- Server field errors are mapped onto inputs with a small type guard, so there is no `as` or `any`. If an error comes back that doesn't map to a field (a 500, a network failure, an unknown key), a general message is shown, so a failure is never silent.
- The submit button is disabled by `isSubmitting` alone. The handler awaits the whole request, so that one flag already covers it.

**Polling hook**
- `fetchRun` is a plain function, not `useQuery` with `refetchInterval`. The loop has to keep a log across polls, stop exactly at a terminal stage, and reset when the run changes, and that is easier to follow written out.
- The first poll runs immediately. After that it uses a chained `setTimeout`, so the next request only starts one second after the previous one finished. With `setInterval`, a slow response would let requests pile up.
- Cleanup does three things: `clearTimeout` for the pending timer, `AbortController.abort()` for the request in flight, and a `cancelled` flag that is checked after every await so nothing writes to state afterwards. A cancelled request is ignored, not shown as an error.
- Polling stops when the run reaches `COMPLETED` or `FAILED`, and then `onFinished` is called. It is read through a ref, so a new callback on each render doesn't restart the effect or leave a stale one behind.
- Any failed request (404, 401, network) stops polling and sets `fetchError`. That also means a one-off network blip stops it. I chose that over retrying forever.
- The log only adds a message if it differs from the last one.

**Detail page**
- The panel is one derived value: idle, running, failed or completed, worked out from the run id and the polled run. It isn't stored separately, so contradictory states can't be written.
- Start and Retry use the same `useStartRun` mutation. A new run id resets the hook's state.
- When a run finishes, the job detail and job list queries are invalidated, so the badges update without a reload.
- If you leave the page during a run and come back, the page starts at idle. The badge still shows the server's status. Clicking Start would begin another run for the same job.

### What was hardest

The polling hook. Getting it to fetch and show progress was the easy part. Making it stop correctly was the real work. There are three separate things to clean up when the component unmounts or the run id changes: the pending timer, the request already in flight, and any state update that arrives after that. Clearing only the timer lets a late response write into a component that is gone, and a cancelled flag alone leaves the timer running. I ended up with all three, and I made sure an aborted request isn't shown as an error.

The other part that took thought was the schema. Zod 4 reports two messages for an empty string when checks are chained, so I wrote the schema tests before the implementation and built it around a single `superRefine` instead.

### What I'd do next

- Resume polling when someone returns mid-run, by starting from the job's `latestRunId`, and disable Start while a run is active.
- After Retry, the old failed panel can show for one render before the new run's state resets. Only using the polled run when its id matches the current run id would fix that.
- Retry a few times on a network error before giving up, instead of stopping at the first failure.
- Add tests for the route handlers, and a test for the polling hook with fake timers that checks it stops after a terminal stage.
- Return "Source URL is required" when the field is missing from an API request, not Zod's generic message.

### How I used AI tools

I used an AI coding assistant in my IDE and Claude in chat. I had the assistant explain each step before it changed anything and wait for my approval, I checked the results myself, and I decided each commit message. I wrote the commit history as I went instead of in one big commit.

