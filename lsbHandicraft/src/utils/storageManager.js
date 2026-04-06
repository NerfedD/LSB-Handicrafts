/**
 * Local Storage Manager for LSB Handicrafts Admin System
 * Handles all inventory data persistence with error handling and versioning
 */

const STORAGE_KEY = 'lsb_inventory';
const STORAGE_VERSION_KEY = 'lsb_inventory_version';
const CURRENT_VERSION = '1.0';

/**
 * Save inventory to localStorage with error handling
 * @param {Array} inventoryData - The inventory array to save
 * @returns {boolean} - Success status
 */
export const saveInventory = (inventoryData) => {
  try {
    const dataToSave = {
      version: CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      data: inventoryData,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    return true;
  } catch (error) {
    console.error('Failed to save inventory to localStorage:', error);
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded. Inventory may not be fully saved.');
    }
    return false;
  }
};

/**
 * Load inventory from localStorage with fallback
 * @param {Array} defaultInventory - Default inventory if nothing is saved
 * @returns {Array} - The loaded inventory data
 */
export const loadInventory = (defaultInventory = []) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultInventory;
    }
    
    const parsed = JSON.parse(stored);
    // Handle both old and new format
    return parsed.data || parsed || defaultInventory;
  } catch (error) {
    console.error('Failed to load inventory from localStorage:', error);
    return defaultInventory;
  }
};

/**
 * Delete an item from inventory
 * @param {Array} inventoryData - Current inventory array
 * @param {number} itemId - ID of the item to delete
 * @returns {Array} - Updated inventory array
 */
export const deleteFromInventory = (inventoryData, itemId) => {
  return inventoryData.filter(item => item.id !== itemId);
};

/**
 * Export inventory as JSON (for backup/download)
 * @param {Array} inventoryData - The inventory to export
 * @returns {string} - JSON string of the inventory
 */
export const exportInventory = (inventoryData) => {
  const exportData = {
    version: CURRENT_VERSION,
    exportDate: new Date().toISOString(),
    itemCount: inventoryData.length,
    data: inventoryData,
  };
  return JSON.stringify(exportData, null, 2);
};

/**
 * Clear all inventory data from localStorage
 * @returns {boolean} - Success status
 */
export const clearInventory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_VERSION_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear inventory from localStorage:', error);
    return false;
  }
};

/**
 * Get storage info (size, version, etc.)
 * @returns {Object} - Storage information
 */
export const getStorageInfo = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const size = stored ? new Blob([stored]).size : 0;
    const version = localStorage.getItem(STORAGE_VERSION_KEY) || 'unknown';
    
    return {
      hasData: !!stored,
      sizeBytes: size,
      sizeKB: (size / 1024).toFixed(2),
      version,
      timestamp: stored ? JSON.parse(stored).timestamp : null,
    };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return { hasData: false, error: error.message };
  }
};
