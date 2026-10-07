# Keeping test fixtures between CI runs

Our end-to-end suite spent most of its time building the same fixtures again on every run, so we started keeping them in the CI cache and building them again only when the schema files that describe them change between two commits.

## The cache key

The key is a hash of the schema files and the fixture generator. When either changes, the fixtures are built again. Otherwise the job restores them in a few seconds.

## restoreFixtures

The restoreFixtures step restores the fixtures. It runs before the tests, reads the archive from the cache, and fails the job when the archive is damaged.

## Results

On an ordinary pull request, the suite now takes 7 minutes instead of 18.
