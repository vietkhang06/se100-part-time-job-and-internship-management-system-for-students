import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GetUserByIdUseCase } from '../../application/use-cases/get-user-by-id.use-case';
import { UserResponseDto } from '../../application/dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly getUserByIdUseCase: GetUserByIdUseCase) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by user UUID' })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    return this.getUserByIdUseCase.execute(id);
  }
}
