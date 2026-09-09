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
 * What the wire may carry, as opposed to `ArticleSchema`, which says what the contract requires.
 * A null body parses here and fails there, which is the whole of the fourth case: the response
 * has to reach `expectContract` intact for the helper to report the violation itself.
 */
export const ArticleEnvelopeSchema = z.object({
  article: z.looseObject({
    slug: z.string(),
    title: z.string(),
    author: z.looseObject({ username: z.string() }),
  }),
});

export type NewArticle = z.infer<typeof NewArticleSchema>;

/**
 * The list endpoint answers with articles that carry no `body` at all - the field is absent,
 * not null - so the full contract cannot describe them.
 */
export const ArticleListResponseSchema = z.object({
  articles: z.array(ArticleSchema.omit({ body: true })),
  articlesCount: z.number(),
});
