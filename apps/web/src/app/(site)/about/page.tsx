import type { Metadata } from 'next';
import { renderMarkdown } from '@zhs/shared';
import { Eyebrow, HandDrawnRule, Section } from '@/components/primitives';
import { getEditorialPage } from '@/lib/pages';

const FALLBACK_DESCRIPTION =
  'ZHS Press is an independent press publishing books, Light magazine, and stationery.';

/**
 * Metadata follows the published page when there is one.
 *
 * generateMetadata rather than a static export, because the title and
 * description are now editable — leaving them static would mean the tab title
 * and the search snippet quietly disagreed with the copy on the page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getEditorialPage('about');
  return {
    title: page?.seoTitle ?? page?.title ?? 'About',
    description: page?.seoDescription ?? FALLBACK_DESCRIPTION,
  };
}

export default async function AboutPage() {
  const page = await getEditorialPage('about');

  return (
    <>
      <div className="shell py-16 md:py-24">
        <Eyebrow>About</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-display">
          {page?.title ?? 'A small press, making things worth keeping.'}
        </h1>
        <HandDrawnRule className="mt-6 max-w-[240px] text-terracotta" />

        {/*
          Published copy wins; otherwise the wording below ships as written.

          The HTML comes from renderMarkdown, which escapes its input before
          applying any formatting and can only emit a fixed set of tags — so
          nothing an editor types can introduce markup here. See
          packages/shared/src/markdown.ts.
        */}
        {page ? (
          <div
            className="prose-editorial mt-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }}
          />
        ) : (
        <div className="prose-editorial mt-8">
          <p>
            ZHS Press is an independent publisher working across three things: picture books for
            young readers, a literary arts magazine, and stationery designed with the artists we
            publish.
          </p>
          <p>
            We publish a small number of titles a year, and we are involved in all of them — the
            writing, the illustration, the paper stock, the way a book opens in a child&rsquo;s
            hands. That is the whole reason to run a press this size.
          </p>
        </div>
        )}
      </div>

      <Section tone="deep">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-h1">Light</h2>
            <p className="prose-editorial mt-4 text-ink-muted">
              <em>Light</em> is our literary arts magazine, exploring health, creativity and
              storytelling. It began in 2020 and is now published entirely by ZHS Press.
            </p>
          </div>
          <div>
            <h2 className="font-display text-h1">Working with us</h2>
            <p className="prose-editorial mt-4 text-ink-muted">
              We read manuscripts and pitches year round, and we take on writers who have not been
              published before.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
