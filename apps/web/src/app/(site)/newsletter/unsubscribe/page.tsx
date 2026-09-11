import type { Metadata } from 'next';
import { NewsletterTokenAction } from '@/components/newsletter-token-action';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
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
          action="unsubscribe"
          token={token ?? ''}
          copy={{
            heading: 'Leaving the list',
            intro: 'Confirm below and we will stop emailing you. No hard feelings.',
            action: 'Unsubscribe me',
            doneHeading: 'Done — you are off the list.',
            doneBody:
              'We will not email you again. If this was a mistake, you can sign up again from the foot of any page.',
          }}
        />
      </div>
    </div>
  );
}
