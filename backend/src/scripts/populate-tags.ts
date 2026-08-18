import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

interface SteamTag {
  tagid: number;
  name: string;
}

interface SteamTagResponse {
  response: {
    tags: SteamTag[];
  };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);
  const httpService = app.get(HttpService);

  const url =
    'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english';

  console.log('Obteniendo tags de Steam...');

  const response: AxiosResponse<SteamTagResponse> = await firstValueFrom(
    httpService.get<SteamTagResponse>(url),
  );
  const tags = response.data.response.tags;

  console.log(`Tags obtenidos: ${tags.length}`);

  const result = await prisma.tag.createMany({
    data: tags.map((tag) => ({
      steamTagId: tag.tagid,
      name: tag.name,
    })),
    skipDuplicates: true,
  });

  console.log(`Tags insertados: ${result.count}`);

  await app.close();
}

bootstrap();
