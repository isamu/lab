# Moving Our Builds to a Shared Cache

Before the change, a full build took 14 minutes on every pull request. Now a typical build takes 3 minutes, because only the packages that changed are rebuilt.

The shared cache also removed a whole class of flaky failures and cut our cloud bill. Its key includes the lockfile hash, so a dependency update can no longer reuse a stale result.

We rolled it out over two weeks in March 2026, one repository at a time. We kept a rollback switch in place and never used it.
