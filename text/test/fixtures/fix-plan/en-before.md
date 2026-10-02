# Moving Our Builds to a Shared Cache

In today's fast-paced world, build speed plays a crucial role in how a team ships. Let's delve into how we moved our builds to a shared cache.

The key point is that the cache is not just a speed-up. It's a change in how the whole team works. Moreover, it removed a whole class of flaky failures. Additionally, it cut our cloud bill.

Here's the thing: before the change, a full build took 14 minutes on every pull request. After the change, a typical build takes 3 minutes, because only the packages that changed are rebuilt. Furthermore, the cache key now includes the lockfile hash, so a dependency update can no longer reuse a stale result.

The migration was planned meticulously. It was rolled out over two weeks in March 2026, one repository at a time. A rollback switch was kept in place — just in case — and it was never used.

In conclusion, the shared cache is a testament to what careful engineering can achieve. I hope this helps!
