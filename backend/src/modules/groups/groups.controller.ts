import { Controller, Get, Post, Body, Param, Ip } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';

@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Ip() ip: string,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(createGroupDto, ip);
  }

  @Get()
  findAll(): Promise<GroupResponseDto[]> {
    return this.groupsService.findAll();
  }

  @Get(':accessCode')
  findOne(@Param('accessCode') accessCode: string): Promise<GroupResponseDto> {
    return this.groupsService.findOne(accessCode);
  }
}
