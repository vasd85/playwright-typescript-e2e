import { z } from 'zod';

export const ArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  // Not nullable on purpose: a null body is the contract violation TC4 demonstrates.
  body: z.string(),
  tagList: z.array(z.string()),
  author: z.object({ username: z.string() }),
});

export const ArticleResponseSchema = z.object({ article: ArticleSchema });

export type Article = z.infer<typeof ArticleSchema>;
