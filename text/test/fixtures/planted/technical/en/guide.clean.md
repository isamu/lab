# Aligning monthly sales data

This guide explains how to bring the sales CSV files sent by branch offices into the head office format with tidyq. The work takes about 30 minutes.

## Before you start

The work is done by someone with access to the internal ETL (extract, transform, load) server. Check that the ETL server has at least 20 GB of free space.

## Steps

1. Put the CSV files from the branches in the `incoming` folder.
2. Run `tidyq check` to list what needs fixing.
3. Read the list and check that no column name is wrong.
4. Run `tidyq fix` to align the formats and write the files to the `outgoing` folder.
5. Send the written files to the ETL server.

You can send up to 2 GB at a time. Before step 4, split larger files into 1 GB parts with `--split`.

## If something goes wrong

If a wrong column name remains, go back to step 3 and read the list again.

The server rejects a file larger than 2 GB.
