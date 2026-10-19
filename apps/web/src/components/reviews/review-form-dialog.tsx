'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { StarRatingInput } from '@/components/reviews/star-rating';
import { createReview } from '@/lib/reviews-api';
import { getM05ErrorMessage } from '@/lib/m05-labels';

const COMMENT_MAX = 2000;

export interface ReviewFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hồ sơ ứng tuyển (đã có kết quả cuối) làm căn cứ đánh giá. */
  applicationId: string;
  companyName?: string;
  onSubmitted?: () => void;
}

/**
 * Hộp thoại đánh giá doanh nghiệp (UC46). Nhúng vào trang Lịch sử ứng tuyển cho các hồ sơ đã có kết quả
 * cuối bằng cách truyền applicationId.
 */
export function ReviewFormDialog({ isOpen, onClose, applicationId, companyName, onSubmitted }: ReviewFormDialogProps) {
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [ratingError, setRatingError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
      setRatingError(null);
      setFormError(null);
      setDone(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (rating < 1) {
      setRatingError('Vui lòng chọn số sao.');
      return;
    }
    setRatingError(null);
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createReview({ applicationId, rating, comment: comment.trim() || undefined });
      setDone(true);
      onSubmitted?.();
    } catch (error) {
      setFormError(getM05ErrorMessage(error, 'Không thể gửi đánh giá. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Đánh giá doanh nghiệp"
      description={companyName}
    >
      {done ? (
        <div className="space-y-4">
          <Alert variant="success" title="Đã gửi đánh giá">
            Cảm ơn bạn. Đánh giá được hiển thị ẩn danh trên trang doanh nghiệp.
          </Alert>
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {formError && <Alert variant="destructive">{formError}</Alert>}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground/80">Số sao</p>
            <StarRatingInput value={rating} onChange={setRating} disabled={isSubmitting} />
            {ratingError && <p className="text-xs text-destructive">{ratingError}</p>}
          </div>
          <Textarea
            label="Nhận xét (không bắt buộc)"
            placeholder="Chia sẻ trải nghiệm của bạn trong quá trình ứng tuyển"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isSubmitting}
            maxLength={COMMENT_MAX}
          />
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>
              Gửi đánh giá
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
