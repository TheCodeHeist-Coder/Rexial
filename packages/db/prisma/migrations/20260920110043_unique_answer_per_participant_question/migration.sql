-- One answer per participant per question.
--
-- A reconnecting participant is replayed the live question, so without this
-- they could submit a second time and be scored twice. The application also
-- checks, but two submissions landing in the same instant can both pass that
-- check; only the database can settle the race.

-- Collapse any pre-existing duplicates first, keeping the earliest answer,
-- which is the one the participant actually gave first.
DELETE FROM "ParticipantAnswer" a
USING "ParticipantAnswer" b
WHERE a."participantId" = b."participantId"
  AND a."questionId"    = b."questionId"
  AND (a."createdAt" > b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

CREATE UNIQUE INDEX "ParticipantAnswer_participantId_questionId_key"
    ON "ParticipantAnswer" ("participantId", "questionId");
