import fs from 'fs';
import path from 'path';

/**
 * Custom error class for source validation errors
 */
export class SourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceValidationError';
  }
}

/**
 * Authentication configuration for a source
 */
export interface AuthConfig {
  type: 'apiKey' | 'bearer' | 'basic' | 'oauth2';
  headers?: Record<string, string>;
}

/**
 * Source metadata
 */
export interface SourceMetadata {
  frequency: string;
  quality_rating: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Source configuration
 */
export interface SourceConfig {
  id: string;
  name: string;
  type: 'rss' | 'rest' | 'graphql';
  category?: string;
  enabled: boolean;
  url?: string; // RSS
  endpoint?: string; // REST/GraphQL
  auth?: AuthConfig | null;
  filters?: Record<string, unknown>;
  timeout: number;
  maxRetries: number;
  mapper: string;
  metadata?: SourceMetadata;
}

/**
 * Raw config structure from JSON file
 */
interface ConfigFile {
  sources: SourceConfig[];
}

/**
 * SourceManager handles loading, validating, and accessing source configurations
 */
export class SourceManager {
  private sources: SourceConfig[];
  private authHeadersCache: Map<string, Record<string, string>>;

  constructor(configPath?: string) {
    this.sources = [];
    this.authHeadersCache = new Map();

    const resolvedPath = configPath || this.getDefaultConfigPath();
    this.loadAndValidateConfig(resolvedPath);
    this.logLoadStatus();
  }

  /**
   * Get the default config path
   */
  private getDefaultConfigPath(): string {
    return path.join(__dirname, 'config.json');
  }

  /**
   * Load and validate the configuration file
   */
  private loadAndValidateConfig(configPath: string): void {
    // Check if file exists
    if (!fs.existsSync(configPath)) {
      throw new SourceValidationError(
        `Config file not found: ${configPath}`
      );
    }

    // Read and parse JSON
    let config: ConfigFile;
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch (error) {
      throw new SourceValidationError(
        `Failed to parse config file: ${configPath}. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Validate structure
    if (!config.sources || !Array.isArray(config.sources)) {
      throw new SourceValidationError(
        'Config must contain a "sources" array'
      );
    }

    // Validate and process each source
    this.sources = config.sources.map((source, index) => {
      this.validateSource(source, index);
      return this.processSource(source);
    });
  }

  /**
   * Validate a source configuration
   */
  private validateSource(source: unknown, index: number): void {
    if (typeof source !== 'object' || source === null) {
      throw new SourceValidationError(
        `Source at index ${index} is not an object`
      );
    }

    const src = source as Record<string, unknown>;

    // Validate required fields
    const requiredFields = ['id', 'name', 'type', 'enabled', 'timeout', 'maxRetries', 'mapper'];
    for (const field of requiredFields) {
      if (!(field in src)) {
        throw new SourceValidationError(
          `Source at index ${index} is missing required field: ${field}`
        );
      }
    }

    // Validate type
    const validTypes = ['rss', 'rest', 'graphql'];
    if (!validTypes.includes(src.type as string)) {
      throw new SourceValidationError(
        `Source at index ${index} has invalid type: ${src.type}. Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Validate type-specific fields
    const type = src.type as string;
    if (type === 'rss' && !src.url) {
      throw new SourceValidationError(
        `RSS source at index ${index} (id: ${src.id}) is missing required field: url`
      );
    }

    if ((type === 'rest' || type === 'graphql') && !src.endpoint) {
      throw new SourceValidationError(
        `${type.toUpperCase()} source at index ${index} (id: ${src.id}) is missing required field: endpoint`
      );
    }

    // Validate auth config if present
    if (src.auth) {
      this.validateAuthConfig(src.auth, index, src.id as string);
    }
  }

  /**
   * Validate authentication configuration
   */
  private validateAuthConfig(auth: unknown, sourceIndex: number, sourceId: string): void {
    if (typeof auth !== 'object' || auth === null) {
      throw new SourceValidationError(
        `Auth config for source ${sourceId} is not an object`
      );
    }

    const authConfig = auth as Record<string, unknown>;

    if (!authConfig.type) {
      throw new SourceValidationError(
        `Auth config for source ${sourceId} is missing required field: type`
      );
    }

    const validAuthTypes = ['apiKey', 'bearer', 'basic', 'oauth2'];
    if (!validAuthTypes.includes(authConfig.type as string)) {
      throw new SourceValidationError(
        `Auth config for source ${sourceId} has invalid type: ${authConfig.type}`
      );
    }

    // Check for environment variables in headers
    if (authConfig.headers && typeof authConfig.headers === 'object') {
      const headers = authConfig.headers as Record<string, string>;
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string' && value.includes('${')) {
          const varName = this.extractVarName(value);
          if (!process.env[varName]) {
            throw new SourceValidationError(
              `Missing environment variable: ${varName}`
            );
          }
        }
      }
    }
  }

  /**
   * Extract environment variable name from template string like ${VAR_NAME}
   */
  private extractVarName(template: string): string {
    const match = template.match(/\$\{([^}]+)\}/);
    return match ? match[1] : template;
  }

  /**
   * Process a source configuration by substituting environment variables
   */
  private processSource(source: SourceConfig): SourceConfig {
    const processed = { ...source };

    // Substitute env vars in auth headers
    if (processed.auth && processed.auth.headers) {
      const substituted: Record<string, string> = {};
      for (const [key, value] of Object.entries(processed.auth.headers)) {
        substituted[key] = this.substituteEnvVars(value);
      }
      processed.auth = {
        ...processed.auth,
        headers: substituted,
      };
    }

    // Cache auth headers for this source
    if (processed.auth && processed.auth.headers) {
      this.authHeadersCache.set(processed.id, processed.auth.headers);
    }

    return processed;
  }

  /**
   * Substitute environment variables in a string
   */
  private substituteEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw new SourceValidationError(
          `Missing environment variable: ${varName}`
        );
      }
      return envValue;
    });
  }

  /**
   * Log the loading status
   */
  private logLoadStatus(): void {
    const enabledCount = this.sources.filter(s => s.enabled).length;
    console.log(`✅ Loaded config: ${this.sources.length} sources (${enabledCount} enabled)`);
  }

  /**
   * Get all enabled sources
   */
  public getEnabled(): SourceConfig[] {
    return this.sources.filter(source => source.enabled === true);
  }

  /**
   * Get sources by type
   */
  public getByType(type: 'rss' | 'rest' | 'graphql'): SourceConfig[] {
    return this.sources.filter(source => source.type === type);
  }

  /**
   * Get a source by ID
   */
  public getById(id: string): SourceConfig | undefined {
    return this.sources.find(source => source.id === id);
  }

  /**
   * Get auth headers for a source
   */
  public getAuthHeaders(sourceId: string): Record<string, string> {
    const cached = this.authHeadersCache.get(sourceId);
    if (cached) {
      return { ...cached };
    }

    const source = this.getById(sourceId);
    if (!source || !source.auth || !source.auth.headers) {
      return {};
    }

    return { ...source.auth.headers };
  }
}
