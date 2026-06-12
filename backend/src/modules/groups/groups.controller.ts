import { Controller, Get, Post, Body, Param, Ip } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@Body() createGroupDto: CreateGroupDto, @Ip() ip: string) {
    return this.groupsService.create(createGroupDto, ip);
  }

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':accessCode')
  findOne(@Param('accessCode') accessCode: string) {
    return this.groupsService.findOne(accessCode);
  }
}
