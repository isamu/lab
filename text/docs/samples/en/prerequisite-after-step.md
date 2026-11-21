<!-- chaff-sample
rule: prerequisite-after-step
genre: docs/manual
file: printer-firmware.md
-->

# Prerequisite written after the steps (`prerequisite-after-step`)

**Where it helps:** manuals, help pages, runbooks. Any numbered procedure that needs something done first.

## Original

```markdown chaff-before
# Updating the printer firmware

1. Download the firmware file from the support page.
2. Copy the file to a USB stick.
3. Insert the stick into the port on the front of the printer.
4. Choose **Settings** and then **Update from USB**.

Before you begin, make sure no print jobs are waiting in the queue.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual printer-firmware.md

printer-firmware.md   docs/manual · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    Before you begin, make sure no print jobs are waiting in the queue.

  ·  Prerequisite written after the steps

     This prerequisite comes after the steps it applies to
     When "Before you begin, stop the order service." comes after the numbered steps, the reader has done the steps by the time they read it. Prerequisites, permissions and preparation go before the steps. It happens when a sentence is added at the end or sections are reordered. A sentence opening with "Before you begin" or "Before you start" after a numbered procedure (three steps or more) in the same section is reported.

     → Move the sentence before the steps, into a "Before you begin" section or right above the list.

     Relax this rule:  npx chaffjs relax prerequisite-after-step


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Updating the printer firmware

Before you begin, make sure no print jobs are waiting in the queue.

1. Download the firmware file from the support page.
2. Copy the file to a USB stick.
3. Insert the stick into the port on the front of the printer.
4. Choose **Settings** and then **Update from USB**.
```

## How it was fixed

The guide tells the reader to clear the print queue only after the four steps.
Someone following it does the steps in order, starts the update with jobs still waiting, and reads the warning when it is too late.
The sentence was probably added at the end after a support call.

The fix moves it above the steps, where it is read before the first one.
chaff reports a sentence opening with "Before you begin" or "Before you start" that comes after a numbered procedure of three steps or more in the same section.
A sentence that names one step ("Before step 4, ...") is not reported.

## Settings

A prerequisite after its steps is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your procedures put a reminder at the end on purpose, turn it off:

```yaml chaff-settings
rules:
  prerequisite-after-step: off
```

It runs for technical documents, manuals and blogs.

```text chaff-explain
$ npx chaffjs explain prerequisite-after-step --genre docs/manual

  Prerequisite written after the steps   (prerequisite-after-step)

  When "Before you begin, stop the order service." comes after the numbered steps, the reader has done the steps by the time they read it. Prerequisites, permissions and preparation go before the steps. It happens when a sentence is added at the end or sections are reordered. A sentence opening with "Before you begin" or "Before you start" after a numbered procedure (three steps or more) in the same section is reported.

  How to fix: Move the sentence before the steps, into a "Before you begin" section or right above the list.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax prerequisite-after-step --why "reason"
```

[All samples](README.md)
