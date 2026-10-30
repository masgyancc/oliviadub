-- BrewCC backfill. Run immediately after 01_up.sql and BEFORE deploying the new code.
-- 1) Every account that existed before the approval system keeps full access.
-- 2) The two confirmed accounts become master admins (confirmed by the owner on 2026-10-31):
--      user_1M671R5CJ5VVPFB9DX7DR9WZX  (oliviaevergarden44@gmail.com)
--      user_1M672MTTBZAB47QVRF0SAVXJ3  (ameeragin4@gmail.com)

-- Run right after 01_up.sql: anyone who signs up after this point stays "pending".
UPDATE `User`
SET `status` = 'approved', `statusUpdatedAt` = CURRENT_TIMESTAMP(3)
WHERE `status` = 'pending';

UPDATE `User`
SET `platformRole` = 'master_admin'
WHERE `id` IN ('user_1M671R5CJ5VVPFB9DX7DR9WZX', 'user_1M672MTTBZAB47QVRF0SAVXJ3');

-- Verify (expect every existing user approved, exactly 2 master admins):
-- SELECT id, email, platformRole, status FROM `User` ORDER BY createdAt;
