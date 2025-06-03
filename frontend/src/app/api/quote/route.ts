import { NextResponse } from 'next/server';

/**
 * API handler to fetch a quote from 1inch API
 * @returns Quote data for the specified token swap
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

    // Validate required parameters
    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromTokenAddress, toTokenAddress, or amount' },
        { status: 400 }
      );
    }

    // Call the 1inch API to get a quote
    const response = await fetch(
      `https://api.1inch.dev/swap/v5.0/${chainId}/quote` +
      `?fromTokenAddress=${fromTokenAddress}` +
      `&toTokenAddress=${toTokenAddress}` +
      `&amount=${amount}`,
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
        { error: errorData.description || 'Error fetching quote' },
        { status: response.status }
      );
    }

    const quoteData = await response.json();
    return NextResponse.json(quoteData);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
