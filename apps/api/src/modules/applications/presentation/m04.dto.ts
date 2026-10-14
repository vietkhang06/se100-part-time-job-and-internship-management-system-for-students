import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitApplicationDto {
  @IsString() @IsNotEmpty() cvId!: string;
  @IsOptional() @IsString() coverLetter?: string;
}

export class RejectApplicationDto {
  @IsString() @IsNotEmpty() reason!: string;
}
