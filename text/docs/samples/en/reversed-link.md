<!-- chaff-sample
rule: reversed-link
genre: docs/manual
file: vpn.md
-->

# Link written the wrong way round (`reversed-link`)

**Where it helps:** manuals, READMEs, internal how-to pages. Anywhere links are typed by hand rather than pasted by an editor.

## Original

```markdown chaff-before
# Connecting from home

Install the VPN client before you leave the office.
The settings for each laptop are in the (VPN setup guide)[https://example.com/vpn-setup].
If the connection drops, restart the client and sign in again.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual vpn.md

vpn.md   docs/manual · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    (VPN setup guide)[https://example.com/vpn-setup]

  ⚠  Link written the wrong way round

     "(VPN setup guide)[https://example.com/vpn-setup]" has its brackets the wrong way round and is not a link
     A Markdown link is written "[text](URL)". With the brackets the wrong way round, "(text)[URL]", Markdown makes no link, and the brackets and the address are shown as written. The reader sees a link that cannot be clicked and a bare address (markdownlint's MD011).

     → Put the text in square brackets and the address in round ones: "[VPN setup guide](https://example.com/vpn-setup)".

     Relax this rule:  npx chaffjs relax reversed-link


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Connecting from home

Install the VPN client before you leave the office.
The settings for each laptop are in the [VPN setup guide](https://example.com/vpn-setup).
If the connection drops, restart the client and sign in again.
```

## How it was fixed

The writer meant to link the setup guide, but typed the round brackets first and the square ones second.
Markdown makes no link of "(text)[URL]": the page shows the brackets and the bare address, and the guide cannot be opened with a click.

The fix swaps the brackets, so the text sits in square brackets and the address in round ones.

## Settings

A link written the wrong way round is a warning at the default level; `strict` makes it an error and `relaxed` a note.

```yaml chaff-settings
rules:
  reversed-link: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain reversed-link --genre docs/manual

  Link written the wrong way round   (reversed-link)

  A Markdown link is written "[text](URL)". With the brackets the wrong way round, "(text)[URL]", Markdown makes no link, and the brackets and the address are shown as written. The reader sees a link that cannot be clicked and a bare address (markdownlint's MD011).

  How to fix: Put the text in square brackets and the address in round ones: "[text](URL)".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reversed-link --why "reason"
```

[All samples](README.md)
