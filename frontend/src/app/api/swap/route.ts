import { NextResponse } from 'next/server';

/**
 * API handler to get swap transaction data from 1inch API
 * @returns Swap transaction data
 */
export async function GET(request: Request) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.ONEINCH_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Get parameters from the query string
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum mainnet
    const fromTokenAddress = searchParams.get('fromTokenAddress');
    const toTokenAddress = searchParams.get('toTokenAddress');
    const amount = searchParams.get('amount');
    const fromAddress = searchParams.get('fromAddress');
    const slippage = searchParams.get('slippage') || '1'; // Default slippage is 1%

    // Validate required parameters
    if (!fromTokenAddress || !toTokenAddress || !amount || !fromAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromTokenAddress, toTokenAddress, amount, or fromAddress' },
        { status: 400 }
      );
    }

    // Call the 1inch API to get swap transaction data
    const response = await fetch(
      `https://api.1inch.dev/swap/v5.0/${chainId}/swap` +
      `?fromTokenAddress=${fromTokenAddress}` +
      `&toTokenAddress=${toTokenAddress}` +
      `&amount=${amount}` +
      `&fromAddress=${fromAddress}` +
      `&slippage=${slippage}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.description || 'Error fetching swap transaction' },
        { status: response.status }
      );
    }

    const swapData = await response.json();
    return NextResponse.json(swapData);
  } catch (error) {
    console.error('Error fetching swap transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap transaction' },
      { status: 500 }
    );
  }
}
