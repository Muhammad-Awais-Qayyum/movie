import { NextRequest, NextResponse } from 'next/server';

const DOWNLOAD_BASE_URL = 'https://123movienow.cc/wefeed-h5api-bff';

const DOWNLOAD_HEADERS = {
  accept: 'application/json',
  'x-client-info': '{"timezone":"Asia/Karachi"}',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId');
    const detailPath = searchParams.get('detailPath');
    const se = searchParams.get('se') || '0';
    const ep = searchParams.get('ep') || '0';

    if (!subjectId || !detailPath) {
      return NextResponse.json(
        { code: -1, message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const url = `${DOWNLOAD_BASE_URL}/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...DOWNLOAD_HEADERS,
        Referer: `https://123movienow.cc/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`,
      },
    });

    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { code: data.code, message: data.message || 'Play failed' },
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

