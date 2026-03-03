# MovieBox Downloader - Next.js

A Next.js web application for searching and downloading movies, series, and music from MovieBox.

## Features

- Search movies, series, and music
- View detailed information about each title
- Download videos in multiple resolutions
- Download subtitles in various languages
- Stream links support
- Season/episode picker for TV series

## Getting Started

### Installation

```bash
npm install
# or
yarn install
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build the application for production:

```bash
npm run build
# or
yarn build
```

Start the production server:

```bash
npm start
# or
yarn start
```

## API Routes

The application includes the following API routes:

- `POST /api/search` - Search for movies, series, or music
- `GET /api/detail` - Get detailed information about a title
- `GET /api/download` - Get download links for a title
- `GET /api/play` - Get streaming links for a title
- `GET /api/file` - Proxy file downloads (videos, subtitles)

## Project Structure

```
tool-app/
├── app/
│   ├── api/           # API routes
│   │   ├── search/
│   │   ├── detail/
│   │   ├── download/
│   │   ├── play/
│   │   └── file/
│   ├── page.tsx       # Main page component
│   ├── layout.tsx     # Root layout
│   └── globals.css    # Global styles
└── ...
```

## Usage

1. Enter a search keyword in the search bar
2. Select the type (All, Movies, Series, or Music)
3. Click "Search" or press Enter
4. Browse the results and click "Downloads" on any item
5. For series, select season and episode, then click "Get Links"
6. Download videos or subtitles from the modal

## Notes

- All API calls are proxied through Next.js API routes to avoid CORS issues
- File downloads are streamed through the server for compatibility
- The application uses the MovieBox API endpoints
