import { NestFactory } from '@nestjs/core';
import axios from 'axios';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const prisma = app.get(PrismaService);

  try {
    const url =
      'https://api.steampowered.com/IStoreBrowseService/GetStoreCategories/v1/';

    const { data } = await axios.get(url, {
      params: {
        key: process.env.STEAM_API_KEY,
        language: 'english',
      },
    });

    const categories = data?.response?.categories ?? [];

    console.log(`Categories received: ${categories.length}`);

    for (const category of categories) {
      await prisma.category.upsert({
        where: {
          steamCategoryId: category.categoryid,
        },
        update: {
          internalName: category.internal_name,
          displayName: category.display_name,
        },
        create: {
          steamCategoryId: category.categoryid,
          internalName: category.internal_name,
          displayName: category.display_name,
        },
      });
    }

    console.log(`Categories imported: ${categories.length}`);
  } catch (error) {
    console.error('Error importing categories:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
