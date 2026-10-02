# chaff-plugin-example

An example [chaff](https://isamu.github.io/lab/) plugin. It is not published; copy it to start your own.

It ships:

| id | what it is |
| --- | --- |
| `example/no-tbd-dates` | a rule written in code: a date left as TBD, TBC or 未定 |
| `example/weasel-words` | a rule driven by a word list: "some say", と言われている |
| `example/weasel` | the word list, in English and Japanese |
| `example/careful` | a house style that raises both rules a step |

Every id is prefixed with the plugin's name, `example`, so none can collide with chaff's rules or another plugin's.

## Use it

```yaml
# chaff.yaml
plugins:
  - chaff-plugin-example # a package in node_modules
  # - ./chaff-plugins/team.mjs  # or a plugin of your own, by its path
style: example/careful # optional
```

```sh
npx chaff article.md
npx chaff explain example/no-tbd-dates
npx chaff relax example/weasel-words --why "quotes are attributed in the footnotes"
```

## Files

- `index.mjs`: the plugin. `definePlugin({ name, rules, lexicons, styles })` from `chaffjs/api`.
- `rules/no-tbd-dates.mjs`: a detector `(doc) => findings` and the words a reader sees (name, why, how to fix,
  an example).
- `rules/weasel-words.mjs`: a detector that reads `options.lexicon`, the plugin's `weasel` list in the document's
  language. A document in a language the list does not cover lists the rule as not run.
- `test/test_example.mjs`: the detectors tested as plain functions, with `node --test`.

Each file starts with `// @ts-check` and imports its types from `chaffjs/api` in JSDoc, so an editor checks a
detector against the API without TypeScript.

## Publish your own

1. Copy this folder. Name the package `chaff-plugin-<name>` (or `@scope/chaff-plugin-<name>`) and set `name` in
   `definePlugin` to `<name>` (or `@scope/<name>`). chaff refuses a plugin whose name does not match its package's.
2. Keep `chaffjs` as a peer dependency, so the plugin uses the chaff the project runs.
3. Point `main` (or `exports["."]`) at the plugin's file. chaff finds a package from the folder `chaff.yaml` is in, as
   Node's `require.resolve` does, so an `exports` with only an `import` condition is not found.
4. Remove `"private": true`, set a version, and run `npm publish`.

A detector must be pure and deterministic: read only the document, and return the same findings for the same text.
Loading a plugin runs its code, so a project should install only plugins it trusts.
