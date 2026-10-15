import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ModerationItemDetailDto,
  ModerationItemDto,
  PaginatedResponse,
  UserRole,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import {
  DecideModerationItemDto,
  ListModerationQueueQueryDto,
} from '../../application/dto/moderation.dto';
import { ListModerationQueueUseCase } from '../../application/use-cases/list-moderation-queue.use-case';
import { GetModerationItemUseCase } from '../../application/use-cases/get-moderation-item.use-case';
import { ClaimModerationItemUseCase } from '../../application/use-cases/claim-moderation-item.use-case';
import {
  DecideModerationItemUseCase,
  DecideResult,
} from '../../application/use-cases/decide-moderation-item.use-case';

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly listQueue: ListModerationQueueUseCase,
    private readonly getItem: GetModerationItemUseCase,
    private readonly claimItem: ClaimModerationItemUseCase,
    private readonly decideItem: DecideModerationItemUseCase,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'UC50 — Xem hàng đợi kiểm duyệt (tin, báo cáo, đánh giá)' })
  async queue(
    @CurrentUser('id') userId: string,
    @Query() query: ListModerationQueueQueryDto,
  ): Promise<PaginatedResponse<ModerationItemDto>> {
    return this.listQueue.execute(userId, query);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Chi tiết một mục kiểm duyệt kèm lịch sử quyết định' })
  @ApiResponse({ status: 404, description: 'MODERATION_ITEM_NOT_FOUND' })
  async detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<ModerationItemDetailDto> {
    return this.getItem.execute(id);
  }

  @Post('items/:id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận xử lý một mục (khóa cho người xử lý)' })
  @ApiResponse({ status: 409, description: 'MODERATION_ALREADY_ASSIGNED | MODERATION_ALREADY_DECIDED' })
  async claim(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ): Promise<ModerationItemDto> {
    return this.claimItem.execute(id, user);
  }

  @Post('items/:id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC51/UC52/UC53 — Ra quyết định kiểm duyệt' })
  @ApiResponse({ status: 400, description: 'MODERATION_DECISION_NOT_ALLOWED | MODERATION_REASON_REQUIRED' })
  @ApiResponse({ status: 403, description: 'MODERATION_NOT_ASSIGNED' })
  @ApiResponse({ status: 409, description: 'MODERATION_ALREADY_DECIDED' })
  async decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() body: DecideModerationItemDto,
  ): Promise<DecideResult> {
    return this.decideItem.execute(id, user, body);
  }
}
