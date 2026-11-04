import 'dotenv/config';
import { PrismaService } from '../prisma.service';

// Calcula Tag.gameCount (cantidad de juegos por tag), que se usa para el IDF.
// Se corre una vez (y de nuevo solo si cambian los tags de los juegos):
//   npx tsx src/scripts/compute-tag-counts.ts
async function main() {
  const prisma = new PrismaService();

  try {
    console.time('compute-tag-counts');

    await prisma.$transaction([
      prisma.$executeRaw`UPDATE "Tag" SET "gameCount" = 0`,
      prisma.$executeRaw`
        UPDATE "Tag" t
        SET "gameCount" = c."gameCount"
        FROM (
          SELECT "tagId", COUNT(*)::int AS "gameCount"
          FROM "GameTag"
          GROUP BY "tagId"
        ) c
        WHERE t."steamTagId" = c."tagId"
      `,
    ]);

    console.timeEnd('compute-tag-counts');

    const rows = await prisma.$queryRaw<
      Array<{ tags: bigint; withGames: bigint; maxCount: number | null }>
    >`
      SELECT
        COUNT(*) AS "tags",
        COUNT(*) FILTER (WHERE "gameCount" > 0) AS "withGames",
        MAX("gameCount") AS "maxCount"
      FROM "Tag"
    `;

    console.log(
      `Tags: ${rows[0].tags}, con juegos: ${rows[0].withGames}, máximo: ${rows[0].maxCount}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
