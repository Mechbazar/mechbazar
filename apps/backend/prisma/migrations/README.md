# Migration history — read this before running anything here

This directory didn't exist before 2026-08-02. Every environment up to now
(prod VPS, local dev, anywhere else this schema is deployed) was set up with
`prisma db push`, which has no migration history at all -- schema changes
were applied directly with no record of what changed or when. This is the
starting point for tracked, diffable migrations going forward.

There are two migrations here:

1. **`..._baseline`** -- a snapshot of the schema exactly as it was deployed
   at commit `9e79d87` (before today's fixes), expressed as `CREATE TABLE`
   statements from an empty database. **Do not run this migration's SQL
   against any existing environment** -- every table it creates already
   exists there (that's the whole point: it's a baseline, not a change).
2. **`..._qa_audit_fixes`** -- the actual schema changes from the 2026-08-02
   QA/security audit fix pass: 4 new indexes, `createdAt`/`updatedAt` on
   `DeliveryPartner`/`ServiceTechnician`, `updatedAt` on `Payment`, a new
   `VendorStatus.RESUBMISSION_REQUIRED` enum value, and `VendorDocument`
   gaining nullable `filePath`/`fileData`/`mimeType` columns (its old `url`
   column is now nullable too, kept for backward-compat -- see the schema
   comment and `prisma/backfill-vendor-documents.ts`). This one **is** meant
   to actually run.

## One-time adoption step, per environment (prod VPS, local dev, etc.)

Run this once, against each environment's real `DATABASE_URL`, in this exact
order:

```bash
# 1. Tell Prisma the baseline is already reflected in this database --
#    this does NOT execute the baseline's SQL, it just records it as applied.
npx prisma migrate resolve --applied 20260801193930_baseline

# 2. Now apply the real change.
npx prisma migrate deploy
```

If step 1 is skipped, step 2 will try to run the baseline's `CREATE TABLE`
statements and fail because those tables already exist.

## From now on

Use `npx prisma migrate dev --name <what-changed>` when developing locally
(it edits `schema.prisma`, generates a new migration folder here, and
applies it to your dev database in one step), and `npx prisma migrate
deploy` in prod deploys -- not `prisma db push`. `db push` is still fine for
quick local prototyping before you've committed to a schema shape, but
anything meant to ship should go through a migration so the history here
stays a true record of what changed.
