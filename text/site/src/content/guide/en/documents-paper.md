# Papers and abstracts

A paper or an abstract is written to the rules of a journal or a conference.
chaff finds by machine mixed British and American spelling, a doubled word, and references to figures that are not there.
The genre is `academic/paper`.

## What usually goes wrong

Co-authors write different sections, and someone joins them at the end. That is where the spelling mixes.

| What goes wrong | Example |
| --- | --- |
| Mixed spelling | "behavior" twice, and "behaviour" once in the section another author wrote |
| A doubled word | "and the the user has to search", left over from an edit |
| A figure that is not there | The figures were merged into one, but the text still says "Figure 3 shows" |

These are the first things a reviewer notices. They cost the reader's trust before the content is read.

## What chaff checks, and what it does not

These are the main rules for this genre. All are experimental, and run with `--experimental`.

| Rule | What it finds |
| --- | --- |
| `spelling-consistency` | British and American spellings mixed in one document |
| `doubled-word` | The same word written twice in a row |
| `dangling-figure-reference` | A figure or table the text refers to that the document does not have |

What it does not do is decided too.

- It does not judge whether the results support the conclusion. The authors and the reviewers read and decide.
- It does not check the reference list against the journal's style.
- It does not decide whether British or American spelling is right. It points at whichever the paper uses less.
  When the two are close to even, it says nothing, since the paper may mix them on purpose.
- For academic writing, the rules on passives and hedging do not run. Science writes in the passive, and hedges its claims on purpose.

`style:` in `chaff.yaml` names a journal's house style. The styles chaff has now are for Japanese papers.
For an English paper, write the team's spellings under `prefer` instead (see the starter file below).

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The abstract and part of a paper below were saved as `paper.md`. They were written for this page.

```markdown
# Assigning free rooms first to cut meeting room booking delays

## Abstract

We propose a method that assigns a free room at the moment a booking is made, during the hours when bookings peak. Using three months of logs from our booking server, we found that the average wait for a booking fell from 42 seconds to 18 seconds. The method changes no user behavior and can be deployed without changing the existing server, its database or its configuration.

## 1. Introduction

Room bookings peak between 9 and 10 in the morning. In this hour, bookings for the same room collide, and the the user has to search for another free room. As Figure 1 shows, our method assigns a free room as soon as a booking arrives, which minimizes collisions.

![Figure 1. How rooms are assigned](fig1.png)

## 2. Evaluation

We used the logs from June to August 2026. Figure 3 shows the results. The wait fell in every hour. The behavior of users did not change, and the size, the location, and the equipment of the room made no difference.

## 3. Conclusion

We proposed a method that assigns free rooms first, and showed that it shortens the wait. We will next evaluate it in large rooms, where the behaviour of users may differ, and organise a trial at a second site.
```

Run without a genre, chaff sees the headings of a paper and suggests the paper genre.

```
$ npx chaffjs paper.md --compact

paper.md   blog/tech · English   genre from the default
   Looks like: Academic paper. Try --genre academic/paper


0 findings, 97 rules not run
```

Add the genre, as suggested, and the experimental rules too.
`--compact` prints each finding on two lines.

```
$ npx chaffjs paper.md --genre academic/paper --experimental --compact

paper.md   academic/paper · English   genre from --genre

  9:111   warning "the the" doubles a word; one of the two is left over
                  doubled-word
  15:44   warning Figure 3 is referred to, but the document has no Figure 3
                  dangling-figure-reference
  19:142  info    "behaviour" here, where the document usually spells it "behavior" (1 of 3)
                  spelling-consistency

3 findings, 40 rules not run
```

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 9 | `doubled-word` | "the the" | Delete one "the" |
| 15 | `dangling-figure-reference` | There is no Figure 3. The only figure is Figure 1 | Add the results figure and number it, or point to the right figure |
| 19 | `spelling-consistency` | The paper writes "behavior" twice, and "behaviour" here | Write "behavior", as the rest does |

The paper also writes "organise" once and "minimizes" once.
With one of each, chaff cannot tell which the paper uses, so it says nothing. Decide, and add the pair to `prefer`.

## No checks that read meaning

For this genre, `npx chaffjs test` sends nothing to an AI.
`npx chaffjs test paper.md --genre academic/paper --dry-run` says 0 passages would be sent.
Whether the results support the conclusion is for the authors and the reviewers.

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your paper.

```yaml
genre: academic/paper
language: en

rules:
  spelling-consistency: normal
  doubled-word: normal
  dangling-figure-reference: normal
```

With this file in place, `npx chaffjs paper.md --compact` alone shows all the findings above.
When the journal sets a spelling, write each pair under `prefer` and turn on `preferred-term`:

```yaml
prefer:
  behaviour: behavior
  organise: organize

rules:
  preferred-term: normal
```

How `prefer` works is in [Configuration](./configuration), under "Making the team's spelling consistent".

## What to read next

- How to turn a journal's rules into settings is in [Define your team's writing rules](./house-style).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
