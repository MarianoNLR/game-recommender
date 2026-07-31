/* eslint-disable @typescript-eslint/require-await */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  isCacheValid(game, expirationHours = 24): boolean {
    if (!game) return false;

    const expirationTime = expirationHours * 60 * 60 * 1000;

    return Date.now() - game.fetchedAt.getTime() < expirationTime;
  }
}
