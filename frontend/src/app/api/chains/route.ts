import { NextResponse } from 'next/server';

/**
 * API handler to fetch supported chains from 1inch API
 * @returns Supported chains data
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

    // Currently, we return static data for supported chains
    // In a production environment, this would call the 1inch API
    return NextResponse.json({
      1: 'Ethereum',
      137: 'Polygon',
      56: 'BSC',
      42161: 'Arbitrum',
      10: 'Optimism'
    });
  } catch (error) {
    console.error('Error fetching supported chains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supported chains' },
      { status: 500 }
    );
  }
}
