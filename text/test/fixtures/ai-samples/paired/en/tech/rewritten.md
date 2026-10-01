<!-- Sample (c), ai.md rewritten. Written by an AI (Claude) for chaff's tests. Same content as human.md and ai.md. -->

# Our flaky test was a time zone problem

One test in our inventory API failed on CI roughly once every 30 runs and never locally. This post describes how we found the cause and fixed it.

## What was happening

We ignored the failure for three weeks, because a rerun always passed. Each rerun took 12 minutes, though, and those waits added up.

## Finding the cause

When we lined up the logs of the failed runs, every failure had run between midnight and 9 a.m. Tokyo time. Our CI runners use UTC. The test took today's date from `new Date()` and expected the due date to be seven days later. On a Monday morning in Tokyo, the runner still thought it was Sunday.

The date shift threw no exception, so it never surfaced as an error.

## The fix

The test now pins the clock with `jest.useFakeTimers` and `setSystemTime`, and the workflow sets `TZ=Asia/Tokyo`. We also changed the production code to decide where a day ends by passing `timeZone: "Asia/Tokyo"` to `Intl.DateTimeFormat`. Fixing only the test would have left the same shift in place for any server that runs in UTC.

## Results

The test has not failed once in the two weeks since. A test that touches the clock depends on when and where it runs. When one fails now and then, start by lining up the times it failed.
