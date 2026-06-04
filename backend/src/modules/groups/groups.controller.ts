import { Controller, Get, Post, Body, Param, Ip } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@Body() createGroupDto: CreateGroupDto, @Ip() ip: string): any {
    return this.groupsService.create(createGroupDto, ip);
  }

  @Get()
  findAll(): any[] {
    return this.groupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): any {
    return this.groupsService.findOne(+id);
  }
}
