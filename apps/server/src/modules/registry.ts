import type { NibleafModule } from '@nibleaf/core';
import adminRoutes from './admin/handlers';
import activationEvents from './app/activation-events/handlers';
import addons from './app/addons/handlers';
import ai from './app/ai/handlers';
import apiKeys from './app/api-keys/handlers';
import assets from './app/assets/handlers';
import branches from './app/branches/handlers';
import comments from './app/comments/handlers';
import deployments from './app/deployments/handlers';
import domains from './app/domains/handlers';
import exportsHandler from './app/exports/handlers';
import git from './app/git/handlers';
import imports from './app/imports/handlers';
import integrations from './app/integrations/handlers';
import languages from './app/languages/handlers';
import members from './app/members/handlers';
import notifications from './app/notifications/handlers';
import openapi from './app/openapi/handlers';
import pages from './app/pages/handlers';
import projectMembers from './app/project-members/handlers';
import projectSettings from './app/project-settings/handlers';
import projects from './app/projects/handlers';
import readerAccess from './app/reader-access/handlers';
import workspace from './app/workspace/handlers';
import mcp from './mcp';
import publicRoutes from './public';

/**
 * Declarative domain module manifests for Nibleaf.
 * Inspired by Avkash's `AvkashModule` manifest registry (`OPEN_MODULES`).
 *
 * Each module declares its metadata and route mounting hooks, separating
 * module identity and registration from transport assembly.
 */

export const projectsModule: NibleafModule = {
  key: 'projects',
  title: 'Projects',
  description: 'Project lifecycle, branding, domain association, and theme configurations',
  appRoutes: (router) => {
    router.route('/projects', projects);
    router.route('/projects/:projectId/members', projectMembers);
    router.route('/projects/:projectId/settings', projectSettings);
  },
};

export const pagesModule: NibleafModule = {
  key: 'pages',
  title: 'Pages & Content',
  description: 'Document hierarchy, MDX content, navigation ordering, and draft revisions',
  appRoutes: (router) => {
    router.route('/projects/:projectId/pages', pages);
  },
};

export const deploymentsModule: NibleafModule = {
  key: 'deployments',
  title: 'Deployments & Publishing',
  description: 'Immutable snapshot deployments, atomic roll-forward, and redirect graphs',
  appRoutes: (router) => {
    router.route('/projects/:projectId/deployments', deployments);
  },
};

export const domainsModule: NibleafModule = {
  key: 'domains',
  title: 'Custom Domains',
  description: 'Custom domain DNS verification, routing, and SSL configurations',
  appRoutes: (router) => {
    router.route('/projects/:projectId/domains', domains);
  },
};

export const branchesModule: NibleafModule = {
  key: 'branches',
  title: 'Content Branches',
  description: 'Git-style draft branches for isolated documentation editing',
  appRoutes: (router) => {
    router.route('/projects/:projectId/branches', branches);
  },
};

export const exportsModule: NibleafModule = {
  key: 'exports',
  title: 'Content Exports',
  description: 'Markdown ZIP, static HTML, PDF generation, and scheduled archival',
  appRoutes: (router) => {
    router.route('/projects/:projectId/exports', exportsHandler);
  },
};

export const openapiModule: NibleafModule = {
  key: 'openapi',
  title: 'OpenAPI Reference',
  description: 'OpenAPI 3.x document parsing, validation, reference bundling, and interactive docs',
  appRoutes: (router) => {
    router.route('/projects/:projectId/openapi', openapi);
  },
};

export const gitModule: NibleafModule = {
  key: 'git',
  title: 'Git Synchronization',
  description: 'Bidirectional Git integration (GitHub/GitLab), webhooks, and repository synchronization',
  appRoutes: (router) => {
    router.route('/projects/:projectId/git', git);
  },
};

export const integrationsModule: NibleafModule = {
  key: 'integrations',
  title: 'Integrations & Webhooks',
  description: 'Audited external integrations, Slack alerts, and webhooks',
  appRoutes: (router) => {
    router.route('/projects/:projectId/integrations', integrations);
  },
};

export const addonsModule: NibleafModule = {
  key: 'addons',
  title: 'Project Add-ons',
  description: 'Per-project optional capabilities and managed add-on provisioning',
  appRoutes: (router) => {
    router.route('/projects/:projectId/addons', addons);
  },
};

export const aiModule: NibleafModule = {
  key: 'ai',
  title: 'AI & Search Copilot',
  description: 'Multilingual grounded answers, summaries, and search diagnostics',
  appRoutes: (router) => {
    router.route('/projects/:projectId/ai', ai);
  },
};

export const readerAccessModule: NibleafModule = {
  key: 'reader-access',
  title: 'Private Reader Access',
  description: 'Reader audiences, JWT/JWKS portal handoff, and access control',
  appRoutes: (router) => {
    router.route('/projects/:projectId/reader-access', readerAccess);
  },
};

export const importsModule: NibleafModule = {
  key: 'imports',
  title: 'Content Importers',
  description: 'Importers from Mintlify, GitBook, Ghost, and static Markdown',
  appRoutes: (router) => {
    router.route('/projects/:projectId/settings/import', imports);
  },
};

export const languagesModule: NibleafModule = {
  key: 'languages',
  title: 'Multilingual & Locales',
  description: 'Project language management, RTL support, and localized document trees',
  appRoutes: (router) => {
    router.route('/projects/:projectId/languages', languages);
  },
};

export const assetsModule: NibleafModule = {
  key: 'assets',
  title: 'Asset Storage',
  description: 'Project-scoped media uploads and presigned direct storage uploads',
  appRoutes: (router) => {
    router.route('/projects/:projectId/assets', assets);
  },
};

export const commentsModule: NibleafModule = {
  key: 'comments',
  title: 'Anchored Comments',
  description: 'Block-anchored review comments, resolution workflows, and mentions',
  appRoutes: (router) => {
    router.route('/projects/:projectId/comments', comments);
  },
};

export const apiKeysModule: NibleafModule = {
  key: 'api-keys',
  title: 'API Keys',
  description: 'Scoped API key generation, revocation, and authentication credentials',
  appRoutes: (router) => {
    router.route('/projects/:projectId/api-keys', apiKeys);
  },
};

export const workspaceModule: NibleafModule = {
  key: 'workspace',
  title: 'Workspace Operations',
  description: 'Workspace-wide settings, team members, invitations, and alerts',
  appRoutes: (router) => {
    router.route('/workspace', workspace);
    router.route('/members', members);
    router.route('/notifications', notifications);
    router.route('/activation-events', activationEvents);
  },
};

export const publicModule: NibleafModule = {
  key: 'public',
  title: 'Public Reader & Delivery',
  description: 'Published documentation delivery, search retrieval, and assets',
  publicRoutes: (router) => {
    router.route('/', publicRoutes);
  },
};

export const adminModule: NibleafModule = {
  key: 'admin',
  title: 'Platform Operator Admin',
  description: 'Operator panel for customer accounts, sites, roles, and deployments',
  adminRoutes: (router) => {
    router.route('/', adminRoutes);
  },
};

export const mcpModule: NibleafModule = {
  key: 'mcp',
  title: 'Model Context Protocol (MCP)',
  description: 'Read-only scoped MCP tools for documentation projects',
  mcpRoutes: (router) => {
    router.route('/', mcp);
  },
};

export const searchModule: NibleafModule = {
  key: 'search',
  title: 'Search & Indexing',
  description: 'Full-text search, vector embeddings, reindexing pipelines, and diagnostics',
};

export const emailModule: NibleafModule = {
  key: 'email',
  title: 'Transactional Email',
  description: 'Transactional email notifications, invitations, and alerts delivery',
};

/**
 * All active domain modules in Nibleaf.
 * Directly corresponds to Avkash's `OPEN_MODULES` registry.
 */
export const NIBLEAF_MODULES: readonly NibleafModule[] = [
  projectsModule,
  pagesModule,
  deploymentsModule,
  domainsModule,
  branchesModule,
  exportsModule,
  openapiModule,
  gitModule,
  integrationsModule,
  addonsModule,
  aiModule,
  readerAccessModule,
  importsModule,
  languagesModule,
  assetsModule,
  commentsModule,
  apiKeysModule,
  workspaceModule,
  publicModule,
  adminModule,
  mcpModule,
  searchModule,
  emailModule,
] as const;

/** Alias adhering to Avkash convention */
export const OPEN_MODULES: readonly NibleafModule[] = NIBLEAF_MODULES;

/**
 * Introspects registered domain modules and their metadata.
 */
export function getRegisteredModules(): readonly NibleafModule[] {
  return NIBLEAF_MODULES;
}
