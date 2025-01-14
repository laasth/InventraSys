// Logger service for frontend
import { usernameStore } from './stores.js';

export class Logger {
  static levels = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  };

  static async log(level, message, context = {}) {
    try {
      let username = 'unknown';
      usernameStore.subscribe(value => {
        username = value;
      })();

      const logData = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        source: 'frontend',
        username
      };

      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
      });
    } catch (error) {
      console.error('Failed to send log to server:', error);
    }
  }

  static debug(message, context = {}) {
    return this.log(this.levels.DEBUG, message, context);
  }

  static info(message, context = {}) {
    return this.log(this.levels.INFO, message, context);
  }

  static warn(message, context = {}) {
    return this.log(this.levels.WARN, message, context);
  }

  static error(message, context = {}) {
    return this.log(this.levels.ERROR, message, context);
  }
}
