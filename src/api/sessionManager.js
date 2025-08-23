import odooApi from './odooApi';

// Logging function with timestamps
const log = (message, data = null, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [SessionManager] [${type.toUpperCase()}]`;
  
  if (data) {
    console[type](`${prefix} ${message}`, data);
  } else {
    console[type](`${prefix} ${message}`);
  }
};

/**
 * Session Manager for handling Odoo POS sessions
 */
const sessionManager = {
  /**
   * Get all active POS sessions and mark those owned by current user
   * @returns {Promise<Array>} Active sessions
   */
  getAllActiveSessions: async () => {
    try {
      log('Fetching all active POS sessions...');
      
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      log(`Current user ID: ${userId}`);
      
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [['state', 'in', ['opening_control', 'opened', 'closing_control']]],
            ['id', 'name', 'config_id', 'user_id', 'start_at', 'stop_at', 'state']
          ],
          kwargs: {},
        },
      });
      
      const sessions = response.data.result || [];
      
      // Mark sessions owned by current user
      const enhancedSessions = sessions.map(session => {
        const isOwnedByCurrentUser = session.user_id && session.user_id[0] === userId;
        return {
          ...session,
          isOwnedByCurrentUser,
          canClose: isOwnedByCurrentUser // User can only close their own sessions
        };
      });
      
      const ownedCount = enhancedSessions.filter(s => s.isOwnedByCurrentUser).length;
      log(`Found ${sessions.length} active POS sessions, ${ownedCount} owned by current user`, enhancedSessions);
      
      return enhancedSessions;
    } catch (error) {
      log(`Error fetching active sessions: ${error.message}`, error, 'error');
      throw error;
    }
  },
  
  /**
   * Check for existing sessions by configuration ID
   * @param {number} configId - POS configuration ID to check
   * @returns {Promise<Object|null>} Session object if found, null otherwise
   */
  getExistingSessionByConfig: async (configId) => {
    try {
      log(`Checking for existing sessions with config ID: ${configId}`);
      
      // Get current user from localStorage for filtering
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      log(`Will only check sessions belonging to user ID: ${userId}`);
      
      // First, check if the config has a current_session_id
      const configResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.config',
          method: 'read',
          args: [[configId], ['current_session_id', 'current_session_state', 'name']],
          kwargs: {},
        },
      });
      
      log('Config check response:', configResponse.data);
      
      if (configResponse.data?.result?.length > 0) {
        const config = configResponse.data.result[0];
        
        if (config.current_session_id) {
          log(`Config "${config.name}" has current session ID: ${config.current_session_id[0]}`);
          
          // Get complete session data
          const sessionResponse = await odooApi.post('/web/dataset/call_kw', {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'pos.session',
              method: 'search_read',
              args: [
                [
                  ['id', '=', config.current_session_id[0]],
                  ['user_id', '=', userId] // Only consider session if it belongs to current user
                ],
                ['id', 'name', 'config_id', 'user_id', 'start_at', 'state']
              ],
              kwargs: {},
            },
          });
          
          if (sessionResponse.data?.result?.length > 0) {
            const session = sessionResponse.data.result[0];
            log(`Found existing session for current user: ${session.name} (${session.state})`, session);
            
            // Check if session is not closed and handle based on state
            if (session.state !== 'closed') {
              // If session is not in opened state, try to open it
              if (session.state !== 'opened') {
                try {
                  log(`Session is in ${session.state} state, attempting to open it...`);
                  const openResponse = await odooApi.post('/web/dataset/call_kw', {
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                      model: 'pos.session',
                      method: 'action_pos_session_open',
                      args: [[session.id]],
                      kwargs: {},
                    },
                  });
                  log('Session open response:', openResponse.data);
                  // Update the state in our session object
                  session.state = 'opened';
                } catch (error) {
                  log(`Warning: Failed to open session - ${error.message}`, error, 'warn');
                  // Still return the session even if we can't open it
                }
              }
              return session;
            } else {
              log(`Session ${session.id} is closed, will search for other active sessions`);
            }
          } else {
            log(`Config has a current session, but it doesn't belong to the current user (${userId})`);
          }
        }
      }
      
      // Fallback: search directly for sessions with this config_id and current user
      log('Searching directly for active sessions with this config for current user');
      const directSessionResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [
              ['config_id', '=', configId], 
              ['state', 'in', ['opened', 'opening_control']],
              ['user_id', '=', userId] // Only for current user
            ],
            ['id', 'name', 'config_id', 'user_id', 'start_at', 'state']
          ],
          kwargs: {
            limit: 1,
          },
        },
      });
      
      if (directSessionResponse.data?.result?.length > 0) {
        const session = directSessionResponse.data.result[0];
        log(`Found active session directly for current user: ${session.name} (${session.state})`, session);
        
        // If session is in opening_control state, try to open it
        if (session.state === 'opening_control') {
          try {
            log('Session is in opening_control state, attempting to open it...');
            await odooApi.post('/web/dataset/call_kw', {
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'pos.session',
                method: 'action_pos_session_open',
                args: [[session.id]],
                kwargs: {},
              },
            });
            // Update the state in our session object
            session.state = 'opened';
          } catch (error) {
            log(`Warning: Failed to open session - ${error.message}`, error, 'warn');
            // Still return the session even if we can't open it
          }
        }
        
        return session;
      }
      
      log(`No existing active session found for config ID ${configId} and user ID ${userId}`);
      return null;
    } catch (error) {
      log(`Error checking for existing sessions: ${error.message}`, error, 'error');
      return null;
    }
  },
  
  /**
   * Close a specific POS session
   * @param {number} sessionId - Session ID to close
   * @returns {Promise<boolean>} - Success status
   */
  closeSession: async (sessionId) => {
    try {
      log(`Attempting to close POS session with ID: ${sessionId}`);
      
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      // First, verify if this session belongs to the current user
      const sessionResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [['id', '=', sessionId]],
            ['id', 'user_id', 'state']
          ],
          kwargs: {},
        },
      });
      
      if (!sessionResponse.data?.result?.length > 0) {
        log(`Session ${sessionId} not found`, null, 'error');
        return false;
      }
      
      const session = sessionResponse.data.result[0];
      const sessionUserId = session.user_id ? session.user_id[0] : null;
      
      // Check if session belongs to current user
      if (sessionUserId !== userId) {
        log(`Cannot close session ${sessionId}: it belongs to user ${sessionUserId}, not current user ${userId}`, null, 'error');
        throw new Error('امکان بستن این سشن وجود ندارد. فقط کاربری که آن را ایجاد کرده می‌تواند آن را ببندد.');
      }
      
      log(`Session ${sessionId} is owned by current user, proceeding with close`);
      
      // Step 1: Call action_pos_session_closing_control to start closing
      log('Step 1: Starting closing control for session');
      const closingResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'action_pos_session_closing_control',
          args: [[sessionId]],
          kwargs: {},
        },
      });
      
      log('Closing control response:', closingResponse.data);
      
      // Step 2: Call action_pos_session_close to complete closing
      log('Step 2: Completing session close');
      const closeResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'action_pos_session_close',
          args: [[sessionId]],
          kwargs: {},
        },
      });
      
      log('Close session response:', closeResponse.data);
      
      // Verify the session state after closing
      const verifyResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [['id', '=', sessionId]],
            ['id', 'state']
          ],
          kwargs: {},
        },
      });
      
      const sessionAfterClose = verifyResponse.data.result?.[0];
      if (sessionAfterClose) {
        log(`Session state after closing attempt: ${sessionAfterClose.state}`, sessionAfterClose);
        
        // Return true if session is closed
        return sessionAfterClose.state === 'closed';
      }
      
      log('Session verification failed', null, 'warn');
      return false;
    } catch (error) {
      log(`Error closing session ${sessionId}: ${error.message}`, error, 'error');
      
      // Add detailed error info
      if (error.response && error.response.data) {
        log('Server error details:', error.response.data, 'error');
      }
      
      throw error;
    }
  },
  
  /**
   * Close all active POS sessions owned by current user
   * @returns {Promise<Object>} Results with success and failure counts
   */
  closeAllSessions: async () => {
    log('Attempting to close all active POS sessions for current user');
    
    try {
      // Get all active sessions
      const sessions = await sessionManager.getAllActiveSessions();
      
      if (sessions.length === 0) {
        log('No active sessions found to close');
        return { success: true, closed: 0, failed: 0 };
      }
      
      // Filter sessions owned by current user
      const userOwnedSessions = sessions.filter(session => session.isOwnedByCurrentUser);
      
      if (userOwnedSessions.length === 0) {
        log('No sessions owned by current user found to close');
        return { 
          success: true, 
          closed: 0, 
          failed: 0,
          message: 'شما هیچ سشن فعالی ندارید که بتوانید ببندید.'
        };
      }
      
      log(`Found ${userOwnedSessions.length} user-owned sessions out of ${sessions.length} total active sessions`);
      
      const results = {
        success: true,
        closed: 0,
        failed: 0,
        sessionDetails: []
      };
      
      // Close each session owned by current user
      for (const session of userOwnedSessions) {
        try {
          log(`Closing user's session ${session.id} (${session.name})`);
          const success = await sessionManager.closeSession(session.id);
          
          if (success) {
            log(`Successfully closed session ${session.id}`);
            results.closed++;
            results.sessionDetails.push({ 
              id: session.id, 
              name: session.name, 
              success: true 
            });
          } else {
            log(`Failed to close session ${session.id}`, null, 'warn');
            results.failed++;
            results.sessionDetails.push({ 
              id: session.id, 
              name: session.name, 
              success: false 
            });
          }
        } catch (error) {
          log(`Error closing session ${session.id}: ${error.message}`, error, 'error');
          results.failed++;
          results.sessionDetails.push({ 
            id: session.id, 
            name: session.name, 
            success: false,
            error: error.message
          });
        }
      }
      
      log(`Session closing complete. Closed: ${results.closed}, Failed: ${results.failed}`);
      return results;
    } catch (error) {
      log(`Error in closeAllSessions: ${error.message}`, error, 'error');
      throw error;
    }
  },
  
  /**
   * Create a new POS session
   * @param {number} configId - POS config ID
   * @returns {Promise<Object>} Created session data
   */
  createSession: async (configId) => {
    try {
      log(`Creating new POS session for config ID: ${configId}`);
      
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.uid || 1;
      
      log(`Using user ID ${userId} (${currentUser.name || 'Unknown'}) to create session`);
      
      // Check if a session already exists for this config
      const existingSession = await sessionManager.getExistingSessionByConfig(configId);
      
      if (existingSession) {
        log(`Found existing session: ${existingSession.name} (${existingSession.state})`, existingSession);
        
        // If the session exists but is not in 'opened' state, try to open it
        if (existingSession.state !== 'opened') {
          log(`Existing session is in '${existingSession.state}' state, attempting to open it`);
          try {
            const openResponse = await odooApi.post('/web/dataset/call_kw', {
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'pos.session',
                method: 'action_pos_session_open',
                args: [[existingSession.id]],
                kwargs: {},
              },
            });
            log('Session open response:', openResponse.data);
            
            // Update the session state
            existingSession.state = 'opened';
          } catch (error) {
            log(`Error opening existing session: ${error.message}`, error, 'warn');
            // Continue with the existing session anyway
          }
        }
        
        return existingSession;
      }
      
      // Create a new session
      log('No active session found, creating new session');
      const createResponse = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'create',
          args: [{
            config_id: configId,
            user_id: userId, // Use current user ID instead of hardcoded admin
          }],
          kwargs: {},
        },
      });
      
      log('Create session response:', createResponse.data);
      
      if (!createResponse.data || !createResponse.data.result) {
        log('Failed to create session', createResponse.data, 'error');
        throw new Error('Failed to create session: No session ID returned');
      }
      
      const sessionId = createResponse.data.result;
      log(`Session created with ID: ${sessionId}`);
      
      // Wait a moment for the session to be registered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Open the session
      try {
        log(`Opening session ${sessionId}`);
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
        
        log('Session open response:', openResponse.data);
      } catch (error) {
        log(`Error opening session: ${error.message}`, error, 'warn');
        // Continue even if open fails
      }
      
      // Get the complete session data
      try {
        const sessionResponse = await odooApi.post('/web/dataset/call_kw', {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'pos.session',
            method: 'search_read',
            args: [
              [['id', '=', sessionId]],
              ['id', 'name', 'config_id', 'user_id', 'start_at', 'state']
            ],
            kwargs: {},
          },
        });
        
        if (sessionResponse.data && sessionResponse.data.result && sessionResponse.data.result.length > 0) {
          log('Session data after creation:', sessionResponse.data.result[0]);
          return sessionResponse.data.result[0];
        }
      } catch (error) {
        log(`Error getting session data: ${error.message}`, error, 'warn');
      }
      
      // If we cannot get complete session info, return basic info
      return {
        id: sessionId,
        name: `Session ${sessionId}`,
        config_id: [configId, ''],
        state: 'opened'
      };
    } catch (error) {
      log(`Error creating session: ${error.message}`, error, 'error');
      
      // Add detailed error info
      if (error.response && error.response.data) {
        log('Server error details:', error.response.data, 'error');
      }
      
      throw error;
    }
  },
  
  /**
   * Get details of a specific session
   * @param {number} sessionId - Session ID
   * @returns {Promise<Object>} Session details
   */
  getSessionDetails: async (sessionId) => {
    try {
      log(`Getting details for session ID: ${sessionId}`);
      
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'read',
          args: [[sessionId]],
          kwargs: {},
        },
      });
      
      if (response.data && response.data.result && response.data.result.length > 0) {
        log('Session details:', response.data.result[0]);
        return response.data.result[0];
      } else {
        log(`No details found for session ${sessionId}`, null, 'warn');
        return null;
      }
    } catch (error) {
      log(`Error getting session details: ${error.message}`, error, 'error');
      throw error;
    }
  },
  
  /**
   * Notify the server that a POS session's opening control has been performed
   * @param {number} sessionId - ID of the POS session
   * @param {number} cashAmount - Starting cash amount (typically 0 or initial amount)
   * @param {string} notes - Optional notes about opening control
   * @returns {Promise<boolean>} - Success status
   */
  setOpeningControl: async (sessionId, cashAmount = 0, notes = "") => {
    try {
      if (!sessionId) {
        log('Invalid session ID provided to setOpeningControl', null, 'error');
        return false;
      }
      
      log(`Notifying server about opening control for session ID: ${sessionId}`);
      
      // Get current user from localStorage
      let userId = 1;
      try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        userId = currentUser.uid || 1;
      } catch (err) {
        log('Error parsing user data from localStorage, using default user ID', err, 'warn');
      }
      
      // Call the set_opening_control method
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'set_opening_control',
          args: [sessionId, cashAmount, notes || ""],
          kwargs: {
            context: {
              lang: 'en_US',
              tz: 'Asia/Tehran',
              uid: userId, 
              allowed_company_ids: [1]
            }
          },
        },
      });
      
      log('Opening control notification response:', response.data);
      
      return true;
    } catch (error) {
      // Improved error handling to avoid any undefined values
      const errorMessage = error?.message || 'Unknown error';
      log(`Error in opening control for session ${sessionId}: ${errorMessage}`, error, 'error');
      
      // Don't throw error, return false to indicate failure but allow the app to continue
      return false;
    }
  }
};

export default sessionManager; 