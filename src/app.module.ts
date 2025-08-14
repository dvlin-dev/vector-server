import { Global, Logger, Module } from '@nestjs/common'
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston'
import { format, transports } from 'winston'
import { ConfigModule } from '@nestjs/config'
import * as dotenv from 'dotenv'
import * as Joi from 'joi'
import { PrismaModule } from './utils/prisma/prisma.module'
import { ConversationModule } from './modules/conversation/conversation.module'
import { VectorModule } from './modules/vector/vector.module'
import { SiteModule } from './modules/site/site.module'

const envFilePath = `.env`
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_PORT: Joi.number().default(3306),
  DB_HOST: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()),
  DB_TYPE: Joi.string().valid('postgres'),
  DB_DATABASE: Joi.string().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SYNC: Joi.boolean().default(false),
  LOG_ON: Joi.boolean(),
  LOG_LEVEL: Joi.string(),
  SYSTEM_PROMPT: Joi.string(),
})

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new transports.Console({
          format: format.combine(
            format.timestamp(),
            nestWinstonModuleUtilities.format.nestLike('vector', {
              colors: true,
              prettyPrint: true,
            })
          ),
        }),
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      load: [
        () => {
          const values = dotenv.config({ path: '.env' })
          const { error } = schema.validate(values?.parsed, {
            // 允许未知的环境变量
            allowUnknown: true,
            // 如果有错误，不要立即停止，而是收集所有错误
            abortEarly: false,
          })
          if (error) {
            throw new Error(
              `Validation failed - Is there an environment variable missing?
        ${error.message}`
            )
          }
          return values
        },
      ],
      validationSchema: schema,
    }),
    PrismaModule.forRoot({
      isGlobal: true,
    }),
    ConversationModule,
    VectorModule,
    SiteModule,
  ],
  controllers: [],
  providers: [Logger],
  exports: [Logger],
})
export class AppModule {}
