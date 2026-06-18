#!/usr/bin/env python3
"""Make all migration.sql files idempotent so `prisma migrate deploy` can be
safely retried after a partial failure, regardless of how far a previous
attempt got. Safe to run repeatedly; already-idempotent statements are left
untouched."""
import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "prisma" / "migrations"

def harden(sql: str) -> str:
    # CREATE TABLE "X" ( -> CREATE TABLE IF NOT EXISTS "X" (
    sql = re.sub(
        r'CREATE TABLE (?!IF NOT EXISTS)"',
        'CREATE TABLE IF NOT EXISTS "',
        sql,
    )

    # CREATE [UNIQUE] INDEX "X" ON -> ... IF NOT EXISTS "X" ON
    sql = re.sub(
        r'CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS|CONCURRENTLY)"',
        lambda m: f'CREATE {m.group(1) or ""}INDEX IF NOT EXISTS "',
        sql,
    )

    # ALTER TABLE "X" ADD COLUMN "y" -> ... ADD COLUMN IF NOT EXISTS "y"
    sql = re.sub(
        r'ADD COLUMN (?!IF NOT EXISTS)"',
        'ADD COLUMN IF NOT EXISTS "',
        sql,
    )

    # DROP COLUMN "y" -> DROP COLUMN IF EXISTS "y"
    sql = re.sub(
        r'DROP COLUMN (?!IF EXISTS)"',
        'DROP COLUMN IF EXISTS "',
        sql,
    )

    # DROP TABLE "X" -> DROP TABLE IF EXISTS "X"
    sql = re.sub(
        r'DROP TABLE (?!IF EXISTS)"',
        'DROP TABLE IF EXISTS "',
        sql,
    )

    # ALTER TABLE "X" ADD CONSTRAINT "Y" ... ; / CREATE POLICY ... ; -> wrap in a
    # DO block that swallows duplicate_object, unless already inside a DO block
    # (i.e. preceded on the prior non-blank line by "DO $$ BEGIN").
    def wrap_if_unwrapped(pattern: str, sql: str) -> str:
        out = []
        pos = 0
        for m in re.finditer(pattern, sql, flags=re.DOTALL):
            preceding = sql[:m.start()]
            prev_line = preceding.rstrip().rsplit("\n", 1)[-1].strip()
            out.append(sql[pos:m.start()])
            if prev_line == "DO $$ BEGIN":
                out.append(m.group(0))
            else:
                stmt = m.group(0)
                out.append(
                    "DO $$ BEGIN\n"
                    f"    {stmt}\n"
                    "EXCEPTION\n"
                    "    WHEN duplicate_object THEN NULL;\n"
                    "END $$;"
                )
            pos = m.end()
        out.append(sql[pos:])
        return "".join(out)

    sql = wrap_if_unwrapped(r'ALTER TABLE "[^"]+"\s+ADD CONSTRAINT "[^"]+"[^;]*;', sql)

    return sql


def main() -> None:
    changed = []
    for path in sorted(MIGRATIONS_DIR.glob("*/migration.sql")):
        original = path.read_text()
        updated = harden(original)
        if updated != original:
            path.write_text(updated)
            changed.append(path.relative_to(MIGRATIONS_DIR))

    print(f"Hardened {len(changed)} migration file(s):")
    for p in changed:
        print(f"  {p}")


if __name__ == "__main__":
    main()
