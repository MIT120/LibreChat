# CS2 MCP Server

A Model Context Protocol (MCP) server that provides Counter-Strike 2 match data and predictions to Anthropic agents through LibreChat.

## Overview

The CS2 MCP Server exposes CS2 match data, team statistics, and prediction capabilities through the MCP protocol, allowing Anthropic agents to analyze historical and real-time match information for predictions and analysis.

## Features

- **Match Data Retrieval**: Get comprehensive match information by ID, team, date range, or status
- **Team Statistics**: Access detailed team performance metrics and recent form
- **Match Predictions**: Generate probability-based predictions for half-time results, map winners, and series outcomes
- **Real-time Data**: Support for live match data and upcoming match information
- **Historical Analysis**: Access to historical match data for pattern recognition

## Tools

### get_match_data

Retrieve CS2 match information by various criteria.

**Parameters:**
- `matchId` (string, optional): HLTV match ID for specific match
- `teamName` (string, optional): Team name to find matches for
- `dateRange` (object, optional): Date range with `start` and `end` properties
- `status` (string, optional): Match status filter (`upcoming`, `live`, `finished`)
- `limit` (number, optional): Maximum number of matches to return (default: 10)

**Example:**
```json
{
  "matchId": "2374849",
  "status": "finished"
}
```

### get_team_stats

Get comprehensive team statistics and recent form.

**Parameters:**
- `teamName` (string, required): Team name to get statistics for
- `mapName` (string, optional): Specific map to get statistics for
- `timeframe` (string, optional): Time period (`1month`, `3months`, `6months`, `1year`)

**Example:**
```json
{
  "teamName": "Natus Vincere",
  "mapName": "de_mirage",
  "timeframe": "3months"
}
```

### predict_match_outcome

Generate predictions for match outcomes with probabilities.

**Parameters:**
- `matchId` (string, required): HLTV match ID to generate predictions for
- `predictionType` (string, required): Type of prediction (`half_time`, `map_winner`, `series_outcome`)

**Example:**
```json
{
  "matchId": "2374849",
  "predictionType": "map_winner"
}
```

## Installation

1. Ensure the CS2 data models and scraper services are set up
2. Add the MCP server configuration to your `librechat.yaml` file:

```yaml
mcpServers:
  cs2-hltv:
    type: stdio
    command: node
    args:
      - api/server/services/CS2/mcp-server.js
    timeout: 60000
    serverInstructions: |
      This server provides access to Counter-Strike 2 match data from HLTV.
      Use it to get match information, team statistics, and predictions.
```

3. Restart LibreChat to load the new MCP server

## Usage Examples

### Getting Recent Matches for a Team

```javascript
// Agent request
{
  "tool": "get_match_data",
  "arguments": {
    "teamName": "Astralis",
    "status": "finished",
    "limit": 5
  }
}
```

### Analyzing Team Performance on Specific Map

```javascript
// Agent request
{
  "tool": "get_team_stats",
  "arguments": {
    "teamName": "FaZe Clan",
    "mapName": "de_inferno",
    "timeframe": "3months"
  }
}
```

### Predicting Match Outcome

```javascript
// Agent request
{
  "tool": "predict_match_outcome",
  "arguments": {
    "matchId": "2374849",
    "predictionType": "series_outcome"
  }
}
```

## Response Format

All tools return structured JSON responses with relevant data:

- **Match Data**: Includes match details, team information, maps, scores, and predictions
- **Team Stats**: Provides win rates, recent form, map-specific performance, and ranking
- **Predictions**: Returns winner predictions, probabilities, confidence levels, and influencing factors

## Error Handling

The server handles various error scenarios gracefully:

- **Database Errors**: Returns error messages with context
- **Invalid Parameters**: Validates input and provides helpful error messages
- **Missing Data**: Handles cases where teams or matches are not found
- **Timeout Handling**: Respects configured timeout limits

## Development

### Running Tests

```bash
npm test -- api/server/services/CS2/CS2MCPServer.test.js
```

### Running the Server Standalone

```bash
node api/server/services/CS2/mcp-server.js
```

### Debugging

Set the `DEBUG` environment variable to enable detailed logging:

```bash
DEBUG=cs2:mcp node api/server/services/CS2/mcp-server.js
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- MongoDB with Mongoose: Data storage and retrieval
- CS2 data models: Match, Team, and Player schemas

## Security Considerations

- Input validation and sanitization for all tool parameters
- Database query optimization to prevent performance issues
- Rate limiting considerations for production deployment
- Authentication integration with LibreChat's user system

## Future Enhancements

- Real-time match updates through WebSocket connections
- Advanced prediction algorithms with machine learning
- Player-specific statistics and performance metrics
- Tournament bracket and standings information
- Integration with live match streaming data

## Troubleshooting

### Common Issues

1. **Server won't start**: Check database connection and ensure all dependencies are installed
2. **Tools not appearing**: Verify MCP server configuration in `librechat.yaml`
3. **Database errors**: Ensure CS2 data models are properly set up and database is accessible
4. **Timeout errors**: Increase timeout value in configuration for complex queries

### Logs

Check LibreChat logs for MCP server initialization and error messages:

```bash
# Look for CS2MCPServer entries in logs
grep "CS2MCPServer" logs/debug-*.log
```

## Contributing

When contributing to the CS2 MCP server:

1. Follow the existing code style and patterns
2. Add comprehensive tests for new functionality
3. Update documentation for any API changes
4. Ensure error handling is robust and user-friendly
5. Test with real data scenarios and edge cases