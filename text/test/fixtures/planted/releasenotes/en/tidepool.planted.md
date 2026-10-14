# Changelog

All notable changes to Tidepool, a command-line tool that keeps photo folders in sync, are recorded here. The newest release comes first.

Version numbers have three parts: major, minor and patch.

## 4.2.0 - 2026-10-06

This release includes the following four fixes:

- Sync no longer stops when a file name contains a colon.
- The progress bar shows the right total for folders of more than 10,000 files.
- Hidden files are skipped again when `--skip-hidden` is set.

It also lets you sort the log by file size.

Supported: October 6, 2026 to October 5, 2025

## 1.4.1 - 2026-08-18

Fixed a crash in 4.1.0 when the target folder was on a network drive.

## 4.1.0 - 2026-11-07

Added the `--dry-run` option, which lists the files a sync would copy without copying them.

## 4.0.0 - 2026-05-12

Dropped support for Node.js 18.

## Upcoming

Release 4.3.0 is planned for Wednesday, December 8, 2026.

If you use 4.0.0 or earlier, update to v4.2.0. Your settings file carries over unchanged.
