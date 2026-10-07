# Moving our CI cache to Redis 7.4

Posted on Thursday, 1 October 2026

Last month our build cache became the slowest part of CI. This post describes how we moved it from a disk cache to Redis 7.4, and what we measured. See [the results](#results) if you only want the numbers.

## Setting up Redis

We run Redis 7.4 in a container next to the build agents:

```bash
docker run --name ci-cache -p 6379:6379 -d redis:7.4
```

## `cachectl warm`

Before each nightly build we fill the cache from the last successful build:

```bash
cachectl warm --from last-green
```

## Results

Over the two weeks up to Thursday, 15 October 2026, the median build took 6 minutes instead of 11. The cache missed on 3% of the builds, mostly after a dependency update.

## What we would do differently

We would have measured the disk cache for longer before moving. The [setup section](#setting-up-redis) lists everything we ran.
