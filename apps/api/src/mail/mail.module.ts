import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global, because four unrelated modules need it — capture, checkout, admin
 * and (at boot) main. Importing MailModule into each is the alternative, and
 * it buys nothing: there is one stateless transport and no scoping decision to
 * express.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
