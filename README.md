# Vetra Providers

A modular Node.js API for aggregating media providers through a unified interface.

Vetra Providers is designed to simplify the integration of multiple providers by exposing a consistent REST API for searching, retrieving metadata, and obtaining streaming sources.

## Features

* Multi-provider architecture
* Movie and web-series providers
* Anime providers
* Unified REST API
* Provider-specific source extraction
* Parallel provider requests
* Search and metadata endpoints
* Stream source endpoints
* Health check endpoint
* API documentation
* CORS support
* Vercel deployment support
* Modular provider system

## Architecture

```text
                         Vetra Providers
                                |
                                v
                         Express REST API
                                |
              +-----------------+-----------------+
              |                 |                 |
              v                 v                 v
           Movies             Anime            Streams
              |                 |                 |
              +-----------------+-----------------+
                                |
                                v
                         Provider Modules
```

## Project Structure

```text
vetra-providers/
├── providers/
│   ├── anime.provider.js
│   ├── cinemaos.provider.js
│   ├── pikashow.provider.js
│   ├── rive.provider.js
│   ├── showbox.provider.js
│   ├── vidlux.provider.js
│   ├── vidrock.provider.js
│   ├── webstreamer.provider.js
│   └── ...
│
├── routes/
│   ├── anime.js
│   ├── info.js
│   └── streams.js
│
├── server.js
├── package.json
├── vercel.json
└── README.md
```

## Requirements

* Node.js 18 or newer
* npm

## Installation

```bash
git clone https://github.com/suadatbiniqbal/vetra-providers.git

cd vetra-providers

npm install
```

## Running Locally

Start the production server:

```bash
npm start
```

Start the development server:

```bash
npm run dev
```

By default, the API runs on:

```text
http://localhost:3000
```

## API

### Providers

Get the list of available providers:

```http
GET /api/providers
```

### Streams

Get streams from providers:

```http
GET /api/streams
```

Get streams from a specific provider:

```http
GET /api/streams/:provider
```

Get a raw provider response:

```http
GET /api/raw/:provider
```

### Anime

Search for anime:

```http
GET /api/anime/search?q=naruto
```

Get trending anime:

```http
GET /api/anime/trending
```

Get anime information:

```http
GET /api/anime/info/:id
```

Get an episode stream:

```http
GET /api/anime/episode/:id
```

### System

Health check:

```http
GET /api/health
```

API documentation:

```http
GET /api/docs
```

## Provider Architecture

Each provider is implemented independently. This keeps provider-specific extraction logic separated from the main API and makes it easier to add, remove, or update providers.

```text
providers/
├── provider-a.provider.js
├── provider-b.provider.js
├── provider-c.provider.js
└── ...
```

A provider can be integrated into the API without requiring major changes to the rest of the application.

## Tech Stack

* Node.js
* Express.js
* Axios
* Cheerio
* node-tls-client
* UUID
* CORS
* Vercel

## Deployment

Vetra Providers can be deployed to Vercel or another Node.js-compatible hosting platform.

For Vercel deployment, the repository already includes the required configuration.

## Development Note

> **Notice:** I am currently unavailable to actively resolve issues or provide immediate support because of my exams.
>
> Issues and pull requests may take longer than usual to receive a response. I will review and address them when I am available again.
>
> Thank you for your patience and understanding.

## Disclaimer

Vetra Providers is provided for educational and development purposes.

This project does not host or store media files. It interfaces with third-party providers, and their availability, functionality, and content are outside the control of this project.

Users are responsible for ensuring that their use of this project complies with applicable laws, copyright requirements, and the terms of service of any third-party services they access.

## Contributing

Contributions and improvements are welcome.

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/my-provider
```

3. Make your changes.
4. Commit your changes.

```bash
git commit -m "Add new provider"
```

5. Push your branch.

```bash
git push origin feature/my-provider
```

6. Open a pull request.

## License

See the repository for licensing information.

---

Built by [suadatbiniqbal](https://github.com/suadatbiniqbal).
