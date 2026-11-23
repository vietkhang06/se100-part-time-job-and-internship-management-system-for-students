import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { NotificationEventType } from '@campusjob/contracts';

export class UpdateNotificationEmailPreferenceDto {
  @ApiProperty({
    enum: NotificationEventType,
    description: 'Loại sự kiện thông báo cần cập nhật tùy chọn email',
    example: NotificationEventType.JOB_APPROVED,
  })
  @IsEnum(NotificationEventType, {
    message: 'Loại sự kiện thông báo không hợp lệ',
  })
  eventType: NotificationEventType;

  @ApiProperty({
    description: 'Bật (true) hoặc tắt (false) nhận email cho loại thông báo này',
    example: false,
  })
  @IsBoolean({
    message: 'emailEnabled phải là giá trị boolean',
  })
  emailEnabled: boolean;
}
