ALTER TABLE "User" ADD COLUMN "roleBeforeModeration" "UserRole",
ADD COLUMN "accessTokenVersion" INTEGER NOT NULL DEFAULT 0;
