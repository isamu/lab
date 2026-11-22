<!-- chaff-sample
rule: reference-topic-missing
genre: docs/manual
file: workspace-guide.md
-->

# A reference to a topic its target never mentions (`reference-topic-missing`)

**Where it helps:** manuals, help pages, handbooks and policies that send the reader to another section.

## Original

```markdown chaff-before
# Team workspace guide

## 1. Getting started

Invite your colleagues from the Members page. Each new member gets an email with a link to join. See Section 3 for storage limits.

## 2. Sharing files

Drag a file into a folder to share it with everyone in the folder. The storage limits are 100 GB per workspace on the Team plan and 1 TB on the Business plan.

## 3. Billing

Plans are billed each month on the date you signed up. You can change plans at any time from the Billing page.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual workspace-guide.md

workspace-guide.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Section 3 for storage limits.

  ·  A reference to a topic its target never mentions

     "storage limits" does not appear in Section 3 (Billing)
     When the text says "see Section 2 for pricing" and Section 2 never mentions pricing, the reader looks and finds nothing. It happens when sections are reordered or a topic moves elsewhere. The words right after "for" (or 「で述べた」) are looked for in the target's heading and text, and it is pointed out when they are not there.

     → Find the section that covers the topic and correct the number. If the section words it differently, using the same word lets the reader find it.

     Relax this rule:  npx chaffjs relax reference-topic-missing


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Team workspace guide

## 1. Getting started

Invite your colleagues from the Members page. Each new member gets an email with a link to join. See Section 2 for storage limits.

## 2. Sharing files

Drag a file into a folder to share it with everyone in the folder. The storage limits are 100 GB per workspace on the Team plan and 1 TB on the Business plan.

## 3. Billing

Plans are billed each month on the date you signed up. You can change plans at any time from the Billing page.
```

## How it was fixed

"See Section 3 for storage limits" sends the reader to Billing, which never mentions storage limits.
They are in Section 2.
The guide was probably reordered, and the reference kept the old number.

The fix points to Section 2.
chaff looks for the words after "for" in the target's heading and text.
It does not know synonyms, so if the target words it differently ("storage quota"), use one wording in both places.

## Settings

A reference to a topic its target never mentions is a note at the default level and a warning at `strict`.

To make it a warning, raise it:

```yaml chaff-settings
rules:
  reference-topic-missing: strict
```

To stop checking it, write `off` instead of `strict`.

```text chaff-explain
$ npx chaffjs explain reference-topic-missing --genre docs/manual

  A reference to a topic its target never mentions   (reference-topic-missing)

  When the text says "see Section 2 for pricing" and Section 2 never mentions pricing, the reader looks and finds nothing. It happens when sections are reordered or a topic moves elsewhere. The words right after "for" (or 「で述べた」) are looked for in the target's heading and text, and it is pointed out when they are not there.

  How to fix: Find the section that covers the topic and correct the number. If the section words it differently, using the same word lets the reader find it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reference-topic-missing --why "reason"
```

[All samples](README.md)
