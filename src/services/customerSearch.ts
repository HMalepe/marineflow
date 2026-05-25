import { prisma } from '../lib/prisma.js';

export interface FuzzySearchResult {
  id: string;
  salonId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  waId: string;
  similarity: number;
}

/**
 * Fuzzy search customers using pg_trgm similarity.
 * Searches across firstName, lastName, displayName, email, and waId.
 * Returns results ranked by similarity score (descending).
 */
export async function fuzzySearchCustomers(
  salonId: string,
  query: string,
  options: { limit?: number; threshold?: number } = {},
): Promise<FuzzySearchResult[]> {
  const { limit = 20, threshold = 0.3 } = options;

  if (!query.trim()) return [];

  const results = await prisma.$queryRawUnsafe<FuzzySearchResult[]>(
    `SELECT
       id, "salonId", "displayName", "firstName", "lastName", email, "waId",
       GREATEST(
         similarity(COALESCE("firstName", ''), $1),
         similarity(COALESCE("lastName", ''), $1),
         similarity(COALESCE("displayName", ''), $1),
         similarity(COALESCE(email, ''), $1),
         similarity("waId", $1)
       ) AS similarity
     FROM "Customer"
     WHERE "salonId" = $2
       AND "deletedAt" IS NULL
       AND (
         similarity(COALESCE("firstName", ''), $1) > $3
         OR similarity(COALESCE("lastName", ''), $1) > $3
         OR similarity(COALESCE("displayName", ''), $1) > $3
         OR similarity(COALESCE(email, ''), $1) > $3
         OR similarity("waId", $1) > $3
       )
     ORDER BY similarity DESC
     LIMIT $4`,
    query.trim(),
    salonId,
    threshold,
    limit,
  );

  return results.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}
