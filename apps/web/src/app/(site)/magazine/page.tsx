import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid, productHref } from '@/components/product-card';
import { Eyebrow, HandDrawnRule, Section } from '@/components/primitives';
import { listIssues } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Light magazine',
  description:
    'Light is a literary arts magazine about health, creativity and storytelling, published by ZHS Press.',
};

export default async function MagazinePage() {
  const issues = await listIssues();
  const current = issues.filter((issue) => issue.status !== 'sold_out');
  const archive = issues.filter((issue) => issue.status === 'sold_out');

  /* The teaser leads with an issue you can still buy, and only falls back to
     the most recent one when nothing is currently in print. */
  const latest = current[0] ?? issues[0] ?? null;

  return (
    <>
      <div className="shell py-16 md:py-24">
        <Eyebrow>Light / A ZHS Press publication</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-display">
          A magazine for the things that stay with us.
        </h1>
        <HandDrawnRule className="mt-5 max-w-[220px] text-ink-blue" />
        <p className="prose-editorial mt-6">
          <em>Light</em> is ZHS Press&rsquo;s literary arts magazine, bringing together writing and
          creative work around themes of health, creativity, storytelling, and the ways we make
          sense of being human. Each issue brings together new perspectives, thoughtful work, and
          creative voices around a central theme.
        </p>
        <p className="prose-editorial mt-4 text-ink-muted">
          <em>Light</em> is published by ZHS Press. Every issue is sold here, in the same shop as
          our books and stationery.
        </p>

        {/*
          An in-page jump rather than a link to /magazine — that is this page.
          What "explore Light" means here is the issues listed below.
        */}
        <p className="mt-6">
          <Link href="#current-issues" className="link-underline text-small font-medium">
            Explore <em>Light</em> →
          </Link>
        </p>
      </div>

      {latest ? (
        <Section tone="deep">
          <div className="max-w-2xl">
            <Eyebrow>The latest issue</Eyebrow>
            <h2 className="mt-3 font-display text-h1">
              {latest.title}
              {latest.subtitle ? <span className="italic">: {latest.subtitle}</span> : null}
            </h2>
            {latest.blurb ? (
              <p className="prose-editorial mt-4 text-ink-muted">{latest.blurb}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-6">
              <Link href={productHref(latest)} className="link-underline text-small font-medium">
                Shop the issue →
              </Link>
              {archive.length > 0 ? (
                <Link href="#archive" className="link-underline text-small font-medium">
                  Explore the archive →
                </Link>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      <Section id="current-issues" tone={latest ? 'paper' : 'deep'} className="scroll-mt-20">
        <h2 className="font-display text-h1">Current issues</h2>
        <div className="mt-10">
          <ProductGrid products={current} emptyMessage="The next issue is on its way." />
        </div>
      </Section>

      {/*
        Sold-out issues stay listed (brief 2.3). The back catalogue is a large
        part of what makes the magazine worth following, and removing an issue
        the moment it sells out also breaks every link anyone ever shared to it.
      */}
      {archive.length > 0 ? (
        <Section id="archive" tone={latest ? 'deep' : 'paper'} className="scroll-mt-20">
          <h2 className="font-display text-h1">Archive</h2>
          <p className="mt-3 max-w-measure font-editorial text-small text-ink-muted">
            Out of print, but still here to read about.
          </p>
          <div className="mt-10">
            <ProductGrid products={archive} />
          </div>
        </Section>
      ) : null}
    </>
  );
}
