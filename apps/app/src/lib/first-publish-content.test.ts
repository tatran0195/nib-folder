import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blogEntry } from './blog';
import { articleHead } from './blog-seo';

const articles = import.meta.glob<string>(
  ['../content/blog/introducing-nibleaf-open-source-mintlify-alternative.mdx', '../content/blog/self-host-documentation-site-docker-compose.mdx'],
  { eager: true, query: '?raw', import: 'default' },
);
const intro = Object.entries(articles).find(([file]) => file.includes('introducing-nibleaf'))?.[1] ?? '';
const selfHost = Object.entries(articles).find(([file]) => file.includes('self-host-documentation'))?.[1] ?? '';

describe('alternatives and self-hosting first-publish content', () => {
  it('uses one source-specific activation bridge in each existing canonical article', () => {
    expect(intro.match(/<FirstPublishBridge source="mintlify_introduction" \/>/gu)).toHaveLength(1);
    expect(selfHost.match(/<FirstPublishBridge source="docker_compose_guide" \/>/gu)).toHaveLength(1);
    expect(`${intro}${selfHost}`.match(/<FirstPublishBridge/gu)).toHaveLength(2);
    expect(intro).toContain('/compare/nibleaf-vs-mintlify');
    expect(selfHost).toContain('/self-hosting');
  });

  it('keeps canonical Article and FAQ structured data on both slugs', () => {
    for (const slug of ['introducing-nibleaf-open-source-mintlify-alternative', 'self-host-documentation-site-docker-compose']) {
      const entry = blogEntry(slug);
      if (!entry) throw new Error(`${slug} is missing from the blog manifest.`);
      const head = articleHead(entry);
      const canonical = head.links.find((link) => link.rel === 'canonical');
      expect(canonical?.href).toMatch(new RegExp(`/blog/${slug}$`, 'u'));
      const structuredTypes = head.scripts.map((script) => JSON.parse(script.children)['@type']);
      expect(structuredTypes).toEqual(expect.arrayContaining(['Article', 'FAQPage']));
    }
  });

  it('ships durable English and Arabic/RTL product evidence', () => {
    expect(existsSync(new URL('../../public/images/first-publish/editor-en.png', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../../public/images/first-publish/dashboard-ar-rtl.jpg', import.meta.url))).toBe(true);
    expect(intro).toContain('/images/first-publish/dashboard-ar-rtl.jpg');
    expect(intro).toContain('right-to-left');
  });
});
