<!-- chaff-sample
rule: agentless-passive
genre: business/report
file: outage.md
-->

# Passive with no actor (`agentless-passive`)

**Where it helps:** incident reports, status reports, proposals. Any text where the reader needs to know who did something, or who will.

## Original

chaff does not check this rule by default in business documents (see Settings), so this sample turns it on in `chaff.yaml`:

```yaml chaff-config
rules:
  agentless-passive: normal
```

```markdown chaff-before
# What happened during Tuesday's outage

On Tuesday at 14:05 the search page stopped returning results for about forty minutes.

The cause was a change to the index settings that went out with the morning release.
The change was approved without a test on the full index, and the alert was missed because it went to an old channel.
At 14:45 the change was rolled back and search came back.

From next week, every change to the index settings will be tried on a copy of the full index first.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report outage.md

outage.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The change was approved without a test on the full index, and the alert was missed because it went to an old channel.

  ⚠  Passive with no actor

     This sentence is passive ("approved missed") but never says who did it
     A passive without an actor removes the person from the sentence. The reader cannot tell who decided, or who will act.

     → Name the actor and make it active. "It was decided" becomes "the steering group decided". If you cannot name anyone, the reason you cannot is the real finding.

     Relax this rule:  npx chaffjs relax agentless-passive


─── line 7 ───────────────────────────────────────────────────

    At 14:45 the change was rolled back and search came back.

  ⚠  Passive with no actor

     This sentence is passive ("rolled") but never says who did it
     A passive without an actor removes the person from the sentence. The reader cannot tell who decided, or who will act.

     → Name the actor and make it active. "It was decided" becomes "the steering group decided". If you cannot name anyone, the reason you cannot is the real finding.

     Relax this rule:  npx chaffjs relax agentless-passive


─── line 9 ───────────────────────────────────────────────────

    From next week, every change to the index settings will be tried on a copy of the full index first.

  ⚠  Passive with no actor

     This sentence is passive ("tried") but never says who did it
     A passive without an actor removes the person from the sentence. The reader cannot tell who decided, or who will act.

     → Name the actor and make it active. "It was decided" becomes "the steering group decided". If you cannot name anyone, the reason you cannot is the real finding.

     Relax this rule:  npx chaffjs relax agentless-passive


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# What happened during Tuesday's outage

On Tuesday at 14:05 the search page stopped returning results for about forty minutes.

The cause was a change to the index settings that went out with the morning release.
Two of us reviewed and approved the change without a test on the full index, and nobody saw the alert because it went to an old channel.
At 14:45 the on-call engineer rolled the change back and search came back.

From next week, the search team will try every change to the index settings on a copy of the full index first.
```

## How it was fixed

An incident write-up is read by people who want to know what failed and who will stop it from failing again.
"The change was approved", "the alert was missed" and "the change was rolled back" describe the events with the people taken out.
The reader cannot tell whether the approval was one person's slip or a gap in the process, and nobody is named for the promise in the last line.

The fix names who acted: the two reviewers, the on-call engineer, the search team.
That is not about blame. It shows where the process broke, and it gives the last sentence an owner, so the promise can be checked next week.

## Settings

The rule reports a sentence that holds a passive with no "by …" and no actor named.
At `normal` and `strict` one passive is enough; `relaxed` waits for a sentence with two.

It is off by default everywhere it could run.
In business documents it was measured on real reports and emails and fired too often to be on by default; minutes record what "was agreed" by their form, and legal text, manuals, papers, literature and speeches use the passive on purpose.
Blogs and technical documents are outside the rule altogether.
A team that wants every actor named turns it on in `chaff.yaml`, as this sample does, or at `relaxed` to report only sentences with two:

```yaml chaff-settings
rules:
  agentless-passive: relaxed
```

A passive where who acted does not matter ("handouts are given out on Tuesday") is reported too, so it suits documents where an owner matters, such as incident reports and plans.

```text chaff-explain
$ npx chaffjs explain agentless-passive --genre business/report

  Passive with no actor   (agentless-passive)

  A passive without an actor removes the person from the sentence. The reader cannot tell who decided, or who will act.

  How to fix: Name the actor and make it active. "It was decided" becomes "the steering group decided". If you cannot name anyone, the reason you cannot is the real finding.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when a sentence has 1 passive with no actor
    normal   reported when a sentence has 1 passive with no actor
    relaxed  reported when a sentence has 2 passives with no actor
    off      not checked

  Now: not run (the business/report genre does not check it).

  Change it:  npx chaffjs relax agentless-passive --why "reason"
```

[All samples](README.md)
