import axios from 'axios';

// Debug environment variables loading
console.log('Environment variables in odooApi.js:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REACT_APP_ODOO_API_URL:', process.env.REACT_APP_ODOO_API_URL);
console.log('REACT_APP_ODOO_DB:', process.env.REACT_APP_ODOO_DB);
console.log("TEST:", process.env.REACT_APP_TEST);

// Load environment variables from .env file only
const API_URL =
  process.env.NODE_ENV === "development"
    ? "" // در dev → از proxy استفاده کن
    : process.env.REACT_APP_ODOO_API_URL; // در build → از env واقعی

// const API_URL = process.env.REACT_APP_ODOO_API_URL;
const DB_NAME = process.env.REACT_APP_ODOO_DB;

// Current database version - increment this when schema changes
const DB_VERSION = 4;

// Function to delete and recreate IndexedDB when needed
const resetIndexedDB = () => {
  return new Promise((resolve, reject) => {
    console.log('[IndexedDB] Starting database reset/check procedure...');
    
    // Increment DB_VERSION to force schema update
    console.log(`[IndexedDB] Current DB_VERSION: ${DB_VERSION}`);
    
    // First try to open with current version to check if upgrade needed
    const checkRequest = indexedDB.open('POSDatabase');
    
    checkRequest.onsuccess = (event) => {
      const db = event.target.result;
      const currentVersion = db.version;
      
      // Check if all required stores exist
      const requiredStores = ['pos_raw_data', 'pos_metadata'];
      let storesMissing = false;
      
      for (const store of requiredStores) {
        if (!db.objectStoreNames.contains(store)) {
          console.warn(`[IndexedDB] Required store '${store}' is missing!`);
          storesMissing = true;
          break;
        }
      }
      
      db.close();
      
      console.log(`[IndexedDB] Current version: ${currentVersion}, Required version: ${DB_VERSION}, Stores missing: ${storesMissing}`);
      
      // If version is lower than what we need or stores are missing
      if (currentVersion < DB_VERSION || storesMissing) {
        console.log(`[IndexedDB] Database needs upgrade`);
        
        // Delete the old database to force an upgrade
        const deleteRequest = indexedDB.deleteDatabase('POSDatabase');
        
        deleteRequest.onsuccess = () => {
          console.log('[IndexedDB] Successfully deleted old database, will recreate with new schema');
          resolve(true);
        };
        
        deleteRequest.onerror = (event) => {
          console.error('[IndexedDB] Error deleting database:', event.target.error);
          reject(event.target.error);
        };
      } else {
        console.log('[IndexedDB] Database version is current, no upgrade needed');
        resolve(false);
      }
    };
    
    checkRequest.onerror = (event) => {
      console.error('[IndexedDB] Error checking database version:', event.target.error);
      // If we can't even open the database, try to delete it
      try {
        console.log('[IndexedDB] Attempting to delete and recreate database after error');
        const deleteRequest = indexedDB.deleteDatabase('POSDatabase');
        deleteRequest.onsuccess = () => {
          console.log('[IndexedDB] Successfully deleted database after error');
          resolve(true);
        };
        deleteRequest.onerror = (e) => {
          console.error('[IndexedDB] Could not delete database:', e);
          reject(e.target.error);
        };
      } catch (e) {
        console.error('[IndexedDB] Fatal error with database:', e);
        reject(e);
      }
    };
  });
};

// Try to reset IndexedDB if needed
resetIndexedDB().catch(error => {
  console.error('[IndexedDB] Error during database reset:', error);
});

// Check if required environment variables are set
if (!API_URL) {
  console.error('Error: REACT_APP_ODOO_API_URL is not defined in .env file');
}

if (!DB_NAME) {
  console.error('Error: REACT_APP_ODOO_DB is not defined in .env file');
}

// Log API configuration during development
if (process.env.NODE_ENV === 'development') {
  console.log('Odoo API Configuration:');
  console.log(`- API URL: ${API_URL}`);
  console.log(`- Database: ${DB_NAME}`);
}

// Helper function to extract session_id from cookie (improved)
const getSessionIdFromCookie = () => {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'session_id') {
      console.log('[Odoo API] Found session ID in cookie:', value);
      return value;
    }
  }
  return null;
};

// Function to extract token from localStorage (improved)
const getAuthToken = () => {
  try {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && userData.session_id) {
      console.log('[Odoo API] Found session ID in localStorage:', userData.session_id);
      return userData.session_id;
    }
  } catch (e) {
    console.warn('[Odoo API] Failed to parse user data from localStorage:', e);
  }
  return null;
};

// Function to safely update user data in localStorage with session ID
const updateSessionInStorage = (sessionId) => {
  if (!sessionId) return false;
  
  try {
    // Get current user data
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Update with new session ID
    userData.session_id = sessionId;
    
    // Save back to localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    
    console.log('[Odoo API] Updated session ID in localStorage:', sessionId);
    return true;
  } catch (e) {
    console.error('[Odoo API] Failed to update session in localStorage:', e);
    return false;
  }
};

// Create an axios instance with default configs
const odooApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // This is important for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Add request interceptor to handle session and database
odooApi.interceptors.request.use(config => {
  // Debug - log request details
  console.log(`[Odoo API] ${config.method?.toUpperCase() || 'REQUEST'} ${config.url}`, {
    headers: config.headers,
    params: config.params,
    data: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null
  });

  // Important: Get session ID from multiple sources with priority
  // Try localStorage first (most reliable in CORS scenarios), then cookies
  const sessionId = getAuthToken() || getSessionIdFromCookie();
  
  if (sessionId) {
    console.log('[Odoo API] Using session ID:', sessionId);
    
    // IMPORTANT: For Odoo 18, set the session ID in multiple places
    // 1. Set in specific Odoo header
    config.headers['X-Openerp-Session-Id'] = sessionId;
    
    // 2. Set in Authorization header as a fallback
    config.headers['Authorization'] = `Session ${sessionId}`;
    
    // 3. Set in custom header that might be used by some Odoo installations
    config.headers['X-Session-Id'] = sessionId;
    
    // 4. Add to any existing Cookie header (though this might not work with CORS)
    const cookieHeader = config.headers['Cookie'] || '';
    if (!cookieHeader.includes('session_id=')) {
      config.headers['Cookie'] = cookieHeader ? 
        `${cookieHeader}; session_id=${sessionId}` : 
        `session_id=${sessionId}`;
    }
  } else {
    console.warn('[Odoo API] No session ID found for request');
  }
  
  // Add database name to the data if it's a post request with a jsonrpc param
  if (config.method === 'post' && config.data) {
    try {
      // Handle both string and object data
      let data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      
      // For requests, add the database name to params
      if (data.params && data.jsonrpc) {
        // Always set the db parameter
        data.params.db = DB_NAME;
        
        // For Odoo 18, inject the session_id into the params if available
        if (sessionId && !data.params.session_id) {
          data.params.session_id = sessionId;
          console.log('[Odoo API] Added session_id to request params');
        }
        
        // Ensure proper context object exists
        if (!data.params.kwargs) {
          data.params.kwargs = {};
        }
        
        if (!data.params.kwargs.context) {
          data.params.kwargs.context = {};
        }
        
        // Add session to context
        if (sessionId) {
          data.params.kwargs.context.session_id = sessionId;
        }
        
        config.data = JSON.stringify(data);
      }
    } catch (e) {
      console.warn('[Odoo API] Could not parse request data:', e);
    }
  }
  
  // Always set db parameter for all requests
  if (!config.params) {
    config.params = { db: DB_NAME };
  } else if (!config.params.db) {
    config.params.db = DB_NAME;
  }
  
  return config;
});

// Add response interceptor to handle errors and session information
odooApi.interceptors.response.use(
  response => {
    // Debug - log response (truncated to avoid huge logs)
    console.log(`[Odoo API] Response from ${response.config.url}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers ? Object.fromEntries(
        Object.entries(response.headers).slice(0, 5)
      ) : 'No headers'
    });
    
    // CRITICAL PART: Extract session ID from various places in the response
    let sessionId = null;
    
    // Check 1: Look in response data
    if (response.data && response.data.result && response.data.result.session_id) {
      sessionId = response.data.result.session_id;
      console.log('[Odoo API] Found session ID in response data:', sessionId);
    }
    
    // Check 2: Look in set-cookie headers (though might not be accessible due to CORS)
    if (!sessionId && response.headers && response.headers['set-cookie']) {
      const setCookieHeader = response.headers['set-cookie'];
      if (typeof setCookieHeader === 'string' && setCookieHeader.includes('session_id=')) {
        const match = setCookieHeader.match(/session_id=([^;]+)/);
        if (match && match[1]) {
          sessionId = match[1].trim();
          console.log('[Odoo API] Found session ID in set-cookie header:', sessionId);
        }
      }
      // Handle array of cookies
      else if (Array.isArray(setCookieHeader)) {
        const sessionCookie = setCookieHeader.find(c => c.includes('session_id='));
        if (sessionCookie) {
          const match = sessionCookie.match(/session_id=([^;]+)/);
          if (match && match[1]) {
            sessionId = match[1].trim();
            console.log('[Odoo API] Found session ID in set-cookie array:', sessionId);
          }
        }
      }
    }
    
    // Check 3: Look in special odoo headers
    if (!sessionId && response.headers) {
      const sessionHeader = 
        response.headers['x-openerp-session-id'] || 
        response.headers['x-session-id'];
      
      if (sessionHeader) {
        sessionId = sessionHeader;
        console.log('[Odoo API] Found session ID in response header:', sessionId);
      }
    }
    
    // If we found a session ID, store it securely in multiple places
    if (sessionId) {
      // Store in localStorage (most reliable for CORS scenarios)
      updateSessionInStorage(sessionId);
      
      // Also try to set as a cookie (may not work with CORS)
      try {
        document.cookie = `session_id=${sessionId}; path=/; max-age=86400`;
        console.log('[Odoo API] Set session ID as cookie');
      } catch (e) {
        console.warn('[Odoo API] Could not set session cookie:', e);
      }
    }
    
    return response;
  },
  error => {
    // Debug - log error response
    console.error(`[Odoo API] Error for ${error.config?.url || 'unknown request'}:`, {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data ? (typeof error.response.data === 'object' ? 
              Object.keys(error.response.data).length + ' keys' : 
              'Data present') : 'No data'
      } : 'No response'
    });
    
    // Check for session expired or authentication errors
    if (error.response) {
      // Check for session expired in error data (Odoo specific)
      const isSessionExpired = 
        (error.response.data && error.response.data.error && 
         (error.response.data.error.code === 100 || 
          error.response.data.error.message?.toLowerCase().includes('session') ||
          error.response.data.error.data?.message?.toLowerCase().includes('session'))) ||
        error.response.status === 401 || 
        error.response.status === 403;
      
      if (isSessionExpired) {
        console.warn('[Odoo API] Session expired or invalid. Cleaning up and redirecting to login...');
        
        // Clear all localStorage items that may contain session data
        const itemsToRemove = [
          'user',
          'token',
          'session_id',
          'pos_active_order_id',
          'pos_orders',
          'current_session',
          'odoo_session',
          'auth_token'
        ];
        
        itemsToRemove.forEach(item => {
          try {
            localStorage.removeItem(item);
          } catch (e) {
            console.warn(`[Odoo API] Failed to remove ${item} from localStorage:`, e);
          }
        });
        
        // Clear all cookies thoroughly
        try {
          document.cookie.split(";").forEach(function(c) {
            const cookieName = c.replace(/^ +/, "").split("=")[0];
            // Use both domain and non-domain versions to ensure cleanup
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
          });
          console.log('[Odoo API] Cleared all cookies');
        } catch (e) {
          console.warn('[Odoo API] Error clearing cookies:', e);
        }
        
        // Redirect to login page if not already there, with timestamp to prevent caching
      if (window.location.pathname !== '/login') {
          console.log('[Odoo API] Redirecting to login page');
          window.location.href = `/login?t=${new Date().getTime()}&expired=true`;
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Test connection function for debugging
export const testConnection = async () => {
  try {
    console.log('[TEST] Testing connection to Odoo server...');
    const sessionId = getAuthToken() || getSessionIdFromCookie();
    console.log('[TEST] Current session ID:', sessionId);
    
    // First try to get session info
    const sessionResponse = await odooApi.post('/web/session/get_session_info', {
      jsonrpc: '2.0',
      method: 'call',
      params: {}
    });
    
    console.log('[TEST] Session info response:', sessionResponse.data);
    
    // Then try a simple API call to verify functionality
    const versionResponse = await odooApi.post('/web/webclient/version_info', {
      jsonrpc: '2.0',
      method: 'call',
      params: {}
    });
    
    console.log('[TEST] Version info response:', versionResponse.data);
    
    return {
      success: true,
      sessionInfo: sessionResponse.data.result,
      versionInfo: versionResponse.data.result
    };
  } catch (error) {
    console.error('[TEST] Connection test failed:', error);
    return {
      success: false,
      error: error.message,
      response: error.response?.data
    };
  }
};

// Export database name so other modules can access it
export const odooConfig = {
  apiUrl: API_URL,
  database: DB_NAME,
  testConnection // Export test function
};

// Function to setup and initialize the IndexedDB database
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('POSDatabase', DB_VERSION);
    
    // Handle database upgrade (first time creation or version change)
    request.onupgradeneeded = (event) => {
      console.log(`[IndexedDB] Database upgrade triggered from version ${event.oldVersion} to ${event.newVersion}`);
      const db = event.target.result;
      
      // Create stores for all Odoo models
      const odooModels = [
        'pos_session',
        'pos_config',
        'pos_order',
        'pos_order_line',
        'pos_pack_operation_lot',
        'pos_payment',
        'pos_payment_method',
        'pos_printer',
        'pos_category',
        'pos_bill',
        'res_company',
        'account_tax',
        'account_tax_group',
        'product_product',
        'product_attribute',
        'product_attribute_custom_value',
        'product_template_attribute_line',
        'product_template_attribute_value',
        'product_combo',
        'product_combo_item',
        'product_packaging',
        'res_users',
        'res_partner',
        'decimal_precision',
        'uom_uom',
        'uom_category',
        'res_country',
        'res_country_state',
        'res_lang',
        'product_pricelist',
        'product_pricelist_item',
        'product_category',
        'account_cash_rounding',
        'account_fiscal_position',
        'account_fiscal_position_tax',
        'stock_picking_type',
        'res_currency',
        'pos_note',
        'ir_ui_view',
        'product_tag',
        'ir_module_module'
      ];
      
      // Create a store for each Odoo model
      odooModels.forEach(model => {
        const storeName = model;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
          console.log(`[IndexedDB] Created store: ${storeName}`);
        }
      });
      
      // Create our utility stores - IMPORTANT: Make sure pos_raw_data is created!
      const utilityStores = [
        'pos_raw_data',
        'pos_metadata'
      ];
      
      utilityStores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
          console.log(`[IndexedDB] Created utility store: ${storeName}`);
        }
      });
    };
    
    request.onerror = (event) => {
      console.error('[IndexedDB] Database error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log(`[IndexedDB] Successfully opened database, version ${db.version}`);
      
      // IMPORTANT: Check if pos_raw_data store exists, if not - increment version and reopen
      if (!db.objectStoreNames.contains('pos_raw_data')) {
        console.warn('[IndexedDB] pos_raw_data store is missing, need to upgrade database');
        db.close();
        // Increment DB version to force upgrade
        const newVersion = DB_VERSION + 1;
        console.log(`[IndexedDB] Will attempt to reopen with new version ${newVersion}`);
        
        // Update the module's DB_VERSION for future use
        window.setTimeout(() => {
          indexedDB.deleteDatabase('POSDatabase');
          console.log('[IndexedDB] Database deleted, it will be recreated on next access');
        }, 100);
        
        reject(new Error('Database needs upgrade, please refresh the page'));
        return;
      }
      
      resolve(db);
    };
  });
};

// Helper function to store data in IndexedDB
const storeDataInDB = (storeName, key, data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      
      // Extra validation to make sure the store exists
      if (!db.objectStoreNames.contains(storeName)) {
        console.error(`[IndexedDB] Store "${storeName}" does not exist in database`);
        // Try to recreate the database
        db.close();
        await resetIndexedDB();
        reject(new Error(`Store "${storeName}" not found. Database has been reset, please refresh the page.`));
        return;
      }
      
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.put(data, key);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error storing data in ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in storeDataInDB for ${storeName}:`, error);
      reject(error);
    }
  });
};

// Helper function to retrieve data from IndexedDB
const getDataFromDB = (storeName, key) => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.get(key);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error getting data from ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in getDataFromDB for ${storeName}:`, error);
      reject(error);
    }
  });
};

// Helper function to retrieve all data from a store in IndexedDB
const getAllFromDB = (storeName) => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error getting all data from ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in getAllFromDB for ${storeName}:`, error);
      reject(error);
    }
  });
};

// Helper function to clear data from IndexedDB
const clearDataFromDB = (storeName, key = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      let request;
      if (key === null) {
        // Clear the entire store
        request = store.clear();
      } else {
        // Delete a specific key
        request = store.delete(key);
      }
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error(`[IndexedDB] Error clearing data from ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in clearDataFromDB for ${storeName}:`, error);
      reject(error);
    }
  });
};

// Helper functions for processing raw data
const processProducts = (products) => {
  if (!products || !Array.isArray(products)) return [];
  
  return products.map(product => {
    return {
      id: product.id,
      name: product.name || 'Unknown Product',
      price: product.list_price || 0,
      barcode: product.barcode || '',
      available_quantity: product.qty_available || 0,
      category_id: product.pos_categ_id ? product.pos_categ_id[0] : false,
      taxes_id: product.taxes_id || [],
      image_url: product.image_128 ? `data:image/png;base64,${product.image_128}` : '',
      // Add any other needed fields
    };
  });
};

const processCategories = (categories) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories.map(category => {
    return {
      id: category.id,
      name: category.name || 'Unknown Category',
      parent_id: category.parent_id ? category.parent_id[0] : false,
      sequence: category.sequence || 0,
      image_url: category.image_128 ? `data:image/png;base64,${category.image_128}` : '',
    };
  });
};

const processPartners = (partners) => {
  if (!partners || !Array.isArray(partners)) return [];
  
  return partners.map(partner => {
    return {
      id: partner.id,
      name: partner.name || 'Unknown Partner',
      email: partner.email || '',
      phone: partner.phone || '',
      mobile: partner.mobile || '',
      address: `${partner.street || ''} ${partner.street2 || ''}`.trim(),
      city: partner.city || '',
      country: partner.country_id ? partner.country_id[1] : '',
      vat: partner.vat || '',
      image_url: partner.image_128 ? `data:image/png;base64,${partner.image_128}` : '',
    };
  });
};

const processPaymentMethods = (methods) => {
  if (!methods || !Array.isArray(methods)) return [];
  
  return methods.map(method => {
    return {
      id: method.id,
      name: method.name || 'Unknown Payment Method',
      is_cash_count: method.is_cash_count || false,
      journal_id: method.journal_id ? method.journal_id[0] : false,
      company_id: method.company_id ? method.company_id[0] : false,
    };
  });
};

const processTaxes = (taxes) => {
  if (!taxes || !Array.isArray(taxes)) return [];
  
  return taxes.map(tax => {
    return {
      id: tax.id,
      name: tax.name || 'Unknown Tax',
      amount: tax.amount || 0,
      price_include: tax.price_include || false,
      type: tax.amount_type || 'percent',
      company_id: tax.company_id ? tax.company_id[0] : false,
    };
  });
};

const processSessionInfo = (sessionInfo) => {
  if (!sessionInfo) return {};
  
  return {
    id: sessionInfo.id,
    name: sessionInfo.name || 'Unknown Session',
    state: sessionInfo.state || 'opened',
    user_id: sessionInfo.user_id ? sessionInfo.user_id[0] : false,
    config_id: sessionInfo.config_id ? sessionInfo.config_id[0] : false,
    start_at: sessionInfo.start_at || new Date().toISOString(),
    currency_id: sessionInfo.currency_id ? sessionInfo.currency_id[0] : false,
    cash_register_balance_start: sessionInfo.cash_register_balance_start || 0,
    cash_register_total_entry_encoding: sessionInfo.cash_register_total_entry_encoding || 0,
    cash_register_balance_end: sessionInfo.cash_register_balance_end || 0,
    cash_register_balance_end_real: sessionInfo.cash_register_balance_end_real || 0,
  };
};

const processConfig = (config) => {
  if (!config) return {};
  
  return {
    id: config.id,
    name: config.name || 'Unknown POS Config',
    session_duration: config.session_duration || 24,
    warehouse_id: config.warehouse_id ? config.warehouse_id[0] : false,
    company_id: config.company_id ? config.company_id[0] : false,
    pricelist_id: config.pricelist_id ? config.pricelist_id[0] : false,
    receipt_header: config.receipt_header || '',
    receipt_footer: config.receipt_footer || '',
    currency_id: config.currency_id ? config.currency_id[0] : false,
  };
};

/**
 * Load all POS data for a given session ID
 * @param {string|number} sessionId - POS session ID
 * @param {boolean} [force=false] - Force reload data even if it's not expired
 * @param {string} [specificModel=null] - If provided, only reload this specific model
 * @returns {Promise<object>} - All processed POS data
 */
export const loadPOSData = async (sessionId, force = false, specificModel = null) => {
  try {
    console.log(`[POS Data] Loading POS data for session ${sessionId}, force=${force}${specificModel ? `, model=${specificModel}` : ''}`);
    
    // Check if we should load fresh data
    if (!force && !specificModel) {
      const isFresh = await getLocalPOSData.isFreshData(sessionId);
      if (isFresh) {
        console.log('[POS Data] Using cached POS data');
        return await getLocalPOSData.getAllData();
      }
    }

    console.log(`[POS Data] Fetching fresh POS data for session ${sessionId}`);
    
    // Get user data from localStorage to extract uid and company_id
    let uid = 1;
    let company_id = 1;
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      uid = userData.uid || 1;
      company_id = userData.company_id || 1;
      console.log('[POS Data] Using user data:', { uid, company_id });
    } catch (e) {
      console.warn('[POS Data] Could not get user data from localStorage:', e);
    }
    
    // Fetch data from Odoo server
    const response = await odooApi.post('/web/dataset/call_kw/pos.session/load_data', {
      id: 0,
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'pos.session',
        method: 'load_data',
        args: [parseInt(sessionId), specificModel ? [specificModel] : []],
        kwargs: {
          context: {
            lang: 'en_US',
            tz: 'Asia/Tehran',
            uid: uid,
            allowed_company_ids: [company_id]
          }
        }
      }
    });

    if (!response.data || !response.data.result) {
      throw new Error('No data received from the server');
    }

    console.log('[POS Data] Successfully received data from server');
    console.log('[POS Data] Response data structure:', Object.keys(response.data.result));
    
    // Log a sample of the data for each model
    for (const key of Object.keys(response.data.result)) {
      const value = response.data.result[key];
      console.log(`[POS Data] Key: ${key}, Type:`, Array.isArray(value) ? 'Array' : typeof value);
      if (Array.isArray(value)) {
        console.log(`[POS Data] Array length: ${value.length}`);
        if (value.length > 0) {
          console.log(`[POS Data] First item sample:`, value[0]);
        }
      }
    }
    
    // When loading everything, store the raw data for debugging purposes
    if (!specificModel) {
      await storeDataInDB('pos_raw_data', 'data', response.data.result);
    }
    
    // Map of data types and their corresponding store names
    const dataMapping = {
      'pos.session': 'pos_session',
      'pos.config': 'pos_config',
      'pos.order': 'pos_order',
      'pos.order.line': 'pos_order_line',
      'pos.pack.operation.lot': 'pos_pack_operation_lot',
      'pos.payment': 'pos_payment',
      'pos.payment.method': 'pos_payment_method',
      'pos.printer': 'pos_printer',
      'pos.category': 'pos_category',
      'pos.bill': 'pos_bill',
      'res.company': 'res_company',
      'account.tax': 'account_tax',
      'account.tax.group': 'account_tax_group',
      'product.product': 'product_product',
      'product.attribute': 'product_attribute',
      'product.attribute.custom.value': 'product_attribute_custom_value',
      'product.template.attribute.line': 'product_template_attribute_line',
      'product.template.attribute.value': 'product_template_attribute_value',
      'product.combo': 'product_combo',
      'product.combo.item': 'product_combo_item',
      'product.packaging': 'product_packaging',
      'res.users': 'res_users',
      'res.partner': 'res_partner',
      'decimal.precision': 'decimal_precision',
      'uom.uom': 'uom_uom',
      'uom.category': 'uom_category',
      'res.country': 'res_country',
      'res.country.state': 'res_country_state',
      'res.lang': 'res_lang',
      'product.pricelist': 'product_pricelist',
      'product.pricelist.item': 'product_pricelist_item',
      'product.category': 'product_category',
      'account.cash.rounding': 'account_cash_rounding',
      'account.fiscal.position': 'account_fiscal_position',
      'account.fiscal.position.tax': 'account_fiscal_position_tax',
      'stock.picking.type': 'stock_picking_type',
      'res.currency': 'res_currency',
      'pos.note': 'pos_note',
      'ir.ui.view': 'ir_ui_view',
      'product.tag': 'product_tag',
      'ir.module.module': 'ir_module_module'
    };
    
    // Process and store each data type separately
    const result = response.data.result;
    const processedData = {};
    
    // If a specific model was requested, only process that one
    if (specificModel) {
      if (result[specificModel]) {
        const storeName = dataMapping[specificModel];
        if (storeName) {
          console.log(`[POS Data] Processing and storing ${specificModel} data`);
          
          // Handle data that comes directly as an array
          let modelDataArray = Array.isArray(result[specificModel]) ? result[specificModel] : [];
          
          // Handle data that comes in { data: [...] } format
          if (result[specificModel] && result[specificModel].data && Array.isArray(result[specificModel].data)) {
            modelDataArray = result[specificModel].data;
          }
          
          // Format data structure correctly
          const modelData = {
            data: modelDataArray,
            fields: result[`${specificModel}_fields`] || {},
            relations: result[`${specificModel}_relations`] || {}
          };
          
          console.log(`[POS Data] Storing ${modelDataArray.length} items for ${specificModel}`);
          await storeDataInDB(storeName, 'data', modelData);
          processedData[specificModel] = modelData;
        }
      } else {
        console.log(`[POS Data] No data found for requested model ${specificModel}`);
      }
    } else {
      // Process all data types
      for (const [odooModelName, storeName] of Object.entries(dataMapping)) {
        // Check if there's data for this model in any form (direct array or fields)
        const hasData = result[odooModelName] !== undefined || result[`${odooModelName}_fields`] !== undefined;
        
        if (hasData) {
          console.log(`[POS Data] Processing and storing ${odooModelName} data`);
          
          // Handle data that comes directly as an array
          let modelDataArray = Array.isArray(result[odooModelName]) ? result[odooModelName] : [];
          
          // Handle data that comes in { data: [...] } format
          if (result[odooModelName] && result[odooModelName].data && Array.isArray(result[odooModelName].data)) {
            modelDataArray = result[odooModelName].data;
          }
          
          // Format data structure correctly
          const modelData = {
            data: modelDataArray,
            fields: result[`${odooModelName}_fields`] || {},
            relations: result[`${odooModelName}_relations`] || {}
          };
          
          console.log(`[POS Data] Storing ${modelDataArray.length} items for ${odooModelName}`);
          await storeDataInDB(storeName, 'data', modelData);
          processedData[odooModelName] = modelData;
        } else {
          console.log(`[POS Data] No data found for ${odooModelName}`);
        }
      }
    }
    
    // Only update metadata if we're loading everything or we've successfully loaded a specific model
    if (!specificModel || Object.keys(processedData).length > 0) {
      await storeDataInDB('pos_metadata', 'timestamp', new Date().getTime());
      await storeDataInDB('pos_metadata', 'session_id', sessionId);
    }
    
    // Log success
    console.log('[POS Data] Data processed and stored successfully');
    
    return processedData;
  } catch (error) {
    console.error('[POS Data] Error in loadPOSData:', error);
    throw error;
  }
};

// Helper functions to access stored POS data
export const getLocalPOSData = {
  // Check if we have fresh data for the given session
  isFreshData: async (sessionId) => {
    try {
      // Get the currently stored session ID
      const storedSessionId = await getDataFromDB('pos_metadata', 'session_id');
      if (!storedSessionId || storedSessionId !== sessionId) {
        console.log('[POS Data] Stored data is for different session, need to reload');
        return false;
      }
      
      // Check when the data was last loaded
      const loadTimestamp = await getDataFromDB('pos_metadata', 'timestamp');
      if (!loadTimestamp) return false;
      
      // Check if data is older than 15 minutes (900000 ms)
      const now = new Date().getTime();
      const age = now - loadTimestamp;
      const isFresh = age < 900000;
      
      if (!isFresh) {
        console.log(`[POS Data] Data age: ${Math.round(age/1000/60)} minutes, is too old`);
        return false;
      }
      
      // Verify that at least the critical stores have data
      const criticalStores = ['product_product', 'pos_category', 'res_partner'];
      for (const store of criticalStores) {
        const storeData = await getDataFromDB(store, 'data');
        
        // Check if data exists
        if (!storeData) {
          console.log(`[POS Data] Critical store ${store} is empty, need to reload data`);
          return false;
        }
        
        // Check if data is in new format with data property
        if (storeData.data !== undefined) {
          // Check if data array is empty
          if (!storeData.data || !Array.isArray(storeData.data) || storeData.data.length === 0) {
            console.log(`[POS Data] Critical store ${store} has empty data array, need to reload data`);
            return false;
          }
        } 
        // Check if data is in old format (direct array)
        else if (Array.isArray(storeData)) {
          if (storeData.length === 0) {
            console.log(`[POS Data] Critical store ${store} has empty array, need to reload data`);
            return false;
          }
        }
        // If neither format matches, data is invalid
        else {
          console.log(`[POS Data] Critical store ${store} has invalid data format, need to reload data`);
          return false;
        }
      }
      
      console.log(`[POS Data] Data age: ${Math.round(age/1000/60)} minutes, is fresh: ${isFresh}`);
      return true;
    } catch (e) {
      console.error('[POS Data] Error checking data freshness:', e);
      return false;
    }
  },
  
  // Get all data for debugging
  getRawData: async () => {
    try {
      const db = await initIndexedDB();
      const allData = {};
      const storeNames = Array.from(db.objectStoreNames);
      
      for (const storeName of storeNames) {
        allData[storeName] = await getAllFromDB(storeName);
      }
      
      return allData;
    } catch (e) {
      console.error('[POS Data] Error getting raw data:', e);
      return null;
    }
  },
  
  // Get currency information from IndexedDB
  getCurrency: async () => {
    try {
      console.log('[POS Data] Getting currency information from IndexedDB...');
      
      // First, we need to get the company info to find the default currency
      const companyData = await getAllFromDB('res_company');
      if (!companyData || !companyData.length) {
        console.warn('[POS Data] No company data found in IndexedDB');
        return { symbol: '$', name: 'USD', position: 'before' }; // Default fallback
      }
      
      // Get company's currency_id
      const company = companyData[0]; // Assume first company
      const currencyId = company.currency_id?.[0] || null;
      
      if (!currencyId) {
        console.warn('[POS Data] No currency_id found in company data');
        return { symbol: '$', name: 'USD', position: 'before' }; // Default fallback
      }
      
      // Get all currencies and find the matching one
      const currencies = await getAllFromDB('res_currency');
      if (!currencies || !currencies.length) {
        console.warn('[POS Data] No currency data found in IndexedDB');
        return { symbol: '$', name: 'USD', position: 'before' }; // Default fallback
      }
      
      // Find the company's currency
      const companyCurrency = currencies.find(curr => curr.id === currencyId);
      if (!companyCurrency) {
        console.warn(`[POS Data] Currency with ID ${currencyId} not found in res_currency`);
        return { symbol: '$', name: 'USD', position: 'before' }; // Default fallback
      }
      
      console.log('[POS Data] Found currency:', companyCurrency);
      
      return {
        id: companyCurrency.id,
        name: companyCurrency.name || 'USD',
        symbol: companyCurrency.symbol || '$',
        position: companyCurrency.position || 'before', // 'before' or 'after'
        rate: companyCurrency.rate || 1,
        decimal_places: companyCurrency.decimal_places || 0,
        rounding: companyCurrency.rounding || 1
      };
    } catch (error) {
      console.error('[POS Data] Error getting currency information:', error);
      return { symbol: '$', name: 'USD', position: 'before' }; // Default fallback
    }
  },
  
  // Get all data - assemble from all stores
  getAllData: async () => {
    try {
      const result = {};
      const storeMapping = {
        'pos.session': 'pos_session',
        'pos.config': 'pos_config',
        'pos.order': 'pos_order',
        'pos.order.line': 'pos_order_line',
        'pos.pack.operation.lot': 'pos_pack_operation_lot',
        'pos.payment': 'pos_payment',
        'pos.payment.method': 'pos_payment_method',
        'pos.printer': 'pos_printer',
        'pos.category': 'pos_category',
        'pos.bill': 'pos_bill',
        'res.company': 'res_company',
        'account.tax': 'account_tax',
        'account.tax.group': 'account_tax_group',
        'product.product': 'product_product',
        'product.attribute': 'product_attribute',
        'product.attribute.custom.value': 'product_attribute_custom_value',
        'product.template.attribute.line': 'product_template_attribute_line',
        'product.template.attribute.value': 'product_template_attribute_value',
        'product.combo': 'product_combo',
        'product.combo.item': 'product_combo_item',
        'product.packaging': 'product_packaging',
        'res.users': 'res_users',
        'res.partner': 'res_partner',
        'decimal.precision': 'decimal_precision',
        'uom.uom': 'uom_uom',
        'uom.category': 'uom_category',
        'res.country': 'res_country',
        'res.country.state': 'res_country_state',
        'res.lang': 'res_lang',
        'product.pricelist': 'product_pricelist',
        'product.pricelist.item': 'product_pricelist_item',
        'product.category': 'product_category',
        'account.cash.rounding': 'account_cash_rounding',
        'account.fiscal.position': 'account_fiscal_position',
        'account.fiscal.position.tax': 'account_fiscal_position_tax',
        'stock.picking.type': 'stock_picking_type',
        'res.currency': 'res_currency',
        'pos.note': 'pos_note',
        'ir.ui.view': 'ir_ui_view',
        'product.tag': 'product_tag',
        'ir.module.module': 'ir_module_module'
      };
      
      // Get data from each store
      for (const [odooModelName, storeName] of Object.entries(storeMapping)) {
        try {
          const storeData = await getDataFromDB(storeName, 'data');
          if (storeData) {
            // If data has the new format (data/fields/relations)
            if (storeData.data !== undefined) {
              result[odooModelName] = storeData;
            } 
            // If data is in old format (just an array)
            else if (Array.isArray(storeData)) {
              result[odooModelName] = {
                data: storeData,
                fields: {},
                relations: {}
              };
            }
            // Otherwise, try to guess the format
            else {
              console.warn(`[POS Data] Data format for ${odooModelName} is unexpected:`, 
                typeof storeData === 'object' ? Object.keys(storeData) : typeof storeData);
              
              result[odooModelName] = {
                data: Array.isArray(storeData) ? storeData : [],
                fields: {},
                relations: {}
              };
            }
          }
        } catch (e) {
          console.error(`[POS Data] Error retrieving data from ${storeName}:`, e);
        }
      }
      
      return Object.keys(result).length > 0 ? result : null;
    } catch (e) {
      console.error('[POS Data] Error retrieving all data:', e);
      return null;
    }
  },
  
  // Get a specific model's data
  getModelData: async (modelName) => {
    try {
      const storeName = modelName.replace('.', '_');
      const storeData = await getDataFromDB(storeName, 'data');
      
      // Check if the data exists and has the expected structure
      if (!storeData) {
        console.log(`[POS Data] No data found for model ${modelName}`);
        return { data: [], fields: {}, relations: {} };
      }
      
      // If data is already in the new format (has data, fields, relations properties)
      if (storeData.data !== undefined) {
        return storeData;
      }
      
      // If data is in the old format (just an array), convert it to new format
      if (Array.isArray(storeData)) {
        console.log(`[POS Data] Converting ${modelName} data to new format`);
        return {
          data: storeData,
          fields: {},
          relations: {}
        };
      }
      
      // If we got here, the data is in an unexpected format
      console.warn(`[POS Data] Data for ${modelName} is in an unexpected format:`, 
        typeof storeData === 'object' ? Object.keys(storeData) : typeof storeData);
      
      return { data: [], fields: {}, relations: {} };
    } catch (e) {
      console.error(`[POS Data] Error retrieving ${modelName} data:`, e);
      return { data: [], fields: {}, relations: {} };
    }
  },
  
  // Check if essential data exists in the database
  checkDataExists: async () => {
    try {
      // Check the database structure first
      const db = await initIndexedDB();
      const storeNames = Array.from(db.objectStoreNames);
      
      // Check if essential stores exist
      const essentialStores = ['product_product', 'pos_category', 'pos_payment_method'];
      for (const store of essentialStores) {
        if (!storeNames.includes(store)) {
          console.error(`[POS Data] Essential store ${store} does not exist in database`);
          return false;
        }
      }
      
      // Check product data specifically since it's most important
      const productData = await getDataFromDB('product_product', 'data');
      if (!productData) {
        console.error('[POS Data] Product data not found in database');
        return false;
      }
      
      // Check if the product data contains actual items
      if (productData.data && Array.isArray(productData.data)) {
        if (productData.data.length === 0) {
          console.error('[POS Data] Product data exists but contains no items');
          return false;
        }
        console.log(`[POS Data] Found ${productData.data.length} products in database`);
      } else if (Array.isArray(productData)) {
        if (productData.length === 0) {
          console.error('[POS Data] Product data exists but contains no items (old format)');
          return false;
        }
        console.log(`[POS Data] Found ${productData.length} products in database (old format)`);
      } else {
        console.error('[POS Data] Product data has invalid format:', typeof productData);
        return false;
      }
      
      // Store metadata should contain a session id and timestamp
      const sessionId = await getDataFromDB('pos_metadata', 'session_id');
      const timestamp = await getDataFromDB('pos_metadata', 'timestamp');
      
      if (!sessionId || !timestamp) {
        console.error('[POS Data] Missing metadata in database:', { sessionId, timestamp });
        return false;
      }
      
      // All checks passed
      console.log('[POS Data] Database verification successful - essential data exists');
      return true;
    } catch (e) {
      console.error('[POS Data] Error checking data existence:', e);
      return false;
    }
  },
  
  // Common shortcuts for frequently used models - now return just the data array for backward compatibility
  getProducts: async () => {
    const products = await getLocalPOSData.getModelData('product.product');
    return products.data || [];
  },
  
  getPartners: async () => {
    const partners = await getLocalPOSData.getModelData('res.partner');
    return partners.data || [];
  },
  
  getCategories: async () => {
    const categories = await getLocalPOSData.getModelData('pos.category');
    return categories.data || [];
  },
  
  getPaymentMethods: async () => {
    const methods = await getLocalPOSData.getModelData('pos.payment.method');
    return methods.data || [];
  },
  
  getTaxes: async () => {
    const taxes = await getLocalPOSData.getModelData('account.tax');
    return taxes.data || [];
  },
  
  getSessionInfo: async () => {
    const sessionInfo = await getLocalPOSData.getModelData('pos.session');
    return sessionInfo.data || [];
  },
  
  getPOSConfig: async () => {
    const config = await getLocalPOSData.getModelData('pos.config');
    return config.data || [];
  },
  
  // Reload a specific model's data from the server
  reloadModelData: async (modelName) => {
    try {
      // First get the current session ID
      const sessionId = await getDataFromDB('pos_metadata', 'session_id');
      if (!sessionId) {
        console.error('[POS Data] No session ID found, cannot reload data');
        return false;
      }
      
      // Clear the existing data
      const storeName = modelName.replace('.', '_');
      await clearDataFromDB(storeName);
      
      // Load fresh data for just this model
      console.log(`[POS Data] Reloading data for model ${modelName}`);
      await loadPOSData(sessionId, true, modelName);
      return true;
    } catch (e) {
      console.error(`[POS Data] Error reloading data for ${modelName}:`, e);
      return false;
    }
  },
  
  // Clear all stored data
  clearAllData: async () => {
    try {
      const db = await initIndexedDB();
      const storeNames = Array.from(db.objectStoreNames);
      
      // Clear each store
      for (const storeName of storeNames) {
        await clearDataFromDB(storeName);
      }
      
      console.log('[POS Data] All local POS data cleared');
      return true;
    } catch (e) {
      console.error('[POS Data] Error clearing data:', e);
      return false;
    }
  },
  
  // Clear a specific data store
  clearStore: async (modelName) => {
    try {
      const storeName = modelName.replace('.', '_');
      await clearDataFromDB(storeName);
      console.log(`[POS Data] Store ${storeName} cleared successfully`);
      
      // Also reset the timestamp so data will be reloaded
      await storeDataInDB('pos_metadata', 'timestamp', 0);
      
      return true;
    } catch (e) {
      console.error(`[POS Data] Error clearing store ${modelName}:`, e);
      return false;
    }
  },
  
  // Get all data with retry in case the first attempt fails
  getProductsWithRetry: async (maxRetries = 3, delay = 300, setStateCallback = null) => {
    let attempts = 0;
    let products = [];
    
    while (attempts < maxRetries) {
      try {
        console.log(`[POS Data] Attempt ${attempts + 1}: Retrieving products...`);
        // Make sure to await the async call
        products = await getLocalPOSData.getProducts() || [];
        console.log(`[POS Data] Attempt ${attempts + 1}: Retrieved ${products.length} products`);
        
        if (products && products.length > 0) {
          // If we have a callback and products, call it immediately
          if (setStateCallback && typeof setStateCallback === 'function') {
            setStateCallback(products);
            console.log('[POS Data] Products state updated via callback');
          }
          return products;
        }
        
        // Check if the model data exists at all
        const db = await initIndexedDB();
        console.log('[POS Data] Checking if product data exists in DB...');
        if (!db.objectStoreNames.contains('product_product')) {
          console.error('[POS Data] Product store does not exist in database!');
          
          // If we're on the last attempt, try to reload POS data completely
          if (attempts === maxRetries - 1) {
            console.log('[POS Data] Attempting to reload all POS data...');
            // Get session ID from storage
            const sessionId = localStorage.getItem('current_session_id');
            if (sessionId) {
              await loadPOSData(sessionId, true); // Force reload
              console.log('[POS Data] Forced reload of POS data complete');
            } else {
              console.error('[POS Data] Cannot reload data - no session ID found');
            }
          }
        } else {
          // Try direct database inspection for debugging
          console.log('[POS Data] Product store exists but no data returned, inspecting...');
          const inspection = await inspectDatabase();
          console.log('[POS Data] Database inspection results:', 
                      inspection.results && inspection.results.product_product ? 
                      inspection.results.product_product : 'No product data found');
        }
        
        // Wait before next attempt
        console.log(`[POS Data] Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
      } catch (error) {
        console.error(`[POS Data] Error retrieving products (attempt ${attempts + 1}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
      }
    }
    
    console.error(`[POS Data] Failed to retrieve products after ${maxRetries} attempts`);
    throw new Error(`Failed to retrieve products after ${maxRetries} attempts`);
  },
};

// Function to inspect database contents (for debugging)
export const inspectDatabase = async () => {
  try {
    console.log('[DEBUG] Inspecting IndexedDB database contents...');
    
    const db = await initIndexedDB();
    const storeNames = Array.from(db.objectStoreNames);
    console.log(`[DEBUG] Available stores: ${storeNames.join(', ')}`);
    
    const results = {};
    
    // Check each store
    for (const storeName of storeNames) {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        
        // Get all data from the store
        const request = store.getAll();
        
        await new Promise((resolve, reject) => {
          request.onsuccess = (event) => {
            const data = event.target.result;
            
            // Get a sample of the data for this store
            const dataToLog = storeName === 'pos_metadata' ? data : 
                            (data.length > 0 ? `${data.length} items, first: ${JSON.stringify(data[0]).substring(0, 100)}...` : 'Empty');
                            
            console.log(`[DEBUG] ${storeName}: ${dataToLog}`);
            
            // Handle specific case of item with key 'data'
            if (data.length === 0) {
              // Try to get by key
              const keyRequest = store.get('data');
              keyRequest.onsuccess = (e) => {
                const keyData = e.target.result;
                if (keyData) {
                  const hasNestedData = keyData.data !== undefined;
                  const dataLength = hasNestedData && Array.isArray(keyData.data) ? keyData.data.length : 'N/A';
                  
                  console.log(`[DEBUG] ${storeName} (data key): Found data with structure:`, 
                    Object.keys(keyData), 
                    `Data array length: ${dataLength}`);
                    
                  if (hasNestedData && dataLength > 0) {
                    console.log(`[DEBUG] ${storeName} sample:`, 
                      JSON.stringify(keyData.data[0]).substring(0, 150) + '...');
                  }
                  
                  results[storeName] = {
                    hasKeyData: true,
                    dataStructure: Object.keys(keyData),
                    dataLength: dataLength
                  };
                } else {
                  console.log(`[DEBUG] ${storeName}: No data found by key 'data'`);
                  results[storeName] = { empty: true };
                }
                resolve();
              };
              keyRequest.onerror = (e) => {
                console.error(`[DEBUG] Error reading ${storeName} by key:`, e.target.error);
                results[storeName] = { error: e.target.error.message };
                resolve();
              };
            } else {
              results[storeName] = {
                count: data.length,
                sample: data.length > 0 ? data[0] : null
              };
              resolve();
            }
          };
          
          request.onerror = (event) => {
            console.error(`[DEBUG] Error reading ${storeName}:`, event.target.error);
            results[storeName] = { error: event.target.error.message };
            reject(event.target.error);
          };
        });
      } catch (storeError) {
        console.error(`[DEBUG] Error accessing store ${storeName}:`, storeError);
        results[storeName] = { error: storeError.message };
      }
    }
    
    console.log('[DEBUG] Database inspection complete');
    db.close();
    
    return {
      success: true,
      storeNames,
      results
    };
  } catch (error) {
    console.error('[DEBUG] Database inspection failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to debug a specific model's data
export const debugModelData = async (modelName) => {
  try {
    console.log(`[DEBUG] Examining data for model: ${modelName}`);
    
    const storeName = modelName.replace('.', '_');
    const db = await initIndexedDB();
    
    if (!db.objectStoreNames.contains(storeName)) {
      console.error(`[DEBUG] Store ${storeName} does not exist`);
      return { success: false, error: 'Store does not exist' };
    }
    
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    // Try getting all keys
    const keysRequest = store.getAllKeys();
    
    const keys = await new Promise((resolve, reject) => {
      keysRequest.onsuccess = (e) => resolve(e.target.result);
      keysRequest.onerror = (e) => reject(e.target.error);
    });
    
    console.log(`[DEBUG] ${storeName} keys:`, keys);
    
    // Get data by 'data' key specifically
    const dataRequest = store.get('data');
    
    const modelData = await new Promise((resolve, reject) => {
      dataRequest.onsuccess = (e) => resolve(e.target.result);
      dataRequest.onerror = (e) => reject(e.target.error);
    });
    
    if (!modelData) {
      console.log(`[DEBUG] No data found for ${modelName} with key 'data'`);
      return { success: false, error: 'No data found' };
    }
    
    console.log(`[DEBUG] ${modelName} data structure:`, Object.keys(modelData));
    
    // Check if data property exists and is an array
    if (modelData.data !== undefined) {
      if (Array.isArray(modelData.data)) {
        console.log(`[DEBUG] ${modelName} data array length:`, modelData.data.length);
        if (modelData.data.length > 0) {
          console.log(`[DEBUG] First item sample:`, modelData.data[0]);
        }
      } else {
        console.log(`[DEBUG] ${modelName} data is not an array, type:`, typeof modelData.data);
      }
    } else {
      console.log(`[DEBUG] ${modelName} data property is undefined`);
    }
    
    return {
      success: true,
      dataExists: !!modelData,
      structure: modelData ? Object.keys(modelData) : [],
      hasDataArray: modelData && modelData.data !== undefined,
      isDataArray: modelData && Array.isArray(modelData.data),
      dataLength: modelData && Array.isArray(modelData.data) ? modelData.data.length : 0,
      sample: modelData && Array.isArray(modelData.data) && modelData.data.length > 0 
        ? modelData.data[0] : null
    };
  } catch (error) {
    console.error(`[DEBUG] Error debugging model ${modelName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export functions for debugging in the browser console
if (typeof window !== 'undefined') {
  window.posDebug = {
    inspectDatabase,
    debugModelData,
    resetDB: resetIndexedDB,
    getLocalPOSData,
    loadPOSData,
    clearStore: async (modelName) => {
      try {
        return await getLocalPOSData.clearStore(modelName);
      } catch (e) {
        console.error(`Error clearing store ${modelName}:`, e);
        return false;
      }
    },
    reloadModel: async (modelName) => {
      try {
        return await getLocalPOSData.reloadModelData(modelName);
      } catch (e) {
        console.error(`Error reloading model ${modelName}:`, e);
        return false;
      }
    }
  };
  console.log('[POS Debug] Debug functions available in window.posDebug');
}

/**
 * Get payment methods available for a specific POS configuration
 * @param {number} configId - POS configuration ID
 * @returns {Promise<Array>} List of available payment methods
 */
export const getPaymentMethods = async (configId) => {
  try {
    console.log(`[POS Data] Fetching payment methods for config ${configId}`);
    
    // First try to get from local storage - using correct store name without dot
    const localConfig = await getDataFromDB('pos_config', configId.toString());
    const localMethods = await getDataFromDB('pos_payment_method', 'all');
    
    if (localConfig && localMethods) {
      console.log('[POS Data] Using cached payment methods');
      
      // Get allowed method IDs from config
      const allowedMethodIds = localConfig.payment_method_ids || [];
      
      // Filter methods by allowed IDs
      const filteredMethods = localMethods.filter(method => 
        allowedMethodIds.includes(method.id)
      );
      
      console.log(`[POS Data] Found ${filteredMethods.length} allowed payment methods`);
      return filteredMethods;
    }
    
    // If no methods found or error occurs, return empty array
    console.log('[POS Data] No payment methods found in local database');
    return [];
  } catch (error) {
    console.error('[POS Data] Error fetching payment methods:', error);
    
    // Try an alternative approach using direct model data
    try {
      console.log('[POS Data] Trying alternative approach to fetch payment methods...');
      
      // Try getting payment methods directly from the model data
      const methodsData = await getLocalPOSData.getModelData('pos.payment.method');
      if (methodsData && methodsData.data && methodsData.data.length > 0) {
        console.log(`[POS Data] Found ${methodsData.data.length} payment methods using alternative method`);
        return methodsData.data;
      }
    } catch (altError) {
      console.error('[POS Data] Alternative approach also failed:', altError);
    }
    
    return [];
  }
};

export default odooApi; 