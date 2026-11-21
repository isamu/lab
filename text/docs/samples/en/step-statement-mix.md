<!-- chaff-sample
rule: step-statement-mix
genre: docs/manual
file: setup.md
-->

# A step written as a statement among instructions (`step-statement-mix`)

**Where it helps:** setup guides, how-to pages, checklists. Any numbered procedure the reader follows one step at a time.

## Original

```markdown chaff-before
# Set up the label printer

1. Plug the printer into the mains and switch it on.
2. Connect it to the computer with the USB cable.
3. Open the Labels app and choose Add printer.
4. The app finds the printer and shows its name.
5. Print a test label to check the alignment.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual setup.md

setup.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The app finds the printer and shows its name.

  ·  List items in mixed forms

     "The app finds the printer and shows its name." opens with a noun phrase; the other items in this list open with a verb (1 of 5)
     Items in one list are easiest to compare when they share a form. When one item is a full sentence among noun phrases, or opens with a verb (Install …) among items that open with a noun (The server …), it reads as a different kind of thing. chaff does not decide which form is right; within one list it points at the items in the less common form.

     → Rewrite the odd item in the form the others use. If it really is a different kind of thing, move it to its own list or paragraph.

     Relax this rule:  npx chaffjs relax list-item-form-mix


─── line 6 ───────────────────────────────────────────────────

    The app finds the printer and shows its name.

  ·  A step written as a statement among instructions

     This step is a statement that opens with its subject, unlike the other 4 instructions
     A numbered procedure is a list of things for the reader to do. When "The installer asks for a password." sits among "Open the app." and "Run the installer.", the reader wonders whether that is a step to take too. In an English numbered list, chaff points at the few items that open with a subject and a verb (The installer asks, You click) among items that open with the verb. Japanese step endings (〜します / 〜してください against the rest) are checked by no-mixed-desumasu and list-item-form-mix, so this rule is for English only.

     → Write what the reader does, as an instruction. If it describes a result, make it a second sentence of the step before, or move it out of the list.

     Relax this rule:  npx chaffjs relax step-statement-mix


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Set up the label printer

1. Plug the printer into the mains and switch it on.
2. Connect it to the computer with the USB cable.
3. Open the Labels app and choose Add printer. The app finds the printer and shows its name.
4. Print a test label to check the alignment.
```

## How it was fixed

Each step tells the reader what to do: plug in, connect, open, print.
Step 4 is different: it says what the app does.
A reader working down the list stops there and looks for something to press, or waits, unsure whether the step is done.
chaff points at it twice: as a statement among instructions, and through `list-item-form-mix`, which notices that the item opens with a noun where the others open with a verb.

The fix folds the sentence into the step before it, as what the reader will see after choosing Add printer.
The procedure now has four steps, each one an action.
If the result matters enough to keep on its own, it can also go after the list as a note.

## Settings

The rule reads numbered lists of three or more steps, and only when the statements are fewer than the instructions.
At `normal`, it is reported when two steps or fewer are statements; `strict` allows three, `relaxed` one.
A step with a label or an opening phrase before the verb ("On the left bar, select …") is not read.

To stop checking:

```yaml chaff-settings
rules:
  step-statement-mix: off
```

It is off for legal, academic, literature and speech texts, where numbered steps are not procedures.

```text chaff-explain
$ npx chaffjs explain step-statement-mix --genre docs/manual

  A step written as a statement among instructions   (step-statement-mix)

  A numbered procedure is a list of things for the reader to do. When "The installer asks for a password." sits among "Open the app." and "Run the installer.", the reader wonders whether that is a step to take too. In an English numbered list, chaff points at the few items that open with a subject and a verb (The installer asks, You click) among items that open with the verb. Japanese step endings (〜します / 〜してください against the rest) are checked by no-mixed-desumasu and list-item-form-mix, so this rule is for English only.

  How to fix: Write what the reader does, as an instruction. If it describes a result, make it a second sentence of the step before, or move it out of the list.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when 3 or fewer steps are statements and they are fewer than the instructions
  → normal   reported when 2 or fewer steps are statements and they are fewer than the instructions
    relaxed  reported when 1 or fewer steps are statements and they are fewer than the instructions
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax step-statement-mix --why "reason"
```

[All samples](README.md)
