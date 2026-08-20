// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Controller, Get, Post, Body, Param, Ip } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private recommendationService: RecommendationService) {}

  // @Get(':accessCode/profile')
  // async getGroupProfile(@Param('accessCode') accessCode: string) {
  //   return this.recommendationService.getGroupProfile(accessCode);
  // }

  // // @Get(':accessCode/preferences')
  // // async getGroupPreferences(@Param('accessCode') accessCode: string) {
  // //   return this.recommendationService.getGroupPreferences(accessCode);
  // // }

  @Get(':accessCode')
  async getGroupRecommendations(@Param('accessCode') accessCode: string) {
    return this.recommendationService.getGroupRecommendations(accessCode);
  }
}
