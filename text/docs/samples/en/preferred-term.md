<!-- chaff-sample
rule: preferred-term
genre: docs/manual
file: password-help.md
-->

# Not the team's spelling (`preferred-term`)

**Where it helps:** user guides, help pages, internal how-tos. Anywhere several people add pages over time and the same thing ends up written several ways.

## Original

```markdown chaff-before
# If you forget your password

1. Open the app and tap "Forgot password?" under the login button.
2. Enter the e-mail address you signed up with and tap "Send".
3. Open the link in the message and choose a new password.
4. Sign in again with the new password.

If the message does not arrive, check your spam folder.
If it is still missing, write to our help desk.
```

```yaml chaff-config
prefer:
  login button: Sign in button
  e-mail: email
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual password-help.md

password-help.md   docs/manual · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Open the app and tap "Forgot password?" under the login button.

  ⚠  Not the team's spelling

     Write "Sign in button", not "login button"
     Writing the same thing two ways ("e-mail" and "email") makes a reader wonder whether they differ, and a search misses one of them. Which way wins is the team's choice, so list pairs (the spelling to avoid, then the one to use) under `prefer` in chaff.yaml. With nothing listed, this rule says nothing.

     → Change it to "Sign in button". Where it must stay (a product's own name, a quotation), silence it with stet and the reason.

     Relax this rule:  npx chaffjs relax preferred-term


─── line 4 ───────────────────────────────────────────────────

    Enter the e-mail address you signed up with and tap "Send".

  ⚠  Not the team's spelling

     Write "email", not "e-mail"
     Writing the same thing two ways ("e-mail" and "email") makes a reader wonder whether they differ, and a search misses one of them. Which way wins is the team's choice, so list pairs (the spelling to avoid, then the one to use) under `prefer` in chaff.yaml. With nothing listed, this rule says nothing.

     → Change it to "email". Where it must stay (a product's own name, a quotation), silence it with stet and the reason.

     Relax this rule:  npx chaffjs relax preferred-term


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# If you forget your password

1. Open the app and tap "Forgot password?" under the Sign in button.
2. Enter the email address you signed up with and tap "Send".
3. Open the link in the message and choose a new password.
4. Sign in again with the new password.

If the message does not arrive, check your spam folder.
If it is still missing, write to our help desk.
```

## How it was fixed

The button in the app says "Sign in". A help page that sends the reader to "the login button" has them looking for a word that is not on the screen.
"e-mail" is the older spelling; the rest of the help pages write "email", and a reader who searches the help site for one does not find pages written the other way.

The team had chosen "Sign in" and "email" and written both under `prefer` in chaff.yaml.
The fix changes the two places chaff pointed at. The page now uses the words on the screen, and step 1 and step 4 name the same button the same way.

## Settings

The rule reads only the pairs under `prefer` in chaff.yaml: on the left the spelling to avoid, on the right the one to use.
chaff ships no spellings of its own. A team takes them from its style guide, or from the words on its own screens:

```yaml chaff-settings
prefer:
  # match the labels on the screen
  login button: Sign in button
  log in: sign in
  # house spellings
  e-mail: email
  set-up: setup
  # plain words over formal ones
  utilize: use
```

When the left-hand word is a verb in its dictionary form, its other forms are found too (`utilize` finds "utilizing").
A listed spelling is one the team has already decided against, so one is enough at `normal`; `relaxed` waits for three:

```yaml chaff-settings
rules:
  preferred-term: relaxed
```

Where the old spelling must stay, such as a product's own name or a quotation, silence that one place with stet and the reason.
It runs in every genre. With nothing under `prefer`, it says nothing.

```text chaff-explain
$ npx chaffjs explain preferred-term --genre docs/manual

  Not the team's spelling   (preferred-term)

  Writing the same thing two ways ("e-mail" and "email") makes a reader wonder whether they differ, and a search misses one of them. Which way wins is the team's choice, so list pairs (the spelling to avoid, then the one to use) under `prefer` in chaff.yaml. With nothing listed, this rule says nothing.

  How to fix: Change it to "the spelling listed under prefer". Where it must stay (a product's own name, a quotation), silence it with stet and the reason.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 3
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax preferred-term --why "reason"
```

[All samples](README.md)
