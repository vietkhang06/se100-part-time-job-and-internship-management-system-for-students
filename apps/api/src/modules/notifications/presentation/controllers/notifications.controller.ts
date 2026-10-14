import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  MarkAllReadResponseDto,
  NotificationDto,
  PaginatedResponse,
  UnreadCountResponseDto,
} from '@campusjob/contracts';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { ListNotificationsQueryDto } from '../../application/dto/list-notifications-query.dto';
import { ListMyNotificationsUseCase } from '../../application/use-cases/list-my-notifications.use-case';
import { GetUnreadCountUseCase } from '../../application/use-cases/get-unread-count.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/mark-all-notifications-read.use-case';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listMyNotifications: ListMyNotificationsUseCase,
    private readonly getUnreadCount: GetUnreadCountUseCase,
    private readonly markNotificationRead: MarkNotificationReadUseCase,
    private readonly markAllNotificationsRead: MarkAllNotificationsReadUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'UC62 — Xem thông báo của tôi (phân trang)' })
  @ApiResponse({ status: 200, description: 'Danh sách thông báo, mới nhất trước' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponse<NotificationDto>> {
    return this.listMyNotifications.execute(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc (badge)' })
  async unreadCount(@CurrentUser('id') userId: string): Promise<UnreadCountResponseDto> {
    return this.getUnreadCount.execute(userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC63 — Đánh dấu tất cả đã đọc' })
  async readAll(@CurrentUser('id') userId: string): Promise<MarkAllReadResponseDto> {
    return this.markAllNotificationsRead.execute(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC63 — Đánh dấu một thông báo đã đọc (idempotent)' })
  @ApiResponse({ status: 404, description: 'Không tồn tại hoặc không thuộc về người dùng' })
  async readOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationDto> {
    return this.markNotificationRead.execute(id, userId);
  }
}
