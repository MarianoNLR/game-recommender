import { Controller, Get } from '@nestjs/common';
import { GameService } from './game.service';
import { SteamStoreClient } from '../steam/steam-store.client';

@Controller('games')
export class GameController {
  constructor(private gameService: GameService) {}
  @Get()
  getGame() {
    return {
      steamAppId: 730,
      name: 'Counter-Strike 2',
    };
  }
}
