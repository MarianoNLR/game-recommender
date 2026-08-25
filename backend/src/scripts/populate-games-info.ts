import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { SteamApiClient } from '../modules/steam/steam-api.client';
import axios from 'axios';

const MULTIPLAYER_CATEGORY_IDS = new Set<number>([
  // IDs correspondientes a:
  // Multi-player
  1,
  // MMO
  20,
  // PvP
  49,
  // Online PvP
  36,
  // LAN PvPF
  47,
  // Shared/Split Screen PvP
  37,
  // Co-op
  9,
  // Online Co-op
  38,
  // LAN Co-op
  48,
  // Shared/Split Screen Co-op
  39,
  // Shared/Split Screen
  24,
  // Cross-Platform Multiplayer
  27,
]);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const steamApiClient = app.get(SteamApiClient);
  const prisma = app.get(PrismaService);

  try {
    await loadItems(steamApiClient, prisma);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error HTTP during initial load:');
      console.error('Status:', error.response?.status);
      console.error('Status text:', error.response?.statusText);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
    } else {
      console.error('Error during inital load:', error);
    }
  } finally {
    await app.close();
  }
}

void main();

const ITEMS_BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES_MS = 1500;

async function loadItems(
  steamApiClient: SteamApiClient,
  prisma: PrismaService,
) {
  let lastAppId: number | undefined;

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalComingSoon = 0;
  let totalDiscarded = 0;

  const tags = await prisma.tag.findMany({
    where: {
      steamTagId: {
        not: null,
      },
    },
    select: {
      steamTagId: true,
    },
  });

  const validTagIds = new Set(
    tags.map((tag) => tag.steamTagId).filter((id): id is number => id !== null),
  );

  while (true) {
    const games = await prisma.game.findMany({
      where: lastAppId
        ? {
            steamAppId: {
              gt: lastAppId,
            },
          }
        : undefined,
      orderBy: {
        steamAppId: 'asc',
      },
      take: ITEMS_BATCH_SIZE,
      select: {
        steamAppId: true,
      },
    });

    if (games.length === 0) {
      break;
    }

    const appIds = games.map((game) => game.steamAppId);
    const requestedAppIds = new Set(appIds);

    console.log(`GetItems: ${appIds[0]} → ${appIds[appIds.length - 1]}`);

    const response = await steamApiClient.getItems(appIds);

    const items = response.store_items ?? [];

    console.log(`Requested: ${appIds.length} | Received: ${items.length}`);

    for (const item of items) {
      /*
       * VALIDATION
       */

      if (!item.appid) {
        console.warn('Steam devolvió un item sin appid');
        totalFailed++;
        continue;
      }

      if (!requestedAppIds.has(item.appid)) {
        console.warn(
          `Steam has sent unexpected app: ${item.appid} - ${item.name}`,
        );

        totalFailed++;
        continue;
      }

      /*
       * DISCARD INVALID / UNRELEASED GAMES
       */

      if (item.success !== 1 || item.is_coming_soon === true) {
        if (item.is_coming_soon === true) {
          totalComingSoon++;
        } else {
          totalFailed++;
        }

        await prisma.$transaction([
          prisma.gameTag.deleteMany({
            where: {
              gameId: item.appid,
            },
          }),

          prisma.game.deleteMany({
            where: {
              steamAppId: item.appid,
            },
          }),
        ]);

        totalDiscarded++;

        console.warn(
          `Dismiss appid=${item.appid} | ` +
            `success=${item.success} | ` +
            `comingSoon=${item.is_coming_soon === true}`,
        );

        continue;
      }

      /*
       * PRICE
       */

      const isFree = item.is_free === true;
      const purchaseOption = item.best_purchase_option;

      let price: number | null = null;
      let initialPrice: number | null = null;
      let discount = 0;

      if (isFree) {
        price = 0;
        initialPrice = 0;
      } else if (purchaseOption) {
        price =
          purchaseOption.final_price_in_cents != null
            ? Number(purchaseOption.final_price_in_cents)
            : null;

        initialPrice =
          purchaseOption.original_price_in_cents != null
            ? Number(purchaseOption.original_price_in_cents)
            : price;

        discount = purchaseOption.discount_pct ?? 0;
      }

      /*
       * REVIEWS
       */

      const reviews = item.reviews?.summary_filtered;

      /*
       * RELEASE DATE
       */

      const releaseDate = item.release?.steam_release_date
        ? new Date(item.release.steam_release_date * 1000)
        : null;

      /*
       * IMAGE
       */

      const imageUrl = buildSteamAssetUrl(
        item.assets?.asset_url_format,
        item.assets?.header,
      );

      /*
       * MULTIPLAYER
       */

      const supportedPlayerCategories =
        item.categories?.supported_player_categoryids ?? [];

      const isMultiplayer = supportedPlayerCategories.some((categoryId) =>
        MULTIPLAYER_CATEGORY_IDS.has(categoryId),
      );

      /*
       * TAGS
       */

      const itemTags = item.tags ?? [];

      const gameTags = itemTags
        .filter((itemTag) => {
          if (!validTagIds.has(itemTag.tagid)) {
            console.warn(
              `Unkonwn tag steamTagId=${itemTag.tagid} | appid=${item.appid}`,
            );

            return false;
          }

          return true;
        })
        .map((itemTag) => ({
          gameId: item.appid,
          tagId: itemTag.tagid,
          weight: itemTag.weight ?? 0,
        }));

      /*
       * UPDATE GAME
       */

      const result = await prisma.game.updateMany({
        where: {
          steamAppId: item.appid,
        },
        data: {
          name: item.name,
          description: item.basic_info?.short_description ?? null,

          releaseDate,

          reviewCount: reviews?.review_count ?? null,

          reviewPercentage: reviews?.percent_positive ?? null,

          isFree,
          price,
          initialPrice,
          discount,

          imageUrl,

          isMultiplayer,
        },
      });

      if (result.count === 0) {
        console.warn(`Game not found for appid=${item.appid} - ${item.name}`);

        totalFailed++;
        continue;
      }

      /*
       * REPLACE TAGS
       */

      await prisma.$transaction([
        prisma.gameTag.deleteMany({
          where: {
            gameId: item.appid,
          },
        }),

        prisma.gameTag.createMany({
          data: gameTags,
        }),
      ]);

      totalUpdated++;
    }

    /*
     * BATCH COMPLETED
     */

    totalProcessed += games.length;

    lastAppId = games[games.length - 1].steamAppId;

    console.log(
      `Processed: ${totalProcessed} | ` +
        `Updated: ${totalUpdated} | ` +
        `Rejected: ${totalDiscarded} | ` +
        `Coming soon: ${totalComingSoon} | ` +
        `Failed: ${totalFailed} | ` +
        `Last appId: ${lastAppId}`,
    );

    if (games.length === ITEMS_BATCH_SIZE) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS),
      );
    }
  }

  console.log('');
  console.log('GetItems load finished.');
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Rejected/Dismissed: ${totalDiscarded}`);
  console.log(`Coming soon: ${totalComingSoon}`);
  console.log(`Failed: ${totalFailed}`);
}

function buildSteamAssetUrl(
  assetUrlFormat?: string,
  filename?: string,
): string | null {
  if (!assetUrlFormat || !filename) {
    return null;
  }

  const path = assetUrlFormat.replace('${FILENAME}', filename);

  return `https://shared.cloudflare.steamstatic.com/store_item_assets/${path}`;
}
