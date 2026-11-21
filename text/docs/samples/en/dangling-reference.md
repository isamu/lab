<!-- chaff-sample
rule: dangling-reference
genre: legal/contract
file: agreement.md
-->

# Reference to a missing provision (`dangling-reference`)

**Where it helps:** contracts, terms of service, staff rules, policies. Any document whose sections are numbered and refer to each other.

## Original

```markdown chaff-before
# Cleaning Services Agreement

## Section 1. Services

The Contractor will clean the Client's office at 12 Mill Lane every weekday evening.

## Section 2. Fees

The Client will pay the monthly fee within 30 days of each invoice.

## Section 3. Term and termination

This Agreement runs for one year from the date it is signed.
Either party may end it early by giving notice as set out in Section 5.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract agreement.md

agreement.md   legal/contract · English   genre from --genre

─── line 14 ──────────────────────────────────────────────────

    Section 5.

  ✖  Reference to a missing provision

     "Section 5" (address 5) is not in this document
     A reference such as "as set out in Section 12" leaves the reader at a dead end when that section is not in the document. It usually happens when a provision is deleted or renumbered and the reference keeps the old number. chaff builds the document's tree of addresses (chaff tree) and checks that each reference's address is in it. A Japanese reference counted in 条 (法第2条) is not looked up in a document that numbers none of its provisions with 条, such as a guideline whose headings read "1 目的", because it points into another document.

     → Fix the number or remove the reference. If it points into another document, name that document so the reader knows where to look.

     Relax this rule:  npx chaffjs relax dangling-reference


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Cleaning Services Agreement

## Section 1. Services

The Contractor will clean the Client's office at 12 Mill Lane every weekday evening.

## Section 2. Fees

The Client will pay the monthly fee within 30 days of each invoice.

## Section 3. Term and termination

This Agreement runs for one year from the date it is signed.
Either party may end it early by giving the other 60 days' notice in writing.
```

## How it was fixed

Section 3 says notice is "set out in Section 5", but the agreement has only three sections.
This happens when a draft is cut down from a longer template: the section is deleted and the reference to it stays.
A reader cannot tell how much notice is needed, and in a dispute that gap is exactly what the two parties will argue about.

The fix writes the notice period where it is used.
The other fix would be to add the missing section back, or to point at the right number.
chaff builds the document as a tree of numbered sections (`npx chaffjs tree agreement.md` shows it) and checks that every reference lands on one.

## Settings

A missing provision is an error at the default level, so the run fails in CI.
`relaxed` reports it as a warning instead:

```yaml chaff-settings
rules:
  dangling-reference: relaxed
```

A reference into another document, such as "Article 2 of the Act", is not looked up.
If a reference points into another document, name that document in the sentence so the reader knows where to look.

```text chaff-explain
$ npx chaffjs explain dangling-reference --genre legal/contract

  Reference to a missing provision   (dangling-reference)

  A reference such as "as set out in Section 12" leaves the reader at a dead end when that section is not in the document. It usually happens when a provision is deleted or renumbered and the reference keeps the old number. chaff builds the document's tree of addresses (chaff tree) and checks that each reference's address is in it. A Japanese reference counted in 条 (法第2条) is not looked up in a document that numbers none of its provisions with 条, such as a guideline whose headings read "1 目的", because it points into another document.

  How to fix: Fix the number or remove the reference. If it points into another document, name that document so the reader knows where to look.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax dangling-reference --why "reason"
```

[All samples](README.md)
