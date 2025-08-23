import Dexie from 'dexie';

// Create a Dexie database
export const db = new Dexie('PosDB');

// Define database schema
db.version(1).stores({
  products: 'id, name, default_code, barcode, *tags',
  categories: 'id, name, parent_id',
  orders: '++id, state, date, customer_id',
  orderLines: '++id, order_id, product_id, qty, price_unit',
  customers: 'id, name, phone, email',
  config: 'key, value'
});

// Products service
export const productsDB = {
  /**
   * Add or update products
   * @param {Array} products - List of products to add or update
   * @returns {Promise<void>}
   */
  bulkUpsert: async (products) => {
    try {
      return await db.products.bulkPut(products);
    } catch (error) {
      console.error('Error in bulkUpsert products:', error);
      throw error;
    }
  },

  /**
   * Get all products
   * @returns {Promise<Array>} Products list
   */
  getAll: async () => {
    try {
      return await db.products.toArray();
    } catch (error) {
      console.error('Error in getAll products:', error);
      return [];
    }
  },

  /**
   * Get product by ID
   * @param {number} id - Product ID
   * @returns {Promise<Object>} Product data
   */
  getById: async (id) => {
    try {
      return await db.products.get(id);
    } catch (error) {
      console.error(`Error in getById product ${id}:`, error);
      return null;
    }
  },

  /**
   * Search products by name or code
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching products
   */
  search: async (query) => {
    try {
      if (!query) return await db.products.toArray();
      
      const searchLower = query.toLowerCase();
      return await db.products
        .filter(product => {
          const nameLower = (product.name || '').toLowerCase();
          const codeLower = (product.default_code || '').toLowerCase();
          const barcodeLower = (product.barcode || '').toLowerCase();
          return nameLower.includes(searchLower) || 
                 codeLower.includes(searchLower) || 
                 barcodeLower.includes(searchLower);
        })
        .toArray();
    } catch (error) {
      console.error('Error in search products:', error);
      return [];
    }
  }
};

// Categories service
export const categoriesDB = {
  /**
   * Add or update categories
   * @param {Array} categories - List of categories to add or update
   * @returns {Promise<void>}
   */
  bulkUpsert: async (categories) => {
    try {
      return await db.categories.bulkPut(categories);
    } catch (error) {
      console.error('Error in bulkUpsert categories:', error);
      throw error;
    }
  },

  /**
   * Get all categories
   * @returns {Promise<Array>} Categories list
   */
  getAll: async () => {
    try {
      return await db.categories.toArray();
    } catch (error) {
      console.error('Error in getAll categories:', error);
      return [];
    }
  },

  /**
   * Get category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Category data
   */
  getById: async (id) => {
    try {
      return await db.categories.get(id);
    } catch (error) {
      console.error(`Error in getById category ${id}:`, error);
      return null;
    }
  }
};

// Orders service
export const ordersDB = {
  /**
   * Add a new order
   * @param {Object} order - Order data
   * @returns {Promise<number>} Order ID
   */
  add: async (order) => {
    try {
      return await db.orders.add(order);
    } catch (error) {
      console.error('Error in add order:', error);
      throw error;
    }
  },

  /**
   * Get all orders
   * @returns {Promise<Array>} Orders list
   */
  getAll: async () => {
    try {
      return await db.orders.toArray();
    } catch (error) {
      console.error('Error in getAll orders:', error);
      return [];
    }
  },

  /**
   * Get order by ID
   * @param {number} id - Order ID
   * @returns {Promise<Object>} Order data with order lines
   */
  getById: async (id) => {
    try {
      const order = await db.orders.get(id);
      if (order) {
        order.lines = await db.orderLines.where('order_id').equals(id).toArray();
      }
      return order;
    } catch (error) {
      console.error(`Error in getById order ${id}:`, error);
      return null;
    }
  },

  /**
   * Add order lines
   * @param {Array} lines - Order lines
   * @returns {Promise<void>}
   */
  addLines: async (lines) => {
    try {
      return await db.orderLines.bulkAdd(lines);
    } catch (error) {
      console.error('Error in addLines:', error);
      throw error;
    }
  },

  /**
   * Get pending orders that need to be synced
   * @returns {Promise<Array>} Pending orders
   */
  getPendingOrders: async () => {
    try {
      return await db.orders.where('state').equals('pending').toArray();
    } catch (error) {
      console.error('Error in getPendingOrders:', error);
      return [];
    }
  },

  /**
   * Mark order as synced
   * @param {number} id - Order ID
   * @returns {Promise<void>}
   */
  markAsSynced: async (id) => {
    try {
      return await db.orders.update(id, { state: 'synced' });
    } catch (error) {
      console.error(`Error in markAsSynced order ${id}:`, error);
      throw error;
    }
  }
};

// Configuration service
export const configDB = {
  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @returns {Promise<void>}
   */
  set: async (key, value) => {
    try {
      return await db.config.put({ key, value });
    } catch (error) {
      console.error(`Error in set config ${key}:`, error);
      throw error;
    }
  },

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @returns {Promise<any>} Configuration value
   */
  get: async (key) => {
    try {
      const record = await db.config.get(key);
      return record?.value;
    } catch (error) {
      console.error(`Error in get config ${key}:`, error);
      return null;
    }
  }
};

export default {
  db,
  productsDB,
  categoriesDB,
  ordersDB,
  configDB
}; 