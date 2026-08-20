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

        lastPriceUpdate: now,
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
          lastTagsUpdate: new Date(),
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
      game.lastPriceUpdate !== null &&
      Date.now() - game.lastPriceUpdate.getTime() < this.PRICE_CACHE_MS
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
      game.lastTagsUpdate !== null &&
      Date.now() - game.lastTagsUpdate.getTime() < this.TAGS_CACHE_MS
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
        tags: {
          select: {
            tag: {
              select: {
                name: true,
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
    const candidateRows = await this.prismaService.$queryRaw<
      Array<{
        steamAppId: number;
        matchedTags: bigint;
      }>
    >(Prisma.sql`
  SELECT
      g."steamAppId",
      COUNT(DISTINCT t."steamTagId") AS "matchedTags"
    FROM "Game" g
    JOIN "GameTag" gt
      ON gt."gameId" = g."steamAppId"
    JOIN "Tag" t
      ON t."steamTagId" = gt."tagId"
    WHERE t."name" IN (${Prisma.join(tagNames)})
      AND g."reviewPercentage" >= 55
      AND g."price" <= ${budget}
      AND g."isMultiplayer" = true
      AND NOT EXISTS (
        SELECT 1
        FROM "GameTag" vrgt
        JOIN "Tag" vrt
          ON vrt."steamTagId" = vrgt."tagId"
        WHERE vrgt."gameId" = g."steamAppId"
          AND vrt."name" = 'VR'
      )
    GROUP BY g."steamAppId"
    HAVING COUNT(DISTINCT t."steamTagId") >= 3
    ORDER BY "matchedTags" DESC
    LIMIT 300
  `);

    if (candidateRows.length === 0) {
      return [];
    }

    const appIds = candidateRows.map((row) => row.steamAppId);

    return this.prismaService.game.findMany({
      where: {
        steamAppId: {
          in: appIds,
        },
      },
      select: {
        steamAppId: true,
        name: true,
        releaseDate: true,
        reviewPercentage: true,

        isFree: true,
        price: true,
        initialPrice: true,
        discount: true,

        tags: {
          select: {
            tag: {
              select: {
                steamTagId: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getNormalizedTagIdf(): Promise<Record<string, number>> {
    const totalGames = await this.prismaService.game.count();

    const rows = await this.prismaService.$queryRaw<
      Array<{
        name: string;
        gameCount: bigint;
      }>
    >(Prisma.sql`
    SELECT
      t."name",
      COUNT(DISTINCT gt."gameId") AS "gameCount"
    FROM "Tag" t
    JOIN "GameTag" gt
      ON gt."tagId" = t."steamTagId"
    GROUP BY t."steamTagId", t."name"
  `);

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
