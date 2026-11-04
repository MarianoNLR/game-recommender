// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Controller, Get, Post, Body, Param, Ip } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private recommendationService: RecommendationService) {}

  // Perfil del grupo: juegos que se tuvieron en cuenta por miembro. Es rápido
  // (usa la caché de perfiles), así que se puede mostrar antes que las recomendaciones.
  @Get(':accessCode/profile')
  async getGroupProfile(@Param('accessCode') accessCode: string) {
    return this.recommendationService.getGroupProfileSummary(accessCode);
  }

  // // @Get(':accessCode/preferences')
  // // async getGroupPreferences(@Param('accessCode') accessCode: string) {
  // //   return this.recommendationService.getGroupPreferences(accessCode);
  // // }

  @Get(':accessCode')
  async getGroupRecommendations(@Param('accessCode') accessCode: string) {
    return this.recommendationService.getGroupRecommendations(accessCode);
  }
}
