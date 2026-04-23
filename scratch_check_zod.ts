import { z } from 'zod'
const TicketInsertSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().default(''),
  status: z.string().min(1)
}).passthrough()

const TicketUpdateSchema = TicketInsertSchema.partial().extend({
  id: z.string().optional()
})

const result = TicketUpdateSchema.safeParse({ status: 'done' })
console.log(result.data)
