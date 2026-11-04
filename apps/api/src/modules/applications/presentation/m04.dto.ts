import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/;

export class SubmitApplicationDto {
  @IsString() @IsNotEmpty() cvId!: string;
  @IsOptional() @IsString() coverLetter?: string;
}

export class RejectApplicationDto {
  @IsString() @IsNotEmpty() reason!: string;
}

export class InviteInterviewDto {
  @IsDateString() @Matches(TIMEZONE_SUFFIX, { message: 'scheduledAt must include a timezone offset or Z' }) scheduledAt!: string;
  @IsEnum({ ONSITE: 'ONSITE', ONLINE: 'ONLINE' }) mode!: 'ONSITE' | 'ONLINE';
  @IsString() @IsNotEmpty() locationOrLink!: string;
  @IsOptional() @IsString() message?: string;
}

export class RequestRescheduleDto {
  @IsDateString() @Matches(TIMEZONE_SUFFIX, { message: 'proposedAt must include a timezone offset or Z' }) proposedAt!: string;
  @IsOptional() @IsString() message?: string;
}

export class DecideRescheduleDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
}

export class RecordInterviewResultDto {
  @IsIn(['ACCEPTED', 'REJECTED']) result!: 'ACCEPTED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}

export class CandidateListQueryDto {
  @IsOptional() @IsIn(['asc', 'desc']) sort: 'asc' | 'desc' = 'asc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
