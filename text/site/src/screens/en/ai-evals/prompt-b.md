# Why the deploy failed

In today's fast-paced world of software delivery, every deploy plays a crucial role.
Let's delve into what happened on Tuesday.

**It wasn't a code problem. It was a database problem.**
A migration added a column with a default value — and on our largest table, that locked writes for four minutes.
The health check gave up after two minutes — and rolled the release back.

The fix is a testament to careful engineering: we will meticulously add the column without a default, then fill it in batches.

In conclusion, robust migrations are the key to a seamless pipeline. I hope this helps!
