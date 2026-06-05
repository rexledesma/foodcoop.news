import { z } from 'zod';

export const governancePendingAgendaItemSchema = z.object({
  agendaItemNumber: z.string(),
  submittedRevisionDate: z.string(),
  subject: z.string(),
});

export type GovernancePendingAgendaItem = z.infer<typeof governancePendingAgendaItemSchema>;

export const governancePreviousAgendaItemSchema = z.object({
  meetingDate: z.string(),
  minutesUrl: z.string(),
  gazetteUrl: z.string().optional(),
  gazetteTitle: z.string().optional(),
  gazettePreviewImageUrl: z.string().optional(),
  agendaSubjects: z.array(z.string()),
});

export type GovernancePreviousAgendaItem = z.infer<typeof governancePreviousAgendaItemSchema>;

export const governanceApiPayloadSchema = z.object({
  sourceUrl: z.string(),
  lastUpdated: z.string(),
  items: z.array(governancePendingAgendaItemSchema),
  previousItems: z.array(governancePreviousAgendaItemSchema).default([]),
  error: z.string().optional(),
});

export type GovernanceApiPayload = z.infer<typeof governanceApiPayloadSchema>;

const gmEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  url: z.string(),
  startUtc: z.string(),
  timezone: z.string(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  image: z.string().optional(),
});

export const gmEventsApiPayloadSchema = z.object({
  events: z.array(gmEventSchema),
});
