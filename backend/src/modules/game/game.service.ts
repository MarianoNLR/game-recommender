/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client/scripts/default-index.js';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly prismaService: PrismaService) {}

  async findByAppId(appId: number) {
    return this.prismaService.game.findUnique({
      where: { appId },
    });
  }

  async upsert(appId: number, data: any) {
    return this.prismaService.game.upsert({
      where: { appId },
      update: data,
      create: {
        appId,
        ...data,
      },
    });
  }

  async getAppsByTags(tags: string[]) {
    return this.prismaService.$queryRaw<
      {
        appId: number;
        steamAppId: number | null;
        name: string | null;
        tags: Record<string, number> | null;
      }[]
    >`
    SELECT "appId", "steamAppId", "name", "tags"
    FROM "Game"
    WHERE tags ?| ${tags};
  `;
  }

  isCacheValid(game, expirationHours = 24 * 30): boolean {
    if (!game) return false;

    const expirationTime = expirationHours * 60 * 60 * 1000;

    return Date.now() - game.fetchedAt.getTime() < expirationTime;
  }
}
