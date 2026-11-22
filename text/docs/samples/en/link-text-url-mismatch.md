<!-- chaff-sample
rule: link-text-url-mismatch
genre: business/email
file: portal-email.md
-->

# Link text shows one address, the link goes to another (`link-text-url-mismatch`)

**Where it helps:** announcements, emails with links, help pages. Especially after a site has moved.

## Original

```markdown chaff-before
Subject: New staff portal from Monday

Hi everyone,

From Monday, payslips and leave requests move to the new staff portal at [https://portal.example.com](https://intranet.example.org/hr).
Your login stays the same.

The old pages will stay open until the end of the month, read only.

Thanks,
HR
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email portal-email.md

portal-email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    [https://portal.example.com](https://intranet.example.org/hr)

  ⚠  Link text shows one address, the link goes to another

     The link text shows "portal.example.com" but the link goes to "intranet.example.org"
     A link whose text is an address ("[https://example.com/guide](https://other.example/page)") that names a different site from where the link goes. The reader clicks expecting the address they see and lands somewhere else. It is usually what is left when a URL was changed in one place only, and it is also the shape phishing uses. On the same site (host), a path the target does not start with ("[github.com/acme/handbook](https://github.com/handbook)") is another page, and is reported.

     → Check which of the two is right and make the other match. Naming the target in words ("[the setup guide](https://…)") avoids the mismatch altogether.

     Relax this rule:  npx chaffjs relax link-text-url-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: New staff portal from Monday

Hi everyone,

From Monday, payslips and leave requests move to the new staff portal at [https://portal.example.com](https://portal.example.com).
Your login stays the same.

The old pages will stay open until the end of the month, read only.

Thanks,
HR
```

## How it was fixed

The email shows the new portal's address, but the link behind it still goes to the old intranet page.
It is what is left when a URL is changed in one place only, here in the text and not in the link.
Everyone who clicks lands somewhere they did not expect, and a careful reader may suspect a phishing email, since a mismatched link is the shape phishing uses.

The fix makes the link go where its text says, the new portal.
If you are not sure which of the two is right, check before changing either.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

A shortened address on the same site ("github.com/a" pointing to a page under it), link text that is not an address, relative links and reference-style links are not reported.
"www." and letter case are ignored.

```yaml chaff-settings
rules:
  link-text-url-mismatch: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain link-text-url-mismatch --genre business/email

  Link text shows one address, the link goes to another   (link-text-url-mismatch)

  A link whose text is an address ("[https://example.com/guide](https://other.example/page)") that names a different site from where the link goes. The reader clicks expecting the address they see and lands somewhere else. It is usually what is left when a URL was changed in one place only, and it is also the shape phishing uses. On the same site (host), a path the target does not start with ("[github.com/acme/handbook](https://github.com/handbook)") is another page, and is reported.

  How to fix: Check which of the two is right and make the other match. Naming the target in words ("[the setup guide](https://…)") avoids the mismatch altogether.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax link-text-url-mismatch --why "reason"
```

[All samples](README.md)
