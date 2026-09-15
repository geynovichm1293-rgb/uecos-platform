const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];
const logFormat = process.env.LOG_FORMAT || 'json';

function formatMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  
  if (logFormat === 'json') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(data && { data })
    });
  }
  
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const logger = {
  debug: (message, data) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, data));
    }
  },
  info: (message, data) => {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, data));
    }
  },
  warn: (message, data) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, data));
    }
  },
  error: (message, data) => {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, data));
    }
  }
};