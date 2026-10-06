# tidyq

tidyq is a command-line tool that makes the column names and date formats of CSV files consistent. The current release is 2.4.0.

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Options](#options)

## Installation

tidyq needs Node.js 22 or later. Install version 2.4.0 from npm:

```bash
npm install --global tidyq@2.4.0
```

## Usage

```bash
tidyq fix sales.csv --out sales.fixed.csv
```

A single file can be up to 200 MB. Larger files are processed in 50 MB parts with `--split`.

## `tidyq check`

Lists what would change, without rewriting the file.

```bash
tidyq check sales.csv
```

## Configuration

Write the date format to use in `tidyq.json`.

```json
{ "dateFormat": "YYYY-MM-DD", "encoding": "utf-8" }
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--out` | none | The file to write |
| `--split` | 50 MB | The size of each part |
| `--encoding` | utf-8 | The encoding to read |

See [Configuration](#configuration) for the settings file.
