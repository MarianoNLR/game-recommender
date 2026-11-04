/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SteamAppDetails, SteamStoreTag } from '../steam/steam.types';
import { Game } from 'src/generated/prisma/client';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class GameService {
  private readonly PRICE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly INFO_CACHE_MS = 365 * 30 * 24 * 60 * 60 * 1000;
  private readonly TAGS_CACHE_MS = 365 * 30 * 24 * 60 * 60 * 1000;
  constructor(private readonly prismaService: PrismaService) {}

  async upsertGame(
    data: SteamAppDetails,
    updatePrice = true,
    updateInfo = true,
  ) {
    const releaseDate = this.parseReleaseDate(data.release_date);
    const now = new Date();

    return this.prismaService.game.upsert({
      where: {
        steamAppId: data.steam_appid,
      },

      create: {
        steamAppId: data.steam_appid,
        name: data.name,
        description: data.short_description,
        isFree: data.is_free,

        price: data.price_overview?.final ?? null,
        initialPrice: data.price_overview?.initial,
        discount: data.price_overview?.discount_percent ?? null,

        releaseDate,

        lastInfoUpdate: now,
      },

      update: {
        ...(updateInfo && {
          name: data.name,
          description: data.short_description,
          releaseDate,
          isFree: data.is_free,
          lastInfoUpdate: now,
        }),

        ...(updatePrice && {
          price: data.price_overview?.final ?? null,
          initialPrice: data.price_overview?.initial,
          discount: data.price_overview?.discount_percent ?? null,
          lastPriceUpdate: now,
        }),
      },
    });
  }

  async updateGameTags(
    steamAppId: number,
    tags: SteamStoreTag[],
  ): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      for (const tag of tags) {
        const dbTag = await tx.tag.upsert({
          where: {
            name: tag.name,
          },
          create: {
            steamTagId: tag.tagid,
            name: tag.name,
          },
          update: {
            steamTagId: tag.tagid,
          },
        });

        await tx.gameTag.upsert({
          where: {
            gameId_tagId: {
              gameId: steamAppId,
              tagId: dbTag.id,
            },
          },
          create: {
            gameId: steamAppId,
            tagId: dbTag.id,
            weight: tag.count,
          },
          update: {
            //count: tag.count,
          },
        });
      }

      await tx.game.update({
        where: {
          steamAppId,
        },
        data: {
          lastInfoUpdate: new Date(),
        },
      });
    });
  }

  private parseReleaseDate(
    releaseDate?: SteamAppDetails['release_date'],
  ): Date | null {
    if (!releaseDate || releaseDate.coming_soon) {
      return null;
    }

    const date = new Date(releaseDate.date);

    return isNaN(date.getTime()) ? null : date;
  }

  isPriceCacheValid(game: Game): boolean {
    return (
      game.lastInfoUpdate !== null &&
      Date.now() - game.lastInfoUpdate.getTime() < this.PRICE_CACHE_MS
    );
  }

  isInfoCacheValid(game: Game): boolean {
    return (
      game.lastInfoUpdate !== null &&
      Date.now() - game.lastInfoUpdate.getTime() < this.INFO_CACHE_MS
    );
  }

  isTagsCacheValid(game: Game): boolean {
    return (
      game.lastInfoUpdate !== null &&
      Date.now() - game.lastInfoUpdate.getTime() < this.TAGS_CACHE_MS
    );
  }

  async findByAppId(appId: number) {
    return this.prismaService.game.findUnique({
      where: { steamAppId: appId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  async findTagsByAppIds(appIds: number[]) {
    return this.prismaService.game.findMany({
      where: {
        steamAppId: {
          in: appIds,
        },
      },
      select: {
        steamAppId: true,
        name: true,
        imageUrl: true,
        tags: {
          select: {
            weight: true,
            tag: {
              select: {
                name: true,
                steamTagId: true,
              },
            },
          },
        },
      },
    });
  }

  async findCandidatesByTags(
    tagNames: string[],
    multiplayerTags: string[],
    budget: number,
  ) {
    return this.prismaService.$queryRaw<
      Array<{
        steamAppId: number;
        name: string;
        releaseDate: Date | null;
        reviewPercentage: number | null;
        reviewCount: number | null;
        isFree: boolean | null;
        price: number | null;
        initialPrice: number | null;
        discount: number | null;
        tags: Array<{
          weight: number;
          tag: { steamTagId: number | null; name: string };
        }>;
      }>
    >(Prisma.sql`
      WITH candidates AS (
        SELECT
          g."steamAppId",
          COUNT(DISTINCT t."steamTagId") AS "matchedTags"
        FROM "Game" g
        JOIN "GameTag" gt
          ON gt."gameId" = g."steamAppId"
        JOIN "Tag" t
          ON t."steamTagId" = gt."tagId"
        WHERE t."name" IN (${Prisma.join(tagNames)})
          AND (
            g."reviewPercentage" IS NULL
            OR COALESCE(g."reviewCount", 0) = 0
            OR g."reviewPercentage" >= 55
          )
          AND g."price" <= ${budget}
          AND g."isMultiplayer" = true
          AND NOT EXISTS (
            SELECT 1
            FROM "GameTag" vrgt
            WHERE vrgt."gameId" = g."steamAppId"
              AND vrgt."tagId" = (SELECT "steamTagId" FROM "Tag" WHERE "name" = 'VR')
          )
        GROUP BY g."steamAppId"
        HAVING COUNT(DISTINCT t."steamTagId") >= 3
        ORDER BY "matchedTags" DESC
        LIMIT 300
      )
      SELECT
        g."steamAppId",
        g."name",
        g."releaseDate",
        g."reviewPercentage",
        g."reviewCount",
        g."isFree",
        g."price",
        g."initialPrice",
        g."discount",
        COALESCE(
          json_agg(
            json_build_object(
              'weight', ogt."weight",
              'tag', json_build_object(
                'steamTagId', ot."steamTagId",
                'name', ot."name"
              )
            )
          ) FILTER (WHERE ogt."gameId" IS NOT NULL),
          '[]'::json
        ) AS "tags"
      FROM candidates c
      JOIN "Game" g
        ON g."steamAppId" = c."steamAppId"
      LEFT JOIN "GameTag" ogt
        ON ogt."gameId" = g."steamAppId"
      LEFT JOIN "Tag" ot
        ON ot."steamTagId" = ogt."tagId"
      GROUP BY g."steamAppId"
    `);
  }

  async getNormalizedTagIdf(): Promise<Record<string, number>> {
    const totalGames = await this.prismaService.game.count();

    // Camino rápido: Tag.gameCount precalculado (scripts/compute-tag-counts.ts).
    let rows: Array<{ name: string; gameCount: bigint | number }> = [];

    try {
      rows = await this.prismaService.$queryRaw<
        Array<{ name: string; gameCount: number }>
      >(Prisma.sql`
        SELECT "name", "gameCount" FROM "Tag" WHERE "gameCount" > 0
      `);
    } catch (error) {
      // La columna todavía no existe (migración sin aplicar): se usa el conteo lento.
      console.warn(
        '[idf] No se pudo leer Tag.gameCount (¿migración sin aplicar?):',
        error instanceof Error ? error.message : error,
      );
    }

    if (rows.length === 0) {
      console.warn(
        '[idf] Tag.gameCount vacío: se usa el conteo lento (~4 s). Corré src/scripts/compute-tag-counts.ts',
      );
      rows = await this.countGamesPerTag();
    }

    return this.buildNormalizedIdf(totalGames, rows);
  }

  // Conteo directo sobre GameTag (lento, ~4 s); solo como respaldo.
  private async countGamesPerTag() {
    return this.prismaService.$queryRaw<
      Array<{
        name: string;
        gameCount: bigint;
      }>
    >(Prisma.sql`
    SELECT
      t."name",
      gt."gameCount"
    FROM (
      -- (gameId, tagId) es PK, así que COUNT(*) equivale a COUNT(DISTINCT gameId).
      SELECT "tagId", COUNT(*) AS "gameCount"
      FROM "GameTag"
      GROUP BY "tagId"
    ) gt
    JOIN "Tag" t
      ON t."steamTagId" = gt."tagId"
  `);
  }

  private buildNormalizedIdf(
    totalGames: number,
    rows: Array<{ name: string; gameCount: bigint | number }>,
  ): Record<string, number> {
    const tags = rows.map((row) => {
      const gamesWithTag = Number(row.gameCount);

      const idf = Math.log((totalGames + 1) / (gamesWithTag + 1));

      return {
        tag: row.name,
        idf,
      };
    });

    const maxIdf = Math.max(...tags.map((tag) => tag.idf));

    return Object.fromEntries(
      tags.map(({ tag, idf }) => [tag, maxIdf > 0 ? idf / maxIdf : 0]),
    );
  }

  // async updateGameInfo(
  //   appId: number,
  //   data: {
  //     name: string;
  //     description?: string;
  //     releaseDate?: Date;
  //     // Add other fields as necessary (details)
  //   },
  // ) {
  //   return this.prismaService.game.upsert({
  //     where: {
  //       steamAppId: appId,
  //     },
  //     update: {
  //       ...data,
  //       lastInfoUpdate: new Date(),
  //     },
  //     create: {
  //       steamAppId: appId,
  //       ...data,
  //       lastInfoUpdate: new Date(),
  //     },
  //   });
  // }

  // async updateGamePrice(
  //   appId: number,
  //   data: {
  //     price?: number;
  //     discount?: number;
  //   },
  // ) {
  //   return this.prismaService.game.update({
  //     where: {
  //       steamAppId: appId,
  //     },
  //     data: {
  //       ...data,
  //       lastPriceUpdate: new Date(),
  //     },
  //   });
  // }

  // async updateGameTags(appId: number, tags: Record<string, number>) {
  //   const game = await this.prismaService.game.findUnique({
  //     where: {
  //       steamAppId: appId,
  //     },
  //   });

  //   if (!game) {
  //     throw new Error(`Game ${appId} not found`);
  //   }

  //   await this.prismaService.$transaction(async (tx) => {
  //     const tagIds: number[] = [];

  //     for (const tagName of Object.keys(tags)) {
  //       const tag = await tx.tag.upsert({
  //         where: {
  //           name: tagName,
  //         },
  //         update: {},
  //         create: {
  //           name: tagName,
  //         },
  //       });

  //       tagIds.push(tag.id);
  //     }

  //     await tx.gameTag.deleteMany({
  //       where: {
  //         gameId: appId,
  //       },
  //     });

  //     await tx.gameTag.createMany({
  //       data: tagIds.map((tagId) => ({
  //         gameId: appId,
  //         tagId,
  //       })),
  //     });

  //     await tx.game.update({
  //       where: {
  //         steamAppId: appId,
  //       },
  //       data: {
  //         lastTagsUpdate: new Date(),
  //       },
  //     });
  //   });
  // }

  // async getAppsByTags(tags: string[]) {
  //   return this.prismaService.$queryRaw<
  //     {
  //       appId: number;
  //       steamAppId: number | null;
  //       name: string | null;
  //       tags: Record<string, number> | null;
  //     }[]
  //   >`
  //   SELECT "appId", "steamAppId", "name", "tags"
  //   FROM "Game"
  //   WHERE tags ?| ${tags};
  // `;
  // }

  // isCacheValid(lastUpdate: Date | null, expirationHours = 24 * 30): boolean {
  //   if (!lastUpdate) return false;

  //   const expirationTime = expirationHours * 60 * 60 * 1000;

  //   return Date.now() - lastUpdate.getTime() < expirationTime;
  // }
}
