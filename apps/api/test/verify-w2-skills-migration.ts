import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Configuration
const CONTAINER_NAME = 'campusjob-test-postgres-migration-w2';
const POSTGRES_PORT = 5433;
const POSTGRES_USER = 'postgres';
const POSTGRES_PASSWORD = 'postgres';
const POSTGRES_DB = 'campusjob_migration_test';
const POSTGRES_IMAGE = 'postgres:16-alpine';

// Resolve project paths
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.resolve(PROJECT_ROOT, 'apps/api/prisma/migrations');

// Helper to get environment with Docker binary in PATH if on Windows and not already present
function getDockerEnv(): NodeJS.ProcessEnv {
  if (process.platform === 'win32' && !process.env.PATH?.toLowerCase().includes('docker')) {
    const defaultWinPath = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
    if (fs.existsSync(defaultWinPath)) {
      return {
        ...process.env,
        PATH: `${process.env.PATH};${defaultWinPath}`,
      };
    }
  }
  return process.env;
}

// Helper to run docker CLI commands
function docker(args: string[]): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf-8',
    env: getDockerEnv(),
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Docker command failed [docker ${args.join(' ')}]:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

// Helper to run psql queries against the container
function psql(db: string, sql: string, extraArgs: string[] = []): string {
  const args = [
    'exec',
    '-i',
    CONTAINER_NAME,
    'psql',
    '-U',
    POSTGRES_USER,
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
    ...extraArgs,
    '-c',
    sql,
  ];
  return docker(args);
}

// Helper to run psql query and return parsed JSON
function psqlJson<T = any>(db: string, sql: string): T {
  const wrapped = `SELECT json_agg(t) FROM (${sql}) t;`;
  const raw = psql(db, wrapped, ['-t', '-A']);
  if (!raw || raw.trim() === '' || raw.trim() === 'null') {
    return [] as unknown as T;
  }
  return JSON.parse(raw);
}

// Helper to run psql file inside the container
function psqlFile(db: string, hostFilePath: string, inTransaction = true): string {
  const content = fs.readFileSync(hostFilePath, 'utf-8');
  const args = [
    'exec',
    '-i',
    CONTAINER_NAME,
    'psql',
    '-U',
    POSTGRES_USER,
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
  ];
  if (inTransaction) {
    args.push('--single-transaction');
  }

  const result = spawnSync('docker', args, {
    input: content,
    encoding: 'utf-8',
    env: getDockerEnv(),
  });

  if (result.status !== 0) {
    throw new Error(`psql file execution failed for ${path.basename(hostFilePath)}:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

interface AssertionRecord {
  category: string;
  testCase: string;
  expected: any;
  actual: any;
  passed: boolean;
  notes?: string;
}

const assertions: AssertionRecord[] = [];

function assert(category: string, testCase: string, actual: any, expected: any, notes?: string): void {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  assertions.push({ category, testCase, expected, actual, passed, notes });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${category}] ${testCase}`);
  if (!passed) {
    console.error(`       Expected: ${JSON.stringify(expected)}`);
    console.error(`       Actual:   ${JSON.stringify(actual)}`);
  }
}

async function runVerification() {
  console.log('======================================================================');
  console.log('W2 MIGRATION VERIFICATION: POPULATED LEGACY STUDENT SKILLS');
  console.log('======================================================================\n');

  let containerCreated = false;

  try {
    // 1. Safety Check: verify container name does not exist
    console.log('[Step 1] Ensuring no pre-existing container with test name exists...');
    const existing = docker(['ps', '-a', '--filter', `name=${CONTAINER_NAME}`, '--format', '{{.Names}}']);
    if (existing.includes(CONTAINER_NAME)) {
      console.log(`Removing leftover test container ${CONTAINER_NAME}...`);
      docker(['rm', '-f', CONTAINER_NAME]);
    }

    // 2. Launch disposable PostgreSQL container
    console.log(`[Step 2] Starting isolated PostgreSQL 16 container on port ${POSTGRES_PORT}...`);
    docker([
      'run',
      '-d',
      '--name',
      CONTAINER_NAME,
      '-e',
      `POSTGRES_USER=${POSTGRES_USER}`,
      '-e',
      `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
      '-e',
      `POSTGRES_DB=${POSTGRES_DB}`,
      '-p',
      `${POSTGRES_PORT}:5432`,
      POSTGRES_IMAGE,
    ]);
    containerCreated = true;

    // 3. Wait for PostgreSQL readiness
    console.log('[Step 3] Waiting for PostgreSQL service to be ready...');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const out = docker(['exec', CONTAINER_NAME, 'pg_isready', '-U', POSTGRES_USER, '-d', POSTGRES_DB]);
        if (out.includes('accepting connections')) {
          ready = true;
          break;
        }
      } catch {
        // ignore and wait
      }
      execSync('timeout /t 1 >nul 2>&1 || ping -n 2 127.0.0.1 >nul');
    }

    if (!ready) {
      throw new Error('PostgreSQL container failed to become ready in 30 seconds.');
    }

    const pgVersion = psql(POSTGRES_DB, 'SHOW server_version;', ['-t', '-A']);
    console.log(`PostgreSQL is ready. Server version: ${pgVersion}\n`);

    // 4. Apply preceding migrations 1 through 7 in sequential order
    const precedingMigrations = [
      '20260930174054_init_auth_baseline',
      '20261012170000_m05_add_notification',
      '20261012172613_add_student_profile',
      '20261014025500_add_cv_management',
      '20261014095000_add_m04_application_contract',
      '20261014100000_add_m04_interview',
      '20261016100000_add_file_asset_and_cv_integrity',
    ];

    console.log('[Step 4] Applying preceding migrations (1 to 7)...');
    for (const mig of precedingMigrations) {
      const sqlPath = path.join(MIGRATIONS_DIR, mig, 'migration.sql');
      console.log(`  -> Applying ${mig}...`);
      psqlFile(POSTGRES_DB, sqlPath, true);
    }

    // Verify pre-migration schema state
    console.log('\n[Step 5] Verifying pre-migration schema state...');
    const columnInfo = psqlJson<Array<{ column_name: string; data_type: string; udt_name: string; is_nullable: string }>>(
      POSTGRES_DB,
      `SELECT column_name, data_type, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'StudentProfile' AND column_name = 'skills'`
    );
    assert('Pre-Migration Schema', 'StudentProfile.skills column exists', columnInfo.length, 1);
    assert('Pre-Migration Schema', 'StudentProfile.skills is an array of text (_text)', columnInfo[0]?.udt_name, '_text');
    assert('Pre-Migration Schema', 'StudentProfile.skills allows NULL', columnInfo[0]?.is_nullable, 'YES');

    const skillTablePre = psqlJson(
      POSTGRES_DB,
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('Skill', 'StudentSkill')`
    );
    assert('Pre-Migration Schema', 'Skill and StudentSkill do not exist prior to migration', skillTablePre.length, 0);

    // 6. Insert representative legacy student profiles
    console.log('\n[Step 6] Seeding representative legacy data (8 test cases)...');

    // Insert 6 users
    const seedUsersSql = `
      INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "role", "status", "createdAt", "updatedAt")
      VALUES
        ('user-legacy-1', 'student1@example.com', 'hash1', 'Student One', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
        ('user-legacy-2', 'student2@example.com', 'hash2', 'Student Two', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
        ('user-legacy-3', 'student3@example.com', 'hash3', 'Student Three', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
        ('user-legacy-4', 'student4@example.com', 'hash4', 'Student Four', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
        ('user-legacy-5', 'student5@example.com', 'hash5', 'Student Five', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
        ('user-legacy-6', 'student6@example.com', 'hash6', 'Student Six', 'STUDENT', 'ACTIVE', '2026-10-01 10:00:00', '2026-10-01 10:00:00');
    `;
    psql(POSTGRES_DB, seedUsersSql);

    // Insert 6 student profiles with diverse, representative skills arrays
    const seedProfilesSql = `
      INSERT INTO "StudentProfile" ("id", "userId", "university", "major", "graduationYear", "jobSeekingStatus", "bio", "skills", "createdAt", "updatedAt")
      VALUES
        -- Case 1 & 7 & 8: Multiple distinct skills; 'React' to test cross-student case sharing
        ('sp-legacy-1', 'user-legacy-1', 'University of Science', 'Computer Science', 2025, 'ACTIVELY_LOOKING', 'Passionate software engineering student', ARRAY['React', 'TypeScript', 'Node.js'], '2026-10-02 08:30:00', '2026-10-02 08:30:00'),

        -- Case 1, 3, 4: 'react' (shared casing difference), '  JavaScript  ' (whitespace), '' (empty string)
        ('sp-legacy-2', 'user-legacy-2', 'Polytechnic University', 'Information Technology', 2026, 'OPEN_FOR_OPPORTUNITIES', 'Frontend developer enthusiast', ARRAY['react', '  JavaScript  ', ''], '2026-10-03 09:15:00', '2026-10-03 09:15:00'),

        -- Case 2, 3, 4: 'Python', 'python', ' PYTHON ' (duplicates within array with varying case/whitespace), '   ' (whitespace only), 'Machine Learning'
        ('sp-legacy-3', 'user-legacy-3', 'International University', 'Data Science', 2024, 'NOT_LOOKING', 'AI and data specialist', ARRAY['Python', 'python', ' PYTHON ', '   ', 'Machine Learning'], '2026-10-04 11:00:00', '2026-10-04 11:00:00'),

        -- Case 5: Empty skills array ARRAY[]::TEXT[]
        ('sp-legacy-4', 'user-legacy-4', 'Economics University', 'Business Analytics', 2027, 'ACTIVELY_LOOKING', 'Looking for internships', ARRAY[]::TEXT[], '2026-10-05 14:20:00', '2026-10-05 14:20:00'),

        -- Case 6: NULL skills array
        ('sp-legacy-5', 'user-legacy-5', 'Foreign Trade University', 'Finance', 2025, 'OPEN_FOR_OPPORTUNITIES', 'Finance and analytics', NULL, '2026-10-06 16:45:00', '2026-10-06 16:45:00'),

        -- Case 2, 3, 7: Duplicate mixed-case 'Docker' vs '  docker  ', plus distinct 'Kubernetes', 'Go'
        ('sp-legacy-6', 'user-legacy-6', 'Posts and Telecoms Institute', 'Cybersecurity', 2026, 'ACTIVELY_LOOKING', 'Security researcher', ARRAY['Docker', 'Kubernetes', 'Go', '  docker  '], '2026-10-07 17:10:00', '2026-10-07 17:10:00');
    `;
    psql(POSTGRES_DB, seedProfilesSql);

    // Record pre-migration snapshot of profiles
    const preMigrationProfiles = psqlJson<Array<any>>(
      POSTGRES_DB,
      `SELECT "id", "userId", "university", "major", "graduationYear", "jobSeekingStatus", "bio", "skills", "createdAt", "updatedAt"
       FROM "StudentProfile" ORDER BY "id"`
    );
    assert('Fixture Setup', 'Pre-migration profile count', preMigrationProfiles.length, 6);

    // 7. Test Transactional Failure and Rollback Behavior
    console.log('\n[Step 7] Testing transactional rollback behavior under simulated migration error...');
    psql(POSTGRES_DB, `CREATE DATABASE campusjob_rollback_test TEMPLATE ${POSTGRES_DB};`);

    // Attempt migration with a forced error at the end of the transaction
    const targetMigrationSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261016110000_normalize_student_skills', 'migration.sql'),
      'utf-8'
    );
    const failureScript = `
      BEGIN;
      ${targetMigrationSql}
      RAISE EXCEPTION 'Simulated failure to verify transactional rollback';
      COMMIT;
    `;

    let rollbackSucceeded = false;
    try {
      const args = ['exec', '-i', CONTAINER_NAME, 'psql', '-U', POSTGRES_USER, '-d', 'campusjob_rollback_test', '-v', 'ON_ERROR_STOP=1'];
      const res = spawnSync('docker', args, {
        input: failureScript,
        encoding: 'utf-8',
        env: getDockerEnv(),
      });
      if (res.status !== 0) {
        // Error expected!
        rollbackSucceeded = true;
      }
    } catch {
      rollbackSucceeded = true;
    }
    assert('Rollback Safety', 'Migration aborts on execution error', rollbackSucceeded, true);

    // Verify rollback preserved pre-migration state on rollback db
    const rollbackColInfo = psqlJson<any[]>(
      'campusjob_rollback_test',
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'StudentProfile' AND column_name = 'skills'`
    );
    assert('Rollback Safety', 'StudentProfile.skills retained after failed transaction', rollbackColInfo.length, 1);

    const rollbackSkillTable = psqlJson<any[]>(
      'campusjob_rollback_test',
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'Skill'`
    );
    assert('Rollback Safety', 'Skill table was rolled back and does not exist', rollbackSkillTable.length, 0);

    // Drop rollback test db
    psql(POSTGRES_DB, `DROP DATABASE campusjob_rollback_test;`);

    // 8. Apply Target Migration 8 to the prepared database
    console.log('\n[Step 8] Applying target migration 20261016110000_normalize_student_skills...');
    const targetSqlPath = path.join(MIGRATIONS_DIR, '20261016110000_normalize_student_skills', 'migration.sql');
    psqlFile(POSTGRES_DB, targetSqlPath, true);
    console.log('Target migration applied successfully.\n');

    // 9. Comprehensive Post-Migration SQL Assertions
    console.log('[Step 9] Running post-migration assertions...');

    // A. Skill Normalization Assertions
    const skills = psqlJson<Array<{ id: string; name: string; normalizedName: string }>>(
      POSTGRES_DB,
      `SELECT "id", "name", "normalizedName" FROM "Skill" ORDER BY "normalizedName"`
    );
    const expectedNormalizedSkills = [
      'docker',
      'go',
      'javascript',
      'kubernetes',
      'machine learning',
      'node.js',
      'python',
      'react',
      'typescript',
    ];
    const actualNormalizedSkills = skills.map((s) => s.normalizedName);

    assert('Skill Normalization', 'Distinct normalized skill count is exactly 9', skills.length, 9);
    assert('Skill Normalization', 'Normalized names match expected lowercase trimmed list', actualNormalizedSkills, expectedNormalizedSkills);

    // Check that every normalized name adheres to canonical rules: lowercase, trimmed, non-empty
    const invalidSkills = skills.filter(
      (s) => s.normalizedName !== s.normalizedName.toLowerCase().trim() || s.normalizedName.length === 0
    );
    assert('Skill Normalization', 'Zero invalid/malformed normalized names', invalidSkills.length, 0);

    // Check unique normalized names count
    const uniqueNormalizedCount = new Set(actualNormalizedSkills).size;
    assert('Skill Normalization', 'All normalized names are strictly unique', uniqueNormalizedCount, skills.length);

    // Verify Skill_normalizedName_check constraint rejects bad input
    let checkConstraintRejectsUppercase = false;
    try {
      psql(POSTGRES_DB, `INSERT INTO "Skill" ("id", "name", "normalizedName", "createdAt", "updatedAt") VALUES ('bad-1', 'Invalid', 'Invalid', NOW(), NOW());`);
    } catch {
      checkConstraintRejectsUppercase = true;
    }
    assert('Constraints & Indexes', 'Skill_normalizedName_check rejects uppercase in normalizedName', checkConstraintRejectsUppercase, true);

    let checkConstraintRejectsWhitespace = false;
    try {
      psql(POSTGRES_DB, `INSERT INTO "Skill" ("id", "name", "normalizedName", "createdAt", "updatedAt") VALUES ('bad-2', 'Invalid', ' invalid ', NOW(), NOW());`);
    } catch {
      checkConstraintRejectsWhitespace = true;
    }
    assert('Constraints & Indexes', 'Skill_normalizedName_check rejects untrimmed normalizedName', checkConstraintRejectsWhitespace, true);

    let checkConstraintRejectsEmpty = false;
    try {
      psql(POSTGRES_DB, `INSERT INTO "Skill" ("id", "name", "normalizedName", "createdAt", "updatedAt") VALUES ('bad-3', '', '', NOW(), NOW());`);
    } catch {
      checkConstraintRejectsEmpty = true;
    }
    assert('Constraints & Indexes', 'Skill_normalizedName_check rejects empty normalizedName', checkConstraintRejectsEmpty, true);

    // B. Student Association Assertions
    const studentSkills = psqlJson<Array<{ studentProfileId: string; skillId: string; normalizedName: string }>>(
      POSTGRES_DB,
      `SELECT ss."studentProfileId", ss."skillId", sk."normalizedName"
       FROM "StudentSkill" ss
       JOIN "Skill" sk ON sk."id" = ss."skillId"
       ORDER BY ss."studentProfileId", sk."normalizedName"`
    );
    assert('Student Associations', 'Total StudentSkill associations is exactly 10', studentSkills.length, 10);

    // Group by student
    const studentSkillMap: Record<string, string[]> = {};
    for (const ss of studentSkills) {
      if (!studentSkillMap[ss.studentProfileId]) {
        studentSkillMap[ss.studentProfileId] = [];
      }
      studentSkillMap[ss.studentProfileId].push(ss.normalizedName);
    }

    // sp-legacy-1: React, TypeScript, Node.js
    assert('Student Associations', 'sp-legacy-1 associations', studentSkillMap['sp-legacy-1']?.sort(), ['node.js', 'react', 'typescript'].sort());

    // sp-legacy-2: react, JavaScript (empty string ignored)
    assert('Student Associations', 'sp-legacy-2 associations', studentSkillMap['sp-legacy-2']?.sort(), ['javascript', 'react'].sort());

    // Verify shared skill 'react' uses identical skillId across sp-legacy-1 and sp-legacy-2
    const reactAssociations = studentSkills.filter((s) => s.normalizedName === 'react');
    const reactSkillIds = new Set(reactAssociations.map((s) => s.skillId));
    assert('Student Associations', 'Both students sharing React reference identical Skill.id', reactSkillIds.size, 1);

    // sp-legacy-3: Python (deduplicated from 3 variants), Machine Learning ('   ' ignored)
    assert('Student Associations', 'sp-legacy-3 associations (deduplicated Python + ML)', studentSkillMap['sp-legacy-3']?.sort(), ['machine learning', 'python'].sort());

    // sp-legacy-4: Empty array -> 0 associations
    assert('Student Associations', 'sp-legacy-4 (empty array) has 0 associations', studentSkillMap['sp-legacy-4'] || [], []);

    // sp-legacy-5: NULL array -> 0 associations
    assert('Student Associations', 'sp-legacy-5 (NULL array) has 0 associations', studentSkillMap['sp-legacy-5'] || [], []);

    // sp-legacy-6: Docker (deduplicated), Kubernetes, Go
    assert('Student Associations', 'sp-legacy-6 associations (deduplicated Docker + K8s + Go)', studentSkillMap['sp-legacy-6']?.sort(), ['docker', 'go', 'kubernetes'].sort());

    // C. Data Preservation Assertions
    const postMigrationProfiles = psqlJson<Array<any>>(
      POSTGRES_DB,
      `SELECT "id", "userId", "university", "major", "graduationYear", "jobSeekingStatus", "bio", "createdAt", "updatedAt"
       FROM "StudentProfile" ORDER BY "id"`
    );
    assert('Data Preservation', 'All 6 student profiles remain present', postMigrationProfiles.length, 6);

    for (const pre of preMigrationProfiles) {
      const post = postMigrationProfiles.find((p) => p.id === pre.id);
      assert('Data Preservation', `Profile ${pre.id} unrelated fields preserved`, {
        userId: post?.userId,
        university: post?.university,
        major: post?.major,
        graduationYear: post?.graduationYear,
        jobSeekingStatus: post?.jobSeekingStatus,
        bio: post?.bio,
        createdAt: post?.createdAt,
        updatedAt: post?.updatedAt,
      }, {
        userId: pre.userId,
        university: pre.university,
        major: pre.major,
        graduationYear: pre.graduationYear,
        jobSeekingStatus: pre.jobSeekingStatus,
        bio: pre.bio,
        createdAt: pre.createdAt,
        updatedAt: pre.updatedAt,
      });
    }

    // Verify column StudentProfile.skills is dropped
    const postColInfo = psqlJson<any[]>(
      POSTGRES_DB,
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'StudentProfile' AND column_name = 'skills'`
    );
    assert('Data Preservation', 'Legacy column StudentProfile.skills is dropped', postColInfo.length, 0);

    // Verify referential integrity: no orphaned foreign keys in StudentSkill
    const orphanCount = psqlJson<any[]>(
      POSTGRES_DB,
      `SELECT ss.id FROM "StudentSkill" ss
       LEFT JOIN "StudentProfile" sp ON sp.id = ss."studentProfileId"
       LEFT JOIN "Skill" sk ON sk.id = ss."skillId"
       WHERE sp.id IS NULL OR sk.id IS NULL`
    );
    assert('Data Preservation', 'Zero orphaned records in StudentSkill', orphanCount.length, 0);

  } finally {
    // 10. Cleanup
    if (containerCreated) {
      console.log('\n[Step 10] Cleaning up disposable PostgreSQL container...');
      try {
        docker(['rm', '-f', CONTAINER_NAME]);
        console.log(`Container ${CONTAINER_NAME} stopped and removed successfully.`);
      } catch (err) {
        console.error(`Failed to clean up container ${CONTAINER_NAME}:`, err);
      }
    }
  }

  // Summary
  console.log('\n======================================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('======================================================================');
  const failed = assertions.filter((a) => !a.passed);
  console.log(`Total Assertions: ${assertions.length}`);
  console.log(`Passed:           ${assertions.length - failed.length}`);
  console.log(`Failed:           ${failed.length}`);

  if (failed.length > 0) {
    console.error('\nFAILED ASSERTIONS:');
    for (const f of failed) {
      console.error(`- [${f.category}] ${f.testCase}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL POPULATED MIGRATION ASSERTIONS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during migration verification:', err);
  process.exit(1);
});
