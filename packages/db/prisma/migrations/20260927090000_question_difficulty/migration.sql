-- Difficulty of a question, as set by the host or suggested by the AI
-- generator. Existing questions default to Medium.
CREATE TYPE "Difficulty" AS ENUM ('Low', 'Medium', 'High');

ALTER TABLE "Question" ADD COLUMN "difficulty" "Difficulty" NOT NULL DEFAULT 'Medium';
