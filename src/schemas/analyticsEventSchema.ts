import { z } from 'zod'

const ALLOWED_EVENT_TYPES = [
  'page_view',
  'view_item',
  'view_item_list',
  'select_item',
  'begin_checkout',
  'generate_lead',
  'sign_up',
  'purchase',
  'agent_copy_link',
] as const

const MAX_METADATA_ENTRIES = 20
const MAX_STRING_LENGTH = 500

export const analyticsEventSchema = z.object({
  type: z.enum(ALLOWED_EVENT_TYPES),
  metadata: z.record(
    z.string().max(100),
    z.union([z.string().max(MAX_STRING_LENGTH), z.number(), z.boolean()])
  ).optional().default({}).refine(
    (obj) => Object.keys(obj).length <= MAX_METADATA_ENTRIES,
    { message: `Metadata no puede tener mas de ${MAX_METADATA_ENTRIES} campos` }
  ),
})

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>
export { ALLOWED_EVENT_TYPES }
