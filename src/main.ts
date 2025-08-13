import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { generateDocument } from './doc';
// import { httpsOptions } from './https-options';
import { getServerConfig } from './utils';

async function bootstrap() {
  const config = getServerConfig();
  // const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // httpsOptions: isProd ? httpsOptions : null, 部署到 sealos，不走这里解析
  });
  app.setGlobalPrefix('api');
  generateDocument(app);
  setupApp(app);
  const port =
    typeof config['APP_PORT'] === 'string'
      ? parseInt(config['APP_PORT'])
      : 13000;
  await app.listen(port, '0.0.0.0');
  await app.init();
}
bootstrap();
