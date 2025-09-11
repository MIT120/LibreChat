# Toki Looker MCP Server Setup Guide

## Prerequisites

Before setting up the Toki Looker MCP Server, ensure you have:

1. **Node.js 18+** installed on your system
2. **Looker instance** with API access enabled
3. **Looker API credentials** (client ID and secret)
4. **Electricity data models** configured in your Looker instance

## Quick Start

### 1. Environment Configuration

Create a `.env` file in the server directory with your Looker configuration:

```env
# Required: Looker API Configuration
LOOKER_BASE_URL=https://your-company.looker.com
LOOKER_CLIENT_ID=your_api_client_id
LOOKER_CLIENT_SECRET=your_api_client_secret

# Optional: Logging and Environment
LOG_LEVEL=info
NODE_ENV=production
```

### 2. Installation

Navigate to the server directory and install dependencies:

```bash
cd api/app/clients/mcp/toki-looker-server
npm install
```

### 3. Build the Server

Compile the TypeScript code:

```bash
npm run build
```

### 4. Test the Server

Test the server connectivity:

```bash
npm start
```

## Looker Configuration

### Required Models

Your Looker instance should have the following data structure for electricity analytics:

#### Electricity Metrics Model

```lookml
explore: electricity_metrics {
  label: "Electricity Metrics"
  
  dimension: timestamp_date {
    type: date
    sql: ${TABLE}.timestamp ;;
  }
  
  dimension: timestamp_hour {
    type: date_time
    sql: ${TABLE}.timestamp ;;
  }
  
  dimension: timestamp_hour_of_day {
    type: number
    sql: EXTRACT(HOUR FROM ${TABLE}.timestamp) ;;
  }
  
  dimension: timestamp_day_of_week {
    type: number
    sql: EXTRACT(DAYOFWEEK FROM ${TABLE}.timestamp) ;;
  }
  
  measure: consumption_kwh {
    type: sum
    sql: ${TABLE}.consumption_kwh ;;
    label: "Total Consumption (kWh)"
  }
  
  measure: generation_kwh {
    type: sum
    sql: ${TABLE}.generation_kwh ;;
    label: "Total Generation (kWh)"
  }
  
  measure: solar_generation_kwh {
    type: sum
    sql: ${TABLE}.solar_generation_kwh ;;
    label: "Solar Generation (kWh)"
  }
  
  measure: wind_generation_kwh {
    type: sum
    sql: ${TABLE}.wind_generation_kwh ;;
    label: "Wind Generation (kWh)"
  }
  
  measure: grid_import_kwh {
    type: sum
    sql: ${TABLE}.grid_import_kwh ;;
    label: "Grid Import (kWh)"
  }
  
  measure: grid_export_kwh {
    type: sum
    sql: ${TABLE}.grid_export_kwh ;;
    label: "Grid Export (kWh)"
  }
  
  measure: battery_charge_kwh {
    type: sum
    sql: ${TABLE}.battery_charge_kwh ;;
    label: "Battery Charge (kWh)"
  }
  
  measure: battery_discharge_kwh {
    type: sum
    sql: ${TABLE}.battery_discharge_kwh ;;
    label: "Battery Discharge (kWh)"
  }
  
  measure: average_demand_kw {
    type: average
    sql: ${TABLE}.demand_kw ;;
    label: "Average Demand (kW)"
  }
  
  measure: peak_demand_kw {
    type: max
    sql: ${TABLE}.demand_kw ;;
    label: "Peak Demand (kW)"
  }
  
  measure: total_cost_eur {
    type: sum
    sql: ${TABLE}.cost_eur ;;
    label: "Total Cost (EUR)"
    value_format: "€#,##0.00"
  }
  
  measure: total_emissions_kg {
    type: sum
    sql: ${TABLE}.carbon_emissions_kg ;;
    label: "Total Carbon Emissions (kg CO2)"
  }
  
  measure: net_consumption_kwh {
    type: number
    sql: ${consumption_kwh} - COALESCE(${generation_kwh}, 0) ;;
    label: "Net Consumption (kWh)"
  }
}
```

### API User Setup

1. **Create API User**: Create a dedicated user for the MCP server
2. **Generate API Credentials**: 
   - Go to Admin > Users
   - Select the API user
   - Go to API Keys section
   - Generate new API3 key
3. **Set Permissions**: Ensure the user has access to:
   - View and run electricity data models
   - Create personal content (looks, dashboards)
   - Access API endpoints

### Data Source Configuration

Ensure your electricity data is properly modeled with:

- **Timestamp fields** for time-series analysis
- **Consumption metrics** in kWh
- **Generation metrics** by source type
- **Grid interaction** metrics (import/export)
- **Battery storage** metrics
- **Cost information** in EUR
- **Environmental data** (emissions)

## Integration with LibreChat

The server is pre-configured to work with LibreChat. The configuration in `librechat.yaml` includes:

```yaml
mcpServers:
  toki-looker:
    command: node
    args:
      - api/app/clients/mcp/toki-looker-server/dist/src/index.js
    env:
      NODE_ENV: production
      LOG_LEVEL: info
      LOOKER_BASE_URL: ${LOOKER_BASE_URL}
      LOOKER_CLIENT_ID: ${LOOKER_CLIENT_ID}
      LOOKER_CLIENT_SECRET: ${LOOKER_CLIENT_SECRET}
    timeout: 120000
    disabled: false
    chatMenu: true
    startup: true
    description: "Toki Looker Analytics and Electricity Statistics Server"
```

## Available Tools

Once configured, the server provides 16 tools:

### Core Looker Tools
- `looker-get-models` - Browse available data models
- `looker-get-explores` - Get explore definitions
- `looker-get-dimensions` - Get available dimensions
- `looker-get-measures` - Get available measures
- `looker-get-filters` - Get filterable fields
- `looker-get-parameters` - Get query parameters

### Query and Visualization Tools
- `looker-query` - Execute custom queries
- `looker-query-sql` - Generate SQL from queries
- `looker-query-url` - Generate shareable URLs
- `looker-get-looks` - Browse saved visualizations
- `looker-run-look` - Execute saved looks
- `looker-make-look` - Create new visualizations

### Dashboard Tools
- `looker-get-dashboards` - Browse dashboards
- `looker-make-dashboard` - Create new dashboards
- `looker-add-dashboard-element` - Add tiles to dashboards

### Electricity Analytics
- `looker-analyze-electricity` - Comprehensive electricity analysis with trends, forecasting, and comparisons

## Usage Examples

### Basic Data Exploration

```text
Human: Show me what electricity data is available in Looker

Assistant will use:
1. looker-get-models (to find electricity model)
2. looker-get-explores (to see electricity_metrics explore)
3. looker-get-measures (to show available metrics)
```

### Consumption Analysis

```text
Human: Analyze our electricity consumption for the last 30 days

Assistant will use:
looker-analyze-electricity with parameters:
- time_range: last 30 days
- metrics: consumption_kwh, cost_eur, peak_demand_kw
- group_by: day
- include_comparisons: true
```

### Dashboard Creation

```text
Human: Create a dashboard to monitor our solar generation

Assistant will use:
1. looker-make-dashboard (create dashboard)
2. looker-make-look (create solar generation chart)
3. looker-add-dashboard-element (add chart to dashboard)
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify LOOKER_BASE_URL is correct
   - Check CLIENT_ID and CLIENT_SECRET
   - Ensure API user has proper permissions

2. **No Data Returned**
   - Verify electricity data models exist in Looker
   - Check data source connections
   - Ensure proper field names in models

3. **Query Timeouts**
   - Increase timeout in librechat.yaml
   - Optimize Looker model performance
   - Add appropriate indexes to data source

4. **Permission Errors**
   - Check API user permissions in Looker
   - Verify access to electricity models
   - Ensure content creation permissions

### Logging

Set `LOG_LEVEL=debug` in your environment to see detailed logs:

```bash
LOG_LEVEL=debug npm start
```

### Testing Connection

Test Looker connectivity:

```bash
# Test build
npm run build

# Test server startup
npm start

# Check server status (in separate terminal)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

## Support

For additional support:
1. Check server logs for specific error messages
2. Verify Looker model configuration
3. Test API credentials directly with Looker API
4. Ensure all environment variables are properly set
