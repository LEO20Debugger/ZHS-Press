import { Controller, Get, Param, Query } from '@nestjs/common';
import { productQuerySchema, type ProductQuery } from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery) {
    return this.products.list(query);
  }

  /** The magazine archive keeps sold-out issues visible (brief 2.3). */
  @Get('issues')
  listIssues() {
    return this.products.listIssues();
  }

  /**
   * The issue the magazine page leads with, or null between issues.
   *
   * Declared above `:slug` so the two-segment path is matched as a route
   * rather than read as a product slug.
   */
  @Get('issues/latest')
  latestIssue() {
    return this.products.getLatestIssue();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}
