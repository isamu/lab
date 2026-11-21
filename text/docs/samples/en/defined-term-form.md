<!-- chaff-sample
rule: defined-term-form
genre: legal/contract
file: agreement.md
-->

# A defined term used in another form (`defined-term-form`)

**Where it helps:** contracts, terms of service, policies. Any document whose defined terms carry a meaning the ordinary word does not.

## Original

```markdown chaff-before
# Website Maintenance Agreement

This agreement is made between Lantern Bakery (the "Customer") and Pixel Row Studio (the "Provider").

## 1. Definitions

"Services" means the hosting, the security updates and up to four hours a month of changes to the Customer's website.

## 2. The Services

2.1 The Provider shall perform the Services during normal working hours.

2.2 The Customer may ask for changes by email, and the Provider shall confirm each request within two working days.

2.3 Work outside the services, such as a new online shop, is quoted separately.

2.4 Either party may end the Services with one month's notice.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract agreement.md

agreement.md   legal/contract · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    services, such as a new online shop, is quoted separately.

  ·  A defined term used in another form

     "Services" is defined with a capital on line 7, but written in lower case here
     A contract uses each defined term exactly as defined. Quoting a term again after its definition ("the "Services"") leaves the reader asking whether it is being defined anew. Writing "services" where "Services" is defined splits the defined sense from the ordinary one, which is where disputes start. In Japanese, 本件業務 written where 本業務 is defined reads as another task. "the Application" written where the Pinecone Notes application is defined as the "App" leaves the reader asking whether it is the same thing. chaff points at a term set in quotes again after its definition, at a capitalised term written in lower case (when the capitalised uses are more, "records officer" for "Records Officer" too), at a Japanese term written with its other prefix (本 for 本件 or the other way round) unless that form is defined too, and at a term made longer with a word of its own definition (Application for App, 文書管理責任者 for 管理責任者). Statutes and regulations use their defined terms as defined, too.

     → Use the defined term without quotes and, in English, with its capital as defined. If the ordinary sense is meant, use another word.

     Relax this rule:  npx chaffjs relax defined-term-form


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Website Maintenance Agreement

This agreement is made between Lantern Bakery (the "Customer") and Pixel Row Studio (the "Provider").

## 1. Definitions

"Services" means the hosting, the security updates and up to four hours a month of changes to the Customer's website.

## 2. The Services

2.1 The Provider shall perform the Services during normal working hours.

2.2 The Customer may ask for changes by email, and the Provider shall confirm each request within two working days.

2.3 Work outside the Services, such as a new online shop, is quoted separately.

2.4 Either party may end the Services with one month's notice.
```

## How it was fixed

"Services" is defined with a capital: the hosting, the updates and four hours of changes a month.
Clause 2.3 writes "services" in lower case.
In a contract that difference matters: "outside the services" may be read as outside anything the Provider happens to do, rather than outside the defined package, and that is where a dispute over a bill starts.

The fix writes "Services" with its capital, so the clause clearly refers to the defined term.
If the ordinary meaning were intended, a different word would make that clear.

## Settings

At `normal`, lower-case uses are reported when there are two or fewer and they are fewer than the capitalised ones; `strict` allows three, `relaxed` one.
A term written in lower case more often than capitalised is taken as the ordinary word on purpose.
chaff also points at a term set in quotes again after its definition ("the "Services"").

To stop checking:

```yaml chaff-settings
rules:
  defined-term-form: off
```

It runs only on legal texts.

```text chaff-explain
$ npx chaffjs explain defined-term-form --genre legal/contract

  A defined term used in another form   (defined-term-form)

  A contract uses each defined term exactly as defined. Quoting a term again after its definition ("the "Services"") leaves the reader asking whether it is being defined anew. Writing "services" where "Services" is defined splits the defined sense from the ordinary one, which is where disputes start. In Japanese, 本件業務 written where 本業務 is defined reads as another task. "the Application" written where the Pinecone Notes application is defined as the "App" leaves the reader asking whether it is the same thing. chaff points at a term set in quotes again after its definition, at a capitalised term written in lower case (when the capitalised uses are more, "records officer" for "Records Officer" too), at a Japanese term written with its other prefix (本 for 本件 or the other way round) unless that form is defined too, and at a term made longer with a word of its own definition (Application for App, 文書管理責任者 for 管理責任者). Statutes and regulations use their defined terms as defined, too.

  How to fix: Use the defined term without quotes and, in English, with its capital as defined. If the ordinary sense is meant, use another word.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   lower-case uses reported when they are 3 or fewer and fewer than the capitalised ones
  → normal   lower-case uses reported when they are 2 or fewer and fewer than the capitalised ones
    relaxed  lower-case uses reported when they are 1 or fewer and fewer than the capitalised ones
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax defined-term-form --why "reason"
```

[All samples](README.md)
