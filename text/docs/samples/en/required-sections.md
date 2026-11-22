<!-- chaff-sample
rule: required-sections
genre: business/proposal
file: proposal.md
-->

# A required heading is missing (`required-sections`)

**Where it helps:** proposals, requests for approval, minutes, incident reports. Any document the team has agreed must always have certain sections.

## Original

```markdown chaff-before
# Proposal: a tablet at the front desk

## Purpose

We replace the paper visitor book at the front desk with a tablet.
When a visitor signs in, the person they are meeting gets a chat message.

## Costs

Two tablets and their stands cost 1,800 dollars in all.
The sign-in service costs 30 dollars a month.

## Plan

We try one tablet in April and add the second in May.
```

```yaml chaff-config
required_sections:
  - Costs
  - Risks
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 1 ───────────────────────────────────────────────────

    Proposal: a tablet at the front desk / Purpose / Costs / Plan

  ✖  A required heading is missing

     No heading for "Risks"
     "A proposal has a risk section" is a decision each team makes. chaff holds no list of its own; it only checks the one written under `required_sections` in chaff.yaml. With nothing written, this rule says nothing.

     → Add the heading. If it is not needed, the honest fix is to remove it from `required_sections`.

     Relax this rule:  npx chaffjs relax required-sections


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: a tablet at the front desk

## Purpose

We replace the paper visitor book at the front desk with a tablet.
When a visitor signs in, the person they are meeting gets a chat message.

## Costs

Two tablets and their stands cost 1,800 dollars in all.
The sign-in service costs 30 dollars a month.

## Risks and how we handle them

If the office network goes down, the tablet cannot sign anyone in.
For those days, we keep the paper visitor book in the desk drawer.

## Plan

We try one tablet in April and add the second in May.
```

## How it was fixed

This office agreed that every proposal has a "Costs" and a "Risks" section. The person who approves it wants to know what can go wrong as much as what it costs.
The original explains the purpose, the costs and the plan well, but has no risks section. What happens to visitors on a day the network is down is a question that would first come up in the approval meeting.

The fix adds a section on the risk and what the office does about it.
The heading does not have to be "Risks" alone: "Risks and how we handle them" contains the word, and that is enough.

## Settings

The rule reads only the headings listed under `required_sections` in chaff.yaml. chaff holds no list of its own:
which sections a proposal or a set of minutes must have is the team's agreement, so the team writes it down.

```yaml chaff-settings
required_sections:
  # what the approver reads before deciding
  - Purpose
  - Costs
  - Risks
```

A heading anywhere in the document that contains the listed word meets it ("Risks" is met by "Risks and how we handle them").
A missing section means the team's agreement was not kept, so by default it is an error and one missing heading is enough.
`relaxed` reports only when two or more are missing:

```yaml chaff-settings
rules:
  required-sections: relaxed
```

If a section really is not needed, the honest fix is to remove it from `required_sections` rather than silence the finding.
It runs in every genre. With nothing under `required_sections`, it says nothing.

```text chaff-explain
$ npx chaffjs explain required-sections --genre business/proposal

  A required heading is missing   (required-sections)

  "A proposal has a risk section" is a decision each team makes. chaff holds no list of its own; it only checks the one written under `required_sections` in chaff.yaml. With nothing written, this rule says nothing.

  How to fix: Add the heading. If it is not needed, the honest fix is to remove it from `required_sections`.

  Levels:
    strict   reported once 1 required headings are missing
  → normal   reported once 1 required headings are missing
    relaxed  reported once 2 required headings are missing
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax required-sections --why "reason"
```

[All samples](README.md)
