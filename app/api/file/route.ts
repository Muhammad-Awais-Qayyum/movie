import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileUrl = searchParams.get('url');
    const fileName = searchParams.get('name') || 'download';

    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    // ✅ THE FIX: capture and forward the Range header from the browser
    const rangeHeader = request.headers.get('range');

    const upstreamHeaders: HeadersInit = {
      Referer: 'https://123movienow.cc/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    };

    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(fileUrl, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status} ${upstream.statusText}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    });

    // Only force download when NOT streaming (no Range header = download button)
    if (!rangeHeader) {
      responseHeaders.set('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body?.getReader();
        if (!reader) { controller.close(); return; }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); break; }
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // ✅ Return 206 Partial Content for range requests
    return new NextResponse(stream, {
      status: upstream.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    },
  });
}