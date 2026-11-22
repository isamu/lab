<!-- chaff-sample
rule: requirement-modal
genre: technical/spec
file: backup-rule.md
-->

# A provision's verb form is not the one the house rule uses (`requirement-modal`)

**Where it helps:** internal policies, work standards, specifications, test procedures. Any document where the reader has to know what is required.

## Original

```markdown chaff-before
# Backup standard for business data

## 1 Taking backups

Each department shall back up its business data every day.
Backups shall be kept in the off-site data centre as well.

## 2 Restoring

The IT team restores data up to seven days old on request.
```

```yaml chaff-config
options:
  requirement-modal:
    shall: must
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec backup-rule.md

backup-rule.md   technical/spec · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Each department shall back up its business data every day.

  ⚠  A provision's verb form is not the one the house rule uses

     Write "must" instead of "shall"
     A standard or a set of rules tells a requirement from a recommendation and a permission by the form of the verb, and the reader takes from it whether something must be done, should be done or may be done. JIS Z 8301:2019 does not use 「…すべきである」 for a recommendation or a closing 「…できる」 for a permission or a possibility; it uses 「…することが望ましい」, 「…してもよい」 and 「…可能である」. In English, the Federal Plain Language Guidelines use "must" for an obligation instead of "shall", which readers and courts take in more than one way. Both are a team's choice, so the rule checks only what options turn on.

     → Decide whether the sentence states an obligation and write "must" ("must not" for a prohibition). Keep "shall" only where a law you quote uses it.

     Relax this rule:  npx chaffjs relax requirement-modal


─── line 6 ───────────────────────────────────────────────────

    Backups shall be kept in the off-site data centre as well.

  ⚠  A provision's verb form is not the one the house rule uses

     Write "must" instead of "shall"
     A standard or a set of rules tells a requirement from a recommendation and a permission by the form of the verb, and the reader takes from it whether something must be done, should be done or may be done. JIS Z 8301:2019 does not use 「…すべきである」 for a recommendation or a closing 「…できる」 for a permission or a possibility; it uses 「…することが望ましい」, 「…してもよい」 and 「…可能である」. In English, the Federal Plain Language Guidelines use "must" for an obligation instead of "shall", which readers and courts take in more than one way. Both are a team's choice, so the rule checks only what options turn on.

     → Decide whether the sentence states an obligation and write "must" ("must not" for a prohibition). Keep "shall" only where a law you quote uses it.

     Relax this rule:  npx chaffjs relax requirement-modal


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Backup standard for business data

## 1 Taking backups

Each department must back up its business data every day.
Backups must be kept in the off-site data centre as well.

## 2 Restoring

The IT team restores data up to seven days old on request.
```

## How it was fixed

This company writes its standards the way the Federal Plain Language Guidelines advise: "must" for what is required, "should" for what is advised, "may" for what is allowed.
"Shall" is read in more than one way. Some readers take it as "must", others as "will", and in a dispute it is the word people argue about.
A department head reading "Backups shall be kept in the off-site data centre" cannot be sure whether skipping it breaks the standard.

The fix writes "must" in both places, so each sentence says plainly that the step is required.
Section 2 says what the IT team does, not what anyone must do, so it stays as it was.

## Settings

The rule checks only what `options` in chaff.yaml turn on; with nothing set, it checks nothing.
Which verb a team uses for a requirement is the team's house rule. For "must" instead of "shall", write:

```yaml chaff-settings
options:
  requirement-modal:
    shall: must
```

It is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  requirement-modal: strict
```

Where a document quotes a law that says "shall", keep the law's word and silence that one place with stet and the reason.
For Japanese documents, `standard: jis-z8301-2019` under the same `options` checks the closing verb forms that JIS Z 8301:2019 does not use.

```text chaff-explain
$ npx chaffjs explain requirement-modal --genre technical/spec

  A provision's verb form is not the one the house rule uses   (requirement-modal)

  A standard or a set of rules tells a requirement from a recommendation and a permission by the form of the verb, and the reader takes from it whether something must be done, should be done or may be done. JIS Z 8301:2019 does not use 「…すべきである」 for a recommendation or a closing 「…できる」 for a permission or a possibility; it uses 「…することが望ましい」, 「…してもよい」 and 「…可能である」. In English, the Federal Plain Language Guidelines use "must" for an obligation instead of "shall", which readers and courts take in more than one way. Both are a team's choice, so the rule checks only what options turn on.

  How to fix: Decide whether the sentence states an obligation and write "must" ("must not" for a prohibition). Keep "shall" only where a law you quote uses it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Options (set under options in chaff.yaml):
    standard: none   (default)
      Which standard's verbal forms a Japanese provision is checked against
      → none            Not checked
        jis-z8301-2019  JIS Z 8301:2019, 7.3 to 7.5: a closing すべきである, すべきでない, できる or できない
    shall: allow   (default)
      Whether "shall" is checked in English
      → allow      Not checked
        must       Point at "shall" and ask for "must" (Federal Plain Language Guidelines)

  Set one:  write options: { requirement-modal: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax requirement-modal --why "reason"
```

[All samples](README.md)
