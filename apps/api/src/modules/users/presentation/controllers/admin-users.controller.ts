import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthContext, UserRole } from '@campusjob/contracts';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { ChangeModeratorRoleDto, ChangeUserStatusDto, ListAdminUsersQueryDto } from '../../application/dto/admin-users.dto';
import { AdminUsersService } from '../../application/use-cases/admin-users.service';

@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsers.detail(id);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeUserStatusDto,
  ) {
    return this.adminUsers.changeStatus(actor.id, id, body.status);
  }

  @Patch(':id/moderator')
  changeModeratorRole(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeModeratorRoleDto,
  ) {
    return this.adminUsers.changeModeratorRole(actor.id, id, body.enabled);
  }
}
