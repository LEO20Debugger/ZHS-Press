import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ProductGrid, productHref } from '@/components/product-card';
import { accentStyle, Eyebrow, HandDrawnRule, Section } from '@/components/primitives';
import { getLatestIssue, listIssues } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'LIGHT magazine',
  description:
    'LIGHT is a literary arts magazine about health, creativity and storytelling, published by ZHS Press.',
};

export default async function MagazinePage() {
  /*
    Which issue leads the page is an editorial decision made in the admin, with
    an optional last day — not the newest issue by number. So it is fetched
    rather than derived, and null is an ordinary answer: between issues, or
    once a window has closed, the page simply opens on the listing.
  */
  const [issues, latest] = await Promise.all([listIssues(), getLatestIssue()]);
  const current = issues.filter((issue) => issue.status !== 'sold_out');
  const archive = issues.filter((issue) => issue.status === 'sold_out');

  /*
    Bands alternate tone, and which bands render depends on what is in print
    and on whether an editor has set a headline, so each takes whichever tone
    the section above it did not.
  */
  const currentTone = latest ? 'paper' : 'deep';
  const archiveTone = current.length > 0 ? (latest ? 'deep' : 'paper') : currentTone;

  return (
    <>
      <div className="shell py-16 md:py-24">
        {/*
          The masthead line: the title set as the wordmark — display serif
          italic, mixed case — against the small-caps descriptor. Italic in the
          eyebrow's own sans would just read as a wobble at this size, so the
          word steps out of the eyebrow's casing and tracking entirely.
        */}
        <Eyebrow>
          <em className="font-display text-body italic normal-case tracking-normal text-ink">
            LIGHT
          </em>
          <span className="mx-2">/</span>A ZHS Press publication
        </Eyebrow>
        <h1 className="mt-4 max-w-3xl text-display">
          A magazine for the things that stay with us.
        </h1>
        <HandDrawnRule className="mt-5 max-w-[220px] text-ink-blue" />
        <p className="prose-editorial mt-6">
          <em>LIGHT</em> is ZHS Press&rsquo;s literary arts magazine, bringing together writing and
          creative work around themes of health, creativity, storytelling, and the ways we make
          sense of being human. Each issue brings together new perspectives, thoughtful work, and
          creative voices around a central theme.
        </p>
      </div>

      {latest ? (
        <Section tone="deep">
          {/* The accent scopes to this band, so the cover sits on its own tint. */}
          <div
            style={accentStyle(latest.accent)}
            className="grid items-center gap-10 md:grid-cols-[0.8fr_1fr] lg:gap-16"
          >
            {/*
              The cover leads on the left and is capped, because its height
              follows from its width — an uncapped column makes the artwork
              taller than the fold and the crop reads as a fault.

              The mount is always rendered, never conditional on there being an
              artwork. An issue with no cover uploaded then reads as missing
              artwork, which is what it is, instead of collapsing to a
              text-only band that looks exactly like the feature not shipping.
            */}
            <Link
              href={productHref(latest)}
              className="order-1 block w-full max-w-[320px] md:order-none"
            >
              <div className="cover-mount bg-accent-tint">
                {latest.coverImage ? (
                  <Image
                    src={latest.coverImage.url}
                    alt={latest.coverImage.alt}
                    width={latest.coverImage.width ?? 896}
                    height={latest.coverImage.height ?? 1200}
                    sizes="(min-width: 768px) 320px, 80vw"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center font-display text-h3 italic text-ink-muted">
                    {latest.title}
                  </div>
                )}
              </div>
            </Link>

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
                  {latest.purchasable ? 'Shop the issue' : 'Read about the issue'} →
                </Link>
                {archive.length > 0 ? (
                  <Link href="#archive" className="link-underline text-small font-medium">
                    Explore the archive →
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {/*
        Every issue still in print, the headline one included. It appears twice
        by design: once as the editor's headline, once in its place in the run.
        A reader scanning the list should not find a gap where the issue they
        just read about ought to be.
      */}
      <Section tone={currentTone}>
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
        <Section id="archive" tone={archiveTone} className="scroll-mt-20">
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
