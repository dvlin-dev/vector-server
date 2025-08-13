import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaModuleOptions } from './interfaces';
import { PrismaService } from './prisma.service';
import { PrismaVectorService } from './prisma-vector.service';

@Module({
  providers: [PrismaService, PrismaVectorService],
  exports: [PrismaService, PrismaVectorService],
})
export class PrismaModule {
  static forRoot(options: PrismaModuleOptions = {}): DynamicModule {
    return {
      global: options.isGlobal,
      module: PrismaModule,
    };
  }
}
