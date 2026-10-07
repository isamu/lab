# wrapkit

wrapkit wraps text to a fixed width for terminals and plain-text email. The current release is 3.2.0.

## Install

```bash
npm install wrapkit@3.1.0
```

## Quick start

```js
import { wrap } from "wrapkit";

console.log(wrapLines("Plain text reads best in short lines.", 20).join("\n"));
```

By default each line is at most 80 characters; pass a width to change it.

## Options

Pass `prefix` to quote every line and `hyphenate: true` to break long words. The older `indent` option is deprecated; use `prefix` instead.

```js
wrap(text, 40, { indent: 2 });
```

See the [API reference](#api-reference) and the [changes](#changelog).

## API reference

The full reference is in `docs/api.md`.

## Changes

- 3.2.0 (2026-09-14): `measure` counts wide characters as two columns.
- 3.1.0 (2026-10-02): Added `hyphenate`.
- 3.0.0 (2026-03-20): `indent` is deprecated in favour of `prefix`.
- 2.4.2 (2026-01-11): Fixed trailing spaces at the end of a wrapped line.
