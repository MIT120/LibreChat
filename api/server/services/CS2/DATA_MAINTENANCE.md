# CS2 Data Maintenance System

This document describes the data cleanup and maintenance system for the CS2 HLTV scraper, which ensures data quality, consistency, and optimal database performance.

## Overview

The data maintenance system consists of several components:

- **DataMaintenanceService**: Core service for data cleanup operations
- **MaintenanceScheduler**: Automated scheduling of maintenance tasks
- **CLI Tool**: Command-line interface for manual maintenance operations

## Features

### Data Deduplication
- Removes duplicate matches, teams, and players based on HLTV IDs
- Preserves the most recent record when duplicates are found
- Updates references to maintain data integrity

### Consistency Checks
- Identifies and fixes orphaned references between collections
- Corrects invalid match statuses
- Adds missing metadata fields with default values

### Data Archival
- Archives old match data to reduce database size
- Configurable retention periods (default: 1 year archive, 2 years deletion)
- Maintains data integrity during archival process

### Database Optimization
- Rebuilds database indexes for optimal query performance
- Analyzes query patterns and suggests index improvements
- Provides database health metrics and statistics

## Usage

### Programmatic Usage

```javascript
const { DataMaintenanceService, MaintenanceScheduler } = require('~/server/services/CS2');

// Create service instance
const maintenanceService = new DataMaintenanceService();

// Run complete maintenance routine
const results = await maintenanceService.runMaintenanceRoutine({
  includeDuplicateRemoval: true,
  includeConsistencyCheck: true,
  includeArchival: true,
  includeIndexOptimization: true,
  dryRun: false // Set to true for testing
});

// Start automated scheduler
const scheduler = new MaintenanceScheduler();
scheduler.start({
  enableDailyMaintenance: true,
  enableWeeklyMaintenance: true,
  enableMonthlyArchival: true
});
```

### CLI Usage

The maintenance CLI provides easy access to all maintenance operations:

```bash
# Run complete maintenance routine
npm run cs2-maintenance run

# Run in dry-run mode (no changes made)
npm run cs2-maintenance run --dry-run

# Remove duplicates only
npm run cs2-maintenance duplicates

# Check data consistency
npm run cs2-maintenance consistency

# Archive old data
npm run cs2-maintenance archive --archive-days 365 --delete-days 730

# Optimize database indexes
npm run cs2-maintenance indexes

# Check database health
npm run cs2-maintenance health

# Show maintenance statistics
npm run cs2-maintenance stats

# Start maintenance scheduler
npm run cs2-maintenance scheduler start

# Check scheduler status
npm run cs2-maintenance scheduler status
```

### Available CLI Commands

| Command | Description | Options |
|---------|-------------|---------|
| `run` | Complete maintenance routine | `--dry-run`, `--no-duplicates`, `--no-consistency`, `--no-archival`, `--no-indexes` |
| `duplicates` | Remove duplicate records | `--dry-run` |
| `consistency` | Fix data consistency issues | `--dry-run` |
| `archive` | Archive old match data | `--dry-run`, `--archive-days <days>`, `--delete-days <days>` |
| `indexes` | Optimize database indexes | `--dry-run` |
| `health` | Check database health | None |
| `stats` | Show maintenance statistics | `--reset` |
| `scheduler start` | Start maintenance scheduler | `--daily-cron <cron>`, `--weekly-cron <cron>`, `--monthly-cron <cron>`, `--no-daily`, `--no-weekly`, `--no-monthly` |
| `scheduler status` | Show scheduler status | None |

## Scheduled Maintenance

The system supports automated maintenance through configurable cron jobs:

### Default Schedule
- **Daily Maintenance** (2:00 AM UTC): Duplicate removal and consistency checks
- **Weekly Maintenance** (3:00 AM UTC Sundays): Full maintenance with index optimization
- **Monthly Archival** (4:00 AM UTC 1st of month): Complete maintenance with data archival

### Configuration Options

```javascript
const config = {
  // Cron expressions
  dailyMaintenanceCron: '0 2 * * *',
  weeklyMaintenanceCron: '0 3 * * 0',
  monthlyArchivalCron: '0 4 1 * *',
  
  // Enable/disable specific tasks
  enableDailyMaintenance: true,
  enableWeeklyMaintenance: true,
  enableMonthlyArchival: true
};

scheduler.start(config);
```

## Maintenance Operations

### 1. Duplicate Removal

Identifies and removes duplicate records across all CS2 collections:

- **Matches**: Duplicates identified by `hltvId`
- **Teams**: Duplicates identified by `hltvId`
- **Players**: Duplicates identified by `hltvId`

When duplicates are found, the system:
1. Keeps the most recently created record
2. Updates all references to point to the kept record
3. Removes the duplicate records

### 2. Consistency Checks

Ensures data integrity across collections:

- **Orphaned References**: Removes references to non-existent records
- **Invalid Statuses**: Corrects match statuses based on date and completion
- **Missing Metadata**: Adds required metadata fields with default values

### 3. Data Archival

Manages database size by archiving old data:

- **Archive Phase**: Marks old matches as archived (default: 365 days)
- **Deletion Phase**: Permanently removes very old archived data (default: 730 days)
- **Configurable Retention**: Customize retention periods based on requirements

### 4. Index Optimization

Maintains optimal database performance:

- **Index Rebuilding**: Rebuilds all indexes for better performance
- **Performance Analysis**: Analyzes query patterns and suggests improvements
- **Statistics Collection**: Provides detailed index usage statistics

## Monitoring and Alerting

### Health Metrics

The system provides comprehensive health metrics:

```javascript
const health = await maintenanceService.getDatabaseHealth();

// Returns:
{
  database: {
    name: 'database_name',
    collections: 3,
    objects: 150000,
    dataSize: 104857600,  // bytes
    storageSize: 209715200,
    indexSize: 52428800
  },
  collections: {
    cs2matches: {
      count: 50000,
      size: 52428800,
      avgObjSize: 1048.576,
      indexCount: 5,
      indexSize: 10485760
    },
    // ... other collections
  },
  maintenance: {
    duplicatesRemoved: 150,
    inconsistenciesFixed: 25,
    recordsArchived: 5000,
    indexesOptimized: 12,
    lastMaintenanceRun: '2024-01-15T02:00:00.000Z'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### Maintenance Statistics

Track maintenance operations over time:

```javascript
const stats = maintenanceService.getMaintenanceStats();

// Returns:
{
  duplicatesRemoved: 150,
  inconsistenciesFixed: 25,
  recordsArchived: 5000,
  indexesOptimized: 12,
  lastMaintenanceRun: '2024-01-15T02:00:00.000Z'
}
```

### Error Handling and Alerts

The system includes comprehensive error handling:

- **Graceful Degradation**: Continues operation even if individual tasks fail
- **Error Logging**: Detailed error logs for troubleshooting
- **Alert Generation**: Configurable alerts for maintenance issues
- **Dry Run Mode**: Test operations without making changes

## Best Practices

### Regular Maintenance
- Run daily maintenance for active systems
- Perform weekly deep maintenance during low-traffic periods
- Schedule monthly archival to manage database growth

### Monitoring
- Monitor database health metrics regularly
- Set up alerts for maintenance failures
- Track maintenance statistics to identify trends

### Testing
- Always test maintenance operations in staging first
- Use dry-run mode to preview changes
- Backup database before major maintenance operations

### Performance
- Schedule intensive operations during off-peak hours
- Monitor system resources during maintenance
- Adjust retention periods based on storage constraints

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce batch sizes or run maintenance during off-peak hours
2. **Long Execution Times**: Check database indexes and consider running operations separately
3. **Duplicate Detection Failures**: Verify HLTV ID uniqueness constraints
4. **Archival Errors**: Check disk space and database permissions

### Debug Mode

Enable detailed logging for troubleshooting:

```javascript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';

// Run maintenance with detailed logging
const results = await maintenanceService.runMaintenanceRoutine({
  dryRun: true // Safe for debugging
});
```

### Recovery Procedures

If maintenance operations fail:

1. Check error logs for specific failure reasons
2. Verify database connectivity and permissions
3. Run individual operations to isolate issues
4. Use dry-run mode to test fixes
5. Restore from backup if data corruption occurs

## Integration

### With Existing Services

The maintenance system integrates seamlessly with other CS2 services:

```javascript
// In your main application
const { MaintenanceScheduler } = require('~/server/services/CS2');

// Start scheduler when application starts
const scheduler = new MaintenanceScheduler();
scheduler.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  scheduler.stop();
});
```

### Custom Maintenance Tasks

Extend the system with custom maintenance operations:

```javascript
class CustomMaintenanceService extends DataMaintenanceService {
  async runCustomCleanup() {
    // Your custom cleanup logic
    logger.info('Running custom cleanup');
    
    // Use existing methods
    const duplicates = await this.findDuplicateMatches();
    
    // Return results in standard format
    return { cleaned: duplicates.length, errors: [] };
  }
}
```

## Configuration

### Environment Variables

```bash
# Database connection
MONGODB_URI=mongodb://localhost:27017/librechat

# Maintenance settings
CS2_MAINTENANCE_ENABLED=true
CS2_ARCHIVE_AFTER_DAYS=365
CS2_DELETE_AFTER_DAYS=730

# Scheduler settings
CS2_DAILY_MAINTENANCE_CRON="0 2 * * *"
CS2_WEEKLY_MAINTENANCE_CRON="0 3 * * 0"
CS2_MONTHLY_ARCHIVAL_CRON="0 4 1 * *"
```

### Database Indexes

Ensure these indexes exist for optimal performance:

```javascript
// CS2 Match indexes
db.cs2matches.createIndex({ "hltvId": 1 }, { unique: true })
db.cs2matches.createIndex({ "date": -1 })
db.cs2matches.createIndex({ "teams.team": 1 })
db.cs2matches.createIndex({ "status": 1 })
db.cs2matches.createIndex({ "metadata.archived": 1 })

// CS2 Team indexes
db.cs2teams.createIndex({ "hltvId": 1 }, { unique: true })
db.cs2teams.createIndex({ "name": 1 })
db.cs2teams.createIndex({ "ranking.current": 1 })

// CS2 Player indexes
db.cs2players.createIndex({ "hltvId": 1 }, { unique: true })
db.cs2players.createIndex({ "nickname": 1 })
db.cs2players.createIndex({ "currentTeam.team": 1 })
```

## API Reference

### DataMaintenanceService

#### Methods

- `runMaintenanceRoutine(options)`: Run complete maintenance routine
- `removeDuplicates(options)`: Remove duplicate records
- `checkAndFixConsistency(options)`: Fix data consistency issues
- `archiveOldData(options)`: Archive old match data
- `optimizeIndexes(options)`: Optimize database indexes
- `getDatabaseHealth()`: Get database health metrics
- `getMaintenanceStats()`: Get maintenance statistics
- `resetMaintenanceStats()`: Reset maintenance statistics

### MaintenanceScheduler

#### Methods

- `start(config)`: Start scheduled maintenance tasks
- `stop()`: Stop all scheduled tasks
- `runMaintenanceOnDemand(options)`: Run maintenance immediately
- `getStatus()`: Get scheduler status
- `updateConfig(config)`: Update scheduler configuration
- `getDatabaseHealth()`: Get database health metrics
- `resetStats()`: Reset maintenance statistics

## License

This maintenance system is part of the LibreChat project and follows the same licensing terms.