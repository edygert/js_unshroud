import { QueryEngine, type QueryFilter } from '../analysis/QueryEngine.ts';
import { existsSync, writeFileSync } from 'fs';

interface QueryArgs {
  input: string;
  // Filter params
  eventType?: string;
  method?: string;
  url?: string;
  urlRegex?: string;
  status?: number;
  level?: string;
  storageType?: 'localStorage' | 'sessionStorage';
  operation?: 'set' | 'get' | 'remove' | 'clear';
  correlationId?: string;
  // Output params
  // Captured verbatim at parse time; validateArgs rejects out-of-set values (Q7).
  format?: string;
  output?: string;
}

/**
 * Parse command-line arguments for the query subcommand
 * @returns Parsed arguments object
 */
export function parseQueryArgs(): QueryArgs {
  const args = process.argv.slice(3); // Skip 'node', 'runner.ts', 'query'

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelpText();
    process.exit(0);
  }

  let input: string | undefined;
  let eventType: string | undefined;
  let method: string | undefined;
  let url: string | undefined;
  let urlRegex: string | undefined;
  let status: number | undefined;
  let level: string | undefined;
  let storageType: 'localStorage' | 'sessionStorage' | undefined;
  let operation: 'set' | 'get' | 'remove' | 'clear' | undefined;
  let correlationId: string | undefined;
  let format: string | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--input' && nextArg) {
      input = nextArg;
      i++;
    } else if (arg === '--type' && nextArg) {
      eventType = nextArg;
      i++;
    } else if (arg === '--method' && nextArg) {
      method = nextArg;
      i++;
    } else if (arg === '--url' && nextArg) {
      url = nextArg;
      i++;
    } else if (arg === '--url-regex' && nextArg) {
      urlRegex = nextArg;
      i++;
    } else if (arg === '--status' && nextArg) {
      status = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--level' && nextArg) {
      level = nextArg;
      i++;
    } else if (arg === '--storage-type' && nextArg) {
      if (nextArg === 'localStorage' || nextArg === 'sessionStorage') {
        storageType = nextArg;
      }
      i++;
    } else if (arg === '--operation' && nextArg) {
      if (nextArg === 'set' || nextArg === 'get' || nextArg === 'remove' || nextArg === 'clear') {
        operation = nextArg;
      }
      i++;
    } else if (arg === '--correlation-id' && nextArg) {
      correlationId = nextArg;
      i++;
    } else if (arg === '--format' && nextArg) {
      // Capture verbatim; validateArgs enforces the allowed set (Q7).
      format = nextArg;
      i++;
    } else if (arg === '--output' && nextArg) {
      output = nextArg;
      i++;
    }
  }

  // Validate required arguments
  if (!input) {
    console.error('Error: --input is required');
    console.error('Usage: js_unshroud query --input <events.jsonl> [FILTERS] [--format jsonl|count] [--output <file>]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  const result: QueryArgs = { input };
  if (eventType) result.eventType = eventType;
  if (method) result.method = method;
  if (url) result.url = url;
  if (urlRegex) result.urlRegex = urlRegex;
  if (status !== undefined && !isNaN(status)) result.status = status;
  if (level) result.level = level;
  if (storageType) result.storageType = storageType;
  if (operation) result.operation = operation;
  if (correlationId) result.correlationId = correlationId;
  if (format) result.format = format;
  if (output) result.output = output;

  return result;
}

/**
 * Validate parsed arguments
 * @param args - Parsed arguments to validate
 */
export function validateArgs(args: QueryArgs): void {
  // Check file exists
  if (!existsSync(args.input)) {
    console.error(`Error: Input file not found: ${args.input}`);
    process.exit(1);
  }

  // Validate format
  if (args.format && !['jsonl', 'count'].includes(args.format)) {
    console.error(`Error: Invalid format '${args.format}'. Must be jsonl or count.`);
    process.exit(1);
  }

  // Validate urlRegex is valid regex
  if (args.urlRegex) {
    try {
      new RegExp(args.urlRegex);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error: Invalid regex pattern '${args.urlRegex}': ${errorMessage}`);
      process.exit(1);
    }
  }
}

/**
 * Build QueryFilter from QueryArgs
 * @param args - Query arguments
 * @returns QueryFilter object
 */
export function buildQueryFilter(args: QueryArgs): QueryFilter {
  const filter: QueryFilter = {};

  // Handle comma-separated types
  if (args.eventType) {
    filter.eventType = args.eventType;
  }

  // Network filters
  if (args.method) {
    filter.method = args.method;
  }

  if (args.url) {
    filter.url = args.url;
  }

  // Convert urlRegex string to RegExp
  if (args.urlRegex) {
    filter.url = new RegExp(args.urlRegex);
  }

  if (args.status !== undefined) {
    filter.status = args.status;
  }

  // Console filters
  if (args.level) {
    filter.level = args.level;
  }

  // Storage filters
  if (args.storageType) {
    filter.storageType = args.storageType;
  }

  if (args.operation) {
    filter.operation = args.operation;
  }

  // Correlation filter
  if (args.correlationId) {
    filter.correlationId = args.correlationId;
  }

  return filter;
}

/**
 * Query events from JSONL file and format output
 * @param args - Query arguments
 * @returns Formatted output string
 */
export async function queryEvents(args: QueryArgs): Promise<string> {
  const queryEngine = new QueryEngine();
  const filter = buildQueryFilter(args);
  const format = args.format ?? 'jsonl';

  // For count format, use countEvents() for speed
  if (format === 'count') {
    const count = await queryEngine.countEvents(args.input, filter);
    return count.toString();
  }

  // For jsonl format, use queryEventsStream() for memory efficiency
  const results: string[] = [];
  for await (const event of queryEngine.queryEventsStream(args.input, filter)) {
    results.push(JSON.stringify(event));
  }

  return results.join('\n');
}

/**
 * Print help text
 */
function printHelpText(): void {
  console.log('Usage: js_unshroud query --input <file> [FILTERS] [OUTPUT]');
  console.log('');
  console.log('Filters:');
  console.log('  --type <types>              Event types (comma-separated)');
  console.log('  --method <method>           HTTP method (network events)');
  console.log('  --url <url>                 Exact URL match (network events)');
  console.log('  --url-regex <pattern>       Regex URL match (network events)');
  console.log('  --status <code>             HTTP status code (network events)');
  console.log('  --level <level>             Console level (console events)');
  console.log('  --storage-type <type>       Storage type (storage events)');
  console.log('  --operation <op>            Storage operation (storage events)');
  console.log('  --correlation-id <id>       Correlation ID');
  console.log('');
  console.log('Output:');
  console.log('  --format <jsonl|count>      Output format (default: jsonl)');
  console.log('  --output <file>             Output file (default: stdout)');
  console.log('');
  console.log('Examples:');
  console.log('  # Find all network requests');
  console.log('  js_unshroud query --input events.jsonl --type network');
  console.log('');
  console.log('  # Find POST requests to suspicious domains');
  console.log('  js_unshroud query --input events.jsonl --type network --method POST --url-regex "\\\\.ru$"');
  console.log('');
  console.log('  # Count code execution events');
  console.log('  js_unshroud query --input events.jsonl --type code_execution --format count');
  console.log('');
  console.log('  # Query and save to file');
  console.log('  js_unshroud query --input events.jsonl --type storage --output storage.jsonl');
}

/**
 * Main entry point for query subcommand
 */
export async function runQuery(): Promise<void> {
  try {
    const args = parseQueryArgs();
    validateArgs(args);
    const output = await queryEvents(args);

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
