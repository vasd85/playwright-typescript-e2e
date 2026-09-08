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

/** What the editor sends, so a test reads the request body typed instead of casting it. */
export const ArticleRequestSchema = z.object({ article: NewArticleSchema });

/**
 * The response envelope, checking only the fields a test addresses by name. `body` is left out
 * on purpose: the contract helper receives the article as it arrived, and on a fully checked
 * envelope a violation would read `field "article.body"` instead of `field "body"`.
 */
export const ArticleEnvelopeSchema = z.object({
  article: z.looseObject({
    slug: z.string(),
    title: z.string(),
    author: z.looseObject({ username: z.string() }),
  }),
});

export type NewArticle = z.infer<typeof NewArticleSchema>;
