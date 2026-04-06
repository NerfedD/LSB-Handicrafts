import { useState, useEffect } from 'react';
import { saveInventory, loadInventory, deleteFromInventory } from '../utils/storageManager';

const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

export const useInventory = () => {
  const [inventory, setInventory] = useState(() => {
    return loadInventory(initialInventory);
  });

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  const updateInventory = (updatedInventory) => {
    if (Array.isArray(updatedInventory)) {
      setInventory(updatedInventory);
    } else {
      console.warn('Attempted to set inventory to a non-array value:', updatedInventory);
    }
  };

  const addItem = (item) => {
    const newRecord = { 
      ...item, 
      id: Date.now(), 
      status: item.stock < 50 ? 'Low Stock' : 'In Stock' 
    };
    setInventory(prev => Array.isArray(prev) ? [...prev, newRecord] : [newRecord]);
  };

  const editItem = (id, updatedData) => {
    if (!Array.isArray(inventory)) return;
    const updatedInventory = inventory.map(item => 
      item.id === id ? { ...updatedData, status: updatedData.stock < 50 ? 'Low Stock' : 'In Stock' } : item
    );
    setInventory(updatedInventory);
  };

  const removeItem = (itemId) => {
    const updatedInventory = deleteFromInventory(Array.isArray(inventory) ? inventory : [], itemId);
    setInventory(updatedInventory);
  };

  return { 
    inventory, 
    setInventory: updateInventory, 
    addItem, 
    editItem, 
    removeItem 
  };
};
