import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const prisma = new PrismaClient();
  const email = 'student@example.com';
  const password = 'Student@123';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        fullName: 'Nguyễn Văn Sinh Viên',
        phone: '0901234567',
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created user ${email} (ID: ${user.id})`);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Updated user ${email} credentials`);
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    const newProfile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        university: 'Đại học Bách Khoa',
        major: 'Khoa học máy tính',
        graduationYear: 2026,
        skills: ['TypeScript', 'NestJS', 'React', 'PostgreSQL'],
        bio: 'Sinh viên năm cuối ngành KHMT đam mê công nghệ',
      },
    });
    console.log(`Created student profile (ID: ${newProfile.id}) for ${email}`);
  } else {
    console.log(`Student profile already exists (ID: ${profile.id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
