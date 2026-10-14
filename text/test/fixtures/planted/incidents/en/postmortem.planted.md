# Postmortem: Delivery Notification Emails Stopped

Brightwater Freight, Systems Group

Postmortem ID: PM-4672

Incident window: August 21, 2026 – August 22, 2026

Written: August 27, 2026

## What happened

From the night of August 21 into the next morning, no delivery notification emails were sent. Sending stopped at 10:10 PM and came back at 12:35 AM the next day. The outage lasted 2 hours 52 minutes.

Monitoring raised the alarm at 9:58 PM, 21 minutes after sending stopped.

## Timeline

### August 21, 2026

- 9:50 PM Work begins to renew the mail server's certificate
- 10:10 PM Emails stop being sent
- 10:31 PM Monitoring reports a growing queue of unsent emails
- 10:45 PM The on-call engineer finds a mistake in the certificate settings
- 10:20 PM The old certificate is restored, but sending does not resume

### August 22, 2026

- 12:05 AM The new certificate is installed again with the right settings
- 12:35 AM Sending is confirmed to have resumed
- 1:40 AM Every queued email has been sent

## Impact

About 18,000 emails were not sent on time. They went to the following three groups of customers:

- Individual customers
- Business customers

By type, the delayed emails were 70% delivery estimates, 20% redelivery confirmations and 15% other.

## Cause

The runbook for renewing the certificate left out one change to the settings file. No one checked the runbook before the work began.

## What we will do

- Review the certificate runbook and have a second person check before the work starts (due August 14, 2026)
- Phone the on-call engineer when more than 500 emails are waiting (due September 11, 2026)
- Try renewing the certificate automatically (due October 30, 2026)

When asking about this postmortem, please quote PM-4762 to the Systems Group.
