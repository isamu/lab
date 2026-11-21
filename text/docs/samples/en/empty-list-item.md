<!-- chaff-sample
rule: empty-list-item
genre: business/meeting-notes
file: minutes.md
-->

# Empty list item (`empty-list-item`)

**Where it helps:** minutes, briefs, forms filled in as lists. Any list of "label: value" items.

## Original

```markdown chaff-before
# Marketing team meeting

- Date: November 12, 2026
- Place: Room 2
- Chair: Lena Park
- Minutes taken by:

## Decisions

The spring brochure goes to print on December 4, 2026.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes minutes.md

minutes.md   business/meeting-notes · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    - Minutes taken by:

  ⚠  Empty list item

     Nothing after "Minutes taken by" (the other items in this list give a value)
     An item holding only a label ("Owner:") while the other items of the list give theirs a value, or an item with nothing after its bullet. The reader cannot tell a gap from an undecided point.

     → Write the value. If it is not decided, write "TBD" and when it will be. If the item is not needed, remove it.

     Relax this rule:  npx chaffjs relax empty-list-item


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Marketing team meeting

- Date: November 12, 2026
- Place: Room 2
- Chair: Lena Park
- Minutes taken by: Omar Haddad

## Decisions

The spring brochure goes to print on December 4, 2026.
```

## How it was fixed

Every line of the header gives a value except "Minutes taken by", which is left empty.
The reader cannot tell whether nobody took them, the name was forgotten, or it is still to be decided. When a question about the decisions comes up later, there is no one to ask.

The fix writes the name.
If a value is not decided, write "TBD" and when it will be; if the item is not needed, remove it.
A list in which no item has a value is read as a blank form and not reported.

## Settings

An empty item is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents are templates that are meant to be filled in later, relax it:

```yaml chaff-settings
rules:
  empty-list-item: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain empty-list-item --genre business/meeting-notes

  Empty list item   (empty-list-item)

  An item holding only a label ("Owner:") while the other items of the list give theirs a value, or an item with nothing after its bullet. The reader cannot tell a gap from an undecided point.

  How to fix: Write the value. If it is not decided, write "TBD" and when it will be. If the item is not needed, remove it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax empty-list-item --why "reason"
```

[All samples](README.md)
