import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { and, desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { schema, type Database } from '@zhs/db';
import {
  addProductImageSchema,
  attachContributorSchema,
  upsertProductSchema,
  type AddProductImageInput,
  type AttachContributorInput,
  type ContributorRole,
  type UpsertProductInput,
} from '@zhs/shared';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { DB } from '../db/db.module';
import { MailService } from '../mail/mail.service';
import { orderShipped, url } from '../mail/templates';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard, Roles, type AuthenticatedRequest } from '../auth/admin.guard';
import { AdminProductsService } from './admin-products.service';
import { AudienceService } from './audience.service';
import { AuditService } from './audit.service';
import { ContributorsService } from './contributors.service';
import { ParityService } from './parity.service';
import { StorageService } from '../storage/storage.service';

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
    private readonly storage: StorageService,
    private readonly contributors: ContributorsService,
    private readonly audience: AudienceService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
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

  /* ---- Homepage hero --------------------------------------------------- */

  /** Which product the homepage currently leads with. Derived, not stored. */
  @Get('hero')
  currentHero() {
    return this.products.currentHero();
  }

  @Post('products/:id/hero')
  makeHero(@Param('id', ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.products.makeHero(id, request.admin!);
  }

  /* ---- Product images -------------------------------------------------- */

  @Post('products/:id/images')
  addImage(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(addProductImageSchema)) body: AddProductImageInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.addImage(id, body, request.admin!);
  }

  /**
   * Real file upload.
   *
   * memoryStorage, not disk: the file is validated and re-encoded before
   * anything is written, so an unverified upload never lands on the
   * filesystem at all. The limit here is a first gate — StorageService
   * enforces its own, because a limit only in the interceptor can be
   * bypassed by any other caller of the service.
   */
  @Post('products/:id/images/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('alt') alt: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!alt?.trim()) {
      throw new BadRequestException({
        message: 'Alt text is required.',
        errors: [{ field: 'alt', message: 'Describe the image for screen readers.' }],
      });
    }

    const stored = await this.storage.storeImage(file);

    return this.products.addImage(
      id,
      { url: stored.url, alt: alt.trim(), width: stored.width, height: stored.height },
      request.admin!,
    );
  }

  /* ---- Audience: waitlist and subscribers --------------------------------
   *
   * @Roles('admin') on every one. These are email addresses belonging to
   * members of the public — the same reason orders are restricted. An editor
   * manages the catalogue; they have no need of the mailing list.
   */

  @Get('waitlist')
  @Roles('admin')
  waitlistSummary() {
    return this.audience.waitlistSummary();
  }

  @Get('waitlist/entries')
  @Roles('admin')
  waitlistEntries(@Query('productId') productId?: string) {
    return this.audience.waitlistEntries(productId ? Number(productId) : undefined);
  }

  @Get('waitlist.csv')
  @Roles('admin')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename=zhs-waitlist.csv')
  waitlistCsv(@Query('productId') productId?: string) {
    return this.audience.waitlistCsv(productId ? Number(productId) : undefined);
  }

  @Get('subscribers')
  @Roles('admin')
  subscribers(@Query('status') status?: string) {
    return this.audience.subscribers(status);
  }

  @Get('subscribers/summary')
  @Roles('admin')
  subscriberSummary() {
    return this.audience.subscriberSummary();
  }

  @Get('subscribers.csv')
  @Roles('admin')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename=zhs-subscribers.csv')
  subscriberCsv() {
    return this.audience.subscriberCsv();
  }

  /* ---- Contributors ---------------------------------------------------- */

  /** Type-ahead for the picker. Editors may manage credits, so no @Roles. */
  @Get('contributors')
  searchContributors(@Query('search') search?: string) {
    return this.contributors.search(search);
  }

  @Get('contributors/all')
  listContributors() {
    return this.contributors.list();
  }

  @Get('products/:id/contributors')
  productContributors(@Param('id', ParseIntPipe) id: number) {
    return this.contributors.listForProduct(id);
  }

  @Post('products/:id/contributors')
  attachContributor(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(attachContributorSchema)) body: AttachContributorInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.contributors.attach(id, body, request.admin!);
  }

  @Delete('products/:id/contributors/:contributorId/:role')
  detachContributor(
    @Param('id', ParseIntPipe) id: number,
    @Param('contributorId', ParseIntPipe) contributorId: number,
    @Param('role') role: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.contributors.detach(id, contributorId, role as ContributorRole, request.admin!);
  }

  @Patch('products/:id/contributors/order')
  reorderContributors(
    @Param('id', ParseIntPipe) id: number,
    @Body('contributorIds') contributorIds: number[],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.contributors.reorder(id, contributorIds, request.admin!);
  }

  @Delete('products/:id/images/:imageId')
  removeImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.removeImage(id, imageId, request.admin!);
  }

  @Patch('products/:id/images/order')
  reorderImages(
    @Param('id', ParseIntPipe) id: number,
    @Body('imageIds') imageIds: number[],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.products.reorderImages(id, imageIds, request.admin!);
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
    const result = await this.db
      .update(schema.orders)
      .set({ status: 'fulfilled', fulfilledAt: new Date() })
      .where(
        and(eq(schema.orders.orderNumber, orderNumber), eq(schema.orders.status, 'paid')),
      );

    /*
     * The shipped email, sent only when this call actually changed something.
     *
     * Marking an already-fulfilled order fulfilled again affects zero rows —
     * the WHERE clause requires `paid` — and must not mail the customer a
     * second time. Reading affectedRows is what separates the real transition
     * from a double click, exactly as the payment webhook does.
     */
    const changed = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
    if (changed > 0) {
      const order = await this.db.query.orders.findFirst({
        where: eq(schema.orders.orderNumber, orderNumber),
      });

      if (order) {
        await this.mail.send(
          order.email,
          orderShipped({
            orderNumber: order.orderNumber,
            orderUrl: url(
              this.config.get('WEB_BASE_URL', { infer: true }),
              `order/${encodeURIComponent(order.orderNumber)}`,
            ),
          }),
          `order shipped ${order.orderNumber}`,
        );
      }
    }

    return { ok: true, notified: changed > 0 };
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
