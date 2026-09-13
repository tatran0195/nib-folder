-- DropForeignKey
ALTER TABLE "usage_plan_meter" DROP CONSTRAINT IF EXISTS "usage_plan_meter_planId_fkey";
ALTER TABLE "usage_plan_meter" DROP CONSTRAINT IF EXISTS "usage_plan_meter_meterId_fkey";
ALTER TABLE "usage_entitlement" DROP CONSTRAINT IF EXISTS "usage_entitlement_planId_fkey";
ALTER TABLE "usage_entitlement" DROP CONSTRAINT IF EXISTS "usage_entitlement_meterId_fkey";
ALTER TABLE "organization_usage_plan" DROP CONSTRAINT IF EXISTS "organization_usage_plan_organizationId_fkey";
ALTER TABLE "organization_usage_plan" DROP CONSTRAINT IF EXISTS "organization_usage_plan_planId_fkey";
ALTER TABLE "usage_storage_marker" DROP CONSTRAINT IF EXISTS "usage_storage_marker_organizationId_fkey";
ALTER TABLE "usage_ingest_checkpoint" DROP CONSTRAINT IF EXISTS "usage_ingest_checkpoint_organizationId_fkey";
ALTER TABLE "usage_ingest_checkpoint" DROP CONSTRAINT IF EXISTS "usage_ingest_checkpoint_projectId_fkey";

-- DropTable
DROP TABLE IF EXISTS "usage_ingest_checkpoint";
DROP TABLE IF EXISTS "usage_storage_marker";
DROP TABLE IF EXISTS "usage_provider_checkpoint";
DROP TABLE IF EXISTS "organization_usage_plan";
DROP TABLE IF EXISTS "usage_entitlement";
DROP TABLE IF EXISTS "usage_plan_meter";
DROP TABLE IF EXISTS "usage_meter";
DROP TABLE IF EXISTS "usage_plan";
