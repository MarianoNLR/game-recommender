import { Module } from '@nestjs/common';
import { SteamService } from './steam.service';
import { SteamController } from './steam.controller';
import { HttpModule } from '@nestjs/axios';
import { SteamApiClient } from './steam-api.client';
import { PrismaModule } from 'src/prisma.module';
import { GameModule } from '../game/game.module';

@Module({
  controllers: [SteamController],
  providers: [SteamService, SteamApiClient],
  imports: [HttpModule, PrismaModule, GameModule],
  exports: [SteamService], // Exporting the service to be used in other modules if needed
})
export class SteamModule {}
