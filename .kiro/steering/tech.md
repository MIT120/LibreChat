# Technology Stack & Build System

## Architecture
- **Monorepo Structure**: Workspace-based with npm workspaces
- **Backend**: Node.js/Express.js API server
- **Frontend**: React 18 with TypeScript/JSX
- **Database**: MongoDB with Mongoose ODM
- **Search**: Meilisearch for conversation/message search
- **Caching**: Redis with multiple client support
- **Authentication**: Passport.js with multiple strategies

## Core Technologies

### Backend (api/)
- **Runtime**: Node.js 20+ (also supports Bun)
- **Framework**: Express.js with middleware-based architecture
- **Database**: MongoDB with connection pooling
- **Authentication**: Passport.js (JWT, OAuth2, LDAP, SAML)
- **AI Integration**: Multiple SDKs (@anthropic-ai/sdk, openai, @google/generative-ai)
- **File Handling**: Multer, Sharp for image processing
- **Validation**: Zod schemas
- **Testing**: Jest with supertest

### Frontend (client/)
- **Framework**: React 18 with Vite build system
- **Language**: TypeScript/JSX
- **State Management**: Recoil for global state
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS with custom design system
- **Forms**: React Hook Form
- **Testing**: Jest with React Testing Library

### Shared Packages (packages/)
- **data-provider**: Shared API client and data fetching logic
- **data-schemas**: Zod validation schemas and TypeScript types
- **api**: Shared backend utilities and types

## Build System & Commands

### Development
```bash
# Start backend in development mode
npm run backend:dev

# Start frontend development server
npm run frontend:dev

# Run both with hot reload
npm run backend:dev & npm run frontend:dev
```

### Production Build
```bash
# Build all packages and frontend
npm run frontend

# Start production backend
npm run backend
```

### Testing
```bash
# Run API tests
npm run test:api

# Run client tests  
npm run test:client

# Run E2E tests
npm run e2e
```

### Bun Support (Alternative Runtime)
```bash
# Bun equivalents for faster execution
npm run b:api          # Production API with Bun
npm run b:client       # Build client with Bun
npm run b:test:api     # Test API with Bun
```

### Docker
```bash
# Start with Docker Compose
docker-compose up -d

# Production deployment
npm run start:deployed
npm run stop:deployed
```

## Key Dependencies

### Backend Core
- `express` - Web framework
- `mongoose` - MongoDB ODM  
- `passport` - Authentication middleware
- `@librechat/agents` - AI agent framework
- `@modelcontextprotocol/sdk` - MCP integration
- `ioredis` - Redis client
- `meilisearch` - Search engine client

### Frontend Core
- `react` + `react-dom` - UI framework
- `@tanstack/react-query` - Server state management
- `recoil` - Client state management
- `react-router-dom` - Routing
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS

### Development Tools
- `vite` - Frontend build tool and dev server
- `eslint` + `prettier` - Code linting and formatting
- `jest` - Testing framework
- `playwright` - E2E testing
- `husky` + `lint-staged` - Git hooks

## Configuration Files
- `librechat.yaml` - Main application configuration
- `.env` - Environment variables
- `docker-compose.yml` - Container orchestration
- `vite.config.ts` - Frontend build configuration
- `eslint.config.mjs` - Code quality rules