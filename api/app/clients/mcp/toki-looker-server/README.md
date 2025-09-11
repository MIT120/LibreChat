# Toki Looker MCP Server

A Model Context Protocol (MCP) server for Toki that integrates with Looker to provide comprehensive electricity analytics and statistics. This server enables AI assistants to interact with Looker dashboards, queries, and data models to analyze electricity consumption, generation, costs, and efficiency metrics.

## Features

### 🔌 Electricity Analytics
- **Consumption Analysis**: Track and analyze electricity usage patterns
- **Generation Monitoring**: Monitor solar, wind, and other renewable generation
- **Grid Interaction**: Analyze import/export patterns with the electrical grid
- **Battery Management**: Track battery charging/discharging cycles
- **Cost Analysis**: Monitor electricity costs and tariff optimization
- **Carbon Footprint**: Track emissions and environmental impact
- **Efficiency Metrics**: Calculate self-sufficiency and grid dependency

### 📊 Looker Integration
- **Models & Explores**: Browse available data models and explores
- **Dimensions & Measures**: Access all available metrics and dimensions
- **Dynamic Queries**: Execute custom queries with filters and sorting
- **Saved Looks**: Create and execute saved visualizations
- **Dashboards**: Build and manage electricity monitoring dashboards
- **SQL Generation**: Generate optimized SQL from semantic queries
- **URL Generation**: Create shareable links to Looker explores

### 🛠 MCP Tools (14 Functions)

1. **`looker-get-models`** - Get all models in the Looker source
2. **`looker-get-explores`** - Get all explores for a given model
3. **`looker-get-dimensions`** - Get all dimensions from an explore
4. **`looker-get-measures`** - Get all measures from an explore
5. **`looker-get-filters`** - Get all filters from an explore
6. **`looker-get-parameters`** - Get all parameters from an explore
7. **`looker-get-looks`** - Search for saved Looks
8. **`looker-run-look`** - Execute a saved Look and get results
9. **`looker-make-look`** - Create a new Look in personal folder
10. **`looker-get-dashboards`** - Search for dashboards
11. **`looker-make-dashboard`** - Create a new dashboard
12. **`looker-add-dashboard-element`** - Add visualizations to dashboards
13. **`looker-query`** - Run inline queries using semantic model
14. **`looker-query-sql`** - Generate SQL from semantic queries
15. **`looker-query-url`** - Generate URLs to Looker explores
16. **`looker-analyze-electricity`** - Comprehensive electricity analysis

## Setup

### Prerequisites

- Node.js >= 18.0.0
- TypeScript
- Access to a Looker instance with API credentials
- Electricity data models configured in Looker

### Installation

1. **Install dependencies:**
   ```bash
   cd api/app/clients/mcp/toki-looker-server
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Looker API Configuration
   LOOKER_BASE_URL=https://your-looker-instance.com
   LOOKER_CLIENT_ID=your_client_id
   LOOKER_CLIENT_SECRET=your_client_secret
   
   # Logging
   LOG_LEVEL=info
   NODE_ENV=production
   ```

3. **Build the server:**
   ```bash
   npm run build
   ```

4. **Test the server:**
   ```bash
   npm run start
   ```

### Looker Configuration

Ensure your Looker instance has:

1. **API User**: Create an API user with appropriate permissions
2. **Electricity Model**: Data model with electricity metrics including:
   - `electricity_metrics` explore with dimensions and measures for:
     - Consumption (kWh)
     - Generation (kWh) 
     - Grid import/export (kWh)
     - Battery charge/discharge (kWh)
     - Demand (kW)
     - Costs (EUR)
     - Carbon emissions (kg CO2)
     - Timestamps and time dimensions

3. **Permissions**: Ensure API user has access to:
   - Create and edit personal content
   - Access electricity data models
   - Run queries and access results

## Usage

### Basic Electricity Analysis

```javascript
// Get available models
await callTool('looker-get-models', {});

// Explore electricity data structure
await callTool('looker-get-explores', {
  model: 'electricity'
});

// Get consumption and generation metrics
await callTool('looker-get-measures', {
  model: 'electricity',
  explore: 'electricity_metrics'
});

// Run comprehensive electricity analysis
await callTool('looker-analyze-electricity', {
  time_range: {
    start: '2024-01-01',
    end: '2024-01-31'
  },
  metrics: [
    'consumption_kwh',
    'generation_kwh',
    'grid_import_kwh',
    'cost_eur',
    'carbon_emissions_kg'
  ],
  group_by: 'day',
  include_forecasting: true,
  include_comparisons: true
});
```

### Creating Dashboards

```javascript
// Create a new electricity monitoring dashboard
await callTool('looker-make-dashboard', {
  title: 'Electricity Monitoring Dashboard',
  description: 'Real-time electricity consumption and generation monitoring'
});

// Create a consumption analysis look
await callTool('looker-make-look', {
  title: 'Daily Electricity Consumption',
  model: 'electricity',
  explore: 'electricity_metrics',
  dimensions: ['electricity_metrics.timestamp_date'],
  measures: ['electricity_metrics.consumption_kwh', 'electricity_metrics.cost_eur'],
  filters: {
    'electricity_metrics.timestamp_date': '7 days ago for 7 days'
  },
  sorts: ['electricity_metrics.timestamp_date']
});
```

### Advanced Queries

```javascript
// Custom query for peak demand analysis
await callTool('looker-query', {
  model: 'electricity',
  explore: 'electricity_metrics',
  dimensions: [
    'electricity_metrics.timestamp_hour_of_day',
    'electricity_metrics.timestamp_day_of_week'
  ],
  measures: [
    'electricity_metrics.average_demand_kw',
    'electricity_metrics.peak_demand_kw'
  ],
  filters: {
    'electricity_metrics.timestamp_date': '30 days ago for 30 days'
  },
  sorts: ['electricity_metrics.peak_demand_kw desc'],
  limit: 100
});

// Generate SQL for custom analysis
await callTool('looker-query-sql', {
  model: 'electricity',
  explore: 'electricity_metrics',
  dimensions: ['electricity_metrics.timestamp_date'],
  measures: ['electricity_metrics.net_consumption_kwh'],
  filters: {
    'electricity_metrics.timestamp_date': 'this month'
  }
});
```

## Development

### Project Structure

```
toki-looker-server/
├── src/
│   ├── core/           # Core utilities (Logger)
│   ├── interfaces/     # TypeScript interfaces
│   ├── services/       # Business logic (LookerService)
│   ├── server/         # MCP server and tool handlers
│   │   └── tools/      # Tool handler implementations
│   └── index.ts        # Main entry point
├── types/              # Type definitions
│   ├── looker.ts       # Looker API types
│   ├── errors.ts       # Custom error types
│   └── index.ts        # Type exports
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # This file
```

### Building

```bash
# Development with watch mode
npm run dev

# Production build
npm run build

# Type checking only
npm run type-check
```

### Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Configuration

### Environment Variables

| Variable               | Required | Description                              |
| ---------------------- | -------- | ---------------------------------------- |
| `LOOKER_BASE_URL`      | Yes      | Base URL of your Looker instance         |
| `LOOKER_CLIENT_ID`     | Yes      | Looker API client ID                     |
| `LOOKER_CLIENT_SECRET` | Yes      | Looker API client secret                 |
| `LOG_LEVEL`            | No       | Logging level (debug, info, warn, error) |
| `NODE_ENV`             | No       | Environment (development, production)    |

### Error Handling

The server includes comprehensive error handling for:

- **Authentication Errors**: Invalid credentials or expired tokens
- **Authorization Errors**: Insufficient permissions
- **Rate Limiting**: Looker API rate limits
- **Network Errors**: Connection issues
- **Validation Errors**: Invalid request parameters
- **Not Found Errors**: Missing resources

## Electricity Analytics Features

### Metrics Supported

- **Energy (kWh)**:
  - Total consumption
  - Renewable generation (solar, wind)
  - Grid import/export
  - Battery storage cycles

- **Power (kW)**:
  - Real-time demand
  - Peak demand tracking
  - Load profiling

- **Economics**:
  - Cost analysis (EUR)
  - Tariff optimization
  - ROI calculations

- **Environmental**:
  - Carbon emissions (kg CO2)
  - Renewable percentage
  - Grid dependency metrics

### Analysis Types

1. **Time Series Analysis**: Hourly, daily, weekly, monthly, yearly aggregations
2. **Comparative Analysis**: Period-over-period comparisons
3. **Trend Analysis**: Consumption, generation, and cost trends
4. **Efficiency Analysis**: Self-sufficiency ratios, grid dependency
5. **Forecasting**: Predictive analytics for future consumption (when configured)

## Integration Examples

### Claude/ChatGPT Integration

This MCP server can be used with AI assistants to provide natural language access to electricity analytics:

*"Show me this month's electricity consumption vs generation"*
*"What was our peak demand yesterday and when did it occur?"*
*"Create a dashboard showing our solar generation efficiency"*
*"Compare our electricity costs from this quarter vs last quarter"*

### Custom Applications

The server can also be integrated into custom applications for:

- Energy management systems
- Building automation platforms
- Sustainability reporting tools
- Cost optimization applications

## Support

For technical support or feature requests:
1. Check the existing documentation
2. Review error logs for specific issues
3. Ensure Looker permissions are correctly configured
4. Verify environment variables are set correctly

## License

This project is licensed under the MIT License - see the LICENSE file for details.
