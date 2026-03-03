import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';

const HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  'x-request-lang': 'en',
  Referer: 'https://moviebox.ph/',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, page, perPage, subjectType } = body;

    const res = await fetch(`${BASE_URL}/subject/search`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        keyword,
        page: String(page || 0),
        perPage: perPage || 28,
        subjectType: subjectType || 0,
      }),
    });

    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { code: data.code, message: data.message || 'Search failed' },
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

