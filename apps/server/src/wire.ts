import * as addonsPkg from '@nibleaf/addons';
import * as contentPkg from '@nibleaf/content';
import { deriveTitle, ensureGroupPage, humanize, parseFrontmatter, upsertLeafPage } from '@nibleaf/content';
import { getCurrentSnapshot, invalidatePublishedSiteConfig } from '@nibleaf/deployments';
import * as exportPkg from '@nibleaf/exports';
import * as exportsPkg from '@nibleaf/exports';
import {
  conflictSnapshotMatches,
  decryptGitSecret,
  encryptGitSecret,
  GitHubProvider,
  gitCredentialFingerprint,
  reconcileOwnedFile,
  repositoryOurs,
} from '@nibleaf/git';
import * as workflowPkg from '@nibleaf/git/workflow';
import * as openapiPkg from '@nibleaf/openapi';
import { getDefaultBranch, getDefaultLanguage, logFirstContentEdit, logPlatformEvent } from '@nibleaf/projects';
import { isPrivateIp } from '@/lib/client-ip';

let wired = false;

/**
 * Connects cross-domain dependency injection points according to "Apps wire, packages think".
 * Idempotent: safe to run multiple times during tests or initialization.
 */
export function wireDomainPackages() {
  if (wired) {
    return;
  }
  wired = true;

  // Addons -> Deployments config invalidation
  addonsPkg.setPublishedConfigInvalidator?.(invalidatePublishedSiteConfig);

  // Exports -> Deployments snapshot loading & Projects platform event logging
  exportPkg.setSnapshotLoader?.(getCurrentSnapshot);
  exportsPkg.setPlatformEventLogger?.(logPlatformEvent);

  // OpenAPI -> Private IP security checks
  openapiPkg.setPrivateIpChecker?.(isPrivateIp);

  // Content -> Projects platform event logging
  contentPkg.setContentEditLogger?.(logFirstContentEdit);

  // Git workflow -> Git crypto, providers, snapshot loaders, reconcilers, and content importers
  workflowPkg.setGitCrypto?.({ decryptGitSecret, encryptGitSecret, gitCredentialFingerprint });
  workflowPkg.setGitProviderClass?.(GitHubProvider);
  workflowPkg.setGitSnapshotLoader?.(getCurrentSnapshot);
  workflowPkg.setGitReconciler?.({ conflictSnapshotMatches, reconcileOwnedFile, repositoryOurs });
  workflowPkg.setGitBranchResolver?.({ getDefaultBranch, getDefaultLanguage });
  workflowPkg.setGitContentImporter?.({ deriveTitle, ensureGroupPage, humanize, parseFrontmatter, upsertLeafPage });
}
