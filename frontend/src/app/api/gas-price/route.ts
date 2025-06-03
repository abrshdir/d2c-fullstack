import { NextResponse } from 'next/server';

/**
 * API handler to fetch gas prices from 1inch API
 * @returns Gas price data
 */
export async function GET() {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.ONEINCH_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Call the 1inch Gas Price API
    // The chainId 1 is for Ethereum mainnet
    const response = await fetch(
      'https://api.1inch.dev/gas-price/v1.5/1',
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
        { error: errorData.description || 'Error fetching gas price' },
        { status: response.status }
      );
    }

    const gasData = await response.json();
    return NextResponse.json(gasData);
  } catch (error) {
    console.error('Error fetching gas price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gas price' },
      { status: 500 }
    );
  }
}
