<!-- Sample (a), human style. Written by an AI (Claude) for chaff's tests. Same content as ai.md and rewritten.md. -->

# The flaky test was a time zone

One test in our inventory API failed on CI about once in thirty runs and never on our laptops. It was always the `calcDueDate` test.

I'll admit we ignored it for three weeks. A rerun took twelve minutes and always passed, so there was never a reason to stop and look. But everyone on the team learned the name of that test by heart, because we all ended up watching the CI page before every merge. Eventually I collected the logs of the failed runs and put them side by side.

Every failure had run between midnight and 9 a.m. Tokyo time. Our CI runners use UTC. The test took today's date from `new Date()` and expected the due date to be seven days later, so on a Monday morning in Tokyo the runner still thought it was Sunday. It never failed on our laptops because we ran the tests during the day, on machines set to Tokyo time.

We fixed it in three places. The test now pins the clock with `jest.useFakeTimers` and `setSystemTime`. The workflow sets `TZ=Asia/Tokyo`. And the production code decides where a day ends by passing `timeZone: "Asia/Tokyo"` to `Intl.DateTimeFormat`, because fixing only the test would have left the same bug waiting for the day a server ran in UTC.

The test has not failed once in the two weeks since. A test that touches the clock depends on when and where it runs, so the next time something fails "sometimes", I will start by lining up the times it failed.
