import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createGroupDto: CreateGroupDto, ip: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return await this.prisma.group.create({
      data: {
        name: createGroupDto.name,
        budget: createGroupDto.budget,
        accessCode: randomUUID(),
        createdFromIp: ip,
        expiresAt,
        members: {
          create: createGroupDto.memberSteamIds.map((steamId) => ({ steamId })),
        },
      },
      include: { members: true },
    });
  }

  async findAll() {
    const groups = await this.prisma.group.findMany({
      include: { members: true },
    });
    return groups;
  }

  async findOne(accessCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { accessCode },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException(
        `Group with access code ${accessCode} not found`,
      );
    }

    if (group.expiresAt < new Date()) {
      throw new BadRequestException(
        `Group with access code ${accessCode} has expired`,
      );
    }
    return group;
  }
}
