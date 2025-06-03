import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { OneInchService, GasPriceResponse } from './oneinch.service';

@Controller('oneinch')
export class OneInchController {
  private readonly logger = new Logger(OneInchController.name);

  constructor(private readonly oneInchService: OneInchService) {}

  /**
   * Get current gas prices from 1inch API
   * @param chainId The blockchain chain ID (optional, defaults to 1 for Ethereum)
   * @returns Gas price data including baseFee, maxFeePerGas, and maxPriorityFeePerGas
   */
  @Get('gas-price')
  async getGasPrice(@Query('chainId') chainIdParam?: string): Promise<GasPriceResponse> {
    try {
      const chainId = chainIdParam ? parseInt(chainIdParam, 10) : 1;
      this.logger.log(`Fetching gas price for chain ID: ${chainId}`);
      
      return await this.oneInchService.getGasPrice(chainId);
    } catch (error) {
      this.logger.error(`Error getting gas price: ${error.message}`, error.stack);
      throw error;
    }
  }
}
