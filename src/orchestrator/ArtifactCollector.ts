import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { MonitoringEvent, SessionConfig, DownloadEvent } from '../schema/types.ts';

export interface ArtifactConfig {
  enabled: boolean;
  baseDirectory: string;  // Default: './artifacts'
  types: {
    pageSnapshot: boolean;        // Save initial page HTML snapshot
    downloads: boolean;           // Save downloaded files
    codeExecution: boolean;       // Save eval/Function code
    encoding: boolean;            // Save atob/btoa output
    cryptojs: boolean;            // Save decrypted plaintext
    clipboard: boolean;           // Save clipboard payloads
    workers: boolean;             // Save worker scripts
    iframes: boolean;             // Save iframe srcdoc
  };
  maxArtifactSize: number;  // Max size in bytes (default: 10MB)
}

export class ArtifactCollector {
  private readonly config: ArtifactConfig;
  private readonly sessionConfig: SessionConfig;
  private readonly sessionDir: string;
  private initialized = false;

  constructor(sessionConfig: SessionConfig, config: ArtifactConfig) {
    this.sessionConfig = sessionConfig;
    this.config = config;
    this.sessionDir = join(config.baseDirectory, sessionConfig.id);
  }

  /**
   * Initialize artifact directory structure
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Create session directory
      await mkdir(this.sessionDir, { recursive: true });

      // Create type-specific subdirectories
      const subdirs = [
        'page_snapshot',
        'downloads',
        'code_execution',
        'encoding',
        'cryptojs',
        'clipboard',
        'workers',
        'iframes'
      ];

      await Promise.all(
        subdirs.map(subdir => mkdir(join(this.sessionDir, subdir), { recursive: true }))
      );

      this.initialized = true;
    } catch (error) {
      console.error('[ArtifactCollector] Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Save artifact from event
   */
  async saveArtifact(event: MonitoringEvent, artifactData: {
    type: string;
    content: string | Buffer;
    extension: string;
    mimeType?: string;
  }): Promise<string | null> {
    if (!this.config.enabled || !this.initialized) return null;

    // Check if this artifact type is enabled
    if (!this.shouldSaveArtifactType(artifactData.type)) return null;

    // Check size limit
    const contentSize = Buffer.byteLength(artifactData.content);
    if (contentSize > this.config.maxArtifactSize) {
      console.warn(`[ArtifactCollector] Artifact too large: ${contentSize} bytes (max: ${this.config.maxArtifactSize})`);
      return null;
    }

    try {
      // Generate artifact filename
      const artifactId = event.id;
      const filename = `${artifactId}.${artifactData.extension}`;
      const subdirMap: Record<string, string> = {
        page_snapshot: 'page_snapshot',
        download: 'downloads',
        code_execution: 'code_execution',
        encoding: 'encoding',
        cryptojs: 'cryptojs',
        clipboard: 'clipboard',
        worker: 'workers',
        iframe: 'iframes'
      };
      const subdir = subdirMap[artifactData.type] ?? artifactData.type;
      const artifactPath = join(this.sessionDir, subdir, filename);

      // Write artifact content
      await writeFile(artifactPath, artifactData.content);

      // Write metadata file
      const metaPath = join(this.sessionDir, subdir, `${artifactId}.meta.json`);
      const metadata = {
        artifactId: artifactId,
        artifactType: artifactData.type,
        eventType: event.type,
        sessionId: this.sessionConfig.id,
        timestamp: event.timestamp,
        originalSize: contentSize,
        savedSize: contentSize,
        truncated: false,
        mimeType: artifactData.mimeType ?? 'application/octet-stream',
        eventData: event
      };
      await writeFile(metaPath, JSON.stringify(metadata, null, 2));

      return artifactPath;
    } catch (error) {
      console.error('[ArtifactCollector] Failed to save artifact:', error);
      return null;
    }
  }

  /**
   * Save download artifact (special handling for blob/data URLs)
   */
  async saveDownloadArtifact(
    downloadEvent: DownloadEvent,
    blobContent: string | Buffer
  ): Promise<string | null> {
    if (!this.config.types.downloads) return null;

    const extension = this.getExtensionFromFilename(downloadEvent.filename) ?? 'bin';
    const mimeType = downloadEvent.blobType ?? 'application/octet-stream';

    return this.saveArtifact(downloadEvent, {
      type: 'download',
      content: blobContent,
      extension: extension,
      mimeType: mimeType
    });
  }

  /**
   * Check if artifact type should be saved
   */
  private shouldSaveArtifactType(type: string): boolean {
    const typeMap: Record<string, boolean> = {
      page_snapshot: this.config.types.pageSnapshot,
      download: this.config.types.downloads,
      code_execution: this.config.types.codeExecution,
      encoding: this.config.types.encoding,
      cryptojs: this.config.types.cryptojs,
      clipboard: this.config.types.clipboard,
      worker: this.config.types.workers,
      iframe: this.config.types.iframes
    };
    return typeMap[type] ?? false;
  }

  /**
   * Extract file extension from filename
   */
  private getExtensionFromFilename(filename?: string): string | null {
    if (!filename) return null;
    const match = filename.match(/\.([^.]+)$/);
    return match ? (match[1] ?? null) : null;
  }

  /**
   * Get artifact directory path (for external reference)
   */
  getSessionDirectory(): string {
    return this.sessionDir;
  }

  /**
   * Check if artifact collection is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }
}
