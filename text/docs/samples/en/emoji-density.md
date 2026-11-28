<!-- chaff-sample
rule: emoji-density
genre: business/report
file: newsletter.md
-->

# Too many emoji (`emoji-density`)

**Where it helps:** team newsletters, internal updates, announcements. Friendly documents where one emoji leads to another.

## Original

```markdown chaff-before
# Team newsletter, March

Hello everyone. 👋 Here is what happened on the team this month.

## New faces

Two new people joined us this month. 🥳 Maria is our new support lead and comes from a travel company, where she ran a team of twelve. ✈️ Daniel joins the data team as a junior analyst after finishing his degree in the summer. 🎓 Please say hello if you see them in the kitchen. ☕

## The office move

The move to the third floor is finished. 🚚 The new meeting rooms can be booked from the calendar as before, and the quiet room at the end of the corridor is for calls only. 🤫 If your chair or screen did not arrive, tell facilities by Friday so they can find it. 🔍

## Results

Support answered 2,300 tickets in March, the most in a single month so far. 💪 The average first reply came within five hours, down from seven. 🚀 Customer ratings stayed at 4.6 out of 5. ⭐ Thank you to everyone who covered extra shifts while two people were on leave. 🙏

## Coming up

The spring team lunch is on 24 April at the Italian place near the station. 🍝 Please add your name to the sheet by 15 April so we can book enough tables. 📝 If you have news for the next newsletter, send it to me by the end of the month. 💌

See you next month. 😊
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report newsletter.md

newsletter.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    👋 Here is what happened on the team this month.

  ·  Too many emoji

     70 emoji per 1000 words (limit 8)
     One emoji marks a spot. Many turn the text into decoration, and a screen reader has to say all of them.

     → Where a heading or emphasis would do the same job, use that instead.

     Relax this rule:  npx chaffjs relax emoji-density


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Team newsletter, March

Hello everyone. Here is what happened on the team this month.

## New faces

Two new people joined us this month. Maria is our new support lead and comes from a travel company, where she ran a team of twelve. Daniel joins the data team as a junior analyst after finishing his degree in the summer. Please say hello if you see them in the kitchen.

## The office move

The move to the third floor is finished. The new meeting rooms can be booked from the calendar as before, and the quiet room at the end of the corridor is for calls only. If your chair or screen did not arrive, tell facilities by Friday so they can find it.

## Results

Support answered 2,300 tickets in March, the most in a single month so far. The average first reply came within five hours, down from seven. Customer ratings stayed at 4.6 out of 5. Thank you to everyone who covered extra shifts while two people were on leave.

## Coming up

The spring team lunch is on 24 April at the Italian place near the station. Please add your name to the sheet by 15 April so we can book enough tables. If you have news for the next newsletter, send it to me by the end of the month.

See you next month. 😊
```

## How it was fixed

Almost every sentence of the newsletter ends with an emoji: chaff counts 70 per 1000 words, where the limit is 8.
One or two would make it feel friendly; at this rate they stop meaning anything, and the two requests in it (tell facilities about a missing chair by Friday, sign up for the lunch by 15 April) look no different from the decoration around them.
A colleague using a screen reader hears every one read out: "airplane", "graduation cap", "hot beverage".

The fix keeps the one at the end, where it says goodbye, and lets the headings do the job of marking each part.
The newsletter is just as warm, and the dates now stand out.

## Settings

The rule counts emoji per 1000 words, and reports a document above 8; `strict` reports one above 3 and `relaxed` one above 20.
Documents under 200 words are not measured, and an arrow between two words (Settings → Printers) marks a menu path and is not counted.
Emoji in headings are a separate rule, `emoji-heading`.

```yaml chaff-settings
rules:
  emoji-density: relaxed
```

The rule does not run on literature.

```text chaff-explain
$ npx chaffjs explain emoji-density --genre business/report

  Too many emoji   (emoji-density)

  One emoji marks a spot. Many turn the text into decoration, and a screen reader has to say all of them.

  How to fix: Where a heading or emphasis would do the same job, use that instead.

  Levels:
    strict   up to 3 emoji per 1000 words
  → normal   up to 8 emoji per 1000 words
    relaxed  up to 20 emoji per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax emoji-density --why "reason"
```

[All samples](README.md)
