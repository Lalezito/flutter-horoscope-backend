const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

/**
 * 🔄 DATABASE BACKUP AND RECOVERY SERVICE
 * Enterprise-grade backup, recovery, and disaster recovery capabilities
 */

class DatabaseBackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
    this.retentionDays = process.env.BACKUP_RETENTION_DAYS || 30;
    this.compressionLevel = process.env.BACKUP_COMPRESSION_LEVEL || 6;
    
    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Generate backup ID
   */
  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Calculate file checksum
   */
  calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Get database connection URL components
   */
  parseDatabaseUrl() {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      username: url.username,
      password: url.password
    };
  }

  /**
   * Create full database backup
   */
  async createFullBackup() {
    const backupId = this.generateBackupId();
    const startTime = Date.now();
    
    console.log(`🔄 Starting full backup: ${backupId}`);
    
    try {
      const dbConfig = this.parseDatabaseUrl();
      const backupFile = path.join(this.backupDir, `${backupId}.sql.gz`);
      
      // Create pg_dump command with optimal settings
      const pgDumpCommand = [
        'pg_dump',
        `--host=${dbConfig.host}`,
        `--port=${dbConfig.port}`,
        `--username=${dbConfig.username}`,
        '--format=custom',
        '--compress=6',
        '--no-password',
        '--verbose',
        '--lock-wait-timeout=30000',
        dbConfig.database
      ];

      // Set password environment variable
      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      
      // Execute backup
      const backupProcess = spawn(pgDumpCommand[0], pgDumpCommand.slice(1), {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Pipe to gzip for additional compression
      const gzipProcess = spawn('gzip', ['-c'], {
        stdio: ['pipe', fs.openSync(backupFile, 'w'), 'pipe']
      });

      backupProcess.stdout.pipe(gzipProcess.stdin);

      // Wait for completion
      await new Promise((resolve, reject) => {
        let pgDumpError = '';
        let gzipError = '';

        backupProcess.stderr.on('data', (data) => {
          pgDumpError += data.toString();
        });

        gzipProcess.stderr.on('data', (data) => {
          gzipError += data.toString();
        });

        gzipProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Backup failed: ${pgDumpError}\n${gzipError}`));
          } else {
            resolve();
          }
        });
      });

      // Calculate metrics
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      const fileStats = fs.statSync(backupFile);
      const checksum = this.calculateChecksum(backupFile);
      
      // Count tables and rows
      const tableStats = await this.getTableStatistics();
      
      // Record backup metadata
      const backupMetadata = {
        id: backupId,
        backup_type: 'full',
        file_path: backupFile,
        file_size: fileStats.size,
        checksum,
        compression_ratio: null, // Would need original size
        encryption_enabled: false,
        tables_included: tableStats.tableCount,
        rows_backed_up: tableStats.totalRows,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date(endTime).toISOString(),
        duration_ms: executionTime,
        verification_status: 'pending',
        retention_policy: `${this.retentionDays} days`,
        retention_until: new Date(Date.now() + this.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        metadata: {
          pg_dump_version: this.getPgDumpVersion(),
          database_size: await this.getDatabaseSize(),
          tables: tableStats.tables
        }
      };

      // Store metadata in database
      await this.recordBackupMetadata(backupMetadata);
      
      console.log(`✅ Full backup completed: ${backupId}`);
      console.log(`📊 Size: ${Math.round(fileStats.size / 1024 / 1024)}MB, Duration: ${executionTime}ms`);
      
      return backupMetadata;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record failed backup
      await this.recordBackupMetadata({
        id: backupId,
        backup_type: 'full',
        file_path: null,
        file_size: 0,
        checksum: null,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: executionTime,
        status: 'failed',
        metadata: { error: error.message }
      });
      
      console.error(`❌ Full backup failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics() {
    try {
      const result = await db.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_operations,
          n_live_tup as live_tuples
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);
      
      const tables = result.rows;
      const tableCount = tables.length;
      const totalRows = tables.reduce((sum, table) => sum + parseInt(table.live_tuples || 0), 0);
      
      return { tables, tableCount, totalRows };
      
    } catch (error) {
      console.error('Error getting table statistics:', error);
      return { tables: [], tableCount: 0, totalRows: 0 };
    }
  }

  /**
   * Get database size
   */
  async getDatabaseSize() {
    try {
      const result = await db.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      `);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting database size:', error);
      return { size: 'unknown', size_bytes: 0 };
    }
  }

  /**
   * Get pg_dump version
   */
  getPgDumpVersion() {
    try {
      return execSync('pg_dump --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Record backup metadata in database
   */
  async recordBackupMetadata(metadata) {
    const query = `
      INSERT INTO backup_metadata (
        id, backup_type, file_path, file_size, checksum, compression_ratio,
        encryption_enabled, tables_included, rows_backed_up, started_at,
        completed_at, duration_ms, verification_status, retention_policy,
        retention_until, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        completed_at = EXCLUDED.completed_at,
        duration_ms = EXCLUDED.duration_ms,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata
    `;
    
    await db.query(query, [
      metadata.id,
      metadata.backup_type,
      metadata.file_path,
      metadata.file_size,
      metadata.checksum,
      metadata.compression_ratio,
      metadata.encryption_enabled,
      metadata.tables_included,
      metadata.rows_backed_up,
      metadata.started_at,
      metadata.completed_at,
      metadata.duration_ms,
      metadata.verification_status,
      metadata.retention_policy,
      metadata.retention_until,
      metadata.status,
      JSON.stringify(metadata.metadata)
    ]);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    console.log(`🔍 Verifying backup: ${backupId}`);
    
    try {
      // Get backup metadata
      const result = await db.query('SELECT * FROM backup_metadata WHERE id = $1', [backupId]);
      if (result.rows.length === 0) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      const backup = result.rows[0];
      
      // Verify file exists
      if (!fs.existsSync(backup.file_path)) {
        throw new Error(`Backup file not found: ${backup.file_path}`);
      }
      
      // Verify checksum
      const currentChecksum = this.calculateChecksum(backup.file_path);
      if (currentChecksum !== backup.checksum) {
        throw new Error(`Checksum mismatch: expected ${backup.checksum}, got ${currentChecksum}`);
      }
      
      // Update verification status
      await db.query(
        'UPDATE backup_metadata SET verification_status = $1, verification_details = $2 WHERE id = $3',
        ['passed', JSON.stringify({ verified_at: new Date().toISOString() }), backupId]
      );
      
      console.log(`✅ Backup verification passed: ${backupId}`);
      return true;
      
    } catch (error) {
      // Update verification status
      await db.query(
        'UPDATE backup_metadata SET verification_status = $1, verification_details = $2 WHERE id = $3',
        ['failed', JSON.stringify({ error: error.message, verified_at: new Date().toISOString() }), backupId]
      );
      
      console.error(`❌ Backup verification failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups() {
    console.log('🧹 Cleaning up old backups...');
    
    try {
      // Get expired backups
      const result = await db.query(`
        SELECT id, file_path FROM backup_metadata 
        WHERE retention_until < NOW() AND status = 'completed'
      `);
      
      let deletedCount = 0;
      let freedSpace = 0;
      
      for (const backup of result.rows) {
        try {
          if (fs.existsSync(backup.file_path)) {
            const stats = fs.statSync(backup.file_path);
            fs.unlinkSync(backup.file_path);
            freedSpace += stats.size;
          }
          
          // Update status to deleted
          await db.query('UPDATE backup_metadata SET status = $1 WHERE id = $2', ['deleted', backup.id]);
          deletedCount++;
          
        } catch (error) {
          console.error(`Error deleting backup ${backup.id}:`, error);
        }
      }
      
      console.log(`✅ Cleanup completed: ${deletedCount} backups deleted, ${Math.round(freedSpace / 1024 / 1024)}MB freed`);
      return { deletedCount, freedSpace };
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get backup status and health
   */
  async getBackupHealth() {
    try {
      const result = await db.query(`
        SELECT 
          backup_type,
          status,
          COUNT(*) as count,
          MAX(completed_at) as last_backup,
          AVG(duration_ms) as avg_duration,
          SUM(file_size) as total_size
        FROM backup_metadata
        WHERE completed_at > NOW() - INTERVAL '30 days'
        GROUP BY backup_type, status
        ORDER BY backup_type, status
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting backup health:', error);
      return [];
    }
  }
}

module.exports = new DatabaseBackupService();