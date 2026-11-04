import { Module } from '@nestjs/common';
import { SteamService } from './steam.service';
import { SteamController } from './steam.controller';
import { HttpModule } from '@nestjs/axios';
import { SteamApiClient } from './steam-api.client';
import { PrismaModule } from 'src/prisma.module';
import { GameModule } from '../game/game.module';
import { SteamStoreClient } from './steam-store.client';
import { SteamUserClient } from './steam-user.client';
import { SteamProfileService } from './steam-profile.service';

@Module({
  controllers: [SteamController],
  providers: [
    SteamService,
    SteamProfileService,
    SteamApiClient,
    SteamStoreClient,
    SteamUserClient,
  ],
  imports: [HttpModule, PrismaModule, GameModule],
  exports: [
    SteamService,
    SteamProfileService,
    SteamApiClient,
    SteamStoreClient,
    SteamUserClient,
  ], // Exporting the service to be used in other modules if needed
})
export class SteamModule {}
