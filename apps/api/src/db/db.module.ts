import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { closeDb, createDb, type Database } from '@zhs/db';
import type { Env } from '../config/env';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Database =>
        createDb({ url: config.get('DATABASE_URL', { infer: true }) }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await closeDb();
  }
}
