import { SanctionStatus, SanctionTargetType, SanctionType } from '@campusjob/contracts';
import { SanctionEntity } from './sanction.entity';

const make = (over: Partial<ConstructorParameters<typeof SanctionEntity>[0]> = {}) =>
  new SanctionEntity({
    id: 's1', reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1',
    type: SanctionType.APPLICATION_LOCK, storedStatus: SanctionStatus.ACTIVE, reason: 'x',
    startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: new Date('2026-10-10T00:00:00Z'),
    imposedBy: 'adm', liftedAt: null, liftReason: null, createdAt: new Date(), ...over,
  });

describe('SanctionEntity.effectiveStatus', () => {
  it('is ACTIVE before the end date and EXPIRED after it (automatic expiry)', () => {
    expect(make().effectiveStatus(new Date('2026-10-05T00:00:00Z'))).toBe(SanctionStatus.ACTIVE);
    expect(make().effectiveStatus(new Date('2026-10-10T00:00:00Z'))).toBe(SanctionStatus.EXPIRED);
    expect(make().isActiveAt(new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });

  it('has no expiry when endsAt is null', () => {
    expect(make({ endsAt: null }).effectiveStatus(new Date('2030-01-01T00:00:00Z'))).toBe(SanctionStatus.ACTIVE);
  });

  it('stays LIFTED regardless of dates', () => {
    expect(make({ storedStatus: SanctionStatus.LIFTED }).effectiveStatus(new Date('2026-10-05T00:00:00Z'))).toBe(
      SanctionStatus.LIFTED,
    );
  });
});
