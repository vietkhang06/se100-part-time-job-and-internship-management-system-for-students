-- CreateTable Skill
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_normalizedName_key" ON "Skill"("normalizedName");

-- CreateIndex
CREATE INDEX "Skill_normalizedName_idx" ON "Skill"("normalizedName");

-- CreateTable StudentSkill
CREATE TABLE "StudentSkill" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentSkill_studentProfileId_skillId_key" ON "StudentSkill"("studentProfileId", "skillId");

-- CreateIndex
CREATE INDEX "StudentSkill_studentProfileId_idx" ON "StudentSkill"("studentProfileId");

-- CreateIndex
CREATE INDEX "StudentSkill_skillId_idx" ON "StudentSkill"("skillId");

-- AddForeignKey
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: enforce canonical lowercase, trimmed, non-empty normalizedName
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_normalizedName_check" CHECK ("normalizedName" = LOWER(TRIM("normalizedName")) AND "normalizedName" <> '');

-- Data Migration: Migrate existing array skills into normalized Skill and StudentSkill records
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'StudentProfile' AND column_name = 'skills'
    ) THEN
        INSERT INTO "Skill" ("id", "name", "normalizedName", "createdAt", "updatedAt")
        SELECT
            gen_random_uuid()::TEXT AS "id",
            skill_raw AS "name",
            LOWER(TRIM(skill_raw)) AS "normalizedName",
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM (
            SELECT DISTINCT TRIM(skill_item) AS skill_raw
            FROM "StudentProfile",
                 LATERAL UNNEST("skills") AS skill_item
            WHERE TRIM(skill_item) <> ''
        ) s
        ON CONFLICT ("normalizedName") DO NOTHING;

        INSERT INTO "StudentSkill" ("id", "studentProfileId", "skillId", "createdAt")
        SELECT
            gen_random_uuid()::TEXT AS "id",
            p."id" AS "studentProfileId",
            sk."id" AS "skillId",
            CURRENT_TIMESTAMP
        FROM "StudentProfile" p,
             LATERAL UNNEST(p."skills") AS raw_skill
        JOIN "Skill" sk ON LOWER(TRIM(raw_skill)) = sk."normalizedName"
        WHERE TRIM(raw_skill) <> ''
        ON CONFLICT ("studentProfileId", "skillId") DO NOTHING;

        -- Drop legacy denormalized skills array column
        ALTER TABLE "StudentProfile" DROP COLUMN IF EXISTS "skills";
    END IF;
END $$;
