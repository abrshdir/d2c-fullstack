import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
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
        throw new HttpException(
          '1inch API key is not configured. Please contact support.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
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
      
      // Handle specific error types
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle Axios errors
      if (error instanceof AxiosError) {
        if (error.response) {
          // Handle specific HTTP status codes
          switch (error.response.status) {
            case 401:
              throw new HttpException(
                'Invalid 1inch API key. Please contact support.',
                HttpStatus.UNAUTHORIZED
              );
            case 403:
              throw new HttpException(
                'Access to 1inch API is forbidden. Please contact support.',
                HttpStatus.FORBIDDEN
              );
            case 429:
              throw new HttpException(
                'Rate limit exceeded for 1inch API. Please try again later.',
                HttpStatus.TOO_MANY_REQUESTS
              );
            case 500:
              throw new HttpException(
                '1inch API is currently unavailable. Please try again later.',
                HttpStatus.SERVICE_UNAVAILABLE
              );
            default:
              errorMessage = `1inch API error: ${error.response.status} - ${
                error.response.data?.description || error.message
              }`;
          }
        } else if (error.request) {
          throw new HttpException(
            'No response from 1inch API. Please check your network connection.',
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
      }

      // Handle network errors
      if (error.message.includes('network') || error.message.includes('connect')) {
        throw new HttpException(
          'Network error while connecting to 1inch API. Please check your connection.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Handle invalid chain ID
      if (error.message.includes('chain') || error.message.includes('network')) {
        throw new HttpException(
          `Unsupported chain ID: ${chainId}. Please use a supported network.`,
          HttpStatus.BAD_REQUEST
        );
      }
      
      this.logger.error(errorMessage, error.stack);
      
      throw new HttpException(
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
