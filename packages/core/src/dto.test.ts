import { describe, expect, it } from 'vitest';
import { projectResponseDto, serialize, toIsoString } from './dto';

describe('DTO Serialization', () => {
  it('serializes project data and retains declared contract fields', () => {
    const rawProject = {
      id: 'proj_123',
      name: 'Documentation',
      slug: 'docs',
      description: 'The docs site',
      logoUrl: null,
      bannerUrl: null,
      faviconUrl: null,
      subdomain: 'docs',
      customDomain: null,
      customDomainVerified: false,
      visibility: 'PUBLIC',
      organizationId: 'org_abc',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
      // Internal fields that should not cause parsing failure
      secretInternalField: 'should-not-leak',
    };

    const serialized = serialize(projectResponseDto, rawProject);
    expect(serialized.id).toBe('proj_123');
    expect(serialized.name).toBe('Documentation');
    expect(serialized.organizationId).toBe('org_abc');
  });

  it('toIsoString normalizes dates and strings', () => {
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString(undefined)).toBeNull();
    const date = new Date('2026-09-13T10:00:00.000Z');
    expect(toIsoString(date)).toBe('2026-09-13T10:00:00.000Z');
    expect(toIsoString('2026-09-13T10:00:00.000Z')).toBe('2026-09-13T10:00:00.000Z');
  });
});
