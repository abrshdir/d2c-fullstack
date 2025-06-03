import { NextResponse } from 'next/server';

/**
 * API handler to fetch tokens from 1inch API
 * @returns Tokens data for the specified chain
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

    // Get chainId from the query parameters
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum mainnet
    
    // Call the 1inch API to get tokens
    const response = await fetch(
      `https://api.1inch.dev/token-list/v1.2/${chainId}`,
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
        { error: errorData.description || 'Error fetching tokens' },
        { status: response.status }
      );
    }

    const tokensData = await response.json();
    return NextResponse.json(tokensData);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
