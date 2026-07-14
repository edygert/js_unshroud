import { describe, test, expect, vi, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { ArtifactCollector, type ArtifactConfig } from '../src/orchestrator/ArtifactCollector.ts';
import type {
  SessionConfig,
  CodeExecutionEvent,
  EncodingEvent,
  CryptoJSEvent,
  ClipboardEvent,
  WorkerEvent,
  IframeEvent,
  PageSnapshotEvent,
  DownloadEvent
} from '../src/schema/types.ts';
import { createEvent } from '../src/schema/events.ts';
// Mock fs/promises module
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import * as fs from 'node:fs/promises';

describe('ArtifactCollector', () => {
  // Helper functions to create test configs
  function createTestSessionConfig(): SessionConfig {
    return {
      id: `test-session-${Date.now()}`,
      url: 'https://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test.jsonl')
    };
  }

  function createTestArtifactConfig(overrides?: Partial<ArtifactConfig>): ArtifactConfig {
    return {
      enabled: true,
      baseDirectory: './artifacts',
      types: {
        pageSnapshot: true,
        downloads: true,
        codeExecution: true,
        encoding: true,
        cryptojs: true,
        clipboard: true,
        workers: true,
        iframes: true
      },
      maxArtifactSize: 10 * 1024 * 1024, // 10MB
      ...overrides
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.mkdir as any).mockResolvedValue(undefined);
  });

  describe('Constructor & Configuration', () => {
    test('should initialize with session config and artifact config', () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      expect(collector).toBeDefined();
      expect(collector.getSessionDirectory()).toContain(sessionConfig.id);
    });

    test('should construct correct session directory path', () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      const path = collector.getSessionDirectory();

      expect(path).toBe(`artifacts/${sessionConfig.id}`);
      expect(path).toContain(sessionConfig.id);
      expect(path).toContain('artifacts');
    });

    test('should return false for isEnabled when disabled', () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({ enabled: false });

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      expect(collector.isEnabled()).toBe(false);
    });

    test('should return false for isEnabled when not initialized', () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      expect(collector.isEnabled()).toBe(false);
    });

    test('should return true for isEnabled when enabled and initialized', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('Directory Initialization', () => {
    test('should create session directory with recursive flag', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        `artifacts/${sessionConfig.id}`,
        { recursive: true }
      );
    });

    test('should create all 8 subdirectories', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const baseDir = `artifacts/${sessionConfig.id}`;
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/page_snapshot`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/downloads`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/code_execution`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/encoding`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/cryptojs`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/clipboard`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/workers`, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(`${baseDir}/iframes`, { recursive: true });

      // Total: 1 session dir + 8 subdirs = 9 mkdir calls
      expect(fs.mkdir).toHaveBeenCalledTimes(9);
    });

    test('should return early when artifact collection is disabled', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({ enabled: false });

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    test('should throw error if mkdir fails for session directory', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (fs.mkdir as any).mockRejectedValueOnce(new Error('Permission denied'));

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      await expect(collector.initialize()).rejects.toThrow('Permission denied');
      consoleErrorSpy.mockRestore();
    });

    test('should throw error if mkdir fails for subdirectories', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // First mkdir succeeds (session dir), second fails (subdirectory)
      (fs.mkdir as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'));

      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      await expect(collector.initialize()).rejects.toThrow('Disk full');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Core Artifact Saving - page_snapshot', () => {
    test('should save page_snapshot artifact with .html extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 100,
        captureTime: Date.now(),
        snapshotStage: 'initial'
      });

      const content = '<html><body>Test</body></html>';
      const result = await collector.saveArtifact(event, {
        type: 'page_snapshot',
        content,
        extension: 'html',
        mimeType: 'text/html'
      });

      expect(result).toContain('page_snapshot/');
      expect(result).toContain('.html');
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // content + metadata
    });

    test('should write metadata for page_snapshot', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 100,
        captureTime: Date.now(),
        snapshotStage: 'final'
      });

      const content = '<html><body>Test</body></html>';
      await collector.saveArtifact(event, {
        type: 'page_snapshot',
        content,
        extension: 'html',
        mimeType: 'text/html'
      });

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      expect(metadataCall).toBeDefined();

      const metadata = JSON.parse(metadataCall![1] as string);
      expect(metadata).toMatchObject({
        artifactId: event.id,
        artifactType: 'page_snapshot',
        eventType: 'page_snapshot',
        sessionId: sessionConfig.id,
        timestamp: event.timestamp,
        truncated: false,
        mimeType: 'text/html'
      });
      expect(metadata.originalSize).toBeGreaterThan(0);
      expect(metadata.savedSize).toBeGreaterThan(0);
    });
  });

  describe('Page Snapshot Stage Differentiation', () => {
    test('should include stage in filename for initial snapshot', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const initialEvent = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 100,
        captureTime: Date.now(),
        snapshotStage: 'initial'
      });

      const initialPath = await collector.saveArtifact(initialEvent, {
        type: 'page_snapshot',
        content: '<html><body>Initial</body></html>',
        extension: 'html',
        mimeType: 'text/html'
      });

      // Verify filename contains stage
      expect(initialPath).toContain('_initial.html');
      expect(initialPath).toContain('page_snapshot/');
    });

    test('should include stage in filename for final snapshot', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const finalEvent = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 150,
        captureTime: Date.now(),
        snapshotStage: 'final'
      });

      const finalPath = await collector.saveArtifact(finalEvent, {
        type: 'page_snapshot',
        content: '<html><body>Final - Modified</body></html>',
        extension: 'html',
        mimeType: 'text/html'
      });

      // Verify filename contains stage
      expect(finalPath).toContain('_final.html');
      expect(finalPath).toContain('page_snapshot/');
    });

    test('should save initial and final snapshots with different filenames', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      // Create initial snapshot
      const initialEvent = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 100,
        captureTime: Date.now(),
        snapshotStage: 'initial'
      });

      const initialPath = await collector.saveArtifact(initialEvent, {
        type: 'page_snapshot',
        content: '<html><body>Initial</body></html>',
        extension: 'html',
        mimeType: 'text/html'
      });

      // Create final snapshot
      const finalEvent = createEvent<PageSnapshotEvent>(sessionConfig.id, undefined, {
        type: 'page_snapshot',
        url: 'https://example.com',
        htmlLength: 150,
        captureTime: Date.now() + 5000,
        snapshotStage: 'final'
      });

      const finalPath = await collector.saveArtifact(finalEvent, {
        type: 'page_snapshot',
        content: '<html><body>Final - Modified by malware</body></html>',
        extension: 'html',
        mimeType: 'text/html'
      });

      // Verify both paths are different
      expect(initialPath).toBeDefined();
      expect(finalPath).toBeDefined();
      expect(initialPath).not.toBe(finalPath);

      // Verify filenames contain appropriate stages
      expect(initialPath).toContain('_initial.html');
      expect(finalPath).toContain('_final.html');

      // Verify both files were written (2 snapshots × 2 files each = content + metadata)
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
    });
  });

  describe('Core Artifact Saving - code_execution', () => {
    test('should save code_execution artifact with .js extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'alert(1)',
        codeLength: 8
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'alert(1)',
        extension: 'js'
      });

      expect(result).toContain('code_execution/');
      expect(result).toContain('.js');
    });

    test('should preserve event data in code_execution metadata', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'Function',
        operation: 'execute',
        code: 'return 42;',
        codeLength: 11
      });

      await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'return 42;',
        extension: 'js',
        mimeType: 'application/javascript'
      });

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      expect(metadata.eventData.method).toBe('Function');
      expect(metadata.mimeType).toBe('application/javascript');
    });
  });

  describe('Core Artifact Saving - encoding', () => {
    test('should save encoding artifact with .txt extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<EncodingEvent>(sessionConfig.id, undefined, {
        type: 'encoding',
        method: 'atob',
        operation: 'decode',
        output: 'Hello',
        outputLength: 5,
        success: true
      });

      const result = await collector.saveArtifact(event, {
        type: 'encoding',
        content: 'Hello',
        extension: 'txt'
      });

      expect(result).toContain('encoding/');
      expect(result).toContain('.txt');
    });
  });

  describe('Core Artifact Saving - cryptojs', () => {
    test('should save cryptojs artifact with .txt extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CryptoJSEvent>(sessionConfig.id, undefined, {
        type: 'cryptojs',
        method: 'AES.decrypt',
        operation: 'decrypt',
        algorithm: 'AES',
        key: 'secret-key',
        output: 'decrypted plaintext',
        outputLength: 19,
        success: true
      });

      const result = await collector.saveArtifact(event, {
        type: 'cryptojs',
        content: 'decrypted plaintext',
        extension: 'txt'
      });

      expect(result).toContain('cryptojs/');
      expect(result).toContain('.txt');
    });
  });

  describe('Core Artifact Saving - clipboard', () => {
    test('should save clipboard artifact with .txt extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<ClipboardEvent>(sessionConfig.id, undefined, {
        type: 'clipboard',
        operation: 'writeText',
        method: 'navigator.clipboard.writeText',
        dataLength: 19,
        success: true
      });

      const result = await collector.saveArtifact(event, {
        type: 'clipboard',
        content: 'clipboard data here',
        extension: 'txt'
      });

      expect(result).toContain('clipboard/');
      expect(result).toContain('.txt');
    });
  });

  describe('Core Artifact Saving - workers', () => {
    test('should save worker artifact with .js extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<WorkerEvent>(sessionConfig.id, undefined, {
        type: 'worker',
        eventType: 'worker_create',
        workerType: 'Worker',
        scriptURL: 'worker.js'
      });

      const result = await collector.saveArtifact(event, {
        type: 'worker',
        content: 'self.onmessage = function() {}',
        extension: 'js'
      });

      expect(result).toContain('workers/');
      expect(result).toContain('.js');
    });
  });

  describe('Core Artifact Saving - iframes', () => {
    test('should save iframe artifact with .html extension', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<IframeEvent>(sessionConfig.id, undefined, {
        type: 'iframe',
        eventType: 'iframe_srcdoc_set',
        srcdoc: '<html><body>Iframe content</body></html>',
        element: 'iframe#test'
      });

      const result = await collector.saveArtifact(event, {
        type: 'iframe',
        content: '<html><body>Iframe content</body></html>',
        extension: 'html'
      });

      expect(result).toContain('iframes/');
      expect(result).toContain('.html');
    });
  });

  describe('Download Artifact Special Handling', () => {
    test('should extract extension from filename', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-123',
        filename: 'malware.pdf',
        href: 'blob:https://example.com/abc123',
        isBlobUrl: true,
        isDataUrl: false,
        blobType: 'application/pdf',
        blobSize: 5000
      });

      const blobContent = Buffer.from('PDF content here');
      const result = await collector.saveDownloadArtifact(downloadEvent, blobContent);

      expect(result).toContain('downloads/');
      expect(result).toContain('.pdf');
    });

    test('should default to bin extension when no filename', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-456',
        href: 'blob:https://example.com/xyz',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, Buffer.from('data'));

      expect(result).toContain('.bin');
    });

    test('should default to bin extension when no extension in filename', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-789',
        filename: 'noextension',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');

      expect(result).toContain('.bin');
    });

    test('should use blobType as mimeType', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-001',
        filename: 'document.pdf',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false,
        blobType: 'application/pdf'
      });

      await collector.saveDownloadArtifact(downloadEvent, Buffer.from('PDF'));

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      expect(metadata.mimeType).toBe('application/pdf');
    });

    test('should default to application/octet-stream if no blobType', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-002',
        filename: 'file.bin',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      await collector.saveDownloadArtifact(downloadEvent, Buffer.from('data'));

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      expect(metadata.mimeType).toBe('application/octet-stream');
    });

    test('should handle Buffer content', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-003',
        filename: 'binary.dat',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const buffer = Buffer.from([0x01, 0x02, 0x03]);
      const result = await collector.saveDownloadArtifact(downloadEvent, buffer);

      expect(result).toBeDefined();
      const contentCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        !(call[0] as string).includes('.meta.json')
      );
      expect(contentCall![1]).toEqual(buffer);
    });

    test('should return null when downloads type is disabled', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({
        types: {
          ...createTestArtifactConfig().types,
          downloads: false
        }
      });
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-004',
        filename: 'file.txt',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');

      expect(result).toBeNull();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('Type Filtering', () => {
    test('should filter out disabled artifact types', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({
        types: {
          ...createTestArtifactConfig().types,
          codeExecution: false
        }
      });
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'alert(1)',
        codeLength: 8
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'alert(1)',
        extension: 'js'
      });

      expect(result).toBeNull();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test('should handle all 8 type mappings', async () => {
      const sessionConfig = createTestSessionConfig();

      // Test each type mapping
      const typeMappings: Array<{
        artifactType: string;
        configKey: keyof ArtifactConfig['types'];
      }> = [
        { artifactType: 'page_snapshot', configKey: 'pageSnapshot' },
        { artifactType: 'download', configKey: 'downloads' },
        { artifactType: 'code_execution', configKey: 'codeExecution' },
        { artifactType: 'encoding', configKey: 'encoding' },
        { artifactType: 'cryptojs', configKey: 'cryptojs' },
        { artifactType: 'clipboard', configKey: 'clipboard' },
        { artifactType: 'worker', configKey: 'workers' },
        { artifactType: 'iframe', configKey: 'iframes' }
      ];

      for (const mapping of typeMappings) {
        const artifactConfig = createTestArtifactConfig({
          types: {
            ...createTestArtifactConfig().types,
            [mapping.configKey]: false
          }
        });

        const collector = new ArtifactCollector(sessionConfig, artifactConfig);
        await collector.initialize();

        const event = createEvent(sessionConfig.id, undefined, {
          type: mapping.artifactType as any
        });

        const result = await collector.saveArtifact(event, {
          type: mapping.artifactType,
          content: 'test',
          extension: 'txt'
        });

        expect(result).toBeNull();
        (fs.writeFile as any).mockClear();
      }
    });
  });

  describe('Size Limit Enforcement', () => {
    test('should return null when artifact exceeds size limit', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({
        maxArtifactSize: 100 // 100 bytes
      });
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'x'.repeat(200),
        codeLength: 200
      });

      const largeContent = 'x'.repeat(200); // 200 bytes > 100 byte limit
      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: largeContent,
        extension: 'js'
      });

      expect(result).toBeNull();
      expect(fs.writeFile).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    test('should save when artifact is within size limit', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({
        maxArtifactSize: 1000 // 1000 bytes
      });
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'small',
        codeLength: 5
      });

      const smallContent = 'small'; // 5 bytes < 1000 byte limit
      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: smallContent,
        extension: 'js'
      });

      expect(result).not.toBeNull();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle writeFile errors gracefully', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (fs.writeFile as any).mockRejectedValueOnce(new Error('Disk full'));

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'alert(1)',
        codeLength: 8
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'alert(1)',
        extension: 'js'
      });

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ArtifactCollector] Failed to save artifact:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('should return null when collection is disabled', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig({ enabled: false });
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'test',
        codeLength: 4
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'test',
        extension: 'js'
      });

      expect(result).toBeNull();
    });

    test('should return null when collector is not initialized', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      // Don't call initialize()

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'test',
        codeLength: 4
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'test',
        extension: 'js'
      });

      expect(result).toBeNull();
    });
  });

  describe('Metadata Validation', () => {
    test('should include all required metadata fields', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'test code',
        codeLength: 9
      });

      await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'test code',
        extension: 'js'
      });

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      expect(metadata).toHaveProperty('artifactId');
      expect(metadata).toHaveProperty('artifactType');
      expect(metadata).toHaveProperty('eventType');
      expect(metadata).toHaveProperty('sessionId');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('originalSize');
      expect(metadata).toHaveProperty('savedSize');
      expect(metadata).toHaveProperty('truncated');
      expect(metadata).toHaveProperty('mimeType');
      expect(metadata).toHaveProperty('eventData');
    });

    test('should calculate size correctly', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'Hello World',
        codeLength: 11
      });

      const content = 'Hello World';
      await collector.saveArtifact(event, {
        type: 'code_execution',
        content,
        extension: 'js'
      });

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      const expectedSize = Buffer.byteLength(content);
      expect(metadata.originalSize).toBe(expectedSize);
      expect(metadata.savedSize).toBe(expectedSize);
    });

    test('should set truncated flag to false', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'test',
        codeLength: 4
      });

      await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'test',
        extension: 'js'
      });

      const metadataCall = (fs.writeFile as any).mock.calls.find((call: any) =>
        (call[0] as string).includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall![1] as string);

      expect(metadata.truncated).toBe(false);
    });
  });

  describe('Extension Extraction', () => {
    test('should extract extension from simple filename', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-1',
        filename: 'file.txt',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');
      expect(result).toContain('.txt');
    });

    test('should extract extension from complex filename', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-2',
        filename: 'archive.tar.gz',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');
      expect(result).toContain('.gz');
    });

    test('should extract extension from path', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-3',
        filename: 'path/to/file.pdf',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');
      expect(result).toContain('.pdf');
    });

    // Regression (audit L4): the browser-side download hook derives the extension
    // from a page-controlled filename via split('.').pop(), which does not strip '/'.
    // A crafted extension like "bin/evil" would place the artifact in a sub-directory
    // of the artifact dir. saveArtifact must whitelist the extension.
    test('should sanitize a path-separator in the extension to bin', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'x',
        codeLength: 1
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'x',
        extension: 'bin/evil' // attacker-controlled: contains a path separator
      });

      expect(result).not.toBeNull();
      // Falls back to 'bin'; the injected sub-path component is gone.
      expect(result).toContain(`${event.id}.bin`);
      expect(result).not.toContain('evil');
      expect(result).not.toContain('bin/evil');
    });

    test('should sanitize an empty or non-alphanumeric extension to bin', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const event = createEvent<CodeExecutionEvent>(sessionConfig.id, undefined, {
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'x',
        codeLength: 1
      });

      const result = await collector.saveArtifact(event, {
        type: 'code_execution',
        content: 'x',
        extension: '../secret'
      });

      expect(result).toContain(`${event.id}.bin`);
      expect(result).not.toContain('secret');
    });

    test('should handle filename with multiple dots', async () => {
      const sessionConfig = createTestSessionConfig();
      const artifactConfig = createTestArtifactConfig();
      const collector = new ArtifactCollector(sessionConfig, artifactConfig);
      await collector.initialize();

      const downloadEvent = createEvent<DownloadEvent>(sessionConfig.id, undefined, {
        type: 'download',
        eventType: 'download_click',
        downloadId: 'dl-4',
        filename: 'data.backup.json',
        href: 'blob:url',
        isBlobUrl: true,
        isDataUrl: false
      });

      const result = await collector.saveDownloadArtifact(downloadEvent, 'content');
      expect(result).toContain('.json');
    });
  });
});
