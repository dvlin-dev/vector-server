-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Index" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "vector" vector(1024),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" TEXT,
    "sectionId" TEXT,

    CONSTRAINT "Index_pkey" PRIMARY KEY ("id")
);

-- 创建向量索引以优化向量搜索性能
CREATE INDEX "vector_idx" ON "Index" USING ivfflat ("vector" vector_l2_ops);