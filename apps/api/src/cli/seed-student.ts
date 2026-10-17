import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'student@example.com';
  const password = 'Student@123';
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  // 1. Create or update the student user.
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

  // 2. Create or reuse the student profile.
  let profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        university: 'Đại học Bách Khoa',
        major: 'Khoa học máy tính',
        graduationYear: 2026,
        bio: 'Sinh viên năm cuối ngành KHMT đam mê công nghệ',
      },
    });

    console.log(`Created student profile (ID: ${profile.id}) for ${email}`);
  } else {
    console.log(`Student profile already exists (ID: ${profile.id})`);
  }

  // 3. Seed normalized skills and link them to the student profile.
  // Skills are stored in Skill and StudentSkill, not directly on StudentProfile.
  const skillNames = ['TypeScript', 'NestJS', 'React', 'PostgreSQL'];

  for (const skillName of skillNames) {
    const name = skillName.trim();
    const normalizedName = name.toLowerCase();

    const skill = await prisma.skill.upsert({
      where: { normalizedName },
      update: {},
      create: {
        name,
        normalizedName,
      },
    });

    await prisma.studentSkill.upsert({
      where: {
        studentProfileId_skillId: {
          studentProfileId: profile.id,
          skillId: skill.id,
        },
      },
      update: {},
      create: {
        studentProfileId: profile.id,
        skillId: skill.id,
      },
    });

    console.log(`Ensured skill "${name}" for profile ${profile.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
