import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  createSubmissionSchema,
  newsletterSignupSchema,
  waitlistSignupSchema,
  type CreateSubmissionInput,
  type NewsletterSignupInput,
  type WaitlistSignupInput,
} from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CaptureService } from './capture.service';

@Controller()
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}

  @Post('newsletter')
  @HttpCode(200)
  subscribe(
    @Body(new ZodValidationPipe(newsletterSignupSchema)) body: NewsletterSignupInput,
  ) {
    return this.capture.subscribe(body);
  }

  @Get('newsletter/confirm')
  confirm(@Query('token') token: string) {
    return this.capture.confirmSubscription(token);
  }

  @Get('newsletter/unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.capture.unsubscribe(token);
  }

  @Post('waitlist')
  @HttpCode(200)
  joinWaitlist(@Body(new ZodValidationPipe(waitlistSignupSchema)) body: WaitlistSignupInput) {
    return this.capture.joinWaitlist(body);
  }

  @Post('submissions')
  @HttpCode(201)
  createSubmission(
    @Body(new ZodValidationPipe(createSubmissionSchema)) body: CreateSubmissionInput,
  ) {
    return this.capture.createSubmission(body);
  }
}
