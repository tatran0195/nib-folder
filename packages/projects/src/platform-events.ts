import { type Prisma, prisma } from '@nibleaf/database';

export interface TimedActivationEvent {
  createdAt: Date;
  userId: string | null;
}

export interface ActivationTiming {
  readyWithin24Hours: number;
  medianHoursToReady: number | null;
}

export function activationTiming(signups: TimedActivationEvent[], readyEvents: TimedActivationEvent[]): ActivationTiming {
  const signupByUser = new Map<string, number>();
  for (const event of signups) {
    if (!event.userId) {
      continue;
    }
    const timestamp = event.createdAt.getTime();
    const current = signupByUser.get(event.userId);
    if (current === undefined || timestamp < current) {
      signupByUser.set(event.userId, timestamp);
    }
  }

  const firstReadyByUser = new Map<string, number>();
  for (const event of readyEvents) {
    if (!event.userId) {
      continue;
    }
    const signup = signupByUser.get(event.userId);
    const timestamp = event.createdAt.getTime();
    if (signup === undefined || timestamp < signup) {
      continue;
    }
    const current = firstReadyByUser.get(event.userId);
    if (current === undefined || timestamp < current) {
      firstReadyByUser.set(event.userId, timestamp);
    }
  }

  const durations = [...firstReadyByUser].map(([userId, ready]) => ready - (signupByUser.get(userId) ?? ready)).sort((a, b) => a - b);
  if (durations.length === 0) {
    return { medianHoursToReady: null, readyWithin24Hours: 0 };
  }

  const middle = Math.floor(durations.length / 2);
  const medianMs = durations.length % 2 === 0 ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2 : (durations[middle] ?? 0);
  const medianHoursToReady = Math.round((medianMs / (60 * 60 * 1000)) * 10) / 10;
  const readyWithin24Hours = durations.filter((duration) => duration <= 24 * 60 * 60 * 1000).length;
  return { medianHoursToReady, readyWithin24Hours };
}

export interface PlatformEventInput {
  userId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget platform event. Never throws and never blocks the caller. */
export function logPlatformEvent(type: string, input: PlatformEventInput = {}): void {
  void prisma.platformEvent
    .create({
      data: {
        type,
        userId: input.userId ?? null,
        projectId: input.projectId ?? null,
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      },
    })
    .catch(() => undefined);
}

/** Record the FIRST content edit a user makes in a project (create or update). */
export function logFirstContentEdit(userId: string, projectId: string): void {
  void (async () => {
    const existing = await prisma.platformEvent.findFirst({ where: { type: 'page_edited', userId, projectId }, select: { id: true } });
    if (existing) return;
    await prisma.platformEvent.createMany({
      data: { id: `page-edited:${userId}:${projectId}`, type: 'page_edited', userId, projectId },
      skipDuplicates: true,
    });
  })().catch(() => undefined);
}

const FIRST_PUBLISH_SOURCES = ['docker_compose_guide', 'mintlify_introduction', 'rtl_readiness_grader'] as const;
type FirstPublishSource = (typeof FIRST_PUBLISH_SOURCES)[number];
type FirstPublishStage = 'editor_entered' | 'project_entered' | 'publish_ready';

export async function recordFirstPublishStage(input: {
  stage: FirstPublishStage;
  properties: { entry_point: 'organic_content' | 'free_tool'; intent: 'first_publish'; source: FirstPublishSource };
}): Promise<void> {
  await prisma.platformEvent.create({
    data: {
      type: input.stage,
      userId: null,
      projectId: null,
      metadata: input.properties,
    },
  });
}

interface FirstPublishSourceJourney {
  source: FirstPublishSource;
  landingViews: number;
  ctaClicks: number;
  projectEntered: number;
  editorEntered: number;
  ready: number;
}

export interface ActivationFunnel {
  days: number;
  signups: number;
  edited: number;
  published: number;
  ready: number;
  readyWithin24Hours: number;
  medianHoursToReady: number | null;
  sourceJourneys: FirstPublishSourceJourney[];
}

export async function getActivationFunnel(days = 30): Promise<ActivationFunnel> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const distinctUsers = (type: string, userPublishOnly: boolean) =>
    prisma.platformEvent.findMany({
      where: {
        type,
        createdAt: { gte: since },
        userId: { not: null },
        ...(userPublishOnly ? { metadata: { path: ['auto'], equals: false } } : {}),
      },
      distinct: ['userId'],
      select: { userId: true },
    });
  const [signups, edited, published, ready, signupEvents, readyEvents, sourceEvents] = await Promise.all([
    prisma.platformEvent.count({ where: { type: 'signup_completed', createdAt: { gte: since } } }),
    distinctUsers('page_edited', false),
    distinctUsers('publish_clicked', true),
    distinctUsers('publish_ready', true),
    prisma.platformEvent.findMany({
      where: { type: 'signup_completed', createdAt: { gte: since }, userId: { not: null } },
      select: { userId: true, createdAt: true },
    }),
    prisma.platformEvent.findMany({
      where: { type: 'publish_ready', createdAt: { gte: since }, userId: { not: null }, metadata: { path: ['auto'], equals: false } },
      select: { userId: true, createdAt: true },
    }),
    prisma.platformEvent.findMany({
      where: {
        type: { in: ['first_publish_landing_viewed', 'first_publish_cta_clicked', 'project_entered', 'editor_entered', 'publish_ready'] },
        createdAt: { gte: since },
      },
      select: { type: true, metadata: true },
    }),
  ]);

  const sourceJourneys = FIRST_PUBLISH_SOURCES.map((source) => {
    const attributed = sourceEvents.filter((event) => {
      const metadata = event.metadata as Record<string, unknown> | null;
      return metadata?.source === source;
    });
    return {
      source,
      landingViews: attributed.filter((event) => event.type === 'first_publish_landing_viewed').length,
      ctaClicks: attributed.filter((event) => event.type === 'first_publish_cta_clicked').length,
      projectEntered: attributed.filter((event) => event.type === 'project_entered').length,
      editorEntered: attributed.filter((event) => event.type === 'editor_entered').length,
      ready: attributed.filter((event) => event.type === 'publish_ready').length,
    };
  });

  return {
    days,
    signups,
    edited: edited.length,
    published: published.length,
    ready: ready.length,
    ...activationTiming(signupEvents, readyEvents),
    sourceJourneys,
  };
}
