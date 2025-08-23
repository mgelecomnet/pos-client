/**
 * Simple logger utility for the POS client
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * General purpose logging function
 * @param {string} message - Message to log
 * @param {Object} data - Optional data to include with the log
 * @param {string} level - Log level (debug, info, warning, error)
 */
export const log = (message, data = null, level = LOG_LEVELS.INFO) => {
  // Format current time
  const timestamp = new Date().toISOString();
  
  // Create log entry
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  // Log to console with appropriate method
  switch (level.toLowerCase()) {
    case LOG_LEVELS.DEBUG:
      console.debug(`[${timestamp}] ${message}`, data || '');
      break;
    case LOG_LEVELS.WARNING:
      console.warn(`[${timestamp}] ${message}`, data || '');
      break;
    case LOG_LEVELS.ERROR:
      console.error(`[${timestamp}] ${message}`, data || '');
      break;
    case LOG_LEVELS.INFO:
    default:
      console.log(`[${timestamp}] ${message}`, data || '');
      break;
  }
  
  return logEntry;
};

/**
 * Log cart changes for debugging
 * @param {string} action - The action performed (add, remove, update)
 * @param {Array} cart - The current cart state
 * @param {string} source - Source of the change
 */
export const logCartChange = (action, cart, source) => {
  log(`Cart ${action}`, { 
    source, 
    itemCount: cart?.length || 0,
    hasRefundItems: cart?.some(item => item.isRefund || item.quantity < 0) || false
  }, LOG_LEVELS.DEBUG);
};

/**
 * Log refund-related information
 * @param {string} message - Message to log
 * @param {Object} data - Optional data to include
 * @param {string} level - Log level
 */
export const refundLog = (message, data = null, level = LOG_LEVELS.INFO) => {
  log(`[Refund] ${message}`, data, level);
};

/**
 * Log refund-related errors
 * @param {string} message - Error message
 * @param {Error|Object} error - Error object or error data
 */
export const refundLogError = (message, error) => {
  const errorData = error instanceof Error 
    ? { message: error.message, stack: error.stack }
    : error;
    
  log(`[Refund Error] ${message}`, errorData, LOG_LEVELS.ERROR);
}; 