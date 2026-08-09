-- UserDailyLikeProgress: helyette UserLikePointWindow (12 órás ablak)
DROP TABLE IF EXISTS "UserDailyLikeProgress";

-- UserDailyActivity.bonusGranted: helyette bonusGrantedCount
ALTER TABLE "UserDailyActivity" DROP COLUMN IF EXISTS "bonusGranted";
