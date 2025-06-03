import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface GasPriceResponse {
  baseFee: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

@Injectable()
export class OneInchService {
  private readonly logger = new Logger(OneInchService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('ONEINCH_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('ONEINCH_API_KEY is not set in environment variables');
    }
  }

  /**
   * Fetches current gas prices from 1inch API
   * @param chainId The blockchain chain ID (default: 1 for Ethereum)
   * @returns Gas price data including baseFee, maxFeePerGas, and maxPriorityFeePerGas
   */
  async getGasPrice(chainId: number = 1): Promise<GasPriceResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('1inch API key is not configured');
      }

      const response = await firstValueFrom(
        this.httpService.get<GasPriceResponse>(
          `https://api.1inch.dev/gas-price/v1.5/${chainId}`,
          {
            headers: {
              'accept': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        )
      );

      return response.data;
    } catch (error) {
      let errorMessage = 'Failed to fetch gas price from 1inch API';
      
      if (error instanceof AxiosError && error.response) {
        errorMessage = `1inch API error: ${error.response.status} - ${
          error.response.data?.description || error.message
        }`;
      }
      
      this.logger.error(errorMessage, error.stack);
      
      throw new Error(errorMessage);
    }
  }
}
