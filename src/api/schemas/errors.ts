import { z } from 'zod';

/**
 * The stand answers every validation failure in one shape, `{"errors": {"<field>": ["<text>"]}}`:
 * measured on the editor 422, on a wrong login and on an unknown article slug.
 */
export const ValidationErrorSchema = z.object({
  errors: z.record(z.string(), z.array(z.string())),
});
