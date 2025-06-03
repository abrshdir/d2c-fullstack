import { NextResponse } from 'next/server';

/**
 * API handler to get approval transaction data from 1inch API
 * @returns Approval transaction data
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
    const tokenAddress = searchParams.get('tokenAddress');
    const amount = searchParams.get('amount') || '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // MaxUint256 by default

    // Validate required parameters
    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Missing required parameter: tokenAddress' },
        { status: 400 }
      );
    }

    // Call the 1inch API to get approval transaction data
    const response = await fetch(
      `https://api.1inch.dev/swap/v5.0/${chainId}/approve/transaction` +
      `?tokenAddress=${tokenAddress}` +
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
        { error: errorData.description || 'Error fetching approval transaction' },
        { status: response.status }
      );
    }

    const approvalData = await response.json();
    return NextResponse.json(approvalData);
  } catch (error) {
    console.error('Error fetching approval transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval transaction' },
      { status: 500 }
    );
  }
}
