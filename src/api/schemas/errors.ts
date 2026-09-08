import { z } from 'zod';

export const ValidationErrorSchema = z.object({
  errors: z.record(z.string(), z.array(z.string())),
});
