<!-- chaff-sample
rule: contact-variant
genre: business/press-release
file: volunteers.md
-->

# A contact written two ways (`contact-variant`)

**Where it helps:** calls for volunteers, event notices, privacy policies, contracts. Any document that gives an email or postal address more than once.

## Original

```markdown chaff-before
# Call for volunteers: Riverside half marathon

The Riverside half marathon needs about eighty volunteers on Sunday 11 October 2026, for the water stations, the bag drop and the finish line.

To sign up, write to volunteers@riverside-run.example with the role you would like and your shirt size. We will send a briefing pack two weeks before race day.

## Contact

Questions about volunteering: volunteers@riversiderun.example
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release volunteers.md

volunteers.md   business/press-release · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    volunteers@riversiderun.example

  ⚠  A contact written two ways

     The email address volunteers@riversiderun.example may be a slip for volunteers@riverside-run.example
     An email address or a company's address is written more than once: at the top and the bottom, under "Contact" and in the governing-law clause. When one place reads privacy@hibarilab.example for privacy@hibari-lab.example, or 2-1-4 Marunouchi for 2-4-1 Marunouchi, the reader cannot tell which is right and may write to one that never arrives. An email address is reported when it is another with a dot or hyphen dropped, or with one word one or two letters off. Addresses written after an address word (Address, head office) on the same street are compared, and one whose block numbers are swapped or one changed, or whose postcode alone differs, is reported.

     → Check which is right and correct the other.

     Relax this rule:  npx chaffjs relax contact-variant


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Call for volunteers: Riverside half marathon

The Riverside half marathon needs about eighty volunteers on Sunday 11 October 2026, for the water stations, the bag drop and the finish line.

To sign up, write to volunteers@riverside-run.example with the role you would like and your shirt size. We will send a briefing pack two weeks before race day.

## Contact

Questions about volunteering: volunteers@riverside-run.example
```

## How it was fixed

The sign-up address has a hyphen, riverside-run, and the contact address at the bottom does not.
To a reader they look like the same address, and most will copy whichever they see last.
If the domain without the hyphen does not exist, their questions bounce, or worse, vanish without a reply, and the organisers wonder why nobody asked.

The race's domain is riverside-run.example, so the fix adds the hyphen to the contact address.
Checking every copy of an address against one source is tedious for a person and quick for a machine.

## Settings

The rule is a warning at `normal` and `relaxed`, and an error at `strict`:

```yaml chaff-settings
rules:
  contact-variant: strict
```

An email address is reported when it is another with a dot or a hyphen dropped, or with one word one or two letters off.
Postal addresses after an address word (Address, head office) on the same street are compared too, for swapped or changed numbers and a postcode that alone differs.
Two different addresses (sales@ and support@), addresses that differ only in a digit, and words shorter than five letters (hr@ and pr@) are not reported.
It does not run on literature, whose addresses are made up, or on speech.
A swapped digit in a phone number is the job of `phone-number-variant`.

```text chaff-explain
$ npx chaffjs explain contact-variant --genre business/press-release

  A contact written two ways   (contact-variant)

  An email address or a company's address is written more than once: at the top and the bottom, under "Contact" and in the governing-law clause. When one place reads privacy@hibarilab.example for privacy@hibari-lab.example, or 2-1-4 Marunouchi for 2-4-1 Marunouchi, the reader cannot tell which is right and may write to one that never arrives. An email address is reported when it is another with a dot or hyphen dropped, or with one word one or two letters off. Addresses written after an address word (Address, head office) on the same street are compared, and one whose block numbers are swapped or one changed, or whose postcode alone differs, is reported.

  How to fix: Check which is right and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax contact-variant --why "reason"
```

[All samples](README.md)
