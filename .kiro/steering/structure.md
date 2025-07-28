# Project Structure & Organization

## Root Level Structure
```
LibreChat/
├── api/                    # Backend Node.js/Express server
├── client/                 # React frontend application
├── packages/               # Shared packages (monorepo)
├── config/                 # Configuration scripts and utilities
├── e2e/                    # End-to-end tests (Playwright)
├── .devcontainer/          # VS Code dev container setup
├── .github/                # GitHub workflows and templates
├── helm/                   # Kubernetes Helm charts
├── redis-config/           # Redis cluster configuration
└── utils/                  # Utility scripts and tools
```

## Backend Structure (api/)
```
api/
├── app/                    # Application logic and AI clients
│   └── clients/            # AI provider clients (OpenAI, Anthropic, etc.)
├── cache/                  # Caching layer (Redis, file-based)
├── config/                 # Configuration management
├── db/                     # Database connection and models
├── models/                 # Mongoose schemas and methods
├── server/                 # Express server setup
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Express middleware
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic services
│   └── utils/              # Server utilities
├── strategies/             # Passport authentication strategies
├── test/                   # Test setup and mocks
└── utils/                  # General utilities
```

## Frontend Structure (client/)
```
client/
├── public/                 # Static assets
│   ├── assets/             # Images, icons, fonts
│   └── fonts/              # Web fonts
├── src/
│   ├── @types/             # TypeScript type definitions
│   ├── Providers/          # React context providers
│   ├── a11y/               # Accessibility components
│   ├── common/             # Shared types and utilities
│   ├── components/         # React components
│   ├── data-provider/      # API client and data fetching
│   ├── hooks/              # Custom React hooks
│   ├── locales/            # Internationalization files
│   ├── routes/             # React Router configuration
│   ├── store/              # Recoil state management
│   └── utils/              # Frontend utilities
├── test/                   # Test utilities and setup
└── scripts/                # Build and deployment scripts
```

## Shared Packages (packages/)
```
packages/
├── api/                    # Shared backend utilities
├── data-provider/          # API client and data fetching logic
└── data-schemas/           # Zod schemas and TypeScript types
```

## Key Architectural Patterns

### Backend Patterns
- **Middleware-based**: Express middleware for authentication, validation, error handling
- **Service Layer**: Business logic separated into service classes
- **Repository Pattern**: Database operations abstracted through models
- **Strategy Pattern**: Multiple authentication strategies via Passport.js
- **Factory Pattern**: Client creation for different AI providers

### Frontend Patterns
- **Component Composition**: Reusable UI components with Radix UI primitives
- **Provider Pattern**: Context providers for global state management
- **Custom Hooks**: Reusable logic encapsulated in custom hooks
- **Container/Presenter**: Smart containers with presentational components
- **Query/Mutation**: TanStack Query for server state management

### File Naming Conventions
- **Backend**: camelCase for files, PascalCase for classes/models
- **Frontend**: PascalCase for components, camelCase for utilities
- **Tests**: `*.spec.js` or `*.test.js` alongside source files
- **Types**: `*.types.ts` for TypeScript definitions

### Import/Export Patterns
- **Barrel Exports**: `index.js/ts` files for clean imports
- **Absolute Imports**: Use `~` alias for src directory
- **Package Imports**: Shared packages imported by name

### Configuration Management
- **Environment Variables**: `.env` files for configuration
- **YAML Config**: `librechat.yaml` for application settings
- **Docker Compose**: Service orchestration and environment setup
- **Build Config**: Separate configs for development/production

### Testing Structure
- **Unit Tests**: Alongside source files
- **Integration Tests**: In dedicated test directories
- **E2E Tests**: Separate `e2e/` directory with Playwright
- **Mocks**: Centralized in `test/__mocks__/` directories

### Development Workflow
- **Monorepo**: npm workspaces for package management
- **Hot Reload**: Vite dev server for frontend, nodemon for backend
- **Code Quality**: ESLint + Prettier with pre-commit hooks
- **Type Safety**: TypeScript throughout with strict configuration