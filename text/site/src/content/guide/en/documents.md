# What chaff does for each kind of document

chaff looks at different things depending on the kind of document (the genre).
These pages show, for one kind at a time, what chaff finds and what it does not, on a real document and its real screen.
They are written for people who have never used a command line.

## chaff is the machine; people and AI do the reading

chaff checks text by fixed steps. The same text gives the same result every time.
It never rewrites anything; fixing is the writer's job.

Anything that needs the meaning to decide (does the conclusion say something?) is not decided by chaff alone.
`npx chaffjs test` sends only the passages the machine narrowed down to an AI, and has it read them.
Using an AI is your choice. Without one, every machine check still runs.

## Pages by kind of document

| Kind of document | Genre | What chaff finds |
| --- | --- | --- |
| [Internal rules and regulations](./documents-statute) | `legal/statute` | Skipped article numbers, references to articles that are not there, a term defined twice |
| [Business reports](./documents-report) | `business/report` | Openings that fit any document, stacked hedges, passives that never say who acts, sentences that run too long |

There are no pages for the other kinds yet.
The [genres page](../../genres/) shows which rules run for each kind.

## Getting ready

chaff needs a tool called Node.js. You set it up once.

| Step | What to do |
| --- | --- |
| 1 | Install the version marked LTS from [nodejs.org](https://nodejs.org/). chaff needs Node.js 24 or later |
| 2 | Open the window where you type commands: Terminal on a Mac, PowerShell on Windows |
| 3 | Type `node --version` and press Enter. A number of `v24` or higher means it is installed |
| 4 | Type `cd` and a space, then the location of the folder that holds your document, and press Enter. On a Mac you can drag the folder into the window to fill in its location |

Save the document as a plain text file ending in `.md` (Markdown).
Start each heading line with `#` (as in `## Article 1 (Purpose)`).
For a Word document, paste the text into a text editor and save it from there.

`npx chaffjs` fetches chaff and runs it. There is nothing else to install.
The first time, it asks whether it may fetch the package. Press `y` to go on.

## What to read next

- How to read the screen, and the three ways to respond to a finding, are in [Getting started](./getting-started).
- To fit rule strength and genre to your team, read [Configuration](./configuration).
