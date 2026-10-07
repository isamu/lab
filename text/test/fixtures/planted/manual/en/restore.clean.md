# Restoring a backup with vaultr

This manual explains how to restore the nightly backup of the customer database with vaultr. The work takes about 20 minutes.

## Before you start

You need the administrator role on the backup server. Stop the order service, so that no order is written during the restore.

## Restore the backup

1. Open the vaultr console and sign in.
2. Select the backup to restore on the **Backups** screen.
3. Click **Verify Backup** and wait until the check mark appears.
4. Click **Start Restore**.
5. When the progress bar reaches 100%, start the order service again.

Warning: the restore replaces the current database. Export today's orders with `vaultr export --today` before you click **Start Restore**.

## Check the result

1. Open the **Backups** screen again.
2. Check that the restored backup is marked as current.
3. Click **Verify Backup** to confirm that the data is complete.

If the check fails, select the previous backup and click **Start Restore** again.

The console signs you out after 15 minutes of inactivity.
