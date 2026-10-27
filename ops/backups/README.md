# Encrypted off-device backups

Status: prepared, not yet a verified scheduled database backup. The owner chose to keep the current snapshot local. Do not upload customer records/photos or activate exports without new explicit authorization for the specific destination. Use a dedicated PRIVATE repository; never install the workflow in the public website repository. Do not consider the paid-launch recovery gate complete until a scheduled export and isolated restore succeed.

## Contents and retention

The daily job (08:31 UTC; 02:31 MDT / 01:31 MST) exports database roles, application schema, database data including Auth/Storage records, and migration history through Supabase CLI. It downloads all `place-photos` objects, verifies sizes and detects listing changes during download. A manifest maps original object names to saved bytes and SHA-256 hashes. Photos are separate from SQL because database exports contain only their metadata.

The archive is encrypted with a fresh AES-256-GCM key, wrapped using RSA-OAEP-SHA256. Only ciphertext and its envelope are uploaded as private Actions artifacts, retained for 30 days. Each run removes plaintext staging on success/failure. This is a daily recovery point, not point-in-time recovery. Exports and photos are taken sequentially; they are not a shared database/Storage transaction. Monitor failures in Actions and download a monthly encrypted copy to a second protected location. Actions schedule timing is best effort and repository/artifact deletion can remove history.

## Activation

1. Copy `scripts/backups/` into the private repository and install `backup.yml` at `.github/workflows/backup.yml`. Keep the private repository restricted to the owner. Do not enable PR-triggered jobs or upload runner logs/working directories as backup artifacts.
2. Generate a 3072-bit or stronger RSA key pair locally. Save the private PEM in a password manager or another secure recovery location, separate from GitHub and this computer. Set repository variable `BACKUP_PUBLIC_KEY` to the public PEM only. The private key must never be a GitHub secret or committed file.
3. Add repository secret `BACKUP_DATABASE_URL` using the project's session-pooler connection string (port 5432) and database password. Use a role with the required dump permissions; never use the transaction pooler. Enter credentials directly in GitHub, never in chat. The exporter validates the source project and never prints captured provider errors.
4. No Storage service-role secret is needed: the database connection reads the `place-photos` object index and the exporter downloads the public objects. If the bucket becomes private, backups fail closed until the access model is reviewed. The helper uses the official Postgres 15 image, matching the current source; update and reverify it when upgrading the database. No website browser credentials or Stripe keys belong in this repository.
5. Manually run the job, download the encrypted artifact, decrypt offline, validate the SQL and photo manifest, and restore into an isolated compatible Supabase environment. Check the same user IDs, memberships, claims, subscription references, favorites, revisions, photo access, RLS and login flows. Keep email dispatch, cron, webhooks and purchases disabled in the restore target. Never restore a backup over production just to test it.
6. Set `BACKUP_ENABLED=true` only after the first verified export and recovery test. Verify the next scheduled run and failure notifications before declaring the system operational. Do not store the only recovery-key copy on this computer.

## Recovery

`node scripts/backups/restore.mjs DOWNLOADED_ARTIFACT PRIVATE_KEY_FILE NEW_ARCHIVE_PATH` authenticates/decrypts only; it performs no database writes. Extract privately, reject unsafe archive paths, and verify every manifest photo hash before use. Follow Supabase's current hosted restore procedure for roles/schema/data/history, then apply the app's managed Auth triggers/Storage policies from versioned migrations. Restore objects through the Storage API using original names/content types, preserving public URLs as appropriate.

SQL exports do not recreate the platform: separately recreate Auth SMTP/templates/redirects, Edge Functions/secrets, Storage policies/bucket settings, cron/Vault secrets, and external Stripe configuration. Vault encryption requires its original encryption root key or recreation of the source secrets; do not assume an encrypted Vault row is portable. Keep private root keys and provider credentials in a password manager. The website source and reviewed setup SQL remain in `RuckusLabs/herbplaces`; record the deployed source commit during every restore. Coordinate restores with Stripe's current state before reopening purchases or reconciliation.

References: [Supabase backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [database backup limitations](https://supabase.com/docs/guides/platform/backups).
