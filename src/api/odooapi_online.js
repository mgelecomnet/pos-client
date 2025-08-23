import axios from 'axios';

// Get Odoo server URL from environment variables with fallback
const ODOO_URL = process.env.REACT_APP_ODOO_API_URL;
const ODOO_DB = process.env.REACT_APP_ODOO_DB ;

// Debug log
console.log('[odooapi_online] Using configuration:');
console.log('- API URL:', ODOO_URL);
console.log('- Database:', ODOO_DB);

// Helper function to get auth data from localStorage
const getAuthData = () => {
  try {
    // First try to get user data from localStorage - this contains all login info
    const userData = localStorage.getItem('user');
    if (!userData) {
      console.error('No user data found in localStorage');
      return null;
    }
    
    const user = JSON.parse(userData);
    
    // Then get session data if available
    const session = localStorage.getItem('odoo_session');
    let sessionData = null;
    if (session) {
      try {
        sessionData = JSON.parse(session);
      } catch (e) {
        console.warn('Error parsing odoo_session data', e);
      }
    }
    
    return {
      uid: user.uid || 2, // Default to 2 if not found
      sessionId: user.session_id || sessionData?.session_id,
      context: user.user_context || {},
      companyId: user.company_id || 1,  // Default to 1 if not found
      allowedCompanyIds: user.allowed_company_ids || [1] // Default to [1] if not found
    };
  } catch (error) {
    console.error('Error getting auth data from localStorage', error);
    return null;
  }
};

// Helper to prepare context object exactly matching the required structure
const prepareContext = (additionalContext = {}) => {
  const auth = getAuthData();
  if (!auth) return null;
  
  // Create context object that exactly matches the structure in the payload example
  return {
    lang: "en_US",
    tz: "Asia/Tehran",
    uid: auth.uid,
    allowed_company_ids: auth.allowedCompanyIds || [1],
    bin_size: true,
    params: {
      action: 414,
      actionStack: [{ action: 414 }]
    },
    current_company_id: auth.companyId || 1,
    ...additionalContext
  };
};

// Create Axios instance with common settings
const odooAPI = axios.create({
  baseURL: ODOO_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Intercept requests to add session cookie if available
odooAPI.interceptors.request.use(config => {
  const auth = getAuthData();
  if (auth && auth.sessionId) {
    config.headers['Cookie'] = `session_id=${auth.sessionId}`;
  }
  
  // Add database parameter to queries if needed
  if (config.params) {
    config.params.db = ODOO_DB;
  } else {
    config.params = { db: ODOO_DB };
  }
  
  return config;
});

// Category API calls
const categoryAPI = {
  // Get all categories from Odoo server (pos.category)
  fetchCategories: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/pos.category/web_search_read', {
        id: 3,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "pos.category",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              sequence: {}, 
              display_name: {}, 
              parent_id: {fields: {display_name: {}}}, 
              color: {},
              image_128: {},
              write_date: {},
              name: {},
              hour_after: {},
              hour_until: {}
            },
            offset: 0,
            order: "sequence ASC, id ASC",
            limit: 80,
            context: context,
            count_limit: 10001,
            domain: []
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch categories');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching Odoo categories:', error);
      throw error;
    }
  },
  
  // Get POS category details from Odoo server
  getPosCategoryDetails: async (categoryId) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/pos.category/web_read', {
        id: 19,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "pos.category",
          method: "web_read",
          args: [[categoryId]],
          kwargs: {
            context: context,
            specification: {
              name: {},
              parent_id: {fields: {display_name: {}}},
              display_name: {},
              color: {},
              image_128: {},
              write_date: {},
              hour_after: {},
              hour_until: {}
            }
          }
        }
      });
      
      console.log('API response for POS category details:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to get POS category details');
      }
      
      return response.data.result && response.data.result.length > 0 ? response.data.result[0] : null;
    } catch (error) {
      console.error('Error getting POS category details:', error);
      throw error;
    }
  },
  
  // Get all product categories from Odoo server (product.category)
  fetchProductCategories: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.category/web_search_read', {
        id: 3,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.category",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              display_name: {},
              name: {},
              parent_id: {fields: {display_name: {}}},
              parent_path: {},
              complete_name: {},
            //   image_128: {},
              write_date: {}
            },
            offset: 0,
            order: "complete_name ASC",
            limit: 80,
            context: context,
            count_limit: 10001,
            domain: []
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch product categories');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching Odoo product categories:', error);
      throw error;
    }
  },

  // Get product category details from Odoo server
  getProductCategoryDetails: async (categoryId) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.category/web_read', {
        id: 18,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.category",
          method: "web_read",
          args: [[categoryId]],
          kwargs: {
            context: context,
            specification: {
              product_count: {},
              name: {},
              parent_id: {fields: {display_name: {}}},
              removal_strategy_id: {fields: {display_name: {}}},
              property_cost_method: {},
              display_name: {},
              complete_name: {}
            }
          }
        }
      });
      
      console.log('API response for product category details:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to get product category details');
      }
      
      return response.data.result && response.data.result.length > 0 ? response.data.result[0] : null;
    } catch (error) {
      console.error('Error getting product category details:', error);
      throw error;
    }
  },

  // Create new product category
  createProductCategory: async (categoryData) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // اطمینان از اینکه parent_id با ساختار مناسب ارسال می‌شود
      let finalCategoryData = {...categoryData};
      
      // اگر parent_id یک آرایه است، آن را به صورت صحیح تنظیم می‌کنیم
      if (finalCategoryData.parent_id && !Array.isArray(finalCategoryData.parent_id)) {
        if (typeof finalCategoryData.parent_id === 'number') {
          finalCategoryData.parent_id = [finalCategoryData.parent_id];
        } else {
          finalCategoryData.parent_id = false;
        }
      }
      
      console.log('Sending data to create product category:', finalCategoryData);
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.category/create', {
        id: 15,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.category",
          method: "create",
          args: [finalCategoryData],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to create product category');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error creating product category:', error);
      throw error;
    }
  },
  
  // Update product category
  updateProductCategory: async (categoryId, categoryData) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // اطمینان از اینکه parent_id با ساختار مناسب ارسال می‌شود
      let finalCategoryData = {...categoryData};
      
      // اگر parent_id یک آرایه است، آن را به صورت صحیح تنظیم می‌کنیم
      if (finalCategoryData.parent_id && !Array.isArray(finalCategoryData.parent_id)) {
        if (typeof finalCategoryData.parent_id === 'number') {
          finalCategoryData.parent_id = [finalCategoryData.parent_id];
        } else {
          finalCategoryData.parent_id = false;
        }
      }
      
      console.log('Sending data to update product category:', finalCategoryData);
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.category/write', {
        id: 16,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.category",
          method: "write",
          args: [[categoryId], finalCategoryData],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to update product category');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error updating product category:', error);
      throw error;
    }
  },
  
  // Delete product category
  deleteProductCategory: async (categoryId) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/pos.category/unlink', {
        id: 10,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "pos.category",
          method: "unlink",
          args: [[categoryId]],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to delete category');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error deleting Odoo category:', error);
      throw error;
    }
  }
};

// Product API calls
const productAPI = {
  // Get all products from Odoo server
  fetchProducts: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.product/web_search_read', {
        id: 4,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.product",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              currency_id: {fields: {display_name: {}}},
              categ_id: {fields: {display_name: {}}},
              name: {},
              default_code: {},
              barcode: {},
              list_price: {},
              qty_available: {},
              type: {},
              pos_categ_ids: {fields: {display_name: {}, color: {}}},
              available_in_pos: {},
              sale_ok: {},
              purchase_ok: {},
              image_128: {},
              write_date: {}
            },
            offset: 0,
            order: "",
            limit: 200,
            context: context,
            count_limit: 10001,
            domain: [["available_in_pos", "=", true]]
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch products');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching Odoo products:', error);
      throw error;
    }
  },
  
  // Fetch products using product.template model
  fetchProductTemplates: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.template/web_search_read', {
        id: 3,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.template",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              currency_id: {fields: {display_name: {}}},
              activity_state: {},
              categ_id: {fields: {display_name: {}}},
              is_favorite: {},
              name: {},
              default_code: {},
              product_variant_count: {},
              list_price: {},
              qty_available: {},
              uom_id: {fields: {display_name: {}}},
              product_properties: {},
              image_128: {},
              write_date: {},
              show_on_hand_qty_status_button: {}
            },
            offset: 0,
            order: "",
            limit: 80,
            context: context,
            count_limit: 10001,
            domain: [["available_in_pos", "=", true]]
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch product templates');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching Odoo product templates:', error);
      throw error;
    }
  },
  
  // Get detailed information about a product template
  getProductDetails: async (productId) => {
    try {
      console.log('Fetching product details for ID:', productId);
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // Add additional context fields required by product.template
      const extendedContext = {
        ...context,
        params: {
          resId: productId,
          action: 415,
          actionStack: [{action: 415}, {resId: productId, action: 415}]
        },
        default_available_in_pos: true,
        create_variant_never: "no_variant",
        _pos_self_order: true
      };
      
      const response = await odooAPI.post('/web/dataset/call_kw/product.template/web_read', {
        id: 3,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.template",
          method: "web_read",
          args: [[productId]],
          kwargs: {
            context: extendedContext,
            specification: {
              product_variant_count: {},
              is_product_variant: {},
              attribute_line_ids: {
                fields: {
                  value_count: {},
                  sequence: {},
                  attribute_id: {
                    fields: {display_name: {}},
                    context: {default_create_variant: "no_variant"}
                  },
                  value_ids: {
                    fields: {display_name: {}, color: {}},
                    context: {show_attribute: false}
                  }
                },
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              company_id: {fields: {display_name: {}}},
              fiscal_country_codes: {},
              pricelist_item_count: {},
              tracking: {},
              show_on_hand_qty_status_button: {},
              show_forecasted_qty_status_button: {},
              qty_available: {},
              uom_name: {},
              virtual_available: {},
              product_document_count: {},
              purchased_product_qty: {},
              reordering_min_qty: {},
              reordering_max_qty: {},
              nbr_reordering_rules: {},
              nbr_moves_in: {},
              nbr_moves_out: {},
              id: {},
              image_1920: {},
              write_date: {},
              is_favorite: {},
              name: {},
              sale_ok: {},
              available_in_pos: {},
              purchase_ok: {},
              active: {},
              type: {},
              is_storable: {},
              combo_ids: {fields: {display_name: {}}},
              service_tracking: {},
              product_tooltip: {},
              lot_valuated: {},
              list_price: {},
              taxes_id: {
                fields: {display_name: {}},
                context: {default_type_tax_use: "sale", search_default_sale: 1}
              },
              tax_string: {},
              standard_price: {},
              supplier_taxes_id: {
                fields: {display_name: {}},
                context: {default_type_tax_use: "purchase", search_default_purchase: 1}
              },
              categ_id: {fields: {display_name: {}}},
              default_code: {},
              valid_product_template_attribute_line_ids: {},
              barcode: {},
              currency_id: {fields: {}},
              cost_currency_id: {fields: {}},
              product_variant_id: {fields: {}},
              product_properties: {},
              description: {},
              product_tag_ids: {fields: {display_name: {}}},
              description_sale: {},
              color: {},
              to_weight: {},
              pos_categ_ids: {fields: {display_name: {}, color: {}}},
              self_order_available: {},
              public_description: {},
              seller_ids: {
                fields: {
                  sequence: {},
                  partner_id: {fields: {display_name: {}}},
                  product_id: {fields: {display_name: {}}},
                  product_tmpl_id: {fields: {display_name: {}}},
                  product_name: {},
                  product_code: {},
                  date_start: {},
                  date_end: {},
                  company_id: {fields: {display_name: {}}},
                  min_qty: {},
                  price: {},
                  discount: {},
                  currency_id: {fields: {display_name: {}}},
                  delay: {}
                },
                context: {product_template_invisible_variant: true, list_view_ref: "purchase.product_supplierinfo_tree_view2"},
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              variant_seller_ids: {
                fields: {
                  sequence: {},
                  partner_id: {fields: {display_name: {}}},
                  product_id: {fields: {display_name: {}}},
                  product_tmpl_id: {fields: {display_name: {}}},
                  product_name: {},
                  product_code: {},
                  date_start: {},
                  date_end: {},
                  company_id: {fields: {display_name: {}}},
                  min_qty: {},
                  price: {},
                  discount: {},
                  currency_id: {fields: {display_name: {}}},
                  delay: {}
                },
                context: {model: "product.template", list_view_ref: "purchase.product_supplierinfo_tree_view2"},
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              purchase_method: {},
              description_purchase: {},
              has_available_route_ids: {},
              route_ids: {fields: {}},
              route_from_categ_ids: {fields: {display_name: {}}},
              responsible_id: {fields: {display_name: {}}},
              weight: {},
              weight_uom_name: {},
              volume: {},
              volume_uom_name: {},
              sale_delay: {},
              description_pickingin: {},
              description_pickingout: {},
              display_name: {}
            }
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to get product details');
      }
      
      return response.data.result && response.data.result.length > 0 ? response.data.result[0] : null;
    } catch (error) {
      console.error('Error getting product details:', error);
      throw error;
    }
  },
  
  // Create new product on Odoo server
  createProduct: async (productData) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // Ensure the product is available in POS
      const finalProductData = {
        ...productData,
        available_in_pos: true
      };
      
      // Now using product.template model instead of product.product
      const response = await odooAPI.post('/web/dataset/call_kw/product.template/create', {
        id: 5,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.template",
          method: "create",
          args: [finalProductData],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to create product');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error creating Odoo product:', error);
      throw error;
    }
  },
  
  // Update product on Odoo server
  updateProduct: async (productId, productData) => {
    try {
      console.log('Updating product with ID:', productId, 'and data:', productData);
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // Add additional context fields required by product.template
      const extendedContext = {
        ...context,
        params: {
          resId: productId,
          action: 415,
          actionStack: [{action: 415}, {resId: productId, action: 415}]
        },
        default_available_in_pos: true,
        create_variant_never: "no_variant",
        _pos_self_order: true
      };
      
      // Using web_save endpoint with the specification matching the product form
      const response = await odooAPI.post('/web/dataset/call_kw/product.template/web_save', {
        id: 7,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.template",
          method: "web_save",
          args: [[productId], productData],
          kwargs: {
            context: extendedContext,
            specification: {
              product_variant_count: {},
              is_product_variant: {},
              attribute_line_ids: {
                fields: {
                  value_count: {},
                  sequence: {},
                  attribute_id: {
                    fields: {display_name: {}},
                    context: {default_create_variant: "no_variant"}
                  },
                  value_ids: {
                    fields: {display_name: {}, color: {}},
                    context: {show_attribute: false}
                  }
                },
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              company_id: {fields: {display_name: {}}},
              fiscal_country_codes: {},
              pricelist_item_count: {},
              tracking: {},
              show_on_hand_qty_status_button: {},
              show_forecasted_qty_status_button: {},
              qty_available: {},
              uom_name: {},
              virtual_available: {},
              product_document_count: {},
              purchased_product_qty: {},
              reordering_min_qty: {},
              reordering_max_qty: {},
              nbr_reordering_rules: {},
              nbr_moves_in: {},
              nbr_moves_out: {},
              id: {},
              image_1920: {},
              write_date: {},
              is_favorite: {},
              name: {},
              sale_ok: {},
              available_in_pos: {},
              purchase_ok: {},
              active: {},
              type: {},
              is_storable: {},
              combo_ids: {fields: {display_name: {}}},
              service_tracking: {},
              product_tooltip: {},
              lot_valuated: {},
              list_price: {},
              taxes_id: {
                fields: {display_name: {}},
                context: {default_type_tax_use: "sale", search_default_sale: 1}
              },
              tax_string: {},
              standard_price: {},
              supplier_taxes_id: {
                fields: {display_name: {}},
                context: {default_type_tax_use: "purchase", search_default_purchase: 1}
              },
              categ_id: {fields: {display_name: {}}},
              default_code: {},
              valid_product_template_attribute_line_ids: {},
              barcode: {},
              currency_id: {fields: {}},
              cost_currency_id: {fields: {}},
              product_variant_id: {fields: {}},
              product_properties: {},
              description: {},
              product_tag_ids: {fields: {display_name: {}}},
              description_sale: {},
              color: {},
              to_weight: {},
              pos_categ_ids: {fields: {display_name: {}, color: {}}},
              self_order_available: {},
              public_description: {},
              seller_ids: {
                fields: {
                  sequence: {},
                  partner_id: {fields: {display_name: {}}},
                  product_id: {fields: {display_name: {}}},
                  product_tmpl_id: {fields: {display_name: {}}},
                  product_name: {},
                  product_code: {},
                  date_start: {},
                  date_end: {},
                  company_id: {fields: {display_name: {}}},
                  min_qty: {},
                  price: {},
                  discount: {},
                  currency_id: {fields: {display_name: {}}},
                  delay: {}
                },
                context: {product_template_invisible_variant: true, list_view_ref: "purchase.product_supplierinfo_tree_view2"},
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              variant_seller_ids: {
                fields: {
                  sequence: {},
                  partner_id: {fields: {display_name: {}}},
                  product_id: {fields: {display_name: {}}},
                  product_tmpl_id: {fields: {display_name: {}}},
                  product_name: {},
                  product_code: {},
                  date_start: {},
                  date_end: {},
                  company_id: {fields: {display_name: {}}},
                  min_qty: {},
                  price: {},
                  discount: {},
                  currency_id: {fields: {display_name: {}}},
                  delay: {}
                },
                context: {model: "product.template", list_view_ref: "purchase.product_supplierinfo_tree_view2"},
                limit: 40,
                order: "sequence ASC, id ASC"
              },
              purchase_method: {},
              description_purchase: {},
              has_available_route_ids: {},
              route_ids: {fields: {}},
              route_from_categ_ids: {fields: {display_name: {}}},
              responsible_id: {fields: {display_name: {}}},
              weight: {},
              weight_uom_name: {},
              volume: {},
              volume_uom_name: {},
              sale_delay: {},
              description_pickingin: {},
              description_pickingout: {},
              display_name: {}
            }
          }
        }
      });
      
      console.log('Product update response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to update product');
      }
      
      return response.data.result && response.data.result.length > 0 ? response.data.result[0] : true;
    } catch (error) {
      console.error('Error updating Odoo product:', error);
      throw error;
    }
  },
  
  // Delete product from Odoo server
  deleteProduct: async (productId) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // Now using product.template model instead of product.product
      const response = await odooAPI.post('/web/dataset/call_kw/product.template/unlink', {
        id: 7,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "product.template",
          method: "unlink",
          args: [[productId]],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to delete product');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error deleting Odoo product:', error);
      throw error;
    }
  }
};

// Customer API calls
const customerAPI = {
  // Get all customers from Odoo server
  fetchCustomers: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/res.partner/web_search_read', {
        id: 11,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "res.partner",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              name: {},
              display_name: {},
              phone: {},
              mobile: {},
              email: {},
              street: {},
              city: {},
              vat: {},
              zip: {}
            },
            offset: 0,
            order: "",
            limit: 200,
            context: context,
            count_limit: 10001,
            domain: [["customer_rank", ">", 0]]
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch customers');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching Odoo customers:', error);
      throw error;
    }
  },
  
  // Create new customer on Odoo server
  createCustomer: async (customerData) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      // Ensure customer rank is set
      const finalCustomerData = {
        ...customerData,
        customer_rank: 1
      };
      
      const response = await odooAPI.post('/web/dataset/call_kw/res.partner/create', {
        id: 12,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "res.partner",
          method: "create",
          args: [finalCustomerData],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to create customer');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error creating Odoo customer:', error);
      throw error;
    }
  },
  
  // Update customer on Odoo server
  updateCustomer: async (customerId, customerData) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/res.partner/write', {
        id: 13,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "res.partner",
          method: "write",
          args: [[customerId], customerData],
          kwargs: {
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to update customer');
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error updating Odoo customer:', error);
      throw error;
    }
  }
};

// Add a new API object for currency operations
const currencyAPI = {
  // Fetch all currencies
  fetchCurrencies: async () => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/res.currency/web_search_read', {
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "res.currency",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              name: {},
              symbol: {},
              rate: {},
              position: {},
              decimal_places: {},
              active: {},
              display_name: {}
            },
            context: context,
            domain: [["active", "=", true]],
            limit: 100
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch currencies');
      }
      
      return response.data.result.records || [];
    } catch (error) {
      console.error('Error fetching currencies:', error);
      throw error;
    }
  },
  
  // Get currency by ID
  getCurrencyById: async (currencyId) => {
    try {
      const context = prepareContext();
      if (!context) throw new Error('No authentication data available');
      
      const response = await odooAPI.post('/web/dataset/call_kw/res.currency/web_read', {
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "res.currency",
          method: "web_read",
          args: [[currencyId]],
          kwargs: {
            specification: {
              name: {},
              symbol: {},
              rate: {},
              position: {},
              decimal_places: {},
              active: {},
              display_name: {}
            },
            context: context
          }
        }
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to get currency details');
      }
      
      return response.data.result && response.data.result.length > 0 ? response.data.result[0] : null;
    } catch (error) {
      console.error(`Error getting currency with ID ${currencyId}:`, error);
      throw error;
    }
  }
};

// Helper function to get image URL
export const getImageUrl = (model, id, field = 'image_128') => {
  // افزودن یک پارامتر unique برای جلوگیری از کش شدن تصویر
  const timestamp = new Date().getTime();
  return `${ODOO_URL}/web/image/${model}/${id}/${field}?unique=${timestamp}`;
};

// Configuration info export
export const odooOnlineConfig = {
  apiUrl: ODOO_URL,
  database: ODOO_DB
};

// Export APIs individually
export { categoryAPI, productAPI, customerAPI, currencyAPI };

// For backwards compatibility
export default {
  categoryAPI,
  productAPI,
  customerAPI,
  currencyAPI
}; 