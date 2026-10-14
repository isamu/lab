# Incident Report: Checkout API Slowdown

Larkspur Books, Site Reliability Team

Incident number: INC-58203

Incident date: September 15, 2026

Report date: September 18, 2026

Severity: High

## Summary

On the afternoon of September 15, 2026, the checkout API slowed down and some customers could not complete their orders.

- Started: 2:05 PM
- Detected: 1:58 PM
- Resolved: 3:47 PM
- Duration: 1 hour 24 minutes

## Timeline

| Time | Event |
| --- | --- |
| 2:05 PM | Checkout response times begin to rise |
| 2:12 PM | A monitoring alert pages the on-call engineer |
| 2:25 PM | The database is found at its connection limit |
| 2:20 PM | The connection limit is raised for the time being |
| 3:10 PM | Response times begin to fall |
| 3:47 PM | Response times are back to normal and the incident is closed |

## Impact

Customers in the following four regions could not complete their orders:

- US East
- US West
- Canada

The failed orders broke down by payment method as follows.

| Payment method | Orders | Share |
| --- | --- | --- |
| Credit card | 1,240 | 52% |
| Gift card | 480 | 24% |
| PayPal | 280 | 14% |
| Total | 2,000 | 100% |

## Cause

A new reporting job released on the morning of September 15 left its database connections open. When orders picked up in the afternoon, the connections reached the limit and new checkouts had to wait.

## Follow-up actions

| Action | Owner | Due |
| --- | --- | --- |
| Add a check that finds connections left open | Platform team | September 10, 2026 |
| Alert when connections pass 80% of the limit | Monitoring team | October 9, 2026 |
| Update the incident runbook | Operations team | October 16, 2026 |

For questions about incident INC-58230, please contact the Site Reliability Team.
