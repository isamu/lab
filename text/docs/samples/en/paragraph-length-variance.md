<!-- chaff-sample
rule: paragraph-length-variance
genre: blog/essay
file: post.md
-->

# Paragraph lengths are too uniform (`paragraph-length-variance`)

**Where it helps:** blog posts, essays, list articles. Longer posts written one tip at a time.

## Original

```markdown chaff-before
# What a year of running a parents' book swap taught me

Last September I started a book swap for parents at our primary school, on a trestle table by the gate every Friday afternoon.

Start small. We began with one crate of books from my own shelves and a sign asking people to take one and leave one.

Pick a fixed time. Friday at 3 pm worked because most parents were already waiting at the gate for the end of school.

Ask the school first. The head teacher was happy to say yes, but she wanted to know who would put the table away.

Keep a simple record. A notebook on the table showed which books went quickly, so I knew what to ask for more of.

Expect quiet weeks. In February, with rain every Friday, only three or four parents stopped at the table at all.

Let others help. By spring two other parents took turns at the table, and one of them made a much better sign.

Clear out old books. Every half term I took the books nobody had touched to the charity shop on the high street.

Enjoy the talk. The best part was never the books themselves but the ten minutes of talk with parents I barely knew.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay post.md

post.md   blog/essay · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Last September I started a book swap for parents at our primary school, on a tre

  ·  Paragraph lengths are too uniform

     Paragraph length varies by only 4% (want at least 30%)
     When a person writes, paragraph length follows what matters. Uniform length is the mark of filling a shape.

     → Let the short ones be short.

     Relax this rule:  npx chaffjs relax paragraph-length-variance


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# What a year of running a parents' book swap taught me

Last September I started a book swap for parents at our primary school, on a trestle table by the gate every Friday afternoon.

We began with one crate of books from my own shelves and a sign asking people to take one and leave one.
Friday at 3 pm worked because most parents were already waiting at the gate for the end of school.

Ask the school first.

The head teacher was happy to say yes, but she wanted to know who would put the table away, and whether the books would be left out in the rain.
I promised to do both myself, which turned out to be the easiest promise of the year to keep.

A notebook on the table showed which books went quickly.

Some weeks were quiet. In February, with rain every Friday, only three or four parents stopped at all.

By spring two other parents took turns at the table, and one of them made a much better sign.
Every half term I took the books nobody had touched to the charity shop on the high street.

The best part was never the books.
It was the ten minutes of talk each Friday with parents I had only nodded to before, two of whom now run the table with me.
```

## How it was fixed

Nine paragraphs, each a short imperative and one sentence of about the same length after it.
When every paragraph is the same size, nothing stands out: asking the school first, which the writer had to do, weighs the same as enjoying the talk, which is the point of the whole post.
Uniform paragraphs are the mark of filling a shape.

The corrected post lets the length follow what matters.
"Ask the school first" stands alone; the story of the head teacher's questions gets a paragraph of its own; the small points share a paragraph; and the ending, the part the writer most wants to say, is the longest.

## Settings

The rule measures how much paragraph lengths vary. It reports when they vary by less than 30%; `strict` asks for 40% and `relaxed` only for 20%:

```yaml chaff-settings
rules:
  paragraph-length-variance: relaxed
```

Documents with fewer than nine paragraphs are not checked. The rule runs on blog posts only; business and technical documents, where even paragraphs are often the form, are not checked.

```text chaff-explain
$ npx chaffjs explain paragraph-length-variance --genre blog/essay

  Paragraph lengths are too uniform   (paragraph-length-variance)

  When a person writes, paragraph length follows what matters. Uniform length is the mark of filling a shape.

  How to fix: Let the short ones be short.

  Levels:
    strict   reported when paragraph length varies by less than 40%
  → normal   reported when paragraph length varies by less than 30%
    relaxed  reported when paragraph length varies by less than 20%
    off      not checked

  Options (set under options in chaff.yaml):
    min_paragraphs: 9   (default)
      The fewest paragraphs measured. With few paragraphs, the variation is small by chance, and a person's writing looks uniform too

  Set one:  write options: { paragraph-length-variance: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax paragraph-length-variance --why "reason"
```

[All samples](README.md)
