import { z } from 'zod';

export const governanceSheetHeaderSchema = z.tuple([
  z.literal('Agenda Item Number'),
  z.literal('Submitted/Revision Date'),
  z.literal('Subject'),
  z.literal('Discussion'),
]);

export const governancePendingAgendaItemSchema = z.object({
  agendaItemNumber: z.string(),
  submittedRevisionDate: z.string(),
  subject: z.string(),
  discussion: z.string(),
});

export type GovernancePendingAgendaItem = z.infer<typeof governancePendingAgendaItemSchema>;

export const governanceApiPayloadSchema = z.object({
  sourceUrl: z.string(),
  lastUpdated: z.string(),
  items: z.array(governancePendingAgendaItemSchema),
  error: z.string().optional(),
});

export type GovernanceApiPayload = z.infer<typeof governanceApiPayloadSchema>;
