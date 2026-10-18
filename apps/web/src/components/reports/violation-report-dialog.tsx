'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ViolationReportForm } from '@/components/reports/violation-report-form';
import { VIOLATION_TARGET_LABEL } from '@/lib/m05-labels';

export interface ViolationReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** COMPANY | STUDENT | JOB | REVIEW */
  targetType: string;
  targetId: string;
  /** Tên hiển thị của đối tượng (không bắt buộc). */
  targetLabel?: string;
  onSubmitted?: () => void;
}

/**
 * Hộp thoại gửi báo cáo vi phạm (UC49) với đối tượng cố định. Nhúng vào trang doanh nghiệp, tin tuyển dụng,
 * hồ sơ ứng viên hoặc đánh giá: truyền targetType + targetId của đối tượng bị báo cáo.
 * (Dialog không render khi đóng nên biểu mẫu tự được làm mới mỗi lần mở.)
 */
export function ViolationReportDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetLabel,
  onSubmitted,
}: ViolationReportDialogProps) {
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setDone(false);
  }, [isOpen]);

  const typeLabel = VIOLATION_TARGET_LABEL[targetType] ?? targetType;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Báo cáo vi phạm"
      description={`${typeLabel}${targetLabel ? `: ${targetLabel}` : ''}`}
    >
      {done ? (
        <div className="space-y-4">
          <Alert variant="success" title="Đã gửi báo cáo">
            Cảm ơn bạn. Báo cáo sẽ được Kiểm duyệt viên thẩm tra, bạn có thể theo dõi trạng thái ở mục "Báo cáo đã gửi".
          </Alert>
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <ViolationReportForm
            fixedTarget={{ targetType, targetId }}
            onSubmitted={() => {
              setDone(true);
              onSubmitted?.();
            }}
            onCancel={onClose}
          />
        </div>
      )}
    </Dialog>
  );
}
