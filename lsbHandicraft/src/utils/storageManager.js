const STORAGE_KEY = 'lsb_inventory';

export const loadInventory = (initialData) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData;
    
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : initialData;
  } catch (error) {
    console.error('Failed to load inventory from localStorage:', error);
    return initialData;
  }
};

export const saveInventory = (inventory) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  } catch (error) {
    console.error('Failed to save inventory to localStorage:', error);
  }
};

export const deleteFromInventory = (inventory, itemId) => {
  return inventory.filter(item => item.id !== itemId);
};
