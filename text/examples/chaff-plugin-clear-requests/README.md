# chaff-plugin-clear-requests

An example [chaff](https://isamu.github.io/lab/) rule pack, written in YAML only: no code runs when chaff loads it.
It is not published; copy it to start your own.

| id | what it is |
| --- | --- |
| `clear-requests/vague-deadline` | a request whose deadline is "soon" or 近日中 rather than a date (`rewrite.depth: light`) |
| `clear-requests/formal-register` | a casual form (don't, ないけど) in a formal document (`rewrite.depth: register`) |
| `clear-requests/strict-requests` | a preset that raises both rules a level |

Each rule takes its words from `lexicons/<language>/`, so a document in a language with no list there is reported as not
run for that rule, not passed.

## Use it

```yaml
# chaff.yaml
plugins:
  - ./path/to/chaff-plugin-clear-requests # or the package's name once it is installed
style: clear-requests/strict-requests # optional
```

## Layout

```text
package.json                 "chaff": { "apiVersion": 1 } marks the folder as a rule pack
rules/*.yaml                 one rule per file, written as under custom_rules
lexicons/<language>/*.yaml   the word lists, one file per list and language
styles/*.yaml                presets
```
