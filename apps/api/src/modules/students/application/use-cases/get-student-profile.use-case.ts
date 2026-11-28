import { Injectable, Inject } from '@nestjs/common';
import { StudentProfileResponseDto } from '@campusjob/contracts';
import {
  STUDENT_PROFILE_REPOSITORY_TOKEN,
  IStudentProfileRepository,
} from '../../domain/repositories/student-profile.repository.interface';
import { mapStudentProfileToDto } from '../dto/student-profile.mapper';

@Injectable()
export class GetStudentProfileUseCase {
  constructor(
    @Inject(STUDENT_PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepository: IStudentProfileRepository,
  ) {}

  async execute(userId: string): Promise<StudentProfileResponseDto> {
    const profile = await this.profileRepository.createOrFind(userId);
    return {
      profile: mapStudentProfileToDto(profile),
    };
  }
}
