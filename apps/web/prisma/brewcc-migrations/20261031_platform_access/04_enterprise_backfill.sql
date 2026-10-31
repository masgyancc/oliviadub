-- BrewCC: every workspace owned by an approved user runs on enterprise (self-hosted, internal use).
-- Same values as lib/brewcc/enterprise-plan.ts. Safe to re-run.
UPDATE `Project` p
SET p.`plan` = 'enterprise', p.`planTier` = 1,
    p.`usageLimit` = 1000000000, p.`linksLimit` = 1000000000, p.`domainsLimit` = 1000,
    p.`tagsLimit` = 1000000, p.`foldersLimit` = 1000000, p.`usersLimit` = 1000,
    p.`aiLimit` = 1000000, p.`trialEndsAt` = NULL
WHERE p.`plan` <> 'enterprise'
  AND EXISTS (
    SELECT 1 FROM `ProjectUsers` pu JOIN `User` u ON u.`id` = pu.`userId`
    WHERE pu.`projectId` = p.`id` AND pu.`role` = 'owner' AND u.`status` = 'approved'
  );
