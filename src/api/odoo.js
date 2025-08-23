// import axios from 'axios';
import odooApi, { odooConfig, loadPOSData, getLocalPOSData } from './odooApi';
import { v4 as uuidv4 } from 'uuid';

// Use database name from odooConfig that gets values from .env
const DB_NAME = odooConfig.database;

// Initialize state for Odoo version
let odooVersion = null;

// Function to detect Odoo version
// This is currently unused but kept for future reference
// eslint-disable-next-line no-unused-vars
async function detectOdooVersion() {
  let version = null;
  
  try {
    // Try to check server info first
    console.log('Attempting to detect Odoo version...');
    
    const response = await odooApi.get('/web/webclient/version_info');
    if (response.data && response.data.server_version) {
      version = response.data.server_version;
      console.log(`Detected Odoo version: ${version}`);
    }
  } catch (error) {
    console.error('Error detecting version from version_info:', error);
    
    try {
      // Fallback: Try to check session info
      const sessionResponse = await odooApi.post('/web/session/get_session_info');
      if (sessionResponse.data && sessionResponse.data.server_version) {
        version = sessionResponse.data.server_version;
        console.log(`Detected Odoo version from session info: ${version}`);
      }
    } catch (sessionError) {
      console.error('Error detecting version from session:', sessionError);
    }
  } finally {
    // Don't return inside finally - it's unsafe
    console.log('Finished version detection attempts');
  }
  
  // Return outside finally
  return version;
}

// Detect version at startup - forcing Odoo 18
odooVersion = { major: 18, minor: 0, micro: 0, raw: '18.0.0' };
console.log('Setting Odoo version to:', odooVersion);

// Add version utility methods to exported API
export const odooInfo = {
  async getVersion() {
    return odooVersion; // Return Odoo 18 directly
  },
  
  async isVersion12OrBelow() {
    return false; // Odoo 18 is above 12
  },
  
  async isVersion13OrAbove() {
    return true; // Odoo 18 is above 13
  }
};

// Authentication service
export const authService = {
  /**
   * Authenticate user with Odoo
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Authentication result
   */
  login: async (username, password) => {
    try {
      console.log(`[AUTH] Authenticating user ${username} with Odoo at ${odooConfig.apiUrl}`);
      
      // Remove any existing session tokens before login
      localStorage.removeItem('user');
      document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Call Odoo authentication endpoint
      const response = await odooApi.post('/web/session/authenticate', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: DB_NAME,
          login: username,
          password,
        },
      });
      
      // Check response
      if (response.data && response.data.result) {
        const userData = response.data.result;
        
        // For Odoo 18, explicitly look for session_id in response
        let sessionId = userData.session_id;
        
        // Also check response headers for session cookie
        if (!sessionId && response.headers && response.headers['set-cookie']) {
          const sessionCookie = response.headers['set-cookie'].find(c => c.startsWith('session_id='));
          if (sessionCookie) {
            sessionId = sessionCookie.split('=')[1].split(';')[0];
          }
        }
        
        // If still no session ID found, try to get it from cookies that might have been set
        if (!sessionId) {
          const cookies = document.cookie.split(';');
          const sessionCookie = cookies.find(c => c.trim().startsWith('session_id='));
          if (sessionCookie) {
            sessionId = sessionCookie.trim().substring('session_id='.length);
          }
        }
        
        // Ensure we have a session ID and save it
        if (sessionId) {
          console.log('[AUTH] Got session ID:', sessionId);
          
          // Store session ID with user data
          userData.session_id = sessionId;
          
          // Store as cookie for redundancy
          document.cookie = `session_id=${sessionId}; path=/; max-age=86400`;
        } else {
          console.warn('[AUTH] No session ID found in authentication response');
        }
        
        // Store user data in local storage
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('[AUTH] Authentication successful. User data:', userData);
        
        // Verify session is working by making a test request
        try {
          console.log('[AUTH] Verifying session is working...');
          await odooConfig.testConnection();
        } catch (sessionError) {
          console.warn('[AUTH] Session verification error:', sessionError);
          // Continue anyway, don't fail the login
        }
        
        // Return user data
        return userData;
      } else if (response.data && response.data.error) {
        console.error('[AUTH] Login error:', response.data.error);
        throw new Error(response.data.error.data?.message || 'Invalid username or password');
      } else {
        console.error('[AUTH] Unexpected login response:', response.data);
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      throw error;
    }
  },

  /**
   * Logout user and destroy session
   * @returns {Promise<boolean>} Logout result
   */
  logout: async () => {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('session_id');
    localStorage.removeItem('sessionExpiration');
    localStorage.removeItem('lastSyncTime');
    
    try {
      // Attempt to logout via API (may fail if already logged out)
      await odooApi.get('/web/session/logout', {
        withCredentials: true
      });
    } catch (error) {
      console.warn('[AUTH] Error during logout API call:', error);
      // Continue with local logout regardless of API error
    }
    
    // Clear all cookies thoroughly
    try {
      document.cookie.split(";").forEach(function(c) {
        const cookieName = c.replace(/^ +/, "").split("=")[0];
        // Use both domain and non-domain versions to ensure cleanup
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      });
      console.log('[AUTH] Cleared all cookies');
    } catch (e) {
      console.warn('[AUTH] Error clearing cookies:', e);
    }
    
    // Return true to indicate successful logout
    return true;
  },

  /**
   * Get current user from local storage
   * @returns {Object|null} Current user or null if not logged in
   */
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('[AUTH] Error getting current user:', error);
      return null;
    }
  },
  
  /**
   * Test if the current session is valid
   * @returns {Promise<boolean>} True if session is valid
   */
  isSessionValid: async () => {
    try {
      const result = await odooConfig.testConnection();
      return result.success;
    } catch (error) {
      console.error('[AUTH] Session validation error:', error);
      return false;
    }
  }
};

// Products service
export const productService = {
  /**
   * Reload product data from server, bypassing the cache
   * @param {boolean} force - Force reload from server
   * @returns {Promise<boolean>} Success status
   */
  reloadProductData: async (force = false) => {
    try {
      console.log('[Product Service] Reloading product data from server...');
      // Get current session ID
      const currentSessionData = JSON.parse(localStorage.getItem('current_session') || '{}');
      const sessionId = currentSessionData.id;
      
      if (!sessionId) {
        console.error('[Product Service] No session ID found for reloading products');
        return false;
      }
      
      // Load fresh data for product model
      await loadPOSData(sessionId, true, 'product.product');
      
      console.log('[Product Service] Successfully reloaded product data');
      return true;
    } catch (error) {
      console.error('[Product Service] Error reloading product data:', error);
      return false;
    }
  },

  /**
   * Get all products
   * @returns {Promise<Array>} Products list
   */
  getProducts: async () => {
    let localProducts = [];
    
    try {
      // First try to get products from IndexedDB (local storage)
      console.log('Trying to get products from local IndexedDB...');
      localProducts = await getLocalPOSData.getProducts();
      
      // If we have products locally, use them
      if (localProducts && localProducts.length > 0) {
        console.log(`Found ${localProducts.length} products in local database`);
        return localProducts;
      }
      
      // If no local products, fetch from API
      console.log('No products in local database, fetching from API...');
      // API fetch implementation would go here
      
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
    
    // Return empty array if no products were found and no exception occurred
    return localProducts;
  },

  /**
   * Get product by ID
   * @param {number} id - Product ID
   * @returns {Promise<Object>} Product data
   */
  getProductById: async (id) => {
    try {
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'read',
          args: [id],
          kwargs: {},
        },
      });
      
      return response.data.result?.[0] || null;
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @returns {Promise<Object>} Created product
   */
  createProduct: async (productData) => {
    try {
      // Ensure available_in_pos is set
      const data = {
        ...productData,
        available_in_pos: true,
      };
      
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'create',
          args: [data],
          kwargs: {},
        },
      });
      
      if (response.data && response.data.result) {
        return response.data.result;
      } else if (response.data && response.data.error) {
        throw new Error(response.data.error.message || 'Error creating product');
      } else {
        return { success: true, id: 0 };
      }
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },
  
  /**
   * Update an existing product
   * @param {number} id - Product ID
   * @param {Object} productData - Updated product data
   * @returns {Promise<boolean>} Success status
   */
  updateProduct: async (id, productData) => {
    try {
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'write',
          args: [
            [id], // ID as array
            productData
          ],
          kwargs: {},
        },
      });
      
      if (response.data && response.data.error) {
        throw new Error(response.data.error.message || 'Error updating product');
      }
      
      return true;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },
  
  /**
   * Delete a product
   * @param {number} id - Product ID
   * @returns {Promise<boolean>} Success status
   */
  deleteProduct: async (id) => {
    try {
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'unlink',
          args: [[id]],
          kwargs: {},
        },
      });
      
      if (response.data && response.data.error) {
        throw new Error(response.data.error.message || 'Error deleting product');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  /**
   * Fetch product templates
   * @returns {Promise<Array>} Product templates
   */
  fetchProductTemplates: async () => {
    try {
      const response = await odooApi.post('/web/dataset/call_kw/product.template/web_search_read', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.template',
          method: 'web_search_read',
          args: [],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: JSON.parse(localStorage.getItem('user') || '{}').uid || 2,
              allowed_company_ids: [1],
              bin_size: true,
              res_partner_search_mode: 'customer'
            },
            domain: [['customer_rank', '>', 0]],
            fields: ['id', 'name', 'price', 'list_price', 'image_128', 'product_type'],
            limit: 80,
            order: 'name',
            count_limit: 10000
          }
        }
      });
      
      if (response.data && response.data.result) {
        const templates = response.data.result.records || [];
        console.log(`Found ${templates.length} product templates using web_search_read`);
        return templates;
      }
      
      console.warn('No product templates returned from web_search_read');
      return [];
    } catch (error) {
      console.error('Error fetching product templates:', error);
      throw error;
    }
  }
};

// Categories service
export const categoryService = {
  /**
   * Reload category data from server, bypassing the cache
   * @param {boolean} force - Force reload from server
   * @returns {Promise<boolean>} Success status
   */
  reloadCategoryData: async (force = false) => {
    try {
      console.log('[Category Service] Reloading category data from server...');
      // Get current session ID
      const currentSessionData = JSON.parse(localStorage.getItem('current_session') || '{}');
      const sessionId = currentSessionData.id;
      
      if (!sessionId) {
        console.error('[Category Service] No session ID found for reloading categories');
        return false;
      }
      
      // Load fresh data for category model
      await loadPOSData(sessionId, true, 'pos.category');
      
      console.log('[Category Service] Successfully reloaded category data');
      return true;
    } catch (error) {
      console.error('[Category Service] Error reloading category data:', error);
      return false;
    }
  },

  /**
   * Get all categories
   * @returns {Promise<Array>} Categories list
   */
  getCategories: async () => {
    try {
      const categories = await getLocalPOSData.getCategories();
      return categories || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },
  
  /**
   * Create a new POS category
   * @param {Object} categoryData - Category data with name and parent_id
   * @returns {Promise<Object>} Created category
   */
  createCategory: async (categoryData) => {
    try {
      console.log('Creating category with data:', categoryData);
      
      // First call onchange to get default values
      const onchangeResponse = await odooApi.post('/web/dataset/call_kw/pos.category/onchange', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category3',
          method: 'onchange',
          args: [
            [],
            {},
            [],
            {
              "image_128": {},
              "write_date": {},
              "name": {},
              "parent_id": {"fields": {"display_name": {}}},
              "color": {},
              "hour_after": {},
              "hour_until": {},
              "display_name": {}
            }
          ],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: JSON.parse(localStorage.getItem('user') || '{}').uid || 2,
              allowed_company_ids: [1]
            }
          }
        }
      });
      
      console.log('onchange response:', onchangeResponse.data);
      
      // Then call web_save to create the category
      const response = await odooApi.post('/web/dataset/call_kw/pos.category/web_save', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category',
          method: 'web_save',
          args: [
            [],
            categoryData
          ],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: JSON.parse(localStorage.getItem('user') || '{}').uid || 2,
              allowed_company_ids: [1]
            },
            specification: {
              "image_128": {},
              "write_date": {},
              "name": {},
              "parent_id": {"fields": {"display_name": {}}},
              "color": {},
              "hour_after": {},
              "hour_until": {},
              "display_name": {}
            }
          }
        }
      });
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        console.log('Category created successfully:', response.data.result[0]);
        return response.data.result[0];
      } else if (response.data && response.data.error) {
        console.error('Server error creating category:', response.data.error);
        throw new Error(response.data.error.message || 'Error creating category');
      } else {
        console.log('Category created, but no result returned:', response.data);
        return { success: true, id: 0 };
      }
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
  
  /**
   * Update an existing POS category
   * @param {number} id - Category ID
   * @param {Object} categoryData - Updated category data
   * @returns {Promise<boolean>} Success status
   */
  updateCategory: async (id, categoryData) => {
    try {
      console.log('Updating category with ID:', id, 'and data:', categoryData);
      
      // First call onchange for the existing record
      const onchangeResponse = await odooApi.post('/web/dataset/call_kw/pos.category/onchange', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category3',
          method: 'onchange',
          args: [
            [id],
            {},
            [],
            {
              "image_128": {},
              "write_date": {},
              "name": {},
              "parent_id": {"fields": {"display_name": {}}},
              "color": {},
              "hour_after": {},
              "hour_until": {},
              "display_name": {}
            }
          ],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: JSON.parse(localStorage.getItem('user') || '{}').uid || 2,
              allowed_company_ids: [1]
            }
          }
        }
      });
      
      console.log('onchange response for update:', onchangeResponse.data);
      
      // Then call web_save to update the category
      const response = await odooApi.post('/web/dataset/call_kw/pos.category/web_save', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category3',
          method: 'web_save',
          args: [
            [id],
            categoryData
          ],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: JSON.parse(localStorage.getItem('user') || '{}').uid || 2,
              allowed_company_ids: [1]
            },
            specification: {
              "image_128": {},
              "write_date": {},
              "name": {},
              "parent_id": {"fields": {"display_name": {}}},
              "color": {},
              "hour_after": {},
              "hour_until": {},
              "display_name": {}
            }
          }
        }
      });
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        console.log('Category updated successfully:', response.data.result[0]);
        return true;
      } else if (response.data && response.data.error) {
        console.error('Server error updating category:', response.data.error);
        throw new Error(response.data.error.message || 'Error updating category');
      } else {
        console.log('Category updated, but unusual response:', response.data);
      return true;
      }
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },
  
  /**
   * Delete a POS category
   * @param {number} id - Category ID
   * @returns {Promise<boolean>} Success status
   */
  deleteCategory: async (id) => {
    try {
      console.log('Deleting category with ID:', id);
      
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category3',
          method: 'unlink',
          args: [[id]], // ID as array
          kwargs: {},
        },
      });
      
      if (response.data && response.data.error) {
        console.error('Server error deleting category:', response.data.error);
        throw new Error(response.data.error.message || 'Error deleting category');
      }
      
      console.log('Category deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }
};

// Orders service
export const orderService = {
  /**
   * Get active POS sessions for current user
   * @param {boolean} loadData - Whether to automatically load all POS data after finding a session
   * @returns {Promise<Array>} Active POS sessions
   */
  getPOSSession: async (loadData = false) => {
    try {
      console.log('Fetching active POS sessions for current user...');
      
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      console.log(`Filtering sessions for user ID: ${userId}`);
      
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [
              ['state', 'in', ['opened', 'opening_control']],
              ['user_id', '=', userId] // Filter for current user only
            ],
            ['id', 'name', 'config_id', 'user_id', 'start_at', 'stop_at', 'state']
          ],
          kwargs: {},
        },
      });
      
      const sessions = response.data.result || [];
      console.log(`POS sessions found for user ${userId}:`, sessions);
      
      if (sessions.length > 0) {
        // Prioritize 'opened' sessions over 'opening_control' sessions
        const openedSessions = sessions.filter(session => session.state === 'opened');
        let activeSession;
        
        if (openedSessions.length > 0) {
          console.log('Using opened session:', openedSessions[0]);
          activeSession = openedSessions[0];
        } else {
          // If no opened sessions, use the first session (which might be in opening_control state)
          console.log('No opened sessions found, using session in opening_control state:', sessions[0]);
          activeSession = sessions[0];
        }
        
        // If loadData is true, load all POS data for the active session
        if (loadData && activeSession) {
          try {
            console.log(`Automatically loading all POS data for session ${activeSession.id}...`);
            
            // Check if we already have fresh data
            const isFresh = await posDataService.isFreshData(activeSession.id);
            
            if (!isFresh) {
              console.log('No fresh data found, loading from server...');
              await posDataService.loadAllPOSData(activeSession.id);
              console.log('POS data loaded successfully');
            } else {
              console.log('Using existing fresh data from local database');
            }
          } catch (loadError) {
            console.error('Error loading POS data automatically:', loadError);
            // Continue to return the session even if data loading fails
          }
        }
        
        return openedSessions.length > 0 ? openedSessions : sessions;
      }
      
      console.log('No active POS sessions found for current user');
      return [];
    } catch (error) {
      console.error('Error fetching POS sessions:', error);
      throw error;
    }
  },

  /**
   * Get available POS configs
   * @returns {Promise<Array>} POS configurations
   */
  getPOSConfigs: async () => {
    try {
      console.log('Fetching POS configs...');
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.config',
          method: 'search_read',
          args: [
            [], 
            ['id', 'name', 'current_session_id', 'current_session_state']
          ],
          kwargs: {},
        },
      });
      
      const configs = response.data.result || [];
      console.log('POS configs:', configs);
      return configs;
    } catch (error) {
      console.error('Error fetching POS configs:', error);
      throw error;
    }
  },
  
  /**
   * Create a new POS session
   * @param {number} configId - POS config ID
   * @returns {Promise<number>} Created session ID
   */
  createPOSSession: async (configId) => {
    try {
      console.log('Creating new POS session for config:', configId);
      
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      console.log(`Using user ID ${userId} (${currentUser.name || 'Unknown'}) to create session`);
      
      // First check if a session already exists for this config
      const configResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.config',
          method: 'read',
          args: [[configId], ['current_session_id', 'current_session_state']],
          kwargs: {},
        },
      });
      
      if (configResponse.data && 
          configResponse.data.result && 
          configResponse.data.result.length > 0) {
        const config = configResponse.data.result[0];
        if (config.current_session_id && config.current_session_state === 'opened') {
          console.log('Config already has an active session:', config.current_session_id);
          return config.current_session_id[0];
        }
      }
      
      // Create a session using more robust approach
      console.log('No active session found, creating a new one with config ID:', configId);
      
      // Step 1: Create the base session
      const createResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'create',
          args: [{
            config_id: configId,
            user_id: userId, // Use current user instead of hardcoded admin user
          }],
          kwargs: {},
        },
      });
      
      console.log('Create session response:', createResponse.data);
      
      if (createResponse.data && createResponse.data.result) {
        const sessionId = createResponse.data.result;
        console.log('POS session created with ID:', sessionId);
        
        // Step 2: Wait a moment to ensure session is registered in database
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 3: Try to open the session
        try {
          console.log('Attempting to open session with ID:', sessionId);
          const openResponse = await odooApi.post('/web/dataset/call_kw', {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'pos.session',
              method: 'action_pos_session_open',
              args: [[sessionId]],
              kwargs: {},
            },
          });
          console.log('Session open response:', openResponse.data);
          console.log('Session opened successfully');
        } catch (err) {
          console.warn('Could not explicitly open session, but will try to use it anyway:', err.message);
        }
        
        // Step 4: Verify session state
        try {
          console.log('Verifying session state for ID:', sessionId);
          const verifyResponse = await odooApi.post('/web/dataset/call_kw', {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'pos.session',
              method: 'search_read',
              args: [
                [['id', '=', sessionId]],
                ['id', 'name', 'config_id', 'state']
              ],
              kwargs: {},
            },
          });
          
          if (verifyResponse.data && verifyResponse.data.result && verifyResponse.data.result.length > 0) {
            const sessionInfo = verifyResponse.data.result[0];
            console.log('Session verification result:', sessionInfo);
            console.log('Session state:', sessionInfo.state);
          } else {
            console.warn('Session verification returned no results, but continuing with session ID');
          }
        } catch (verifyError) {
          console.warn('Error verifying session state, but continuing:', verifyError.message);
        }
        
        // Return the session ID regardless of verification outcome
        return sessionId;
      } else if (createResponse.data && createResponse.data.error) {
        console.error('Server returned error:', createResponse.data.error);
        throw new Error(createResponse.data.error.data?.message || 'Error creating session');
      }
      
      // If reaching here, no session ID was returned
      throw new Error('No session ID returned from creation method');
    } catch (error) {
      console.error('Error creating POS session:', error);
      throw error;
    }
  },

  /**
   * Create a new POS order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Created order
   */
  createOrder: async (orderData) => {
    try {
      console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
      
      // For Odoo 18, we use a different approach to create orders
      return await createOrderOdoo18(orderData);
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
};

// Function for Odoo 18 order creation
async function createOrderOdoo18(orderData) {
  try {
    console.log('Using Odoo 18 specific order creation approach');
    console.log('Raw order data:', JSON.stringify(orderData, null, 2));
    
    // Create the full order object based on the sample format
    const fullOrderObject = {
      message_follower_ids: [],
      message_ids: [],
      website_message_ids: [],
      access_token: uuidv4(),
      account_move: false,
      amount_difference: false,
      amount_paid: orderData.data.amount_paid,
      amount_return: orderData.data.amount_return || 0,
      amount_tax: orderData.data.amount_tax,
      amount_total: orderData.data.amount_total,
      company_id: orderData.data.company_id || 1,
      create_date: false,
      create_uid: false,
      customer_count: false,
      date_order: orderData.data.date_order,
      employee_id: false,
      fiscal_position_id: orderData.data.fiscal_position_id || false,
      floating_order_name: false,
      general_note: "",
      has_deleted_line: false,
      id: orderData.id.toString(),
      is_tipped: false,
      last_order_preparation_change: JSON.stringify({
        lines: {},
        generalNote: "",
        sittingMode: "dine in"
      }),
      lines: orderData.data.lines,
      name: orderData.data.name || `Order ${new Date().toISOString().slice(0, 19)}`,
      nb_print: 0,
      next_online_payment_amount: false,
      partner_id: orderData.data.partner_id,
      payment_ids: orderData.data.payment_ids,
      picking_ids: [],
      pos_reference: orderData.data.pos_reference || `00000-001-0001`,
      pricelist_id: orderData.data.pricelist_id || false,
      procurement_group_id: false,
      sequence_number: orderData.data.sequence_number || 1,
      session_id: orderData.data.session_id,
      shipping_date: false,
      state: 'paid',
      table_id: false,
      table_stand_number: false,
      takeaway: false,
      ticket_code: generateRandomString(5),
      tip_amount: false,
      to_invoice: orderData.data.to_invoice || false,
      user_id: orderData.data.user_id,
      uuid: uuidv4(),
      write_date: false,
      write_uid: false
    };
    
    // Log the payment_ids structure specifically for debugging
    console.log('Payment IDs structure:', JSON.stringify(fullOrderObject.payment_ids, null, 2));
    
    // Additional detail logging for user_id, partner_id and session_id
    console.log('Important IDs:', {
      user_id: fullOrderObject.user_id,
      partner_id: fullOrderObject.partner_id,
      session_id: fullOrderObject.session_id,
      payment_method_ids: fullOrderObject.payment_ids?.map(p => p[2]?.payment_method_id)
    });
    
    // Special check for payment_ids.id
    const paymentDetails = fullOrderObject.payment_ids?.map(p => ({
      amount: p[2]?.amount,
      payment_method_id: p[2]?.payment_method_id,
      id: p[2]?.id
    }));
    console.log('Payment details:', paymentDetails);
    
    // Send the order to the server
    const syncRequestData = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'pos.order',
        method: 'sync_from_ui',
        args: [[fullOrderObject]],
        kwargs: {}
      }
    };
    
    console.log('Sending sync request to server:', JSON.stringify(syncRequestData, null, 2));
    
    const syncResponse = await odooApi.post('/web/dataset/call_kw/pos.order/sync_from_ui', syncRequestData);
    
    console.log('Sync response received from server:', JSON.stringify(syncResponse.data, null, 2));
    
    if (syncResponse.data.error) {
      console.error('Error in sync_from_ui:', syncResponse.data.error);
      
      // Enhanced error logging
      if (syncResponse.data.error.data) {
        console.error('Server error details:', syncResponse.data.error.data);
        console.error('Error message:', syncResponse.data.error.data.message);
        console.error('Error traceback:', syncResponse.data.error.data.debug || syncResponse.data.error.data.message);
      }
      
      throw new Error(syncResponse.data.error.data?.message || 'Error creating order');
    }
    
    const result = syncResponse.data.result;
    console.log('Order synced successfully:', result);
    
    if (!result || result.length === 0) {
      console.warn('Server returned success but with empty result data, this could indicate a silent failure');
    }
    
    return {
      id: orderData.id,
      name: fullOrderObject.name,
      success: true,
      serverResult: result
    };
  } catch (error) {
    console.error('Error in Odoo 18 order creation:', error);
    
    // Enhanced error logging for network errors
    if (error.response) {
      console.error('Server response status:', error.response.status);
      console.error('Server response headers:', error.response.headers);
      console.error('Server error details:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server, request details:', error.request);
    } else {
      console.error('Error details:', error.message);
    }
    
    throw error;
  }
}

// Helper function to generate random ticket code
function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Customers service
export const customerService = {
  /**
   * Get all customers
   * @returns {Promise<Array>} Customers list
   */
  getCustomers: async () => {
    try {
      console.log('Fetching customers with Odoo 18 API...');
      
      // دریافت اطلاعات کاربر از localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 2;
      
      // Get first 100 customers with search_read (more compatible approach)
      const searchReadResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [
            [['customer_rank', '>', 0]],
            ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'vat', 'image_128', 'country_id', 'state_id']
          ],
          kwargs: {
            limit: 100,
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId,
              allowed_company_ids: [1]
            }
          },
        },
      });
      
      console.log('Customers search_read response:', searchReadResponse.data);
      
      if (searchReadResponse.data && searchReadResponse.data.result) {
        const customers = searchReadResponse.data.result || [];
        console.log(`Found ${customers.length} customers using search_read`);
        
        // If we got results, return them
        if (customers.length > 0) {
          return customers;
        }
      }
      
      // If search_read returned no results or failed, try the web_read approach as backup
      console.log('Trying alternative web_read approach...');
      
      try {
        // استفاده از روش web_read برای Odoo 18
        const response = await odooApi.post('/web/dataset/call_kw/res.partner/web_search_read', {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.partner',
            method: 'web_search_read',
            args: [],
            kwargs: {
              context: {
                lang: 'en_US',
                tz: 'Asia/Tehran',
                uid: userId,
                allowed_company_ids: [1],
                bin_size: true,
                res_partner_search_mode: 'customer'
              },
              domain: [['customer_rank', '>', 0]],
              fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'vat', 'image_128', 'country_id', 'state_id'],
              limit: 80,
              order: 'name',
              count_limit: 10000
            }
          }
        });
        
        console.log('Customers web_search_read response:', response.data);
        
        if (response.data && response.data.result) {
          const records = response.data.result.records || [];
          console.log(`Found ${records.length} customers using web_search_read`);
          return records;
        }
      } catch (webReadError) {
        console.warn('web_search_read approach failed:', webReadError);
      }
      
      // If all else fails, return empty array
      console.warn('No customer data returned from either method');
      return [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },
  
  /**
   * Create a new customer
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>} Created customer
   */
  createCustomer: async (customerData) => {
    try {
      console.log('Creating customer with Odoo 18 API:', customerData);
      
      // دریافت اطلاعات کاربر از localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 2;
      
      // Ensure customer rank is set
      const data = {
        ...customerData,
        customer_rank: 1, // Set as customer
      };
      
      // First try the classic create method which is more reliable
      try {
        const createResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'create',
          args: [data],
            kwargs: {
              context: {
                lang: 'en_US',
                tz: 'Asia/Tehran',
                uid: userId,
                allowed_company_ids: [1],
                res_partner_search_mode: 'customer',
                default_customer_rank: 1
              }
            },
        },
      });
      
        console.log('Customer creation create method response:', createResponse.data);
        
        if (createResponse.data && createResponse.data.result) {
          const customerId = createResponse.data.result;
          
          // Fetch the newly created customer details
          const getResponse = await odooApi.post('/web/dataset/call_kw', {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'res.partner',
              method: 'read',
              args: [[customerId]],
              kwargs: {
                fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'vat', 'image_128', 'country_id', 'state_id']
              },
            },
          });
          
          if (getResponse.data && getResponse.data.result && getResponse.data.result.length > 0) {
            console.log('Customer created successfully:', getResponse.data.result[0]);
            return getResponse.data.result[0];
          }
          
          // If we couldn't get details but we have the ID, return basic info
          return { id: customerId, name: data.name };
        }
      } catch (createError) {
        console.warn('Classic create method failed, trying web_save:', createError);
      }
      
      // Try the web_save approach as fallback
      console.log('Trying web_save approach for customer creation...');
      
      // استفاده از روش جدید Odoo 18 برای ایجاد مشتری
      const response = await odooApi.post('/web/dataset/call_kw/res.partner/web_save', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'web_save',
          args: [
            [],
            data
          ],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId,
              allowed_company_ids: [1],
              res_partner_search_mode: 'customer',
              default_customer_rank: 1
            },
            specification: {
              "name": {},
              "phone": {},
              "mobile": {},
              "email": {},
              "street": {},
              "city": {},
              "vat": {},
              "image_128": {},
              "country_id": {"fields": {"display_name": {}}},
              "state_id": {"fields": {"display_name": {}}},
              "customer_rank": {}
            }
          }
        }
      });
      
      console.log('Customer creation web_save response:', response.data);
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        console.log('Customer created successfully with web_save:', response.data.result[0]);
        return response.data.result[0];
      } else if (response.data && response.data.error) {
        console.error('Server error creating customer:', response.data.error);
        throw new Error(response.data.error.message || 'Error creating customer');
      } else {
        console.log('Customer created, but unusual response:', response.data);
        return { success: true, id: 0 };
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },
  
  /**
   * Update an existing customer
   * @param {number} id - Customer ID
   * @param {Object} customerData - Updated customer data
   * @returns {Promise<boolean>} Success status
   */
  updateCustomer: async (id, customerData) => {
    try {
      console.log(`Updating customer with ID ${id} using Odoo 18 API:`, customerData);
      
      // دریافت اطلاعات کاربر از localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 2;
      
      // روش اول: روش قدیمی write که پایدارتر است
      try {
        const writeResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'write',
            args: [[id], customerData], // ID as array and data to update
            kwargs: {
              context: {
                lang: 'en_US',
                tz: 'Asia/Tehran',
                uid: userId,
                allowed_company_ids: [1],
                res_partner_search_mode: 'customer'
              }
            },
        },
      });
      
        console.log('Customer update write method response:', writeResponse.data);
        
        if (writeResponse.data && (writeResponse.data.result === true || writeResponse.data.result === undefined)) {
          console.log('Customer updated successfully with write method');
          
          // Fetch the updated customer details
          const getResponse = await odooApi.post('/web/dataset/call_kw', {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'res.partner',
              method: 'read',
              args: [[id]],
              kwargs: {
                fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'vat', 'image_128', 'country_id', 'state_id']
              },
            },
          });
          
          if (getResponse.data && getResponse.data.result && getResponse.data.result.length > 0) {
            console.log('Updated customer details:', getResponse.data.result[0]);
      }
      
      return true;
        }
      } catch (writeError) {
        console.warn('Classic write method failed, trying web_save:', writeError);
      }
      
      // روش دوم: استفاده از روش جدید Odoo 18 (web_save) به عنوان پشتیبان
      console.log('Trying web_save approach for customer update...');
      
      // استفاده از روش جدید Odoo 18 برای به‌روزرسانی مشتری
      const response = await odooApi.post('/web/dataset/call_kw/res.partner/web_save', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'web_save',
          args: [[id], customerData],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId,
              allowed_company_ids: [1],
              res_partner_search_mode: 'customer'
            },
            specification: {
              "name": {},
              "phone": {},
              "mobile": {},
              "email": {},
              "street": {},
              "city": {},
              "vat": {},
              "image_128": {},
              "country_id": {"fields": {"display_name": {}}},
              "state_id": {"fields": {"display_name": {}}},
              "write_date": {}
            }
          }
        }
      });
      
      console.log('Customer update web_save response:', response.data);
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        console.log('Customer updated successfully with web_save:', response.data.result[0]);
        return true;
      } else if (response.data && response.data.error) {
        console.error('Server error updating customer:', response.data.error);
        throw new Error(response.data.error.message || 'Error updating customer');
      } else {
        console.log('Customer update attempted, but unusual response:', response.data);
        return true;
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },
  
  /**
   * Delete a customer
   * @param {number} id - Customer ID
   * @returns {Promise<boolean>} Success status
   */
  deleteCustomer: async (id) => {
    try {
      console.log(`Deleting customer with ID ${id}...`);
      
      // دریافت اطلاعات کاربر از localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 2;
      
      // Odoo همچنان از unlink برای حذف رکوردها استفاده می‌کند
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'unlink',
          args: [[id]], // ID as array
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId,
              allowed_company_ids: [1]
            }
          }
        },
      });
      
      console.log('Customer delete response:', response.data);
      
      if (response.data && response.data.result === true) {
        console.log('Customer deleted successfully');
      return true;
      } else if (response.data && response.data.error) {
        console.error('Server error deleting customer:', response.data.error);
        throw new Error(response.data.error.message || 'Error deleting customer');
      } else {
        console.log('Customer deletion attempted with unusual response:', response.data);
        // اگر خطایی برنگشت، فرض می‌کنیم عملیات موفق بوده
        return true;
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },
  
  /**
   * Get a single customer by ID
   * @param {number} id - Customer ID
   * @returns {Promise<Object>} Customer data
   */
  getCustomerById: async (id) => {
    try {
      console.log(`Fetching customer with ID ${id}...`);
      
      // دریافت اطلاعات کاربر از localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 2;
      
      // روش اول: استفاده از متد استاندارد read
      try {
        const readResponse = await odooApi.post('/web/dataset/call_kw', {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.partner',
            method: 'read',
            args: [[id]],
            kwargs: {
              fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'vat', 'image_128', 'country_id', 'state_id'],
              context: {
                lang: 'en_US',
                tz: 'Asia/Tehran',
                uid: userId,
                allowed_company_ids: [1]
              }
            },
          },
        });
        
        console.log('Customer read response:', readResponse.data);
        
        if (readResponse.data && readResponse.data.result && readResponse.data.result.length > 0) {
          console.log('Customer details retrieved with read:', readResponse.data.result[0]);
          return readResponse.data.result[0];
        }
      } catch (readError) {
        console.warn('Classic read method failed, trying web_read:', readError);
      }
      
      // روش دوم: استفاده از متد web_read به عنوان پشتیبان
      console.log('Trying web_read approach for fetching customer...');
      
      const response = await odooApi.post('/web/dataset/call_kw/res.partner/web_read', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'web_read',
          args: [[id]],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId,
              allowed_company_ids: [1],
              bin_size: true,
              res_partner_search_mode: 'customer'
            },
            specification: {
              "id": {},
              "name": {},
              "phone": {},
              "mobile": {},
              "email": {},
              "street": {},
              "city": {},
              "vat": {},
              "image_128": {},
              "country_id": {"fields": {"display_name": {}}},
              "state_id": {"fields": {"display_name": {}}},
              "write_date": {},
              "display_name": {}
            }
          }
        }
      });
      
      console.log('Customer web_read response:', response.data);
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        console.log('Customer details retrieved with web_read:', response.data.result[0]);
        return response.data.result[0];
      } else {
        console.warn(`No customer found with ID ${id}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching customer with ID ${id}:`, error);
      throw error;
    }
  }
};

// Function to check connection to Odoo server
export const checkConnection = async () => {
  try {
    console.log(`Testing connection to Odoo server at ${odooConfig.apiUrl} with database ${odooConfig.database}`);
    
    const response = await odooApi.post('/web/session/get_session_info', {
      jsonrpc: '2.0',
      method: 'call',
      params: {}
    });
    
    if (response.data && response.data.result) {
      console.log('Connection successful - Server info:', response.data.result);
      return {
        success: true,
        serverInfo: response.data.result,
        message: 'Successfully connected to Odoo server'
      };
    } else {
      console.error('Connection failed - No valid response from server:', response.data);
      return {
        success: false,
        message: 'Could not retrieve server information'
      };
    }
  } catch (error) {
    console.error('Connection error:', error);
    return {
      success: false,
      error: error,
      message: error.message || 'Failed to connect to Odoo server'
    };
  }
};

// New service for managing the POS data loaded from server
export const posDataService = {
  /**
   * Load all POS data from server and store locally
   * @param {number} sessionId - POS session ID
   * @returns {Promise<Object>} Result of loading operation
   */
  loadAllPOSData: async (sessionId) => {
    try {
      console.log('Loading all POS data from server for session:', sessionId);
      
      // Call the loadPOSData function from odooApi.js
      const result = await loadPOSData(sessionId);
      
      if (result.success) {
        console.log('Successfully loaded and stored all POS data');
        return {
          success: true,
          data: result.data
        };
      } else {
        console.error('Failed to load POS data:', result.error);
        throw new Error(result.error || 'Failed to load POS data');
      }
    } catch (error) {
      console.error('Error in loadAllPOSData:', error);
      throw error;
    }
  },
  
  /**
   * Get all the POS data from local storage
   * @returns {Promise<Object>} Complete POS data
   */
  getAllPOSData: async () => {
    return await getLocalPOSData.getAllData();
  },
  
  /**
   * Get products from local storage
   * @returns {Promise<Array>} Products list
   */
  getProducts: async () => {
    return await getLocalPOSData.getProducts();
  },
  
  /**
   * Get customers (partners) from local storage
   * @returns {Promise<Array>} Customers list
   */
  getCustomers: async () => {
    return await getLocalPOSData.getPartners();
  },
  
  /**
   * Get categories from local storage
   * @returns {Promise<Array>} Categories list
   */
  getCategories: async () => {
    return await getLocalPOSData.getCategories();
  },
  
  /**
   * Get payment methods from local storage
   * @returns {Promise<Array>} Payment methods list
   */
  getPaymentMethods: async () => {
    return await getLocalPOSData.getPaymentMethods();
  },
  
  /**
   * Get taxes from local storage
   * @returns {Promise<Array>} Taxes list
   */
  getTaxes: async () => {
    return await getLocalPOSData.getTaxes();
  },
  
  /**
   * Get session info from local storage
   * @returns {Promise<Object>} Session info
   */
  getSessionInfo: async () => {
    return await getLocalPOSData.getSessionInfo();
  },
  
  /**
   * Get POS config from local storage
   * @returns {Promise<Object>} POS config
   */
  getPOSConfig: async () => {
    return await getLocalPOSData.getPOSConfig();
  },
  
  /**
   * Clear all POS data from local storage
   * @returns {Promise<boolean>} Success status
   */
  clearAllPOSData: async () => {
    return await getLocalPOSData.clearAllData();
  },
  
  /**
   * Check if the locally stored data is fresh for the given session
   * @param {number} sessionId - POS session ID
   * @returns {Promise<boolean>} Whether the data is fresh
   */
  isFreshData: async (sessionId) => {
    return await getLocalPOSData.isFreshData(sessionId);
  },
  
  // Get raw data from IndexedDB
  getRawData: async () => {
    try {
      // Import getDataFromDB from loadPOSData's internal implementation
      return await getLocalPOSData.getRawData();
    } catch (error) {
      console.error('Error getting raw data:', error);
      return null;
    }
  },
};

// Payment Methods Service
export const paymentMethodService = {
  // Get payment methods for a POS configuration
  async getPaymentMethods(configId) {
    try {
      // Import the getLocalPOSData function dynamically to avoid circular dependency
      const { getLocalPOSData } = await import('./odooApi');
      
      // Get all payment methods from local storage
      const allMethods = await getLocalPOSData.getPaymentMethods();
      console.log(`[Payment Service] Found ${allMethods.length} payment methods in local storage`);
      
      // Get POS configuration to find allowed payment methods
      const configs = await getLocalPOSData.getPOSConfig();
      const currentConfig = configs.find(c => c.id === configId);
      
      if (currentConfig && currentConfig.payment_method_ids && currentConfig.payment_method_ids.length > 0) {
        console.log(`[Payment Service] Config ${configId} has ${currentConfig.payment_method_ids.length} allowed payment methods`);
        
        // Filter methods by allowed IDs
        const allowedMethods = allMethods.filter(method => 
          currentConfig.payment_method_ids.includes(method.id)
        );
        
        console.log(`[Payment Service] Returning ${allowedMethods.length} filtered payment methods`);
        return allowedMethods;
      }
      
      // If no specific config found or no payment_method_ids, return all methods
      return allMethods;
    } catch (error) {
      console.error('[Payment Service] Error getting payment methods:', error);
      // Return default payment methods as fallback
      return [
        { id: 2, name: 'Cash', is_cash_count: true },
        { id: 3, name: 'Bank Card', is_cash_count: false }
      ];
    }
  }
};

// Add a new function to check connection status
export const connectionStatus = {
  isOnline: false,
  lastChecked: null,
  checking: false,
  listeners: [],
  
  /**
   * Check the connection status to Odoo server
   * @returns {Promise<boolean>} true if online, false if offline
   */
  async checkConnection() {
    // Avoid multiple simultaneous checks
    if (this.checking) {
      return this.isOnline;
    }
    
    this.checking = true;
    const prevStatus = this.isOnline;
    
    try {
      console.log('Checking connection to Odoo server...');
      
      // First check if browser is online
      if (!navigator.onLine) {
        console.log('Browser reports device is offline');
        this.isOnline = false;
        this.lastChecked = new Date();
        this.checking = false;
        
        // Notify listeners if status changed
        if (prevStatus !== this.isOnline) {
          this._notifyListeners();
        }
        
        return false;
      }
      
      // Try to ping the Odoo server with a lightweight request
      const pingResponse = await odooApi.post('/web/session/get_session_info', {
        jsonrpc: '2.0',
        method: 'call',
        params: {},
      }, {
        timeout: 5000 // Short timeout for quick feedback
      });
      
      // Check if response is valid
      const isConnectionValid = pingResponse && 
                               pingResponse.data && 
                               !pingResponse.data.error;
      
      this.isOnline = isConnectionValid;
      this.lastChecked = new Date();
      
      console.log(`Connection check result: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      // Notify listeners if status changed
      if (prevStatus !== this.isOnline) {
        this._notifyListeners();
      }
      
      return this.isOnline;
    } catch (error) {
      console.error('Error checking connection:', error);
      this.isOnline = false;
      this.lastChecked = new Date();
      
      // Notify listeners if status changed
      if (prevStatus !== this.isOnline) {
        this._notifyListeners();
      }
      
      return false;
    } finally {
      this.checking = false;
    }
  },
  
  /**
   * Start periodic connection checking
   * @param {number} interval - Interval in milliseconds
   * @returns {number} Interval ID
   */
  startPeriodicCheck(interval = 30000) {
    // Initial check
    this.checkConnection();
    
    // Set up periodic checking
    const intervalId = setInterval(() => {
      this.checkConnection();
    }, interval);
    
    return intervalId;
  },
  
  /**
   * Add a listener for connection status changes
   * @param {function} callback - Function to call when status changes
   */
  addListener(callback) {
    if (typeof callback === 'function' && !this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  },
  
  /**
   * Remove a listener
   * @param {function} callback - Function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  },
  
  /**
   * Notify all listeners about status change
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (error) {
        console.error('Error in connection status listener:', error);
      }
    });
  }
};

// Initialize connection checking when module loads
connectionStatus.checkConnection();

export default {
  authService,
  productService,
  categoryService,
  orderService,
  customerService,
  odooInfo,
  posDataService, // Add the new service to the default export
  paymentMethodService
}; 