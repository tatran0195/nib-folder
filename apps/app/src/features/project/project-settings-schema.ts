import type { MessageKey } from '@nibleaf/i18n';
import {
  Archive,
  Bell,
  Blocks,
  Braces,
  CirclePlus,
  GitBranch,
  Globe2,
  Import,
  KeyRound,
  Languages,
  LockKeyhole,
  type LucideIcon,
  Plug,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react';

export type SettingsGroupId = 'site' | 'deployment' | 'workspace' | 'advanced';

export type ProjectSectionId =
  | 'general'
  | 'languages'
  | 'domain'
  | 'authentication'
  | 'search'
  | 'addons'
  | 'git'
  | 'openapi'
  | 'contentImport'
  | 'members'
  | 'apiKeys'
  | 'integrations'
  | 'notifications'
  | 'exports'
  | 'danger';

export const GROUPS = [
  { id: 'site', labelKey: 'settings.group.site' },
  { id: 'deployment', labelKey: 'settings.group.deployment' },
  { id: 'workspace', labelKey: 'settings.group.workspace' },
  { id: 'advanced', labelKey: 'settings.group.advanced' },
] as const satisfies ReadonlyArray<{ id: SettingsGroupId; labelKey: MessageKey }>;

export const SECTIONS = [
  { id: 'general', group: 'site', icon: CirclePlus },
  { id: 'languages', group: 'site', icon: Languages },
  { id: 'domain', group: 'site', icon: Globe2 },
  { id: 'authentication', group: 'site', icon: LockKeyhole },
  { id: 'search', group: 'site', icon: Search },
  { id: 'addons', group: 'site', icon: Blocks },
  { id: 'git', group: 'deployment', icon: GitBranch },
  { id: 'openapi', group: 'deployment', icon: Braces },
  { id: 'contentImport', group: 'deployment', icon: Import },
  { id: 'members', group: 'workspace', icon: Users },
  { id: 'apiKeys', group: 'workspace', icon: KeyRound },
  { id: 'integrations', group: 'workspace', icon: Plug },
  { id: 'notifications', group: 'workspace', icon: Bell },
  { id: 'exports', group: 'advanced', icon: Archive },
  { id: 'danger', group: 'advanced', icon: TriangleAlert },
] as const satisfies ReadonlyArray<{ id: ProjectSectionId; group: SettingsGroupId; icon: LucideIcon }>;

export const isProjectSectionId = (value: unknown): value is ProjectSectionId => SECTIONS.some((section) => section.id === value);
