# Changelog

All notable changes to wrapkit, newest first. Versions follow semantic versioning.

## 3.2.0 - 2026-09-14

- `measure` counts wide characters as two columns.
- Install with `npm install wrapkit@3.1.1`.

## 3.1.1 - 2026-05-08

- Fixed a crash when `width` is less than 1.

## 3.3.0 - 2026-06-02

- Added the `hyphenate` option.

## 3.0.0 - 2026-03-20

- `indent` is deprecated; use `prefix`.
- `wrap` returns an array of lines instead of one string.

## 2.4.2 - 2026-01-11

- Fixed trailing spaces at the end of a wrapped line.
