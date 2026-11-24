'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PROFILE_LIMITS, validateSkillAddition } from '@/lib/m02-validation';

export interface SkillEditorProps {
  label?: string;
  skills: string[];
  onChange: (nextSkills: string[]) => void;
  maxSkills?: number;
  maxSkillLength?: number;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  helperText?: string;
  inputId?: string;
}

export function SkillEditor({
  label = 'Kỹ năng chuyên môn',
  skills,
  onChange,
  maxSkills = PROFILE_LIMITS.MAX_SKILLS,
  maxSkillLength = PROFILE_LIMITS.SKILL_MAX_LENGTH,
  placeholder = 'Nhập kỹ năng (VD: TypeScript, NestJS) rồi nhấn Enter hoặc Thêm',
  error,
  disabled = false,
  helperText,
  inputId = 'skill-editor-input',
}: SkillEditorProps) {
  const [draft, setDraft] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleAdd = () => {
    if (!draft.trim()) {
      setLocalError('Vui lòng nhập tên kỹ năng trước khi thêm.');
      return;
    }

    const result = validateSkillAddition(skills, draft, maxSkills, maxSkillLength);
    if (result.error) {
      setLocalError(result.error);
      return;
    }

    setLocalError(null);
    setDraft('');
    onChange(result.nextSkills);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (indexToRemove: number) => {
    setLocalError(null);
    onChange(skills.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAll = () => {
    setLocalError(null);
    onChange([]);
  };

  const displayedError = error || localError || undefined;

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold text-foreground/80">
          {label}
        </label>
        <span className="text-xs text-muted-foreground">
          Đã thêm <strong className="text-foreground">{skills.length}</strong>/{maxSkills} kỹ năng
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 min-w-0">
          <Input
            id={inputId}
            value={draft}
            disabled={disabled || skills.length >= maxSkills}
            placeholder={
              skills.length >= maxSkills
                ? `Đã đạt giới hạn tối đa ${maxSkills} kỹ năng`
                : placeholder
            }
            onChange={(e) => {
              setDraft(e.target.value);
              if (localError) setLocalError(null);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !draft.trim() || skills.length >= maxSkills}
          onClick={handleAdd}
          className="shrink-0"
        >
          + Thêm kỹ năng
        </Button>
      </div>

      {helperText && !displayedError && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {displayedError && (
        <p className="text-xs text-destructive" role="alert">
          {displayedError}
        </p>
      )}

      {skills.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill, idx) => (
              <Badge
                key={`${skill}-${idx}`}
                variant="secondary"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
              >
                <span className="break-all">{skill}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Xóa kỹ năng ${skill}`}
                    onClick={() => handleRemove(idx)}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
          </div>

          {!disabled && skills.length > 1 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-destructive hover:underline"
              >
                Xóa tất cả kỹ năng
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Chưa có kỹ năng nào được thêm. Bạn có thể nhập từng kỹ năng hoặc ngăn cách bằng dấu phẩy.
        </p>
      )}
    </div>
  );
}

