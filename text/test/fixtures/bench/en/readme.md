# roomly-cli

A command line tool for the company room booking server. It lists bookings, finds free rooms, and cancels bookings.

## Installing the tool

You need Node.js 24 or later. Install it with this command.

```sh
npm install -g roomly-cli
```

## Getting started

First, set the address of the booking server. The IT team gives you this address. The tool saves it in a settings file in your home directory.

```sh
roomly config set server https://roomly.example.com
```

Next, list today's bookings. Each line shows the room, the time slot, and the person who booked it. Add `--mine` to see only your own bookings.

```sh
roomly list --today
```

Pass a start time and a length to find a free room. Without a length, the tool looks for a one-hour slot.

## Settings file

| Key | Meaning |
| --- | --- |
| server | Address of the booking server |
| user | Employee number used for bookings |
| timeout | Seconds to wait for a reply |

## Common questions

If the tool cannot reach the server, check that you are on the office network. The server does not accept requests from outside.

You can cancel a booking only before it starts. To free a room during a meeting, press the panel at the door.

## License

The tool is released under the MIT license. Report bugs in the internal issue tracker.
