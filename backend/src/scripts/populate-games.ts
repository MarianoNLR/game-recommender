/* eslint-disable @typescript-eslint/no-unsafe-return */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';

import axios from 'axios';
import * as cheerio from 'cheerio';
import { SteamUserClient } from 'src/modules/steam/steam-user.client';

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

const STEAM_URL = 'https://store.steampowered.com/search/results/';

const COUNTRY = 'US';

const REQUEST_DELAY = 1500;
const START_PAGE = 4994;

const PICS_BATCH_SIZE = 50;
const PICS_DELAY = 1000;

let gamesLoadingFinished = false;

type GameData = {
  steamAppId: number;
  name: string;
  price: number | null;
  discount: number;
  isFree: boolean;
  releaseDate: Date | null;
};

const http = axios.create({
  timeout: 30_000,

  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',

    'Accept-Language': 'en-US,en;q=0.9',
  },
});

/**
 * Parse a results page of steam
 */
type ParsedPage = {
  games: GameData[];
  totalResults: number;
};

function parsePage(html: string): ParsedPage {
  const $ = cheerio.load(html);

  const rows = $('.search_result_row');

  const games: GameData[] = [];

  rows.each((_, element) => {
    const row = $(element);

    const appIdRaw = row.attr('data-ds-appid');

    if (!appIdRaw) {
      return;
    }

    const steamAppId = Number(appIdRaw.split(',')[0]);

    if (!Number.isInteger(steamAppId)) {
      return;
    }

    const name = row.find('.title').text().trim();

    if (!name) {
      return;
    }

    const releaseStatus = row
      .find('.search_released')
      .text()
      .trim()
      .toLowerCase();

    // No guardar juegos que todavía no fueron lanzados.
    if (
      releaseStatus === 'coming soon' ||
      releaseStatus === 'to be announced'
    ) {
      return;
    }

    const releaseDate = parseReleaseDate(releaseStatus);

    const priceElement = row.find('[data-price-final]').first();

    const priceRaw = priceElement.attr('data-price-final');

    const price = priceRaw !== undefined ? Number(priceRaw) : null;

    const discountBlock = row.find('.discount_block').first();

    const discountRaw = discountBlock.attr('data-discount');

    const discount = discountRaw !== undefined ? Number(discountRaw) : 0;

    const isFree = row.find('.discount_final_price.free').length > 0;

    games.push({
      steamAppId,
      name,
      price: Number.isFinite(price ?? NaN) ? price : null,
      discount: Number.isFinite(discount) ? discount : 0,
      isFree,
      releaseDate,
    });
  });

  return {
    games,
    totalResults: rows.length,
  };
}

/**
 * Get a page
 */
async function getPage(page: number): Promise<string> {
  const response = await http.get(STEAM_URL, {
    params: {
      sort_by: 'Name',
      sort_order: 'ASC',
      category1: 998,
      cc: COUNTRY,
      page,
    },
  });

  return response.data;
}

async function loadAllGames(prisma: PrismaService) {
  let page = START_PAGE;
  let total = 0;

  while (true) {
    console.log(`\n==============================`);
    console.log(`Procesando página ${page}`);
    console.log(`==============================`);

    try {
      const html = await getPage(page);

      const { games, totalResults } = parsePage(html);

      console.log(`Resultados encontrados: ${totalResults}`);

      console.log(`Juegos válidos: ${games.length}`);

      // Steam ya no devuelve resultados.
      if (totalResults === 0) {
        console.log('No hay más resultados.');

        break;
      }

      for (const game of games) {
        await saveGame(prisma, game);
      }

      total += games.length;

      console.log(`Total guardado: ${total}`);

      page++;

      // Wait a little between request for rate limit
      await sleep(REQUEST_DELAY);
    } catch (error) {
      // Rate limit
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 429) {
          console.log(`Rate limit en página ${page}. Esperando 60 segundos...`);

          await sleep(60_000);
          continue;
        }

        if (status === 502 || status === 503 || status === 504) {
          console.log(
            `Steam respondió ${status} en página ${page}. Esperando 10 segundos...`,
          );

          await sleep(10_000);
          continue;
        }
      }

      console.error(`Error procesando página ${page}:`, error);

      break;
    }
  }
  gamesLoadingFinished = true;

  console.log(`\nCarga terminada. Total procesado: ${total}`);
}

async function loadAllTags(prisma: PrismaService, steamUser: SteamUserClient) {
  let totalProcessed = 0;

  while (true) {
    const games = await prisma.game.findMany({
      where: {
        lastPicsUpdate: null,
      },
      select: {
        steamAppId: true,
      },
      take: PICS_BATCH_SIZE,
      orderBy: {
        steamAppId: 'asc',
      },
    });

    // No more games
    if (games.length === 0) {
      if (gamesLoadingFinished) {
        console.log('\nNo quedan juegos pendientes de tags.');

        break;
      }

      // loadAllGames is loading new games
      console.log('No hay juegos pendientes. Esperando nuevos juegos...');

      await sleep(5000);

      continue;
    }

    const appIds = games.map((game) => game.steamAppId);

    console.log(`\nPICS: procesando ${appIds.length} juegos`);

    try {
      const { packages } = await steamUser.getProductInfo(appIds);
      for (const game of games) {
        const app = packages?.[game.steamAppId];

        if (!app) {
          console.log(`PICS: sin información para ${game.steamAppId}`);

          await prisma.game.update({
            where: {
              steamAppId: game.steamAppId,
            },
            data: {
              lastPicsUpdate: new Date(),
            },
          });

          continue;
        }

        const common = app.appinfo?.common;

        if (!common) {
          console.log(`PICS: sin common para ${game.steamAppId}`);

          await prisma.game.update({
            where: {
              steamAppId: game.steamAppId,
            },
            data: {
              lastPicsUpdate: new Date(),
            },
          });

          continue;
        }

        const tags = common.store_tags;
        const categories: Record<string, string> = common.category ?? {};

        const isMultiplayer = isMultiplayerGame(categories);

        /*
         * Tags
         */
        if (tags) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument
          for (const [tagIndex, tagId] of Object.entries(tags)) {
            const id = Number(tagId);

            if (!Number.isInteger(id)) {
              continue;
            }

            await prisma.gameTag.upsert({
              where: {
                gameId_tagId: {
                  gameId: game.steamAppId,
                  tagId: id,
                },
              },
              create: {
                gameId: game.steamAppId,
                tagId: id,
              },
              update: {},
            });
          }
        }

        /*
         * Release date
         */
        const releaseDate = common.steam_release_date
          ? new Date(Number(common.steam_release_date) * 1000)
          : undefined;

        /*
         * Reviews
         */
        const reviewPercentage =
          common.review_percentage !== undefined
            ? Number(common.review_percentage)
            : undefined;

        /*
         * Update Game with info from PICS
         */
        await prisma.game.update({
          where: {
            steamAppId: game.steamAppId,
          },
          data: {
            ...(releaseDate && {
              releaseDate,
            }),

            ...(reviewPercentage !== undefined &&
              !Number.isNaN(reviewPercentage) && {
                reviewPercentage,
              }),
            isMultiplayer,
            lastPicsUpdate: new Date(),
          },
        });

        totalProcessed++;
      }

      await sleep(PICS_DELAY);
    } catch (error) {
      console.error('Error procesando batch de PICS:', error);

      // Wait before retry
      await sleep(5000);
    }
  }

  console.log(`\nCarga de tags terminada. Total procesado: ${totalProcessed}`);
}

function isMultiplayerGame(categories: Record<string, string>): boolean {
  return Object.entries(categories).some(([key, value]) => {
    if (value !== '1') return false;

    const categoryId = Number(key.replace('category_', ''));

    return (
      Number.isInteger(categoryId) && MULTIPLAYER_CATEGORY_IDS.has(categoryId)
    );
  });
}

/**
 * Save game in db
 */
async function saveGame(prisma: PrismaService, game: GameData) {
  const now = new Date();

  await prisma.game.upsert({
    where: {
      steamAppId: game.steamAppId,
    },

    create: {
      steamAppId: game.steamAppId,
      name: game.name,
      price: game.price,
      discount: game.discount,
      isFree: game.isFree,
      lastPriceUpdate: now,
      lastInfoUpdate: now,
      releaseDate: game.releaseDate,
    },

    update: {
      name: game.name,
      price: game.price,
      discount: game.discount,
      isFree: game.isFree,
      lastInfoUpdate: now,
      releaseDate: game.releaseDate,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseReleaseDate(text: string): Date | null {
  const value = text.trim();

  if (!value) {
    return null;
  }

  // Not available yet
  if (
    value.toLowerCase() === 'coming soon' ||
    value.toLowerCase() == 'to be announced'
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function main() {
  /**
   * Start Nest context without HTTP Server
   */
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const steamUser = new SteamUserClient();
  try {
    await steamUser.login();
    await Promise.all([
      // loadAllGames(prisma),
      loadAllTags(prisma, steamUser),
    ]);
  } finally {
    /**
     * Close App
     */
    steamUser.logOff();
    await app.close();
  }
}

main().catch((error) => {
  console.error('Error fatal:', error);

  process.exit(1);
});
