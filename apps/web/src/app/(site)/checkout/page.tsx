'use client';

import { useState, type FormEvent } from 'react';
import { createCheckoutSchema, formatMoney } from '@zhs/shared';
import { useCart } from '@/components/cart-provider';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

const FIELD =
  'w-full border border-rule bg-paper-raised px-4 py-3 font-ui text-small text-ink ' +
  'placeholder:text-ink-muted focus:border-ink focus:outline-none';

/** A short list at launch; expand once fulfilment zones are confirmed. */
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AU', name: 'Australia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
];

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function CheckoutPage() {
  const { cart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const payload = {
      email: data.get('email'),
      shippingAddress: {
        name: data.get('name'),
        line1: data.get('line1'),
        line2: data.get('line2') || undefined,
        city: data.get('city'),
        region: data.get('region') || undefined,
        postalCode: data.get('postalCode'),
        country: data.get('country'),
        phone: data.get('phone') || undefined,
      },
      customerNote: data.get('customerNote') || undefined,
      subscribeToNewsletter: data.get('subscribeToNewsletter') === 'on',
    };

    // Validated against the same schema the API uses, so the two cannot
    // disagree. The server validates again regardless.
    const parsed = createCheckoutSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.paymentLink) {
        setMessage(result?.message ?? 'Could not start checkout. Please try again.');
        setSubmitting(false);
        return;
      }

      // Hand off to Flutterwave's hosted page. We never see a card number.
      window.location.href = result.paymentLink as string;
    } catch {
      setMessage('Could not reach the shop. Please try again.');
      setSubmitting(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="shell py-24">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="mt-4 text-display">There is nothing to check out.</h1>
        <HandDrawnRule className="mt-5 max-w-[200px] text-terracotta" />
        <div className="mt-8">
          <Button href="/shop">Visit the shop</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-16 md:py-24">
      <Eyebrow>Checkout</Eyebrow>
      <h1 className="mt-4 text-display">Where should it go?</h1>
      <HandDrawnRule className="mt-5 max-w-[200px] text-terracotta" />

      <div className="mt-12 grid gap-16 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <Field label="Email" id="email" error={errors.email}>
            <input id="email" name="email" type="email" required autoComplete="email" className={FIELD} />
          </Field>

          <Field label="Full name" id="name" error={errors['shippingAddress.name']}>
            <input id="name" name="name" type="text" required autoComplete="name" className={FIELD} />
          </Field>

          <Field label="Address" id="line1" error={errors['shippingAddress.line1']}>
            <input
              id="line1"
              name="line1"
              type="text"
              required
              autoComplete="address-line1"
              className={FIELD}
            />
          </Field>

          <Field label="Apartment, suite (optional)" id="line2">
            <input id="line2" name="line2" type="text" autoComplete="address-line2" className={FIELD} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="City" id="city" error={errors['shippingAddress.city']}>
              <input id="city" name="city" type="text" required autoComplete="address-level2" className={FIELD} />
            </Field>
            <Field label="State / region" id="region">
              <input id="region" name="region" type="text" autoComplete="address-level1" className={FIELD} />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Postal code" id="postalCode" error={errors['shippingAddress.postalCode']}>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                required
                autoComplete="postal-code"
                className={FIELD}
              />
            </Field>
            <Field label="Country" id="country" error={errors['shippingAddress.country']}>
              <select id="country" name="country" required defaultValue="US" autoComplete="country" className={FIELD}>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Phone (optional)" id="phone">
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={FIELD} />
          </Field>

          <Field label="Note (optional)" id="customerNote">
            <textarea id="customerNote" name="customerNote" rows={3} className={FIELD} />
          </Field>

          <label className="flex items-start gap-3 text-small">
            <input type="checkbox" name="subscribeToNewsletter" className="mt-1" />
            <span className="text-ink-muted">
              Email me about new titles and issues. No more than once a month.
            </span>
          </label>

          {message ? (
            <p role="alert" className="text-small text-danger">
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Taking you to payment…' : 'Continue to payment'}
          </Button>

          <p className="text-caption text-ink-muted">
            Payment is handled by Flutterwave on their own secure page. ZHS Press never sees your
            card details.
          </p>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="eyebrow">Your order</h2>
          <ul className="mt-5 divide-y divide-rule border-y border-rule">
            {cart.lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-4 py-3">
                <span className="text-small">
                  {line.title}
                  <span className="text-ink-muted"> × {line.quantity}</span>
                </span>
                <span className="whitespace-nowrap text-small">
                  {formatMoney(line.lineTotalCents, cart.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex justify-between">
            <span className="text-small text-ink-muted">Subtotal</span>
            <span className="text-small">{formatMoney(cart.subtotalCents, cart.currency)}</span>
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            Shipping is added on the next step, once we know where it is going.
          </p>
        </aside>
      </div>
    </div>
  );
}
