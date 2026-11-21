<!-- chaff-sample
rule: ui-label-variant
genre: docs/manual
file: restore.md
-->

# Screen label written two ways (`ui-label-variant`)

**Where it helps:** user manuals, help pages, training notes. Any document that tells the reader which button to press.

## Original

```markdown chaff-before
# Getting back a deleted file

1. Open the shared drive and choose **Recently Deleted** in the left bar.
2. Find the file and tick the box next to it.
3. Press **Restore File**. The file goes back to the folder it was in.
4. If you cannot find the folder, press **Restore file** again and choose **Show Location**.

Files stay in **Recently Deleted** for 30 days.
If the file is not in the list, it may have been deleted longer ago than that.
Ask the IT help desk: they keep a weekly copy of the whole drive for three months.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual restore.md

restore.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Restore file** again and choose **Show Location**.

  ·  Screen label written two ways

     "Restore file" is written as "Restore File" elsewhere
     When a manual writes the same button as **Start Restore** in one step and **Start restore** in another, the reader looks for two buttons. A manual spells every label exactly as the screen does. It happens when the screen's wording changes and only some steps are updated. Labels in bold (or in ［］) that differ only in case, spaces or a particle are read as one label, and the form written less often is pointed out.

     → Check the screen and use its spelling in every step.

     Relax this rule:  npx chaffjs relax ui-label-variant


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Getting back a deleted file

1. Open the shared drive and choose **Recently Deleted** in the left bar.
2. Find the file and tick the box next to it.
3. Press **Restore File**. The file goes back to the folder it was in.
4. If you cannot find the folder, press **Restore File** again and choose **Show Location**.

Files stay in **Recently Deleted** for 30 days.
If the file is not in the list, it may have been deleted longer ago than that.
Ask the IT help desk: they keep a weekly copy of the whole drive for three months.
```

## How it was fixed

The button is written **Restore File** in step 3 and **Restore file** in step 4.
A reader looking at the screen may look for two buttons, or doubt that they have the right one.
It usually happens when the screen's wording changed and only some steps were updated.

The fix writes the label the same way in both steps.
chaff cannot see the screen: it points at the form written less often. Check the real button before changing it.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Only labels in bold are compared, and only labels that differ in case or spaces. **Save** and **Save As** are different labels and are left alone.

To stop checking:

```yaml chaff-settings
rules:
  ui-label-variant: off
```

It runs on manuals, technical documents and blogs, and is off for legal, academic, literature and speech texts.

```text chaff-explain
$ npx chaffjs explain ui-label-variant --genre docs/manual

  Screen label written two ways   (ui-label-variant)

  When a manual writes the same button as **Start Restore** in one step and **Start restore** in another, the reader looks for two buttons. A manual spells every label exactly as the screen does. It happens when the screen's wording changes and only some steps are updated. Labels in bold (or in ［］) that differ only in case, spaces or a particle are read as one label, and the form written less often is pointed out.

  How to fix: Check the screen and use its spelling in every step.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ui-label-variant --why "reason"
```

[All samples](README.md)
