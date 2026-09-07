import type { Metadata } from 'next';
import { Eyebrow, HandDrawnRule, Section } from '@/components/primitives';
import { SubmissionForm } from '@/components/submission-form';

export const metadata: Metadata = {
  title: 'Submissions',
  description:
    'ZHS Press accepts manuscripts and author pitches for fiction, non-fiction, children’s books and literary work.',
};

/**
 * Brief 2.5. A clean one-pager is explicitly sufficient at launch — what
 * matters is that the page exists and the form works.
 *
 * Rates and selection criteria are to be supplied separately by the Publishing
 * Associate; the sections are marked below so it is obvious what is still
 * placeholder rather than approved copy.
 */
export default function SubmissionsPage() {
  return (
    <>
      <div className="shell py-16 md:py-24">
        <Eyebrow>Submissions</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-display">We read every submission.</h1>
        <HandDrawnRule className="mt-6 max-w-[240px] text-terracotta" />
        <p className="prose-editorial mt-6">
          ZHS Press accepts manuscripts and pitches year round. You do not need an agent, and you
          do not need to have been published before. We are a small team, so a reply usually takes
          six to eight weeks.
        </p>
      </div>

      <Section tone="deep">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-h1">What we publish</h2>
            <ul className="prose-editorial mt-5 space-y-2">
              <li>Fiction</li>
              <li>Non-fiction</li>
              <li>Children&rsquo;s books, picture books through middle grade</li>
              <li>Poetry and literary work, including for Light</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-h1">Rates and selection</h2>
            {/* PLACEHOLDER — awaiting approved copy from the Publishing Associate. */}
            <p className="prose-editorial mt-5 text-ink-muted">
              Details of our rates and how we select work will be published here shortly. In the
              meantime, send your pitch and we will reply with terms if we would like to read more.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <div className="max-w-2xl">
          <h2 className="font-display text-h1">Send us your work</h2>
          <p className="prose-editorial mt-4 text-ink-muted">
            A short synopsis is enough to start. Please do not send a full manuscript until we ask.
          </p>
          <div className="mt-10">
            <SubmissionForm />
          </div>
          <p className="mt-8 text-small text-ink-muted">
            Prefer email? Write to{' '}
            <a href="mailto:submissions@zhspress.org" className="link-underline">
              submissions@zhspress.org
            </a>
            .
          </p>
        </div>
      </Section>
    </>
  );
}
