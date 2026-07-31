import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma.module';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule], // Import PrismaModule to use PrismaService in GroupsService
  controllers: [],
  providers: [GameService],
  exports: [GameService], // Exporting the service to be used in other modules if needed
})
export class GameModule {}
