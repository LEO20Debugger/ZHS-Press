import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { schema, type Database } from '@zhs/db';
import { upsertProductSchema, type UpsertProductInput } from '@zhs/shared';
import { DB } from '../db/db.module';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard, Roles, type AuthenticatedRequest } from '../auth/admin.guard';
import { AdminProductsService } from './admin-products.service';
import { AuditService } from './audit.service';
import { ParityService } from './parity.service';

/**
 * Admin API.
 *
 * Every route requires an authenticated admin user. Routes that touch money or
 * customer data additionally carry @Roles('admin'), so an `editor` account —
 * the Publishing Associate's — can manage the catalogue but cannot read orders
 * or customer addresses.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly products: AdminProductsService,
    private readonly parity: ParityService,
    private readonly audit: AuditService,
  ) {}

  /* ---- Catalogue: editors and admins ---------------------------------- */

  @Get('products')
  listProducts(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.products.list({ search, type, status, page: page ? Number(page) : 1 });
  }

  /** The palette the colour picker offers, with each option's text pairing. */
  @Get('accents')
  accents() {
    return this.products.accentOptions();
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post('products')
  createProduct(
    @Body(new ZodValidationPipe(upsertProductSchema)) body: UpsertProductInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.create(body, request.admin!);
  }

  @Put('products/:id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(upsertProductSchema)) body: UpsertProductInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.update(id, body, request.admin!);
  }

  @Patch('products/:id/inventory')
  setInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.setInventory(id, quantity, request.admin!);
  }

  /** Archives rather than deletes; past orders must keep their references. */
  @Delete('products/:id')
  archiveProduct(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.archive(id, request.admin!);
  }

  @Get('submissions')
  listSubmissions(@Query('status') status?: string) {
    return this.db.query.submissions.findMany({
      where: status ? eq(schema.submissions.status, status as 'new') : undefined,
      orderBy: [desc(schema.submissions.createdAt)],
      limit: 100,
    });
  }

  @Patch('submissions/:id')
  async updateSubmission(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Body('notes') notes: string | undefined,
  ) {
    await this.db
      .update(schema.submissions)
      .set({ status: status as 'reviewing', ...(notes != null ? { notes } : {}) })
      .where(eq(schema.submissions.id, id));
    return { ok: true };
  }

  /* ---- Amazon parity: editors and admins ------------------------------ */

  @Get('parity')
  parityReport() {
    return this.parity.report();
  }

  @Get('parity.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="zhs-amazon-parity.csv"')
  parityCsv() {
    return this.parity.csv();
  }

  /* ---- Orders and money: admins only ---------------------------------- */

  @Get('orders')
  @Roles('admin')
  listOrders(@Query('status') status?: string) {
    return this.db.query.orders.findMany({
      where: status ? eq(schema.orders.status, status as 'paid') : undefined,
      orderBy: [desc(schema.orders.createdAt)],
      limit: 100,
      with: { items: true },
    });
  }

  @Get('orders/:orderNumber')
  @Roles('admin')
  getOrder(@Param('orderNumber') orderNumber: string) {
    return this.db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, orderNumber),
      with: { items: true, payments: true },
    });
  }

  @Patch('orders/:orderNumber/fulfil')
  @Roles('admin')
  async fulfilOrder(@Param('orderNumber') orderNumber: string) {
    // Only a paid order can be marked fulfilled. Guarding it in the WHERE
    // clause means a pending order cannot be shipped by an accidental click.
    await this.db
      .update(schema.orders)
      .set({ status: 'fulfilled', fulfilledAt: new Date() })
      .where(
        and(eq(schema.orders.orderNumber, orderNumber), eq(schema.orders.status, 'paid')),
      );
    return { ok: true };
  }

  @Get('audit')
  @Roles('admin')
  auditLog() {
    return this.audit.recent();
  }

  /* ---- Dashboard ------------------------------------------------------- */

  @Get('overview')
  async overview(@Req() request: AuthenticatedRequest) {
    const products = await this.db.query.products.findMany({ columns: { id: true, status: true } });
    const submissions = await this.db.query.submissions.findMany({
      columns: { id: true, status: true },
    });

    const base = {
      products: {
        total: products.length,
        draft: products.filter((p) => p.status === 'draft').length,
        comingSoon: products.filter((p) => p.status === 'coming_soon').length,
        available: products.filter((p) => p.status === 'available').length,
      },
      submissions: {
        total: submissions.length,
        unread: submissions.filter((s) => s.status === 'new').length,
      },
    };

    // Editors get no order figures at all — not zeroed, absent.
    if (request.admin?.role !== 'admin') return base;

    const orders = await this.db.query.orders.findMany({
      columns: { id: true, status: true, totalCents: true },
    });
    const paid = orders.filter((o) => o.status === 'paid' || o.status === 'fulfilled');

    return {
      ...base,
      orders: {
        total: orders.length,
        awaitingFulfilment: orders.filter((o) => o.status === 'paid').length,
        revenueCents: paid.reduce((sum, o) => sum + o.totalCents, 0),
      },
    };
  }
}
