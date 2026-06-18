#!/bin/sh
# Recover from partial migration failures before deploy.
# Prisma P3009 blocks startup when _prisma_migrations has a failed row — the SQL
# for these migrations is idempotent, so mark rolled-back and re-apply safely.

RECOVERABLE_FAILED_MIGRATIONS="
20260526070000_week19_file_uploads
20260612160000_power_features_automation
20260612170000_add_review_incentive
20260618120000_ensure_uploaded_file
"

# Bootstrap UploadedFile if week19 never ran (newsletter media uploads)
npx prisma db execute --file prisma/migrations/20260618120000_ensure_uploaded_file/migration.sql 2>/dev/null || true

for migration in $RECOVERABLE_FAILED_MIGRATIONS; do
  if npx prisma migrate resolve --rolled-back "$migration" 2>/dev/null; then
    echo "[migrate-deploy] marked rolled-back: $migration"
  fi
done

exec npx prisma migrate deploy
