import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';

const HEADERS = {
  accept: 'application/json',
  'x-request-lang': 'en',
  Referer: 'https://moviebox.ph/',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json(
        { code: -1, message: 'Missing subjectId parameter' },
        { status: 400 }
      );
    }

    const res = await fetch(`${BASE_URL}/detail?subjectId=${subjectId}`, {
      method: 'GET',
      headers: HEADERS,
    });

    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { code: data.code, message: data.message || 'Detail failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ code: 0, data: data.data });
  } catch (error: any) {
    return NextResponse.json(
      { code: -1, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

