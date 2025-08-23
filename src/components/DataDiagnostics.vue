<template>
  <div class="data-diagnostics">
    <h2>POS Data Diagnostics</h2>
    
    <div v-if="loading" class="loading">
      <span>Testing data access...</span>
    </div>
    
    <div v-else>
      <div class="status-summary">
        <div class="status" :class="{ success: dataStatus.success, error: !dataStatus.success }">
          <span v-if="dataStatus.success">✓ Data access successful</span>
          <span v-else>✗ Data access failed</span>
        </div>
      </div>
      
      <div class="details">
        <div class="detail-item">
          <span class="label">Products:</span>
          <span class="value" :class="{ available: dataStatus.productsAvailable, unavailable: !dataStatus.productsAvailable }">
            {{ dataStatus.productsAvailable ? `Available (${dataStatus.productCount})` : 'Unavailable' }}
          </span>
        </div>
        
        <div class="detail-item">
          <span class="label">Partners:</span>
          <span class="value" :class="{ available: dataStatus.partnersAvailable, unavailable: !dataStatus.partnersAvailable }">
            {{ dataStatus.partnersAvailable ? `Available (${dataStatus.partnerCount})` : 'Unavailable' }}
          </span>
        </div>
        
        <div class="detail-item">
          <span class="label">Raw Data:</span>
          <span class="value" :class="{ available: dataStatus.rawDataAvailable, unavailable: !dataStatus.rawDataAvailable }">
            {{ dataStatus.rawDataAvailable ? 'Available' : 'Unavailable' }}
          </span>
        </div>
      </div>
      
      <div v-if="dataStatus.error" class="error-message">
        <h3>Error Details:</h3>
        <pre>{{ dataStatus.error }}</pre>
      </div>
      
      <div class="actions">
        <button @click="runDiagnostics" class="refresh-btn">Refresh Diagnostics</button>
      </div>
    </div>
  </div>
</template>

<script>
import { testAccessPOSData } from '../api/testPOSData';

export default {
  name: 'DataDiagnostics',
  data() {
    return {
      loading: true,
      dataStatus: {
        success: false,
        productsAvailable: false,
        partnersAvailable: false,
        rawDataAvailable: false,
        productCount: 0,
        partnerCount: 0,
        error: null
      }
    };
  },
  
  mounted() {
    this.runDiagnostics();
  },
  
  methods: {
    async runDiagnostics() {
      this.loading = true;
      try {
        const result = await testAccessPOSData();
        this.dataStatus = { ...result };
      } catch (error) {
        this.dataStatus = {
          success: false,
          productsAvailable: false,
          partnersAvailable: false,
          rawDataAvailable: false,
          productCount: 0,
          partnerCount: 0,
          error: error.message
        };
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.data-diagnostics {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

h2 {
  margin-bottom: 1.5rem;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  font-style: italic;
  color: #666;
}

.status-summary {
  margin-bottom: 1.5rem;
}

.status {
  padding: 0.75rem;
  border-radius: 4px;
  font-weight: bold;
  text-align: center;
}

.status.success {
  background-color: #dff2bf;
  color: #4F8A10;
}

.status.error {
  background-color: #ffbaba;
  color: #D8000C;
}

.details {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.detail-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: bold;
  color: #555;
}

.value {
  font-family: monospace;
}

.available {
  color: #4F8A10;
}

.unavailable {
  color: #D8000C;
}

.error-message {
  background-color: #fff0f0;
  border-left: 4px solid #D8000C;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0 4px 4px 0;
}

.error-message h3 {
  margin-top: 0;
  color: #D8000C;
  font-size: 1rem;
}

pre {
  background-color: #f8f9fa;
  padding: 0.5rem;
  overflow-x: auto;
  border-radius: 4px;
}

.actions {
  text-align: center;
}

.refresh-btn {
  background-color: #4285f4;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background-color: #3367d6;
}
</style> 