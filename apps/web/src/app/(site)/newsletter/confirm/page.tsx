import type { Metadata } from 'next';
import { NewsletterTokenAction } from '@/components/newsletter-token-action';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

export const metadata: Metadata = {
  title: 'Confirm your subscription',
  // A page reached only from a personal link has no business in an index.
  robots: { index: false, follow: false },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="shell py-20 md:py-28">
      <div className="max-w-xl">
        <Eyebrow>Newsletter</Eyebrow>
        <HandDrawnRule className="mb-8 mt-4 max-w-[180px] text-terracotta" />
        <NewsletterTokenAction
          action="confirm"
          token={token ?? ''}
          copy={{
            heading: 'Almost there',
            intro:
              'One click and you are on the list. We write when there is a new book, an issue of Light, or something new for the desk.',
            action: 'Confirm subscription',
            doneHeading: 'You are on the list.',
            doneBody:
              'Thank you. You will hear from us when there is something worth hearing about — and you can leave at any time from the foot of any email.',
          }}
        />
      </div>
    </div>
  );
}
