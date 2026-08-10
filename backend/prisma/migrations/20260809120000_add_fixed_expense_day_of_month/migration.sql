ALTER TABLE "fixed_expenses" ADD COLUMN "dayOfMonth" INTEGER;

UPDATE "fixed_expenses"
SET "dayOfMonth" = EXTRACT(DAY FROM COALESCE("lastGeneratedDueDate", "createdAt"))::INTEGER
WHERE "recurrence" = 'MONTHLY';
