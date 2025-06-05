import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
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
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/token-scanner'),
    TokenScannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
