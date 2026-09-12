import { Controller, Get, Param } from '@nestjs/common';
import { PagesService } from '../admin/pages.service';

/**
 * Public read for editorial pages.
 *
 * Separate from the admin controller because that one sits behind AdminGuard in
 * its entirety. Only published pages are reachable here — a draft is invisible
 * rather than merely unlinked.
 */
@Controller('pages')
export class ContentController {
  constructor(private readonly pages: PagesService) {}

  @Get(':slug')
  page(@Param('slug') slug: string) {
    return this.pages.findPublished(slug);
  }
}
