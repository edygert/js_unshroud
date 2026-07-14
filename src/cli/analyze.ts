import { QueryEngine } from '../analysis/QueryEngine.ts';
import { TimelineFormatter } from '../analysis/TimelineFormatter.ts';
import { existsSync, writeFileSync } from 'fs';

interface AnalyzeArgs {
  input: string;
  format?: 'text' | 'json' | 'stats';
  output?: string;
}

/**
 * Parse command-line arguments for the analyze subcommand
 * @returns Parsed arguments object
 */
function parseAnalyzeArgs(): AnalyzeArgs {
  const args = process.argv.slice(3); // Skip 'node', 'runner.ts', 'analyze'
  let input: string | undefined;
  let format: 'text' | 'json' | 'stats' | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') {
      const nextArg = args[i + 1];
      if (nextArg) {
        input = nextArg;
        i++;
      }
    } else if (args[i] === '--format') {
      const nextArg = args[i + 1];
      if (nextArg && (nextArg === 'text' || nextArg === 'json' || nextArg === 'stats')) {
        format = nextArg;
        i++;
      }
    } else if (args[i] === '--output') {
      const nextArg = args[i + 1];
      if (nextArg) {
        output = nextArg;
        i++;
      }
    }
  }

  if (!input) {
    console.error('Error: --input is required');
    console.error('Usage: js_unshroud analyze --input <events.jsonl> [--format text|json|stats] [--output <file>]');
    process.exit(1);
  }

  const result: AnalyzeArgs = { input };
  if (format) result.format = format;
  if (output) result.output = output;
  return result;
}

/**
 * Validate parsed arguments
 * @param args - Parsed arguments to validate
 */
function validateArgs(args: AnalyzeArgs): void {
  // Check file exists
  if (!existsSync(args.input)) {
    console.error(`Error: Input file not found: ${args.input}`);
    process.exit(1);
  }

  // Validate format
  if (args.format && !['text', 'json', 'stats'].includes(args.format)) {
    console.error(`Error: Invalid format '${args.format}'. Must be text, json, or stats.`);
    process.exit(1);
  }
}

/**
 * Format statistics output from TimelineFormatter
 * @param formatter - TimelineFormatter instance
 * @returns Formatted statistics string
 */
function formatStatistics(formatter: TimelineFormatter): string {
  const stats = formatter.getStats();

  const lines: string[] = [];
  lines.push('Event Statistics');
  lines.push('='.repeat(50));

  // Empty input: avoid NaN% (divide-by-zero) and 1970 timestamps from new Date(0) (L5).
  if (stats.totalEvents === 0) {
    lines.push('No events found in input file');
    return lines.join('\n');
  }

  lines.push(`Total Events: ${stats.totalEvents}`);
  lines.push(`Time Span: ${new Date(stats.timeSpan.start).toISOString()} to ${new Date(stats.timeSpan.end).toISOString()}`);
  lines.push(`Duration: ${stats.timeSpan.end - stats.timeSpan.start}ms`);
  lines.push('');
  lines.push('Event Type Breakdown:');

  // Sort by count descending
  const sorted = Object.entries(stats.eventTypes).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sorted) {
    const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
    lines.push(`  ${type}: ${count} (${percentage}%)`);
  }

  return lines.join('\n');
}

/**
 * Load events from JSONL file and format output
 * @param args - Analyze arguments
 * @returns Formatted output string
 */
async function analyzeEvents(args: AnalyzeArgs): Promise<string> {
  // 1. Load events using QueryEngine
  const queryEngine = new QueryEngine();
  const events = await queryEngine.queryEvents(args.input, {});

  // Warn if no events found
  if (events.length === 0) {
    console.warn('Warning: No events found in input file');
  }

  // 2. Create TimelineFormatter
  const formatter = new TimelineFormatter(events);

  // 3. Generate output based on format
  switch (args.format ?? 'text') {
    case 'text':
      return formatter.formatAsText();
    case 'json':
      return formatter.formatAsJSON();
    case 'stats':
      return formatStatistics(formatter);
    default:
      throw new Error(`Unknown format: ${args.format}`);
  }
}

/**
 * Main entry point for analyze subcommand
 */
export async function runAnalyze(): Promise<void> {
  try {
    const args = parseAnalyzeArgs();
    validateArgs(args);
    const output = await analyzeEvents(args);

    if (args.output) {
      writeFileSync(args.output, output, 'utf-8');
    } else {
      console.log(output);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

// Export functions for testing
export { parseAnalyzeArgs, validateArgs, analyzeEvents, formatStatistics };
