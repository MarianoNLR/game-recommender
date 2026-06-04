import { Injectable } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}
  create(createGroupDto: CreateGroupDto, ip: string): any {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.prisma.group.create({
      data: {
        name: createGroupDto.name,
        budget: createGroupDto.budget,
        accessCode: randomUUID(),
        createdFromIp: ip,
        expiresAt,
        members: {
          create: {
            steamId: createGroupDto.creatorSteamId,
          },
        },
      },
      include: { members: true },
    });
  }

  findAll(): any[] {
    return [];
  }

  findOne(id: number): any {
    return null;
  }
}
