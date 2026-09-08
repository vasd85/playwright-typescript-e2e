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

export const NewArticleSchema = z.object({
  title: z.string(),
  description: z.string(),
  body: z.string(),
  tagList: z.array(z.string()),
});

export const ArticleRequestSchema = z.object({ article: NewArticleSchema });

/**
 * Turns a parsed response body into typed values without a cast, and deliberately stops there:
 * both tests hand the article on to `expectContract`, so a schema that rejected a corrupted body
 * here would leave the helper nothing to report.
 */
export const ArticleEnvelopeSchema = z.object({
  article: z.looseObject({
    slug: z.string(),
    title: z.string(),
    author: z.looseObject({ username: z.string() }),
  }),
});

export type NewArticle = z.infer<typeof NewArticleSchema>;
