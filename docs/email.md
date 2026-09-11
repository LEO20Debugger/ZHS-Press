# Email

Seven transactional messages. Nothing marketing, nothing scheduled.

| Message | Sent when | To |
|---|---|---|
| Newsletter confirmation | Someone submits the signup form | The subscriber |
| Newsletter welcome | They click confirm | The subscriber |
| Order receipt | The Flutterwave webhook settles a payment | The customer |
| Order shipped | An order is marked fulfilled in admin | The customer |
| Submission acknowledgement | A manuscript is submitted | The writer |
| Submission alert | Same moment | `PRESS_NOTIFY_EMAIL` |
| Waitlist release | A product's status changes **to** `available` in admin | Everyone on that title's waitlist |

Templates live in [`apps/api/src/mail/templates.ts`](../apps/api/src/mail/templates.ts) as pure
functions. Sending is [`mail.service.ts`](../apps/api/src/mail/mail.service.ts).

## Seeing them

```bash
pnpm mail:preview
```

Writes `apps/api/email-previews/index.html` — every message rendered from the real
template code, with buttons to resize the frames. 280px is a Galaxy Fold cover
screen, which is what the layout is tuned against. Each message's plain-text
alternative is under the "plain text" toggle.

The directory is git-ignored; regenerate it whenever a template changes.

## Configuring a sender

One variable:

```
SMTP_URL="smtps://user:password@smtp.provider.com:465"
```

`smtps://` means implicit TLS and defaults to port 465. `smtp://` means STARTTLS
and defaults to 587. Percent-encode the password if it contains `@ / : +` — an
`@` in a password splits the URL in the wrong place and you get an
authentication failure for a password that looks perfectly correct.

### Resend (recommended)

1. Sign up at [resend.com](https://resend.com) with the address you want the test
   mail to arrive at. That address is the only one you can send to until a
   domain is verified, so it matters which one you use.
2. **API Keys → Create API Key.** Sending permission is enough. Copy it — it is
   shown once.
3. Put it in `.env` (below).
4. `pnpm mail:send-test you@example.com` — see *Proving it works*.

Nothing in the code changes — Resend speaks SMTP, so it is the same one variable.

```
SMTP_URL="smtp://resend:re_YOUR_API_KEY@smtp.resend.com:587"
MAIL_FROM="ZHS Press <onboarding@resend.dev>"
PRESS_NOTIFY_EMAIL="you@your-address.com"
```

The username is the literal word `resend` — not an email address, which is what
every other provider uses. The password is the API key.

**Use port 587, not 465.** Resend documents five ports (465 and 2465 implicit
TLS; 25, 587 and 2587 STARTTLS), but 465 was unreachable when tested from this
project, while 587, 2587 and 2465 all connected. Gmail's 465 worked from the same
machine, so it is not a local block on the port. 587 is the safe default; 2587 is
the fallback if a host blocks 587 too. A wrong choice here hangs rather than
erroring, which is a miserable thing to debug.

**Before a domain is verified**, Resend only lets you send *from*
`onboarding@resend.dev` and only *to* the address the account was registered
with. That is not a limitation for testing here — point `PRESS_NOTIFY_EMAIL` at
that same address and use it at checkout, and every one of the seven messages is
exercisable end to end.

To send to anyone else, add `zhspress.org` in the Resend dashboard and set the
DNS records it gives you. Then `MAIL_FROM` becomes `hello@zhspress.org` and the
restriction lifts. That is also what fixes SPF and DKIM, so it is the same piece
of work as getting receipts out of spam.

### Testing with a personal Gmail account

Workable, but Resend above is less fuss and is what production will use anyway.

1. Turn on 2-Step Verification on the Google account (App Passwords do not exist
   without it).
2. Google Account → Security → App passwords → generate one for "Mail".
3. Use the 16-character app password, **not** the account password:

```
SMTP_URL="smtps://you@gmail.com:abcdefghijklmnop@smtp.gmail.com:465"
MAIL_FROM="ZHS Press <you@gmail.com>"
PRESS_NOTIFY_EMAIL="you@gmail.com"
```

`MAIL_FROM` must be that same Gmail address. Gmail rewrites a From it does not
own, so setting `hello@zhspress.org` here means recipients see your Gmail address
anyway — with a "sent on behalf of" warning that looks like a phishing attempt.

Gmail's limit is roughly 500 recipients a day, which is fine for testing and not
fine for a waitlist. Move to a real sending provider before launch.

### Before launch

Use a provider on the `zhspress.org` domain — Resend, Postmark and SES all work.
What matters is not which one:

- **The From domain must be verified at the provider**, or mail is accepted by
  the relay and then dropped or spam-filed with no error anywhere in our logs.
- **SPF and DKIM must be set** on `zhspress.org`, or receipts land in spam. This
  is DNS, not code.
- Set `MAIL_REPLY_TO` if `MAIL_FROM` is a no-reply address. Someone replying to
  an order receipt is a customer with a question.

## Proving it works

```bash
pnpm mail:send-test you@example.com           # all seven
pnpm mail:send-test you@example.com receipt   # just one
```

Builds the API, reads `SMTP_URL` from `.env`, verifies the connection, then sends
the real templates to a real inbox. Names: `confirm`, `welcome`, `receipt`,
`shipped`, `submission`, `alert`, `waitlist`.

This is the only check that covers what nothing else can. The unit tests prove
the HTML is correct and `pnpm mail:preview` proves it looks correct; neither can
tell you the provider rejected the From address or that the message went to spam.

Read it on a phone once. The preview page's 280px setting approximates a narrow
screen, but it is not a mail client — Gmail and Outlook both re-render what they
are given.

## Running without it

Leaving `SMTP_URL` blank is a supported state, not a broken one. Messages are
written to the log instead of sent — subject and full text body — so newsletter
double opt-in is testable locally by copying the confirmation URL out of the
terminal.

In production the same state is a genuine fault: customers who pay get no
receipt, and nobody can complete a signup. The API says so at boot:

```
ERROR [MailService] SMTP_URL is not set. Newsletter confirmations, order
receipts and submission alerts will be logged instead of sent.
```

When it *is* set, boot verifies the connection and authenticates without sending:

```
LOG [MailService] Mail transport ready, sending as ZHS Press <hello@zhspress.org>
```

A wrong password shows up in the deploy log rather than being discovered by a
customer who never got a receipt. What `verify()` cannot catch is an unverified
From domain — that fails later, at the provider, often silently.

## Failure behaviour

**Sending never throws.** Every send returns a result and logs its own failure.

This matters most on the order receipt. It is sent by the Flutterwave webhook,
after the payment has settled and stock has been decremented. If a relay timeout
failed that request, Flutterwave would redeliver the webhook — which would hit
the already-settled branch and could never send the receipt anyway, while making
the provider's dashboard show a failing endpoint for a payment that went through
perfectly.

So the worst case is a real order with no receipt, which is recoverable by hand.
The reverse — a receipt for an order that rolled back — is not.

The receipt is also sent **after** the transaction commits, and only by the
webhook delivery that won the atomic claim. Redelivered webhooks send nothing.

## Links in email are not clicked only by people

The confirmation and unsubscribe links open a page that asks for a click; they do
not take effect on load.

Spam filters follow links, corporate gateways rewrite and probe them, and clients
prefetch them for previews. A confirmation that takes effect on `GET` is therefore
confirmed by the first machine to look at it, which defeats the entire point of
double opt-in. Unsubscribe has the mirror problem: a prefetch removes someone from
a list they never asked to leave.

The emailed link opens `/newsletter/confirm?token=…`, the page POSTs the token to
our own server, and that server calls the API. See
[`apps/web/src/lib/newsletter-token.ts`](../apps/web/src/lib/newsletter-token.ts).

## Waitlist

Triggered by the status transition in admin, not by a scheduled job — a cron
would have to keep its own copy of every product's previous status to detect the
change at all.

- Only a transition **into** `available` fires it. Editing an already-available
  product mails nobody.
- `notified_at` is written per entry, **after** that entry's send succeeds. A
  relay failure halfway through leaves the rest unmarked, so re-running picks
  them up. Marking the batch up front would be one query instead of N, and would
  permanently mark people as notified who received nothing.
- Sends are sequential, capped at 200 per run, and run detached from the admin
  request so a long list does not hold the save open until it times out.

## Still to do

- The shipped email carries **no tracking number**, because fulfilment is still
  TBC in the brief and there is no column to put one in. Add both together.
- Nothing is sent on a failed or abandoned payment.
- There is no bounce or complaint handling; a hard-bouncing address stays on the
  list forever.
