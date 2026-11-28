<!-- chaff-sample
rule: shell-prompt-mix
genre: technical/readme
file: README.md
-->

# Shell commands with and without a prompt (`shell-prompt-mix`)

**Where it helps:** READMEs, setup guides, runbooks. Any page whose commands the reader copies and pastes.

## Original

````markdown chaff-before
# Room display

Shows today's meeting room bookings on a screen by the door.

## Install

```bash
git clone https://example.com/room-display.git
cd room-display
yarn install
```

## Run

```bash
$ yarn start
```

## Test

```bash
yarn test
```

## Build for the screen

```bash
yarn build
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    ```bash

  ·  Shell commands with and without a prompt

     This block writes its commands with a prompt ($) differently from the other 3 blocks
     When "$ npm install" and "npm install" both appear in one document, the reader wonders whether to type the "$", and a copied command may fail. chaff compares shell blocks (```bash, ```console) whose every line has a prompt ($) with those where no line has one, and points at the fewer. A block that shows a command with its output (some lines prompted, some not) is not read. Which way is right is not decided.

     → Match the majority. For commands meant to be copied, leaving the prompt out avoids pasting it.

     Relax this rule:  npx chaffjs relax shell-prompt-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# Room display

Shows today's meeting room bookings on a screen by the door.

## Install

```bash
git clone https://example.com/room-display.git
cd room-display
yarn install
```

## Run

```bash
yarn start
```

## Test

```bash
yarn test
```

## Build for the screen

```bash
yarn build
```
````

## How it was fixed

Three blocks give the commands bare, ready to copy.
The block under "Run" starts with a "$" prompt.
A reader who copies it pastes the "$" too, and the shell answers "command not found", or they wonder whether every other block was meant to have one.

The fix drops the prompt, like the other blocks.
chaff does not decide which way is right; it points at the fewer blocks.
For commands meant to be copied, leaving the prompt out avoids the problem altogether.

## Settings

Only shell blocks (`bash`, `sh`, `console` and the like) are compared, and only those where every line has a prompt against those where no line has one.
A block that shows a command with its output is not read.
At `normal`, the fewer style is reported in two blocks or fewer; `strict` allows three, `relaxed` one.

To stop checking:

```yaml chaff-settings
rules:
  shell-prompt-mix: off
```

```text chaff-explain
$ npx chaffjs explain shell-prompt-mix --genre technical/readme

  Shell commands with and without a prompt   (shell-prompt-mix)

  When "$ npm install" and "npm install" both appear in one document, the reader wonders whether to type the "$", and a copied command may fail. chaff compares shell blocks (```bash, ```console) whose every line has a prompt ($) with those where no line has one, and points at the fewer. A block that shows a command with its output (some lines prompted, some not) is not read. Which way is right is not decided.

  How to fix: Match the majority. For commands meant to be copied, leaving the prompt out avoids pasting it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the fewer style appears in 3 blocks or fewer
  → normal   reported when the fewer style appears in 2 blocks or fewer
    relaxed  reported when the fewer style appears in 1 block or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax shell-prompt-mix --why "reason"
```

[All samples](README.md)
