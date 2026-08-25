import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { SteamApiClient } from '../modules/steam/steam-api.client';
import axios from 'axios';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const steamApiClient = app.get(SteamApiClient);
  const prisma = app.get(PrismaService);

  try {
    await loadAppList(steamApiClient, prisma);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error HTTP during inital load:');
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

async function loadAppList(
  steamApiClient: SteamApiClient,
  prisma: PrismaService,
) {
  let lastAppId: number | undefined;
  let totalProcessed = 0;

  try {
    while (true) {
      console.log(
        `Obtaining apps from steam... lastAppId=${lastAppId ?? 'start'}`,
      );

      const response = await steamApiClient.getAppList(lastAppId);

      const apps = response.apps ?? [];

      if (apps.length === 0) {
        console.log('Steam has not sent more apps.');
        break;
      }

      const games = apps
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .filter((app) => app.appid && app.name?.trim())
        .map((app) => ({
          steamAppId: app.appid,
          name: app.name.trim(),
          lastInfoUpdate: app.last_modified
            ? new Date(app.last_modified * 1000)
            : null,
        }));

      const result = await prisma.game.createMany({
        data: games,
        skipDuplicates: true,
      });

      totalProcessed += apps.length;

      console.log(
        `Received: ${apps.length} | ` +
          `Valid: ${games.length} | ` +
          `Inserted: ${result.count} | ` +
          `Processed: ${totalProcessed}`,
      );

      if (!response.have_more_results) {
        break;
      }

      lastAppId = response.last_appid;
    }

    console.log('Applist load finished.');
    console.log(`Total processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error loading AppList:', error);
    throw error;
  }
}
