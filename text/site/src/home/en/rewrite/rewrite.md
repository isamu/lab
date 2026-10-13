# Running AI agents in parallel

We run four coding agents at once, each in its own git worktree. This note is what we learned in the first month.

## What it gave us

- Four tickets move at the same time instead of one.
- Nobody waits for an agent to finish before starting the next task.
- When a fix is unclear, two agents try two approaches and we keep the better diff.

## What it cost

Each agent needs its own checkout, its own test run and its own review. On a laptop with eight cores, the fifth agent made every test run slower than the four before it.

We now cap the number of agents at four and give each one a single file to change, so two agents never edit the same function.

## Where to start

Start with two agents on two unrelated tickets, and add a third only when reviewing their diffs takes less time than writing them would.
