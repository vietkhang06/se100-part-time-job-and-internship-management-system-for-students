import { Body, Controller, Get, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { UserRole } from '@campusjob/contracts';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { M04Workflow } from '../application/m04-workflow';
import {
  DecideRescheduleDto, InviteInterviewDto, RecordInterviewResultDto,
  RejectApplicationDto, RequestRescheduleDto, SubmitApplicationDto,
} from './m04.dto';
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

  @Get('employer/jobs/:jobId/applications')
  @Roles(UserRole.EMPLOYER)
  candidates(@CurrentUser('id') employerId: string, @Param('jobId') jobId: string) {
    return this.workflow.listCandidates(employerId, jobId);
  }

  @Get('employer/applications/:id')
  @Roles(UserRole.EMPLOYER)
  candidate(@CurrentUser('id') employerId: string, @Param('id') id: string) {
    return this.workflow.getCandidate(employerId, id);
  }

  @Patch('employer/applications/:id/viewed')
  @Roles(UserRole.EMPLOYER)
  markViewed(@CurrentUser('id') employerId: string, @Param('id') id: string) {
    return this.workflow.markViewed(employerId, id);
  }

  @Patch('employer/applications/:id/reject')
  @Roles(UserRole.EMPLOYER)
  reject(@CurrentUser('id') employerId: string, @Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.workflow.reject(employerId, id, dto.reason);
  }

  @Post('employer/applications/:id/interviews')
  @Roles(UserRole.EMPLOYER)
  invite(@CurrentUser('id') employerId: string, @Param('id') id: string, @Body() dto: InviteInterviewDto) {
    return this.workflow.invite(employerId, id, { ...dto, scheduledAt: new Date(dto.scheduledAt) });
  }

  @Get('interviews/me')
  @Roles(UserRole.STUDENT)
  myInterviews(@CurrentUser('id') studentId: string) { return this.workflow.listMyInterviews(studentId); }

  @Post('interviews/:id/confirm')
  @Roles(UserRole.STUDENT)
  confirm(@CurrentUser('id') studentId: string, @Param('id') id: string) {
    return this.workflow.confirmInterview(studentId, id);
  }

  @Post('interviews/:id/change-request')
  @Roles(UserRole.STUDENT)
  requestChange(@CurrentUser('id') studentId: string, @Param('id') id: string, @Body() dto: RequestRescheduleDto) {
    return this.workflow.requestReschedule(studentId, id, new Date(dto.proposedAt), dto.message);
  }

  @Patch('employer/interviews/:id/change-request')
  @Roles(UserRole.EMPLOYER)
  decideChange(@CurrentUser('id') employerId: string, @Param('id') id: string, @Body() dto: DecideRescheduleDto) {
    return this.workflow.decideReschedule(employerId, id, dto.decision);
  }

  @Patch('employer/interviews/:id/result')
  @Roles(UserRole.EMPLOYER)
  result(@CurrentUser('id') employerId: string, @Param('id') id: string, @Body() dto: RecordInterviewResultDto) {
    return this.workflow.recordResult(employerId, id, dto.result, dto.reason);
  }
}
