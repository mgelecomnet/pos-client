// Auth service for authentication with Odoo backend
export const authService = {
  // Login to the backend
  login: async (username, password) => {
    try {
      console.log('[Auth Service] Logging in with username:', username);
      
      // Clear any existing sessions to avoid conflicts
      localStorage.removeItem('user');
      document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Make login request to Odoo
      const response = await odooApi.post('/web/session/authenticate', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          login: username,
          password: password,
          db: process.env.REACT_APP_ODOO_DB
        }
      });

      // Debug the response
      console.log('[Auth Service] Login response:', {
        status: response.status,
        success: !!response.data?.result?.uid,
        hasSession: !!response.data?.result?.session_id,
        headerKeys: response.headers ? Object.keys(response.headers) : []
      });

      // Check if login was successful
      if (response.data.result && response.data.result.uid) {
        // Create user object from response
        const user = {
          uid: response.data.result.uid,
          name: response.data.result.name,
          username: username,
          // Additional fields from response if available
          db: response.data.result.db || process.env.REACT_APP_ODOO_DB,
          companies: response.data.result.companies || [],
          company_id: response.data.result.company_id || [],
          isAdmin: response.data.result.is_admin || false,
          // Extract the session ID from response (directly from result)
          session_id: response.data.result.session_id || null
        };

        // Look for session ID in other locations if not in result
        if (!user.session_id) {
          // Look for session_id in different locations of the response
          console.log('[Auth Service] Session ID not found in result, checking headers...');
          
          // Try to extract from headers (Set-Cookie)
          if (response.headers && response.headers['set-cookie']) {
            const cookies = response.headers['set-cookie'];
            console.log('[Auth Service] Found Set-Cookie header:', typeof cookies, 
                        Array.isArray(cookies) ? cookies.length : 'not array');
            
            let sessionMatch = null;
            
            // Try to extract session_id from cookies
            if (Array.isArray(cookies)) {
              // Find the session_id cookie in the array
              const sessionCookie = cookies.find(cookie => cookie.includes('session_id='));
              if (sessionCookie) {
                sessionMatch = sessionCookie.match(/session_id=([^;]+)/);
              }
            } else if (typeof cookies === 'string') {
              // Extract from string cookie
              sessionMatch = cookies.match(/session_id=([^;]+)/);
            }
            
            if (sessionMatch && sessionMatch[1]) {
              user.session_id = sessionMatch[1].trim();
              console.log('[Auth Service] Extracted session ID from cookie:', user.session_id);
            }
          }
          
          // Try to extract from custom headers
          if (!user.session_id && response.headers) {
            const sessionHeader = 
              response.headers['x-openerp-session-id'] || 
              response.headers['x-session-id'];
            
            if (sessionHeader) {
              user.session_id = sessionHeader;
              console.log('[Auth Service] Extracted session ID from header:', user.session_id);
            }
          }
        }

        // If we still don't have a session ID, try to get it from document.cookie
        if (!user.session_id) {
          console.log('[Auth Service] Checking browser cookies for session_id...');
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'session_id' && value) {
              user.session_id = value;
              console.log('[Auth Service] Found session ID in browser cookie:', value);
              break;
            }
          }
        }

        // Final check and warning if no session ID found
        if (!user.session_id) {
          console.warn('[Auth Service] No session ID found in any source');
        } else {
          console.log('[Auth Service] Final session ID:', user.session_id);
          
          // Store session in cookie too (belt and suspenders approach)
          document.cookie = `session_id=${user.session_id}; path=/; max-age=86400`;
        }

        // Store user data in localStorage (main storage method)
        localStorage.setItem('user', JSON.stringify(user));
        
        return {
          success: true,
          user
        };
      } else {
        // Handle unsuccessful login
        console.error('[Auth Service] Login failed:', response.data.error || 'No UID returned');
        return {
          success: false,
          error: response.data.error || {
            message: 'Login failed. Invalid credentials.'
          }
        };
      }
    } catch (error) {
      console.error('[Auth Service] Login error:', error);
      
      // Check if the error has a response from server
      if (error.response && error.response.data) {
        const errorMsg = error.response.data.error || {
          message: 'Unable to connect to Odoo server'
        };
        return {
          success: false,
          error: errorMsg
        };
      }
      
      // Generic error handling
      return {
        success: false,
        error: {
          message: error.message || 'Network error'
        }
      };
    }
  },

  // Logout and destroy session
  logout: async () => {
    try {
      console.log('[Auth Service] Logging out');
      
      // Try to destroy the session on server (but not critical if it fails)
      try {
        await odooApi.post('/web/session/destroy', {
          jsonrpc: '2.0',
          method: 'call',
          params: {}
        });
      } catch (e) {
        console.warn('[Auth Service] Could not destroy session on server:', e.message);
      }
      
      // Always clear local storage and cookies
      localStorage.removeItem('user');
      document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      return { success: true };
    } catch (error) {
      console.error('[Auth Service] Logout error:', error);
      
      // Still clear local storage and cookies even if server logout fails
      localStorage.removeItem('user');
      document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      return {
        success: false,
        error: {
          message: error.message || 'Error during logout'
        }
      };
    }
  },

  // Get the current logged in user
  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        // Check if we have a session ID
        if (!userData.session_id) {
          console.warn('[Auth Service] User found in localStorage but no session_id');
          
          // Try to get from cookie as fallback
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'session_id' && value) {
              userData.session_id = value;
              console.log('[Auth Service] Found session ID in cookie:', value);
              
              // Update localStorage with the session ID
              localStorage.setItem('user', JSON.stringify(userData));
              break;
            }
          }
        }
        return userData;
      }
      return null;
    } catch (error) {
      console.error('[Auth Service] Error getting current user:', error);
      return null;
    }
  },

  // Test if the current session is valid
  isSessionValid: async () => {
    try {
      console.log('[Auth Service] Testing session validity');
      
      // Get the current user and session
      const user = authService.getCurrentUser();
      if (!user || !user.session_id) {
        console.warn('[Auth Service] No user or session ID found');
        return false;
      }
      
      // Test connection to the server
      const response = await odooApi.post('/web/session/check', {
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      });
      
      // Check if response indicates valid session
      const isValid = response.data && response.data.result;
      console.log('[Auth Service] Session check result:', isValid);
      
      return isValid;
    } catch (error) {
      console.error('[Auth Service] Session check error:', error);
      return false;
    }
  }
}; 