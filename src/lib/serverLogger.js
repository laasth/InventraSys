import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Define log format for single-line output
const singleLineFormat = winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
  // Convert metadata to a compact JSON string, removing newlines
  const metaStr = Object.keys(meta).length ? 
    ` | ${JSON.stringify(meta).replace(/\n/g, ' ')}` : '';
  return `[${timestamp}] [${level}] [${service}] ${message}${metaStr}`;
});

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json({ space: 0 }) // Compact JSON without pretty printing
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'inventory-system' },
  transports: [
    // Write all logs to console in single-line format
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        singleLineFormat
      )
    }),
    // Write all logs with level 'info' and below to rotating combined logs
    new winston.transports.DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.json({ space: 0 })
      ),
      zippedArchive: true,
      auditFile: path.join(process.cwd(), 'logs', 'combined-audit.json')
    }),
    // Write all logs with level 'error' and below to rotating error logs
    new winston.transports.DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.json({ space: 0 })
      ),
      zippedArchive: true,
      auditFile: path.join(process.cwd(), 'logs', 'error-audit.json')
    })
  ]
});

// Helper function to format request details
function formatReqDetails(req) {
  return {
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || 
        req.socket?.remoteAddress || 
        'unknown',
    username: req.headers['x-username'] || 'unknown',
    userAgent: req.headers['user-agent']
  };
}

// Helper function to log API requests
function logAPIRequest(req, message, meta = {}) {
  const reqDetails = formatReqDetails(req);
  logger.info(message, { ...reqDetails, ...meta });
}

// Helper function to log API errors
function logAPIError(req, error, message) {
  const reqDetails = formatReqDetails(req);
  logger.error(message, {
    ...reqDetails,
    error: error.toString(),
    stack: error.stack?.split('\n').join(' ') // Convert stack trace to single line
  });
}

// Helper function to log database operations
function logDBOperation(operation, details) {
  logger.debug(`Database ${operation}`, details);
}

// Helper function to log system events
function logSystemEvent(message, meta = {}) {
  logger.info(message, meta);
}

export {
  logger,
  logAPIRequest,
  logAPIError,
  logDBOperation,
  logSystemEvent
};
