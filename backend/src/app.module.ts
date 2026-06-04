import { Module } from '@nestjs/common';
import { GroupsModule } from './modules/groups/groups.module';
import { SteamModule } from './modules/steam/steam.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the configuration available globally across the application
    }),
    GroupsModule,
    SteamModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
