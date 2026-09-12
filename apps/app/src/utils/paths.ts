export {
  isCustomDomainSite,
  siteBasePath,
  siteHref,
  siteLanguageParam,
} from '@/lib/site-paths';

export function projectPath(projectId: string) {
  return `/app/projects/${projectId}`;
}

export function projectEditorPath(projectId: string, pageId?: string) {
  return pageId ? `/app/projects/${projectId}/editor?page=${pageId}` : `/app/projects/${projectId}/editor`;
}

export function projectPreviewPath(projectId: string) {
  return `/app/projects/${projectId}/preview`;
}

export function projectAnalyticsPath(projectId: string) {
  return `/app/projects/${projectId}/analytics`;
}

export function projectSettingsPath(projectId: string) {
  return `/app/projects/${projectId}/settings`;
}

export function dashboardPath() {
  return '/app';
}

export function dashboardSitesPath() {
  return '/app/sites';
}

export function dashboardAnalyticsPath() {
  return '/app/analytics';
}

export function dashboardMembersPath() {
  return '/app/members';
}

export function dashboardSettingsPath() {
  return '/app/settings';
}

export function loginPath() {
  return '/sign-in';
}

export function registerPath() {
  return '/sign-up';
}
