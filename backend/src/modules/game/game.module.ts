import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma.module';
import { GameService } from './game.service';
import { GameController } from './game.controller';

@Module({
  imports: [PrismaModule], // Import PrismaModule to use PrismaService in GroupsService
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService], // Exporting the service to be used in other modules if needed
})
export class GameModule {}
