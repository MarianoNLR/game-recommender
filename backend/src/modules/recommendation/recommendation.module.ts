import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { SteamModule } from '../steam/steam.module';
import { GroupsModule } from '../groups/groups.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [SteamModule, GroupsModule, GameModule], // Importing SteamModule and GroupsModule to use their services in RecommendationService
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService], // Exporting the service to be used in other modules if needed
})
export class RecommendationModule {}
