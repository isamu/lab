<!-- Sample (b), generated style. Written by an AI (Claude) for chaff's tests. Not human writing. Same content as human.md and rewritten.md. -->

# Solving Our Flaky Test Problem — The Hidden Trap of Time Zones

In this article, we'll delve into how we tracked down a flaky test on CI, from identifying the root cause to implementing a robust fix.

## What Was Happening

One test in our inventory API was failing on CI roughly **once every 30 runs**. It never failed locally.

This wasn't just a flaky test. It was a **silent drain on the team's time**.

To be honest, we ignored it for three weeks. A rerun always passed.

But each rerun took 12 minutes. That adds up. Before long, we were losing hours.

## Investigating the Root Cause

The key point is to line up the logs of the failed runs.

Here's what we found:

- **Every failure** ran between midnight and 9 a.m. Tokyo time
- Our CI runners use **UTC**
- The test took today's date from `new Date()` and expected the due date to be seven days later

In other words, on a Monday morning in Tokyo, the runner still thought it was Sunday.

What's important is that the error was silently swallowed. The date shift threw no exception, and the test quietly broke.

## The Solution

Here's how we fixed it:

- **Test**: pinned the clock with `jest.useFakeTimers` and `setSystemTime`
- **Workflow**: added `TZ=Asia/Tokyo`
- **Production code**: passed `timeZone: "Asia/Tokyo"` to `Intl.DateTimeFormat` to decide where a day ends

Moreover, fixing the production code was crucial. It's not only about the test — it's about being ready for the day a server runs in UTC.

## Results

In the two weeks since the fix, the test has **not failed once**.

## Conclusion

Time-dependent tests are not just bugs; they are a reflection of the environment itself. By tackling flaky tests one by one, teams can unlock significant gains in productivity.

I hope this helps! Let me know if you have any questions.
