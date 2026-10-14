import { Body, Controller, Get, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { UserRole } from '@campusjob/contracts';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { M04Workflow } from '../application/m04-workflow';
import { SubmitApplicationDto } from './m04.dto';
import { M04ExceptionFilter } from './m04-exception.filter';

/** Registered only after real M02/M03 adapters are supplied to M04Module. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(M04ExceptionFilter)
export class M04Controller {
  constructor(private readonly workflow: M04Workflow) {}

  @Post('jobs/:jobId/apply')
  @Roles(UserRole.STUDENT)
  submit(@CurrentUser('id') studentId: string, @Param('jobId') jobId: string, @Body() dto: SubmitApplicationDto) {
    return this.workflow.submit(studentId, jobId, dto.cvId, dto.coverLetter);
  }

  @Get('applications/me')
  @Roles(UserRole.STUDENT)
  mine(@CurrentUser('id') studentId: string) { return this.workflow.listMine(studentId); }

  @Get('applications/me/:id')
  @Roles(UserRole.STUDENT)
  detail(@CurrentUser('id') studentId: string, @Param('id') id: string) { return this.workflow.getMine(studentId, id); }

  @Patch('applications/me/:id/withdraw')
  @Roles(UserRole.STUDENT)
  withdraw(@CurrentUser('id') studentId: string, @Param('id') id: string) { return this.workflow.withdraw(studentId, id); }

}
