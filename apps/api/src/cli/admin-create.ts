import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as readline from 'readline';

function parseArgs(): { email?: string; name?: string; confirmPromote?: boolean } {
  const args = process.argv.slice(2);
  const result: { email?: string; name?: string; confirmPromote?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[i + 1].trim().toLowerCase();
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      result.name = args[i + 1].trim();
      i++;
    } else if (args[i] === '--confirm-promote') {
      result.confirmPromote = true;
    }
  }

  return result;
}

function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Simple prompt (in dev/cli environments where hidden input may differ by platform)
    rl.question('Enter Admin Password (minimum 8 chars): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  const prisma = new PrismaClient();
  const args = parseArgs();

  const email = args.email || process.env.ADMIN_EMAIL;
  const name = args.name || process.env.ADMIN_NAME || 'Super Admin';

  if (!email) {
    console.error('Error: --email <email> is required');
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await promptPassword();
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    if (existingUser) {
      if (existingUser.role === UserRole.ADMIN) {
        console.log(`User ${email} is already an Admin. Updating credentials.`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            fullName: name || existingUser.fullName,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
          },
        });
        console.log(`Admin ${email} updated successfully.`);
      } else {
        if (!args.confirmPromote) {
          console.error(
            `Error: User ${email} already exists with role '${existingUser.role}'. To promote this account to ADMIN, re-run with --confirm-promote.`,
          );
          process.exit(1);
        }
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: UserRole.ADMIN,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        });
        console.log(`User ${email} was promoted to ADMIN.`);
      }
    } else {
      const newUser = await prisma.user.create({
        data: {
          email,
          fullName: name,
          passwordHash,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: newUser.id,
          action: 'ADMIN_INIT',
          entityType: 'User',
          entityId: newUser.id,
          metadata: { note: 'Initial system administrator created via CLI' },
        },
      });

      console.log(`Admin account ${email} created successfully (ID: ${newUser.id}).`);
    }
  } catch (err: any) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
