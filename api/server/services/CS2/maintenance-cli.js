#!/usr/bin/env node

/**
 * CLI utility for running CS2 data maintenance operations
 * Usage: node maintenance-cli.js [command] [options]
 */

const { program } = require('commander');
const DataMaintenanceService = require('./DataMaintenanceService');
const MaintenanceScheduler = require('./MaintenanceScheduler');
const logger = require('~/utils/logger');

// Initialize services
const maintenanceService = new DataMaintenanceService();
const scheduler = new MaintenanceScheduler();

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Print results in a formatted way
 */
function printResults(results, operation = 'Maintenance') {
  console.log(`\n${operation} Results:`);
  console.log('='.repeat(50));
  
  if (results.duplicatesRemoved !== undefined) {
    console.log(`Duplicates removed: ${results.duplicatesRemoved}`);
  }
  
  if (results.inconsistenciesFixed !== undefined) {
    console.log(`Inconsistencies fixed: ${results.inconsistenciesFixed}`);
  }
  
  if (results.recordsArchived !== undefined) {
    console.log(`Records archived: ${results.recordsArchived}`);
  }
  
  if (results.indexesOptimized !== undefined) {
    console.log(`Indexes optimized: ${results.indexesOptimized}`);
  }
  
  if (results.duration !== undefined) {
    console.log(`Duration: ${formatDuration(results.duration)}`);
  }
  
  if (results.errors && results.errors.length > 0) {
    console.log(`\nErrors (${results.errors.length}):`);
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log('\nNo errors encountered.');
  }
  
  console.log('='.repeat(50));
}

/**
 * Print database health information
 */
function printDatabaseHealth(health) {
  console.log('\nDatabase Health:');
  console.log('='.repeat(50));
  
  console.log(`Database: ${health.database.name}`);
  console.log(`Collections: ${health.database.collections}`);
  console.log(`Total Objects: ${health.database.objects.toLocaleString()}`);
  console.log(`Data Size: ${(health.database.dataSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Storage Size: ${(health.database.storageSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Index Size: ${(health.database.indexSize / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('\nCollection Statistics:');
  Object.entries(health.collections).forEach(([name, stats]) => {
    if (stats.error) {
      console.log(`  ${name}: ${stats.error}`);
    } else {
      console.log(`  ${name}: ${stats.count.toLocaleString()} documents, ${(stats.size / 1024).toFixed(2)} KB`);
    }
  });
  
  console.log('\nMaintenance Statistics:');
  const maintenance = health.maintenance;
  console.log(`  Duplicates removed (total): ${maintenance.duplicatesRemoved}`);
  console.log(`  Inconsistencies fixed (total): ${maintenance.inconsistenciesFixed}`);
  console.log(`  Records archived (total): ${maintenance.recordsArchived}`);
  console.log(`  Indexes optimized (total): ${maintenance.indexesOptimized}`);
  console.log(`  Last maintenance run: ${maintenance.lastMaintenanceRun || 'Never'}`);
  
  console.log('='.repeat(50));
}

// Configure CLI commands
program
  .name('cs2-maintenance')
  .description('CS2 data maintenance utility')
  .version('1.0.0');

// Full maintenance command
program
  .command('run')
  .description('Run complete maintenance routine')
  .option('--dry-run', 'Run in dry-run mode (no changes made)')
  .option('--no-duplicates', 'Skip duplicate removal')
  .option('--no-consistency', 'Skip consistency checks')
  .option('--no-archival', 'Skip data archival')
  .option('--no-indexes', 'Skip index optimization')
  .action(async (options) => {
    try {
      console.log('Starting complete maintenance routine...');
      
      const results = await maintenanceService.runMaintenanceRoutine({
        dryRun: options.dryRun || false,
        includeDuplicateRemoval: !options.noDuplicates,
        includeConsistencyCheck: !options.noConsistency,
        includeArchival: !options.noArchival,
        includeIndexOptimization: !options.noIndexes,
      });
      
      printResults(results, 'Complete Maintenance');
      
      if (options.dryRun) {
        console.log('\n⚠️  This was a dry run - no changes were made to the database.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Maintenance failed:', error.message);
      process.exit(1);
    }
  });

// Duplicate removal command
program
  .command('duplicates')
  .description('Remove duplicate records')
  .option('--dry-run', 'Run in dry-run mode (no changes made)')
  .action(async (options) => {
    try {
      console.log('Starting duplicate removal...');
      
      const results = await maintenanceService.removeDuplicates({
        dryRun: options.dryRun || false,
      });
      
      printResults(results, 'Duplicate Removal');
      
      if (options.dryRun) {
        console.log('\n⚠️  This was a dry run - no changes were made to the database.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Duplicate removal failed:', error.message);
      process.exit(1);
    }
  });

// Consistency check command
program
  .command('consistency')
  .description('Check and fix data consistency issues')
  .option('--dry-run', 'Run in dry-run mode (no changes made)')
  .action(async (options) => {
    try {
      console.log('Starting consistency checks...');
      
      const results = await maintenanceService.checkAndFixConsistency({
        dryRun: options.dryRun || false,
      });
      
      printResults(results, 'Consistency Check');
      
      if (options.dryRun) {
        console.log('\n⚠️  This was a dry run - no changes were made to the database.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Consistency check failed:', error.message);
      process.exit(1);
    }
  });

// Archive command
program
  .command('archive')
  .description('Archive old match data')
  .option('--dry-run', 'Run in dry-run mode (no changes made)')
  .option('--archive-days <days>', 'Archive matches older than N days', '365')
  .option('--delete-days <days>', 'Delete archived matches older than N days', '730')
  .action(async (options) => {
    try {
      console.log('Starting data archival...');
      
      const results = await maintenanceService.archiveOldData({
        dryRun: options.dryRun || false,
        archiveAfterDays: parseInt(options.archiveDays),
        deleteAfterDays: parseInt(options.deleteDays),
      });
      
      printResults(results, 'Data Archival');
      
      if (options.dryRun) {
        console.log('\n⚠️  This was a dry run - no changes were made to the database.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Data archival failed:', error.message);
      process.exit(1);
    }
  });

// Index optimization command
program
  .command('indexes')
  .description('Optimize database indexes')
  .option('--dry-run', 'Run in dry-run mode (no changes made)')
  .action(async (options) => {
    try {
      console.log('Starting index optimization...');
      
      const results = await maintenanceService.optimizeIndexes({
        dryRun: options.dryRun || false,
      });
      
      printResults(results, 'Index Optimization');
      
      if (options.dryRun) {
        console.log('\n⚠️  This was a dry run - no changes were made to the database.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Index optimization failed:', error.message);
      process.exit(1);
    }
  });

// Health check command
program
  .command('health')
  .description('Check database health and statistics')
  .action(async () => {
    try {
      console.log('Checking database health...');
      
      const health = await maintenanceService.getDatabaseHealth();
      printDatabaseHealth(health);
      
      process.exit(0);
    } catch (error) {
      console.error('Health check failed:', error.message);
      process.exit(1);
    }
  });

// Statistics command
program
  .command('stats')
  .description('Show maintenance statistics')
  .option('--reset', 'Reset statistics after showing them')
  .action(async (options) => {
    try {
      const stats = maintenanceService.getMaintenanceStats();
      
      console.log('\nMaintenance Statistics:');
      console.log('='.repeat(50));
      console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
      console.log(`Inconsistencies fixed: ${stats.inconsistenciesFixed}`);
      console.log(`Records archived: ${stats.recordsArchived}`);
      console.log(`Indexes optimized: ${stats.indexesOptimized}`);
      console.log(`Last maintenance run: ${stats.lastMaintenanceRun || 'Never'}`);
      console.log('='.repeat(50));
      
      if (options.reset) {
        maintenanceService.resetMaintenanceStats();
        console.log('\n✅ Statistics have been reset.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Failed to get statistics:', error.message);
      process.exit(1);
    }
  });

// Scheduler commands
const schedulerCommand = program
  .command('scheduler')
  .description('Manage maintenance scheduler');

schedulerCommand
  .command('start')
  .description('Start the maintenance scheduler')
  .option('--daily-cron <cron>', 'Daily maintenance cron expression', '0 2 * * *')
  .option('--weekly-cron <cron>', 'Weekly maintenance cron expression', '0 3 * * 0')
  .option('--monthly-cron <cron>', 'Monthly archival cron expression', '0 4 1 * *')
  .option('--no-daily', 'Disable daily maintenance')
  .option('--no-weekly', 'Disable weekly maintenance')
  .option('--no-monthly', 'Disable monthly archival')
  .action(async (options) => {
    try {
      console.log('Starting maintenance scheduler...');
      
      scheduler.start({
        dailyMaintenanceCron: options.dailyCron,
        weeklyMaintenanceCron: options.weeklyCron,
        monthlyArchivalCron: options.monthlyCron,
        enableDailyMaintenance: !options.noDaily,
        enableWeeklyMaintenance: !options.noWeekly,
        enableMonthlyArchival: !options.noMonthly,
      });
      
      console.log('✅ Maintenance scheduler started successfully.');
      console.log('Press Ctrl+C to stop the scheduler.');
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\nStopping maintenance scheduler...');
        scheduler.stop();
        console.log('✅ Maintenance scheduler stopped.');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to start scheduler:', error.message);
      process.exit(1);
    }
  });

schedulerCommand
  .command('status')
  .description('Show scheduler status')
  .action(async () => {
    try {
      const status = scheduler.getStatus();
      
      console.log('\nScheduler Status:');
      console.log('='.repeat(50));
      console.log(`Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
      console.log(`Scheduled tasks: ${status.scheduledTasks.join(', ') || 'None'}`);
      
      console.log('\nNext runs:');
      Object.entries(status.nextRuns).forEach(([task, time]) => {
        console.log(`  ${task}: ${time}`);
      });
      
      console.log('\nMaintenance statistics:');
      const stats = status.maintenanceStats;
      console.log(`  Duplicates removed: ${stats.duplicatesRemoved}`);
      console.log(`  Inconsistencies fixed: ${stats.inconsistenciesFixed}`);
      console.log(`  Records archived: ${stats.recordsArchived}`);
      console.log(`  Last run: ${stats.lastMaintenanceRun || 'Never'}`);
      
      console.log('='.repeat(50));
      
      process.exit(0);
    } catch (error) {
      console.error('Failed to get scheduler status:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}