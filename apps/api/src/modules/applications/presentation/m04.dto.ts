import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitApplicationDto {
  @IsString() @IsNotEmpty() cvId!: string;
  @IsOptional() @IsString() coverLetter?: string;
}

export class RejectApplicationDto {
  @IsString() @IsNotEmpty() reason!: string;
}

export class InviteInterviewDto {
  @IsDateString() scheduledAt!: string;
  @IsEnum({ ONSITE: 'ONSITE', ONLINE: 'ONLINE' }) mode!: 'ONSITE' | 'ONLINE';
  @IsString() @IsNotEmpty() locationOrLink!: string;
  @IsOptional() @IsString() message?: string;
}

export class RequestRescheduleDto {
  @IsDateString() proposedAt!: string;
  @IsOptional() @IsString() message?: string;
}

export class DecideRescheduleDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
}

export class RecordInterviewResultDto {
  @IsIn(['ACCEPTED', 'REJECTED']) result!: 'ACCEPTED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}
