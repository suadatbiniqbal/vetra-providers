
# Vetra Providers API

> A fast, multi-provider streaming API that aggregates stream URLs from various providers in parallel.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://vetra-providers.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Providers](#providers)
- [Base URL](#base-url)
- [Endpoints](#endpoints)
  - [GET /api/streams](#get-apistreams)
  - [GET /api/streams/:provider](#get-apistreamsprovider)
  - [GET /api/raw/:provider](#get-apirawprovider)
  - [GET /api/proxy](#get-apiproxy)
  - [GET /api/quilox-proxy](#get-apiquilox-proxy)
  - [GET /api/anime/search](#get-apianimesearch)
  - [GET /api/anime/trending](#get-apianimetrending)
  - [GET /api/anime/latest](#get-apianimlatest)
  - [GET /api/anime/info/:id](#get-apianimeinfoid)
  - [GET /api/anime/episode/:id](#get-apianiepisodeid)
  - [GET /api/providers](#get-apiproviders)
  - [GET /api/health](#get-apihealth)
- [Stream Object Schema](#stream-object-schema)
- [Error Responses](#error-responses)
- [Running Locally](#running-locally)
- [Deployment](#deployment)

---

## Overview

Vetra Providers fires all providers in **parallel**, collects streams, and returns them in one unified response. Stream URLs are automatically rewritten through the built-in proxy to handle CORS and authentication headers transparently.

---

## Providers

| ID | Name | Movie | TV | Notes |
|---|---|---|---|---|
| `cinemaos` | CinemaOS | Yes | Yes | AES-256-GCM encrypted API |
| `vidlux` | VidLux | Yes | Yes | Multi-sub-provider (10 sources) |
| `vidrock` | VidRock | Yes | Yes | AES-256-CBC encrypted ID |
| `webstreamer` | Webstreamer | Yes | Yes | Requires `imdbId` |
| `showbox` | ShowBox | Yes | Yes | FebBox token-based |
| `pikashow` | Pikashow | Yes | No | Movies only |
| `rive` | Rive | Yes | Yes | Multi-server (4 servers) |
| `challenge` | Challenge | Yes | Yes | Altcha challenge solver |

---

## Base URL

```
https://vetra-providers.vercel.app
```

---

## Endpoints

### GET /api/streams

Fetches streams from **all providers in parallel**.

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `tmdbId` | Required | TMDB movie/show ID |
| `type` | Required | `movie` or `tv` |
| `imdbId` | Optional | IMDB ID (e.g. `tt0137523`) — needed for CinemaOS, Webstreamer |
| `season` | Optional | Season number (TV only) |
| `episode` | Optional | Episode number (TV only) |
| `title` | Optional | Title string — improves VidLux accuracy |
| `year` | Optional | Release year — improves VidLux accuracy |

**Example:**
```
GET /api/streams?tmdbId=550&type=movie&imdbId=tt0137523
```

**Response:**
```json
{
  "success": true,
  "took": "4231ms",
  "results": {
    "vidlux": {
      "success": true,
      "streams": [ { "url": "...", "server": "...", "quality": "auto", "type": "m3u8" } ]
    },
    "vidrock": [ { "url": "...", "server": "Atlas", "quality": "Auto", "type": "m3u8" } ],
    "cinemaos": { "success": false, "error": "..." }
  }
}
```

---

### GET /api/streams/:provider

Fetches streams from a **single provider**.

**Path Parameters:** `provider` — one of the provider IDs listed above.

**Query Parameters:** Same as `/api/streams`.

**Example:**
```
GET /api/streams/vidlux?tmdbId=550&type=movie
```

---

### GET /api/raw/:provider

Returns the **raw, un-proxied** response from a provider (URLs are not rewritten).

**Example:**
```
GET /api/raw/vidrock?tmdbId=550&type=movie
```

---

### GET /api/proxy

A transparent HTTP proxy that forwards stream requests with the correct `Referer`/`Origin` headers. Falls back to a TLS client for CDNs that block standard requests.

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `url` | Required | URL-encoded stream URL to proxy |
| `referer` | Optional | URL-encoded Referer header value |

**Example:**
```
GET /api/proxy?url=https%3A%2F%2Fexample.com%2Fvideo.m3u8&referer=https%3A%2F%2Fvidlux.xyz%2F
```

Supports `Range` headers for partial content / seeking.

---

### GET /api/quilox-proxy

A dedicated proxy for Quilox (purstream) streams returned by VidLux.

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `url` | Required | URL-encoded stream URL |
| `referer` | Optional | URL-encoded Referer (default: `https://purstream.ch/`) |
| `origin` | Optional | URL-encoded Origin (default: `https://purstream.ch`) |

---

### GET /api/anime/search

**Query Parameters:**

| Param | Required | Description |
|---|---|---|
| `q` | Required | Search query string |
| `page` | Optional | Page number (default: `1`) |

**Example:**
```
GET /api/anime/search?q=naruto&page=1
```

---

### GET /api/anime/trending

Returns trending anime. No parameters required.

```
GET /api/anime/trending
```

---

### GET /api/anime/latest

Returns latest episode releases.

```
GET /api/anime/latest
```

---

### GET /api/anime/info/:id

Returns anime metadata by slug or ID.

```
GET /api/anime/info/naruto-shippuuden
```

---

### GET /api/anime/episode/:id

Returns the stream URL for an anime episode.

```
GET /api/anime/episode/naruto-shippuuden-episode-1
```

---

### GET /api/providers

Lists all registered providers and their capabilities.

```json
{
  "success": true,
  "count": 9,
  "providers": [
    { "id": "vidlux", "name": "VidLux", "supports": ["movie", "tv"], "requiresImdb": false }
  ]
}
```

---

### GET /api/health

Health check endpoint.

```json
{ "success": true, "status": "ok", "timestamp": "2026-06-13T...", "uptime": 123.4 }
```

---

## Stream Object Schema

Each stream object in a response follows this shape:

```json
{
  "url": "https://vetra-providers.vercel.app/api/proxy?url=...",
  "directUrl": "https://original-cdn.example.com/video.m3u8",
  "server": "Atlas",
  "quality": "1080p",
  "type": "m3u8",
  "language": "English",
  "headers": {
    "Referer": "https://vidlux.xyz/",
    "Origin": "https://vidlux.xyz"
  },
  "provider": "VidLux"
}
```

| Field | Description |
|---|---|
| `url` | Proxied URL — use this in your player |
| `directUrl` | Original CDN URL (may require headers) |
| `server` | Source server name |
| `quality` | Quality label (`1080p`, `720p`, `Auto`, `HD`, etc.) |
| `type` | `m3u8` (HLS) or `mp4` |
| `language` | Stream language if known |
| `headers` | Headers required when playing `directUrl` directly |
| `provider` | Which provider returned this stream |

---

## Error Responses

All errors follow a consistent shape:

```json
{ "success": false, "error": "Description of what went wrong" }
```

| HTTP Status | Meaning |
|---|---|
| `400` | Missing or invalid query parameter |
| `404` | Unknown provider or route |
| `500` | Internal server error / provider failure |
| `503` | Provider module failed to load |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server (with auto-reload)
npm run dev

# Start production server
npm start
```

Server runs at `http://localhost:3000` by default.

---

## Deployment

Deployed on **Vercel** via `vercel.json`. All routes are forwarded to `server.js`.

```bash
vercel --prod

<script>
  atOptions = {
    'key' : 'b589d93de453d0270414e0ef2344b785',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://breedsmuteexams.com/b589d93de453d0270414e0ef2344b785/invoke.js"></script>

```
