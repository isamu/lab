# wrapkit API reference

wrapkit splits text into lines of a given width. This page describes version 3.2.0.

## Contents

- [wrap](#wrap)
- [measure](#measure)
- [Options](#option-list)

## wrap

```ts
wrap(text: string, width = 72, options?: WrapOptions, locale?: string): string[]
```

| Parameter | Type | Description |
| --- | --- | --- |
| `text` | string | The text to wrap |
| `width` | number | The longest line, in characters |
| `options` | WrapOptions | See [Options](#options) |

`width` defaults to 80 characters.

Returns: `string[]`, one entry per line.

```ts
const lines = wrapText("A long sentence to wrap.", 10);
```

## measure

```ts
measure(text: string, tabSize = 4): number
```

| Parameter | Type | Description |
| --- | --- | --- |
| `text` | string | The line to measure |
| `tabWidth` | number | The width of one tab |

Returns: `number`, the width of the line in columns.

measure returns the width as a string such as "12".

## Options

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | "" | Text put before every line |
| `hyphenate` | false | Break long words with a hyphen |
| `indent` | 0 | Deprecated since 3.0.0; use `prefix` |

```ts
const quoted = wrap(text, 60, { indent: 2 });
```
