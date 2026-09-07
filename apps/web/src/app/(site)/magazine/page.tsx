import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-card';
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

  return (
    <>
      <div className="shell py-16 md:py-24">
        <Eyebrow>The magazine</Eyebrow>
        <h1 className="mt-4 font-display text-hero italic">Light</h1>
        <HandDrawnRule className="mt-5 max-w-[220px] text-ink-blue" />
        <p className="prose-editorial mt-6">
          A literary arts magazine about health, creativity and storytelling. Two themed issues a
          year, drawn from an open call, with work from writers and artists in St.&nbsp;Louis and
          well beyond it.
        </p>
        <p className="prose-editorial mt-4 text-ink-muted">
          <em>Light</em> is published by ZHS Press. Every issue is sold here, in the same shop as
          our books and stationery.
        </p>
      </div>

      <Section tone="deep">
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
        <Section tone="paper">
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
