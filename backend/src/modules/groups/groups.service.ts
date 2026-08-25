import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { GroupResponseDto } from './dto/group-response.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    createGroupDto: CreateGroupDto,
    ip: string,
  ): Promise<GroupResponseDto> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const group = await this.prisma.group.create({
      data: {
        name: createGroupDto.name,
        budget:
          createGroupDto.budget != null
            ? Math.round(createGroupDto.budget * 100)
            : null,
        accessCode: randomUUID(),
        createdFromIp: ip,
        expiresAt,
        memberSteamIds: createGroupDto.memberSteamIds,
        // members: {
        //   create: createGroupDto.memberSteamIds.map((steamId) => ({ steamId })),
        // },
      },
      // include: { members: true },
    });
    return plainToInstance(GroupResponseDto, group, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(): Promise<GroupResponseDto[]> {
    const groups = await this.prisma.group.findMany({
      // include: { members: true },
    });
    return plainToInstance(GroupResponseDto, groups, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(accessCode: string): Promise<GroupResponseDto> {
    const group = await this.prisma.group.findUnique({
      where: { accessCode },
      // include: { members: true },
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
    return plainToInstance(GroupResponseDto, group, {
      excludeExtraneousValues: true,
    });
  }
}
