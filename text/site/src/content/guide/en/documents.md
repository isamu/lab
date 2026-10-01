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

## What kind of document do you have?

Pick the one closest to yours, and go to its page.
Each page names the genre to use, runs chaff on a short sample and shows the real screen.

| Your document, and its page | What chaff finds |
| --- | --- |
| [Tech articles and blog posts](./documents-blog): a tech article or a team blog post | Stock openings and closings, shapes of generated text, counts that do not match, links that go nowhere |
| [Contracts and terms of service](./documents-contract): a contract, terms of service or a privacy policy | Periods that run backwards, totals that do not add up, references to missing articles, skipped numbers, wrong weekdays |
| [Internal rules and regulations](./documents-statute): internal rules, regulations or official notices | Skipped article numbers, references to articles that are not there, a term defined twice |
| [Business email](./documents-email): an email or a letter to a client | Sentences too long to follow, stacked hedges, wrong weekdays, blanks left in |
| [Meeting minutes](./documents-minutes): minutes or meeting notes | Wrong weekdays, skipped item numbers, counts that do not match, decisions with nobody behind them |
| [Business reports](./documents-report): a monthly report, a white paper or an internal document | Openings that fit any document, stacked hedges, passives that never say who acts, sentences that run too long |
| [Manuals and API docs](./documents-manual): a user guide, an API doc or a help page | Links that go nowhere, images with no description, skipped heading levels, empty sections |
| [Press releases and announcements](./documents-press): a press release or an announcement | Wrong weekdays, periods that run backwards, totals and breakdowns that do not add up |
| [Papers and abstracts](./documents-paper): a paper, an abstract or a conference submission | Mixed British and American spelling, doubled words, references to missing figures |

If none fits, find the closest genre on the [genres page](../../genres/), which also shows which rules run for each kind.
With no genre set, chaff reads a document as a tech article. When the file name or the content says otherwise, it suggests a genre on the screen.

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
