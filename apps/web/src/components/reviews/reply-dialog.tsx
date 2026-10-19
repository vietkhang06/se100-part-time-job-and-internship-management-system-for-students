'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { replyToReview } from '@/lib/reviews-api';
import { getM05ErrorCode, getM05ErrorMessage } from '@/lib/m05-labels';

const REPLY_MAX = 1000;

export interface ReplyDialogProps {
  reviewId: string | null;
  onClose: () => void;
  /** Gọi sau khi gửi thành công hoặc khi đánh giá đã có phản hồi (để làm mới danh sách). */
  onReplied: () => void;
}

/** UC47 — phản hồi một lần cho mỗi đánh giá. */
export function ReplyDialog({ reviewId, onClose, onReplied }: ReplyDialogProps) {
  const [content, setContent] = React.useState('');
  const [contentError, setContentError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setContent('');
    setContentError(null);
    setFormError(null);
  }, [reviewId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewId || isSubmitting) return;
    if (!content.trim()) {
      setContentError('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    setContentError(null);
    setFormError(null);
    setIsSubmitting(true);
    try {
      await replyToReview(reviewId, content.trim());
      onReplied();
      onClose();
    } catch (error) {
      setFormError(getM05ErrorMessage(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'));
      if (getM05ErrorCode(error) === 'REVIEW_ALREADY_REPLIED') {
        onReplied();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={reviewId !== null}
      onClose={onClose}
      title="Phản hồi đánh giá"
      description="Mỗi đánh giá chỉ được phản hồi một lần và không thể sửa sau khi gửi."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="destructive">{formError}</Alert>}
        <Textarea
          label="Nội dung phản hồi"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={contentError ?? undefined}
          disabled={isSubmitting}
          maxLength={REPLY_MAX}
        />
        <div className="flex gap-2">
          <Button type="submit" isLoading={isSubmitting}>
            Gửi phản hồi
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
