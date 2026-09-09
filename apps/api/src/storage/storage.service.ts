import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { Env } from '../config/env';

export interface StoredImage {
  /** Public URL the storefront renders. */
  url: string;
  /** Key we can delete by later. */
  key: string;
  width: number;
  height: number;
  bytes: number;
}

/** Formats we accept. Anything else is refused before it touches the disk. */
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'avif']);

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** 2x the largest rendered size. Bigger buys nothing anyone can see. */
const MAX_EDGE = 1600;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get uploadDir(): string {
    return this.config.get('UPLOAD_DIR', { infer: true });
  }

  private get publicBaseUrl(): string {
    return this.config.get('ASSET_BASE_URL', { infer: true });
  }

  /**
   * Stores an uploaded image.
   *
   * The file is decoded and re-encoded through sharp rather than written
   * through. That does four things at once, and the first is the important
   * one:
   *
   * 1. It proves the bytes really are an image. Checking the extension or the
   *    client's content-type proves nothing — both are attacker-controlled.
   *    A file that sharp cannot decode never reaches the disk.
   * 2. Re-encoding discards everything that is not pixels: EXIF, colour
   *    profiles, and any payload smuggled into a metadata block.
   * 3. It caps the dimensions, so a 40-megapixel upload cannot sit in the
   *    catalogue costing bandwidth on every page view.
   * 4. It normalises the format, so the storefront gets one predictable thing.
   *
   * The stored filename is generated here and never derived from the uploaded
   * one, which removes path traversal and collisions in a single stroke.
   */
  async storeImage(file: { buffer: Buffer; size: number }): Promise<StoredImage> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${
          MAX_UPLOAD_BYTES / 1024 / 1024
        }MB.`,
      );
    }

    let pipeline: sharp.Sharp;
    let metadata: sharp.Metadata;
    try {
      pipeline = sharp(file.buffer, { failOn: 'error' });
      metadata = await pipeline.metadata();
    } catch {
      throw new BadRequestException('That file is not an image we can read.');
    }

    if (!metadata.format || !ACCEPTED.has(metadata.format)) {
      throw new BadRequestException(
        `Unsupported image format${metadata.format ? ` (${metadata.format})` : ''}. ` +
          'Use JPEG, PNG, WebP or AVIF.',
      );
    }

    const output = await pipeline
      .rotate() // Applies the EXIF orientation before that metadata is dropped.
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });

    const key = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.jpg`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, key), output.data);

    this.logger.log(`Stored ${key} (${(output.info.size / 1024).toFixed(0)}KB)`);

    return {
      key,
      url: `${this.publicBaseUrl.replace(/\/+$/, '')}/${key}`,
      width: output.info.width,
      height: output.info.height,
      bytes: output.info.size,
    };
  }

  async deleteImage(key: string): Promise<void> {
    // Reject anything that is not a plain filename, so a crafted key cannot
    // walk out of the upload directory and delete something else.
    if (!/^[a-z0-9-]+\.jpg$/i.test(key)) {
      throw new BadRequestException('Invalid image key.');
    }

    try {
      await unlink(join(this.uploadDir, key));
    } catch {
      // Already gone. Deleting a missing file is the desired end state.
    }
  }

  /** Turns a stored public URL back into the key, for deletion. */
  keyFromUrl(url: string): string | null {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    if (!url.startsWith(base)) return null;
    const key = url.slice(base.length + 1);
    return /^[a-z0-9-]+\.jpg$/i.test(key) ? key : null;
  }
}
