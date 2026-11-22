<!-- chaff-sample
rule: arrival-before-departure
genre: business/report
file: itinerary.md
-->

# An arrival before its departure (`arrival-before-departure`)

**Where it helps:** travel itineraries, timetables, booking confirmations. Any trip with a departure and an arrival on one line.

## Original

```markdown chaff-before
# Itinerary: client visit to Washington

Traveller: regional account manager. Both trains are Amtrak Northeast Regional, booked in business class.

| Date | Train | Departs | Arrives |
| --- | --- | --- | --- |
| Tue 15 Sep 2026 | New York Penn to Washington Union Station | 7:05 AM | 6:50 AM |
| Thu 17 Sep 2026 | Washington Union Station to New York Penn | 4:10 PM | 7:45 PM |

A hotel room is booked near the client's office for two nights. The client will meet you in the station concourse at 11:30 AM on Tuesday.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report itinerary.md

itinerary.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    6:50 AM |

  ⚠  An arrival before its departure

     Arrives at 6:50 AM, before it departs at 7:05 AM
     When a leg such as "departs Washington 1:30 PM, arrives Boston 1:05 PM" arrives before it departs, one of the times is wrong. The reader has to look the connection up again, and someone may plan around the wrong time. A departure and an arrival in one line are compared: times marked "departs" and "arrives" (or "dep" and "arr"), and the departure and arrival columns of a table. An arrival marked as the next day (+1, "next day") gets a day added, and when both times have a date, the dates are compared first.

     → Check both times and correct the wrong one. If the leg arrives on the next day, mark the arrival "+1" or "next day".

     Relax this rule:  npx chaffjs relax arrival-before-departure


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Itinerary: client visit to Washington

Traveller: regional account manager. Both trains are Amtrak Northeast Regional, booked in business class.

| Date | Train | Departs | Arrives |
| --- | --- | --- | --- |
| Tue 15 Sep 2026 | New York Penn to Washington Union Station | 7:05 AM | 10:50 AM |
| Thu 17 Sep 2026 | Washington Union Station to New York Penn | 4:10 PM | 7:45 PM |

A hotel room is booked near the client's office for two nights. The client will meet you in the station concourse at 11:30 AM on Tuesday.
```

## How it was fixed

The outbound train departs at 7:05 AM and, as written, arrives at 6:50 AM: before it has left.
New York and Washington are in the same time zone, so one of the two times is wrong.
The traveller cannot tell how much time they have before meeting the client, and whoever booked the meeting may have planned around the wrong one.

The booking confirmation gives the arrival as 10:50 AM; "10:50" lost its first digit when it was copied into the table.
With the right time, there are forty minutes between arriving and meeting the client.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  arrival-before-departure: relaxed
```

A departure and an arrival on one line are compared: times marked "departs" and "arrives" (or "dep" and "arr"), and the departure and arrival columns of a table.
An arrival marked as the next day (+1, "next day") gets a day added, and when both times have a date, the dates are compared first.
A line with two different time zones or a "local time" mark is not reported, since the times cannot be compared as written.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain arrival-before-departure --genre business/report

  An arrival before its departure   (arrival-before-departure)

  When a leg such as "departs Washington 1:30 PM, arrives Boston 1:05 PM" arrives before it departs, one of the times is wrong. The reader has to look the connection up again, and someone may plan around the wrong time. A departure and an arrival in one line are compared: times marked "departs" and "arrives" (or "dep" and "arr"), and the departure and arrival columns of a table. An arrival marked as the next day (+1, "next day") gets a day added, and when both times have a date, the dates are compared first.

  How to fix: Check both times and correct the wrong one. If the leg arrives on the next day, mark the arrival "+1" or "next day".

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax arrival-before-departure --why "reason"
```

[All samples](README.md)
