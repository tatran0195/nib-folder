import { z } from 'zod';

const path = z.string().trim().max(512);
const boundedDimension = z.string().trim().max(120);

export const consentStateSchema = z.enum(['denied', 'granted', 'not_required', 'unknown']);
export type ConsentState = z.infer<typeof consentStateSchema>;

export const readerPayload = z
  .object({
    name: z.enum(['page_view', 'page_engaged', 'navigation_clicked', 'cta_clicked', 'outbound_link_clicked', 'code_copied']),
    path: path.optional(),
    targetPath: path.optional(),
    placement: boundedDimension.optional(),
    referrer: z.string().trim().max(512).optional(),
    language: z.string().trim().max(35).optional(),
    engagementMs: z.number().int().min(0).max(86_400_000).optional(),
    scrollDepth: z.number().int().min(0).max(100).optional(),
    utmSource: boundedDimension.optional(),
    utmMedium: boundedDimension.optional(),
    utmCampaign: boundedDimension.optional(),
    utmContent: boundedDimension.optional(),
    utmTerm: boundedDimension.optional(),
  })
  .strict();

export const publicSearchPayload = z
  .object({
    name: z.literal('search_result_clicked'),
    query: z.string().trim().max(200).optional(),
    path: path.optional(),
    language: z.string().trim().max(35).optional(),
    resultCount: z.number().int().min(0).max(10_000).optional(),
    resultPosition: z.number().int().min(1).max(1000).optional(),
    resultId: boundedDimension.optional(),
    latencyMs: z.number().int().min(0).max(3_600_000).optional(),
    cacheStatus: z.enum(['bypass', 'hit', 'miss', 'stale', 'unknown']).optional(),
    noAnswerReason: z.enum(['empty_corpus', 'filtered', 'low_confidence', 'no_match', 'policy', 'provider_error', 'unknown']).optional(),
  })
  .strict();

export const feedbackPayload = z
  .object({
    name: z.literal('feedback_submitted'),
    path: path.optional(),
    feedback: z.enum(['helpful', 'not_helpful']),
    target: z.enum(['answer', 'page', 'search']),
  })
  .strict();

const analyticsEventBase = {
  eventId: z.string().trim().min(1).max(128).optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  consentState: consentStateSchema.default('unknown'),
  sessionId: z.string().trim().min(1).max(128).optional(),
  anonymousUserId: z.string().trim().min(1).max(128).optional(),
};

export const publicAnalyticsEventSchema = z
  .object({
    ...analyticsEventBase,
    payload: z.union([readerPayload, publicSearchPayload, feedbackPayload]),
  })
  .strict();

export type PublicAnalyticsEvent = z.infer<typeof publicAnalyticsEventSchema>;
