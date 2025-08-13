import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/vector-client';

@Injectable()
export class PrismaVectorService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error('Failed to connect to the vector database:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
} 