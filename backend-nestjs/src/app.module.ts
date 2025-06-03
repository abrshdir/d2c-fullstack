import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TokenScannerModule } from './token-scanner/token-scanner.module';

//scanner
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    TokenScannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
