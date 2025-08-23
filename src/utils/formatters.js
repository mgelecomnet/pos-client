/**
 * Utility functions for formatting data consistently across the application
 */

/**
 * Format a number as currency
 * 
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - ISO currency code (default: USD)
 * @param {string} locale - The locale to use for formatting (default: en-US)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode = 'USD', locale = 'en-US') => {
  if (amount === null || amount === undefined) return '';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `$${parseFloat(amount).toFixed(2)}`;
  }
};

/**
 * Format a date string or Date object to a human-readable format
 * 
 * @param {string|Date} dateInput - Date to format
 * @param {string} locale - The locale to use for formatting (default: en-US)
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateInput, locale = 'en-US', options = {}) => {
  if (!dateInput) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat(locale, mergedOptions).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(dateInput);
  }
};

/**
 * Format a timestamp to a relative time (e.g., "2 hours ago")
 * 
 * @param {string|Date} dateInput - Date to format
 * @param {string} locale - The locale to use for formatting (default: en-US)
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (dateInput, locale = 'en-US') => {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffMs = now - date;
    
    // Convert to seconds
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
      return 'just now';
    }
    
    // Convert to minutes
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffMin < 60) {
      return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    }
    
    // Convert to hours
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    }
    
    // Convert to days
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay < 30) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
    
    // For older dates, use standard date format
    return formatDate(date, locale);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return String(dateInput);
  }
};

/**
 * Format a number with thousand separators
 * 
 * @param {number} number - The number to format
 * @param {string} locale - The locale to use for formatting (default: en-US)
 * @returns {string} Formatted number string
 */
export const formatNumber = (number, locale = 'en-US') => {
  if (number === null || number === undefined) return '';
  
  try {
    return new Intl.NumberFormat(locale).format(number);
  } catch (error) {
    console.error('Error formatting number:', error);
    return String(number);
  }
};

/**
 * Format a percentage value
 * 
 * @param {number} value - The value to format as percentage (0-1)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return '';
  
  try {
    // Convert to percentage (0-100)
    const percentage = value * 100;
    return `${percentage.toFixed(decimals)}%`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return `${value}%`;
  }
}; 