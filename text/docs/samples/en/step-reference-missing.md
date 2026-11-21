<!-- chaff-sample
rule: step-reference-missing
genre: docs/manual
file: vpn-setup.md
-->

# A reference to a step that does not exist (`step-reference-missing`)

**Where it helps:** manuals, setup guides, runbooks. Any procedure whose text refers to its own steps by number.

## Original

```markdown chaff-before
# Connecting to the office VPN

1. Open the VPN app and choose **Add connection**.
2. Enter vpn.example.com as the server address.
3. Sign in with your work email and password.
4. Approve the sign-in on your phone.

If the connection drops, check the server address you entered in step 5.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual vpn-setup.md

vpn-setup.md   docs/manual · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    ress you entered in step 5.

  ⚠  A reference to a step that does not exist

     "step 5" is referred to, but the steps end at 4
     When the text says "see step 5" and there are only four steps, the reader stops to look for step 5. It happens when steps are removed or reordered and a reference keeps the old number. Matching the references against the steps' numbers is mechanical.

     → Check which step is meant and correct the reference. If the step was removed, rewrite the sentence that refers to it.

     Relax this rule:  npx chaffjs relax step-reference-missing


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Connecting to the office VPN

1. Open the VPN app and choose **Add connection**.
2. Enter vpn.example.com as the server address.
3. Sign in with your work email and password.
4. Approve the sign-in on your phone.

If the connection drops, check the server address you entered in step 2.
```

## How it was fixed

The guide has four steps, and the note after them sends the reader to step 5.
The server address is entered in step 2. Step 5 probably existed in an earlier version, and the steps were renumbered when one was removed.
A reader with a dropped connection, already annoyed, looks for a step that is not there.

The fix points the reference at the step that is meant.
In a document with no steps at all, a reference to a step may be to another document and is not reported.

## Settings

A reference to a missing step is a warning at the default level and a note at `relaxed`.

If your steps refer to another document's steps by number, relax it:

```yaml chaff-settings
rules:
  step-reference-missing: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain step-reference-missing --genre docs/manual

  A reference to a step that does not exist   (step-reference-missing)

  When the text says "see step 5" and there are only four steps, the reader stops to look for step 5. It happens when steps are removed or reordered and a reference keeps the old number. Matching the references against the steps' numbers is mechanical.

  How to fix: Check which step is meant and correct the reference. If the step was removed, rewrite the sentence that refers to it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax step-reference-missing --why "reason"
```

[All samples](README.md)
