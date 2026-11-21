<!-- chaff-sample
rule: due-before-issue
genre: business/proposal
file: invoice.md
-->

# A due date before the issue date (`due-before-issue`)

**Where it helps:** invoices, quotations with an expiry date, meeting minutes with action items. Anywhere a document sets its own date and a deadline after it.

## Original

```markdown chaff-before
# Invoice 2026-031

Northfield Web Services, for Oakridge Veterinary Clinic.

- Invoice date: 3 March 2026
- Payment due: 2 February 2026

| Item | Amount |
| --- | --- |
| Website hosting, March | $45.00 |
| Booking form update | $120.00 |
| Total | $165.00 |

Please pay by bank transfer to the account shown below.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal invoice.md

invoice.md   business/proposal · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    2 February 2026

  ✖  A due date before the issue date

     The due date 2 February 2026 is before the issue date 3 March 2026
     When the payment due date of an invoice or the expiry of a quote is before its issue date, the document is overdue on arrival and the reader has to ask which date is right. It happens when last month's invoice is reused and only one date is changed. The date on a line starting with an issue word (Issued, Invoice date) is compared with the date on a line starting with a due word (Payment due, Valid until), and an earlier due date is pointed out. Minutes are read the same way. An action item due before the meeting it was set in is overdue when it is written down. The dates in the due column, or after "due" in a list item, of an action-items section are compared with the date on the "Date" line near the top. A property listing is read the same way. An "Available from" date before the "Listed" date has passed when the listing goes up. A job posting is read the same way. An "Application deadline" before the "Posted" date has passed when the posting goes up. An earnings release is read the same way. An "Earnings call" before the "Reporting period" ends would discuss results for a period that has not closed; a line stating a period is compared by the period's last day. A checkup or lab report is read the same way. A "Report date" before the "Examination date" or the "Collection date" reports results that did not exist yet. A product warranty is read the same way. A "Registration deadline" before the "Purchase date" has passed when the product is bought. A hotel or car rental booking is read the same way. A "Check-out" before the "Check-in", or a "Drop-off" before the "Pick-up", leaves before arriving; a "Free cancellation until" date after the check-in or the pick-up lets the booking be cancelled free once it has started, so one of the dates is wrong. The finding is on whichever of the two dates is written second. The pairs of dates that must come in order are listed, pair by pair, in the language's vocabulary. A loan or an installment plan is read the same way. A "First payment date" before the "Contract date" has passed when the contract is signed. A recall notice is read the same way. A deadline for replacement or refund requests before the "Notice date" has passed when the notice goes out. A payslip is read the same way. A "Pay date" before the "Pay period" starts pays for a period that has not begun. A trip or an expense report is read the same way. A "Return" before the "Departure" comes back before leaving. A purchase order or a delivery note is read the same way. A "Delivery date" before the "Order date" delivers goods not yet ordered. An academic transcript or a certificate of graduation or completion is read the same way. A "Date of graduation" or "Date of completion" before the "Date of enrolment" ends the course before it began, and a "Date of issue" before the graduation or completion date certifies a graduation that has not happened yet. An annual earnings and tax withholding statement is read the same way. An "Issue date" before the "Tax year" ends, or before the "Leaving date", states the year's amounts before they are final. A packing list or a commercial invoice is read the same way. An "Arrival date" or "Estimated arrival" before the "On-board date" arrives before the goods are shipped. An itemized medical bill is read the same way. A "Date issued" before the "Date of visit" bills a visit that has not happened yet, and a "Date of discharge" before the "Date of admission" leaves hospital before arriving. A tenancy's deposit settlement is read the same way. A "Move-out date" before the "Move-in date" leaves before moving in, and a "Notice date" after the "Move-out date" gives notice once the tenant has already left. A car's service record is read the same way. A "Next inspection due" before the "Service date" has passed when the car is serviced. A construction or renovation quote is read the same way. A "Completion date" or "Handover date" before the "Start date" or "Construction start" finishes the work before it begins. A phone bill or a service contract is read the same way. A "Service end date" or "Contract end date" before the "Service start date" or "Contract start date" ends the service before it began. A price list, a coupon or a policy is read the same way. A "Valid until" or an "Expiry date" before the "Valid from" or the "Effective date" ends before it begins. A bank statement whose period is written as two lines is read the same way. A "Period end" before the "Period start" ends the period before it begins. An insurance or benefit claim is read the same way. A "Date of claim" before the "Date of incident" claims for a loss that has not happened yet. A treasurer's report or an income and expenditure statement is read the same way. An audit date before the "Fiscal year" or the "Financial year" ends audits accounts that have not closed. When one table's header names both columns of a pair, as a points statement's "Date" and "Expires" do, the two dates of each row are compared. Points that expire before the date they were earned have lapsed on arrival. A row is never compared with another row or another table. A property sale's settlement statement is read the same way. A "Settlement date" or "Closing date" before the "Contract date" pays and hands over the property before the sale is agreed. A banquet or meeting room quote runs the other way. A "Valid until" date after the "Event date" lets the quote be accepted once the event is over.

     → Check which is right, the issue date or the due date, and correct the other.

     Relax this rule:  npx chaffjs relax due-before-issue


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Invoice 2026-031

Northfield Web Services, for Oakridge Veterinary Clinic.

- Invoice date: 3 March 2026
- Payment due: 2 April 2026

| Item | Amount |
| --- | --- |
| Website hosting, March | $45.00 |
| Booking form update | $120.00 |
| Total | $165.00 |

Please pay by bank transfer to the account shown below.
```

## How it was fixed

This invoice was made from last month's, and only the invoice date was moved on.
As written, it falls due a month before it was issued: it is overdue the moment it arrives.
The clinic's bookkeeper cannot tell whether the invoice is wrongly dated or the payment is late, and has to call to ask before paying.

The fix moves the due date on with the invoice date, to 2 April 2026, the same thirty days the previous invoice gave.
When an invoice is copied each month, both dates have to change together; a machine notices when only one did.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  due-before-issue: relaxed
```

The date on a line starting with an issue word (Issued, Invoice date) is compared with the date on a line starting with a due word (Payment due, Valid until).
In minutes, an action item due before the meeting it was set in is reported the same way.
A date in a sentence, a date without its year, a due date eight lines or more away from the issue date, and a line that says the deadline has passed (overdue, expired) are not compared.
It does not run on statutes, court decisions, patents, FAQs, glossaries, academic writing, literature or speech, where a past deadline is reported on rather than set.

```text chaff-explain
$ npx chaffjs explain due-before-issue --genre business/proposal

  A due date before the issue date   (due-before-issue)

  When the payment due date of an invoice or the expiry of a quote is before its issue date, the document is overdue on arrival and the reader has to ask which date is right. It happens when last month's invoice is reused and only one date is changed. The date on a line starting with an issue word (Issued, Invoice date) is compared with the date on a line starting with a due word (Payment due, Valid until), and an earlier due date is pointed out. Minutes are read the same way. An action item due before the meeting it was set in is overdue when it is written down. The dates in the due column, or after "due" in a list item, of an action-items section are compared with the date on the "Date" line near the top. A property listing is read the same way. An "Available from" date before the "Listed" date has passed when the listing goes up. A job posting is read the same way. An "Application deadline" before the "Posted" date has passed when the posting goes up. An earnings release is read the same way. An "Earnings call" before the "Reporting period" ends would discuss results for a period that has not closed; a line stating a period is compared by the period's last day. A checkup or lab report is read the same way. A "Report date" before the "Examination date" or the "Collection date" reports results that did not exist yet. A product warranty is read the same way. A "Registration deadline" before the "Purchase date" has passed when the product is bought. A hotel or car rental booking is read the same way. A "Check-out" before the "Check-in", or a "Drop-off" before the "Pick-up", leaves before arriving; a "Free cancellation until" date after the check-in or the pick-up lets the booking be cancelled free once it has started, so one of the dates is wrong. The finding is on whichever of the two dates is written second. The pairs of dates that must come in order are listed, pair by pair, in the language's vocabulary. A loan or an installment plan is read the same way. A "First payment date" before the "Contract date" has passed when the contract is signed. A recall notice is read the same way. A deadline for replacement or refund requests before the "Notice date" has passed when the notice goes out. A payslip is read the same way. A "Pay date" before the "Pay period" starts pays for a period that has not begun. A trip or an expense report is read the same way. A "Return" before the "Departure" comes back before leaving. A purchase order or a delivery note is read the same way. A "Delivery date" before the "Order date" delivers goods not yet ordered. An academic transcript or a certificate of graduation or completion is read the same way. A "Date of graduation" or "Date of completion" before the "Date of enrolment" ends the course before it began, and a "Date of issue" before the graduation or completion date certifies a graduation that has not happened yet. An annual earnings and tax withholding statement is read the same way. An "Issue date" before the "Tax year" ends, or before the "Leaving date", states the year's amounts before they are final. A packing list or a commercial invoice is read the same way. An "Arrival date" or "Estimated arrival" before the "On-board date" arrives before the goods are shipped. An itemized medical bill is read the same way. A "Date issued" before the "Date of visit" bills a visit that has not happened yet, and a "Date of discharge" before the "Date of admission" leaves hospital before arriving. A tenancy's deposit settlement is read the same way. A "Move-out date" before the "Move-in date" leaves before moving in, and a "Notice date" after the "Move-out date" gives notice once the tenant has already left. A car's service record is read the same way. A "Next inspection due" before the "Service date" has passed when the car is serviced. A construction or renovation quote is read the same way. A "Completion date" or "Handover date" before the "Start date" or "Construction start" finishes the work before it begins. A phone bill or a service contract is read the same way. A "Service end date" or "Contract end date" before the "Service start date" or "Contract start date" ends the service before it began. A price list, a coupon or a policy is read the same way. A "Valid until" or an "Expiry date" before the "Valid from" or the "Effective date" ends before it begins. A bank statement whose period is written as two lines is read the same way. A "Period end" before the "Period start" ends the period before it begins. An insurance or benefit claim is read the same way. A "Date of claim" before the "Date of incident" claims for a loss that has not happened yet. A treasurer's report or an income and expenditure statement is read the same way. An audit date before the "Fiscal year" or the "Financial year" ends audits accounts that have not closed. When one table's header names both columns of a pair, as a points statement's "Date" and "Expires" do, the two dates of each row are compared. Points that expire before the date they were earned have lapsed on arrival. A row is never compared with another row or another table. A property sale's settlement statement is read the same way. A "Settlement date" or "Closing date" before the "Contract date" pays and hands over the property before the sale is agreed. A banquet or meeting room quote runs the other way. A "Valid until" date after the "Event date" lets the quote be accepted once the event is over.

  How to fix: Check which is right, the issue date or the due date, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax due-before-issue --why "reason"
```

[All samples](README.md)
