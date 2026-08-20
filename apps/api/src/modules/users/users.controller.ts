import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UsersService, type UploadedImage } from './users.service';
import { AssignManagerDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/** Avatar upload cap — mirrors UsersService.AVATAR_MAX_BYTES (5 MB). */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('users:create')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:read')
  @Get()
  findAll(
    @Query('role') role?: UserRole,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('q') q?: string,
  ) {
    return this.users.findAll(role, Number(page), Number(pageSize), q);
  }

  // Self-profile routes — no role gate, no permission gate. Any authenticated
  // user reads/updates their own profile.
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.findOne(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.users.update(user.sub, dto);
  }

  // Multipart avatar upload for the signed-in user. The image is buffered in
  // memory (FileInterceptor default), validated + streamed to object storage
  // by the service, and the new avatarUrl is persisted on the user.
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES } }))
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedImage) {
    return this.users.updateAvatar(user.sub, file);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:update')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  // ADMIN-only team assignment. SALES_MANAGER cannot assign their own team yet.
  @Roles(UserRole.ADMIN)
  @Permissions('users:update')
  @Patch(':id/manager')
  assignManager(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignManagerDto) {
    return this.users.assignManager(id, dto.managerId ?? null);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:deactivate')
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.deactivate(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:activate')
  @Patch(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.activate(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:delete')
  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.softDelete(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('users:restore')
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.restore(id);
  }
}
