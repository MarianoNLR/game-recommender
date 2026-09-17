import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaModule } from 'src/prisma.module';
import { SteamModule } from '../steam/steam.module';

@Module({
  imports: [PrismaModule, SteamModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService], // Exporting the service to be used in other modules if needed
})
export class GroupsModule {}
