import { CorrelationEngine, type CorrelationChain, type CorrelationRule } from '../analysis/CorrelationEngine.ts';
import { QueryEngine } from '../analysis/QueryEngine.ts';
import type { MonitoringEvent } from '../schema/types.ts';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

interface CorrelateArgs {
  input: string;
  rulesFile?: string;
  rules?: string;
  format?: 'text' | 'json';
  output?: string;
}

interface RulesFileSchema {
  rules: CorrelationRule[];
}

/**
 * Parse command-line arguments for the correlate subcommand
 * @returns Parsed arguments object
 */
export function parseCorrelateArgs(): CorrelateArgs {
  const args = process.argv.slice(3); // Skip 'node', 'runner.ts', 'correlate'

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelpText();
    process.exit(0);
  }

  let input: string | undefined;
  let rulesFile: string | undefined;
  let rules: string | undefined;
  let format: 'text' | 'json' | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--input' && nextArg) {
      input = nextArg;
      i++;
    } else if (arg === '--rules-file' && nextArg) {
      rulesFile = nextArg;
      i++;
    } else if (arg === '--rules' && nextArg) {
      rules = nextArg;
      i++;
    } else if (arg === '--format' && nextArg) {
      if (nextArg === 'text' || nextArg === 'json') {
        format = nextArg;
      }
      i++;
    } else if (arg === '--output' && nextArg) {
      output = nextArg;
      i++;
    }
  }

  // Validate required arguments
  if (!input) {
    console.error('Error: --input is required');
    console.error('Usage: js_unshroud correlate --input <events.jsonl> [OPTIONS]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  const result: CorrelateArgs = { input };
  if (rulesFile) result.rulesFile = rulesFile;
  if (rules) result.rules = rules;
  if (format) result.format = format;
  if (output) result.output = output;

  return result;
}

/**
 * Resolve rules file path with fallback logic
 * @param rulesFile - Optional explicit rules file path
 * @returns Resolved path to rules file
 */
export function resolveRulesFilePath(rulesFile?: string): string {
  // Priority:
  // 1. Explicit --rules-file path
  // 2. ./correlation_rules.json (current directory)
  // 3. <project-root>/correlation_rules.json

  if (rulesFile) {
    return resolve(rulesFile);
  }

  // Check current directory
  const cwd = process.cwd();
  const cwdPath = resolve(cwd, 'correlation_rules.json');
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // Check project root (same directory as package.json)
  // For ESM, we need to get __dirname equivalent
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = dirname(currentFilePath);

  // Navigate up from src/cli/ to project root
  const projectRoot = resolve(currentDir, '../../');
  const rootPath = resolve(projectRoot, 'correlation_rules.json');

  return rootPath;
}

/**
 * Validate parsed arguments
 * @param args - Parsed arguments to validate
 */
export function validateArgs(args: CorrelateArgs): void {
  // Check input file exists
  if (!existsSync(args.input)) {
    console.error(`Error: Input file not found: ${args.input}`);
    process.exit(1);
  }

  // Validate format
  if (args.format && !['text', 'json'].includes(args.format)) {
    console.error(`Error: Invalid format '${args.format}'. Must be text or json.`);
    process.exit(1);
  }

  // Resolve rules file path and check existence
  const rulesPath = resolveRulesFilePath(args.rulesFile);
  if (!existsSync(rulesPath)) {
    console.error(`Error: Rules file not found: ${rulesPath}`);
    console.error('Hint: Create correlation_rules.json in current directory or project root, or specify --rules-file');
    process.exit(1);
  }
}

/**
 * Validate a custom correlation rule
 * @param rule - Rule to validate
 * @returns Validated CorrelationRule
 * @throws Error if rule is invalid
 */
function validateCustomRule(rule: unknown): CorrelationRule {
  // Type guard and validation
  if (typeof rule !== 'object' || rule === null) {
    throw new Error('Rule must be an object');
  }

  const r = rule as Record<string, unknown>;

  // Validate required fields
  const name = r['name'];
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Rule must have a non-empty "name" field');
  }

  if (!r['description'] || typeof r['description'] !== 'string') {
    throw new Error('Rule must have a "description" field');
  }

  if (!r['patterns'] || typeof r['patterns'] !== 'object') {
    throw new Error('Rule must have a "patterns" object');
  }

  const patterns = r['patterns'] as Record<string, unknown>;

  // Validate patterns.type
  if (patterns['type'] !== 'sequence' && patterns['type'] !== 'group') {
    throw new Error('patterns.type must be "sequence" or "group"');
  }

  // Validate patterns.events
  const events = patterns['events'];
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('patterns.events must be a non-empty array');
  }

  for (const event of events) {
    if (typeof event !== 'string') {
      throw new Error('patterns.events must contain only strings');
    }
  }

  // Validate optional fields
  const maxTimeGap = patterns['maxTimeGap'];
  if (maxTimeGap !== undefined) {
    if (typeof maxTimeGap !== 'number' || maxTimeGap <= 0) {
      throw new Error('patterns.maxTimeGap must be a positive number');
    }
  }

  if (patterns['correlationField'] !== undefined) {
    if (typeof patterns['correlationField'] !== 'string') {
      throw new Error('patterns.correlationField must be a string');
    }
  }

  return rule as CorrelationRule;
}

/**
 * Load and validate custom correlation rules from JSON file
 * @param rulesFilePath - Path to rules file
 * @returns Array of validated CorrelationRule objects
 * @throws Error if file is invalid or rules fail validation
 */
export function loadCustomRules(rulesFilePath: string): CorrelationRule[] {
  try {
    const content = readFileSync(rulesFilePath, 'utf-8');
    const parsed = JSON.parse(content) as RulesFileSchema;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!parsed.rules || !Array.isArray(parsed.rules)) {
      throw new Error('Rules file must contain a "rules" array');
    }

    // Validate each rule
    const validatedRules: CorrelationRule[] = [];
    for (let i = 0; i < parsed.rules.length; i++) {
      const rule = parsed.rules[i];
      try {
        const validated = validateCustomRule(rule);
        validatedRules.push(validated);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid rule at index ${i}: ${msg}`);
      }
    }

    return validatedRules;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse rules file: Invalid JSON`);
    }
    throw error;
  }
}

/**
 * Format event summary for display in correlation chains
 * @param event - Event to summarize
 * @returns Summary string
 */
export function formatEventSummary(event: MonitoringEvent): string {
  // Type-specific summaries
  switch (event.type) {
    case 'network':
      return `${(event).method || 'REQUEST'} ${(event).url || '(no URL)'}`;
    case 'storage':
      return `${(event).storageType}.${(event).operation}(${(event).key})`;
    case 'console':
      return `[${(event).level}] ${(event).message}`;
    case 'error':
      return (event).message;
    case 'timer':
      return (event).timerType;
    case 'code_execution': {
      const codePreview = (event).code ? (event).code.substring(0, 40) : '';
      return `${(event).method}("${codePreview}${codePreview.length >= 40 ? '...' : ''}")`;
    }
    case 'fingerprinting':
      return `${(event).method}()`;
    case 'websocket':
      return `WebSocket ${(event).event}: ${(event).url}`;
    case 'dom':
      return `DOM ${(event).eventType}${(event).target ? ` on ${(event).target}` : ''}`;
    case 'headless_mitigation':
      return `${(event).method} ${(event).operation}`;
    case 'performance_stats':
      return `Performance: ${(event).totalEventsProcessed} events (${(event).eventsAccepted} accepted)`;
    case 'performance_warning':
      return `${(event).method}(${(event).delay}ms): ${(event).warning}`;
    case 'service_worker':
      return `ServiceWorker ${(event).eventType}${(event).scriptUrl ? `: ${(event).scriptUrl}` : ''}`;
    case 'encoding': {
      const outputPreview = (event).output ? (event).output.substring(0, 40) : '';
      return `${(event).method}("${outputPreview}${outputPreview.length >= 40 ? '...' : ''}")`;
    }
    case 'cryptojs':
      return `CryptoJS.${(event).method}(${(event).algorithm ?? (event).encoding ?? ''})`;
    case 'script_injection':
      return `${(event).method}${(event).scriptSrc ? `: ${(event).scriptSrc}` : (event).htmlLength ? ` (${(event).htmlLength} bytes)` : ''}`;
    case 'event_handler':
      return `${(event).element}.${(event).handlerName} = function(...)`;
    case 'blob':
      return `Blob ${(event).eventType}${(event).blobUrl ? `: ${(event).blobUrl}` : ''}`;
    case 'url_execution':
      return `${(event).eventType}: javascript:${(event).code.substring(0, 40)}...`;
    case 'worker':
      return `${(event).workerType} ${(event).eventType}: ${(event).scriptURL}`;
    case 'module':
      return `ES Module ${(event).isInline ? 'inline' : (event).src ?? '(no src)'}`;
    case 'iframe':
      return `iframe ${(event).eventType}${(event).src ? `: ${(event).src}` : ''}`;
    case 'clipboard':
      return `${(event).method}: ${(event).data?.substring(0, 40) ?? '(no data)'}${((event).data?.length ?? 0) > 40 ? '...' : ''}`;
    case 'debugger':
      return `debugger at ${(event).url ?? 'inline'}:${(event).lineNumber ?? '?'}`;
    case 'download':
      return `Download ${(event).eventType}: ${(event).filename ?? (event).url ?? (event).href ?? '(no filename)'}`;
  }
}

/**
 * Format correlation chains as human-readable text
 * @param chains - Correlation chains to format
 * @returns Formatted text string
 */
function formatTextOutput(chains: CorrelationChain[]): string {
  if (chains.length === 0) {
    return 'No correlation chains found.\n';
  }

  const lines: string[] = [];
  lines.push('Correlation Chains');
  lines.push('='.repeat(80));
  lines.push(`Total Chains Found: ${chains.length}`);
  lines.push('');

  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];
    if (!chain) continue;

    lines.push(`Chain ${i + 1}: ${chain.chainType}`);
    lines.push(`  Description: ${chain.description}`);
    lines.push(`  Duration: ${chain.timeSpan.duration}ms`);
    lines.push(`  Start: ${new Date(chain.timeSpan.start).toISOString()}`);
    lines.push(`  End: ${new Date(chain.timeSpan.end).toISOString()}`);

    if (chain.correlationId) {
      lines.push(`  Correlation ID: ${chain.correlationId}`);
    }

    lines.push(`  Events (${chain.events.length}):`);

    for (let j = 0; j < chain.events.length; j++) {
      const event = chain.events[j];
      if (!event) continue;

      const timestamp = new Date(event.timestamp).toISOString();
      const summary = formatEventSummary(event);
      lines.push(`    ${j + 1}. [${timestamp}] ${event.type}: ${summary}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format correlation chains as JSON
 * @param chains - Correlation chains to format
 * @returns JSON string
 */
function formatJsonOutput(chains: CorrelationChain[]): string {
  return JSON.stringify({
    totalChains: chains.length,
    chains: chains.map(chain => ({
      chainType: chain.chainType,
      description: chain.description,
      correlationId: chain.correlationId,
      timeSpan: chain.timeSpan,
      eventCount: chain.events.length,
      events: chain.events
    }))
  }, null, 2);
}

/**
 * Print help text for correlate command
 */
function printHelpText(): void {
  console.log('Usage: js_unshroud correlate --input <events.jsonl> [OPTIONS]');
  console.log('');
  console.log('Find correlation patterns between events using custom rules.');
  console.log('');
  console.log('Required:');
  console.log('  --input <file>           Path to JSONL events file');
  console.log('');
  console.log('Optional:');
  console.log('  --rules-file <file>      Path to correlation rules JSON file');
  console.log('                           (default: ./correlation_rules.json or project root)');
  console.log('  --rules <name1,name2>    Apply only specified rules (comma-delimited, default: all)');
  console.log('  --format <text|json>     Output format (default: text)');
  console.log('  --output <file>          Write to file instead of stdout');
  console.log('  --help, -h               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Find all correlations using default rules');
  console.log('  js_unshroud correlate --input events.jsonl');
  console.log('');
  console.log('  # Use custom rules file');
  console.log('  js_unshroud correlate --input events.jsonl --rules-file my_rules.json');
  console.log('');
  console.log('  # Find specific correlation pattern');
  console.log('  js_unshroud correlate --input events.jsonl --rules storage-to-network');
  console.log('');
  console.log('  # Find multiple correlation patterns');
  console.log('  js_unshroud correlate --input events.jsonl --rules storage-to-network,timer-to-network');
  console.log('');
  console.log('  # Output as JSON');
  console.log('  js_unshroud correlate --input events.jsonl --format json --output chains.json');
}

/**
 * Execute correlation analysis
 * @param args - Correlate arguments
 * @returns Formatted output string
 */
export async function correlateEvents(args: CorrelateArgs): Promise<string> {
  // Load rules
  const rulesPath = resolveRulesFilePath(args.rulesFile);
  const rules = loadCustomRules(rulesPath);

  // Create engines
  const queryEngine = new QueryEngine();
  const correlationEngine = new CorrelationEngine(queryEngine, rules);

  // Parse comma-delimited rules filter (like query.ts does for --type)
  const ruleNames = args.rules ? args.rules.split(',').map(r => r.trim()) : undefined;

  // Find correlations
  // If multiple rules specified, run each and combine results
  let chains: CorrelationChain[];
  if (ruleNames && ruleNames.length > 0) {
    chains = [];
    for (const ruleName of ruleNames) {
      const ruleChains = await correlationEngine.findCorrelations(args.input, ruleName);
      chains.push(...ruleChains);
    }
    // Sort combined results by start time
    chains.sort((a, b) => a.timeSpan.start - b.timeSpan.start);
  } else {
    // No filter, apply all rules
    chains = await correlationEngine.findCorrelations(args.input);
  }

  // Format output
  const format = args.format ?? 'text';
  return format === 'json' ? formatJsonOutput(chains) : formatTextOutput(chains);
}

/**
 * Main entry point for correlate subcommand
 */
export async function runCorrelate(): Promise<void> {
  try {
    const args = parseCorrelateArgs();
    validateArgs(args);
    const output = await correlateEvents(args);

    if (args.output) {
      writeFileSync(args.output, output, 'utf-8');
      console.error(`Correlation results written to ${args.output}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}
