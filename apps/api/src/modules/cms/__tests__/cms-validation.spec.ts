import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertArticleDto, UpsertPageDto } from '../cms.module';

/**
 * F-073: an article could be saved with an empty or unusable slug (spaces, slashes, upper case,
 * 500 characters), empty titles, or a javascript: cover; pages could have empty titles/bodies.
 */
const article = {
  slug: 'buying-guide',
  ar_title: 'دليل الشراء',
  en_title: 'Buying guide',
  ar_excerpt: 'مقتطف',
  en_excerpt: 'Excerpt',
  ar_body: '<p>نص</p>',
  en_body: '<p>Body</p>',
};
const page = { slug: 'about', ar_title: 'من نحن', en_title: 'About', ar_body: 'نص', en_body: 'Body' };
const bad = async (cls: new () => object, base: object, patch: Record<string, unknown>) =>
  (await validate(plainToInstance(cls, { ...base, ...patch }))).map((e) => e.property);

describe('UpsertArticleDto', () => {
  it('accepts a normal article, with and without a cover', async () => {
    expect(await bad(UpsertArticleDto, article, {})).toEqual([]);
    expect(await bad(UpsertArticleDto, article, { coverUrl: 'https://cdn.example.com/a.jpg' })).toEqual([]);
  });
  it.each(['', 'a b/c', 'Hello', 'مقال', '-x', 'x'.repeat(81)])('rejects the slug "%s"', async (slug) => {
    expect(await bad(UpsertArticleDto, article, { slug })).toContain('slug');
  });
  it.each(['ar_title', 'en_title', 'ar_excerpt', 'en_excerpt', 'ar_body', 'en_body'])('rejects an empty %s', async (f) => {
    expect(await bad(UpsertArticleDto, article, { [f]: '' })).toContain(f);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', '//evil.test/a.jpg', 'ftp://x.test/a'])('rejects the cover "%s"', async (coverUrl) => {
    expect(await bad(UpsertArticleDto, article, { coverUrl })).toContain('coverUrl');
  });
});

describe('UpsertPageDto', () => {
  it('accepts a normal page and rejects empty titles and bodies', async () => {
    expect(await bad(UpsertPageDto, page, {})).toEqual([]);
    for (const f of ['ar_title', 'en_title', 'ar_body', 'en_body']) {
      expect(await bad(UpsertPageDto, page, { [f]: '' })).toContain(f);
    }
  });
});
