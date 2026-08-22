import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function EditOrder({ data, onSave, navigateTo, addActivity, showModal }) {
  const order = data || { items: [] };
  const [formData, setFormData] = useState({
    customerName: order.customerName || '',
    items: order.items ? [...order.items] : [{ name: '', quantity: 1, price: 0 }]
  });

  const [errors, setErrors] = useState({});

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (formData.items.length === 0) newErrors.items = 'At least one item is required';
    
    formData.items.forEach((item, idx) => {
      if (!item.name.trim()) {
        newErrors[`item_${idx}_name`] = 'Item name is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${idx}_qty`] = 'Quantity must be greater than 0';
      }
      if (!item.price || item.price < 0) {
        newErrors[`item_${idx}_price`] = 'Price must be a valid number';
      }
    });

    return newErrors;
  };

  const handleCustomerNameChange = (e) => {
    setFormData(prev => ({ ...prev, customerName: e.target.value }));
    if (errors.customerName) {
      setErrors(prev => ({ ...prev, customerName: '' }));
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: field === 'name' ? value : value };
      return { ...prev, items: newItems };
    });

    const errorKey = `item_${index}_${field === 'quantity' ? 'qty' : field === 'price' ? 'price' : 'name'}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    showModal(
      'Confirm Update',
      `Update order for ${formData.customerName}?`,
      () => {
        onSave({
          id: order.id,
          customerName: formData.customerName,
          items: formData.items.map(item => ({
            name: item.name,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price)
          })),
          totalAmount: calculateTotal(),
          status: order.status || 'Pending',
          createdAt: order.createdAt
        });

        addActivity?.({
          type: 'Order',
          title: 'Order Updated',
          description: `Updated order for ${formData.customerName}`,
          color: 'bg-blue-500'
        });

        navigateTo('orders');
      }
    );
  };

  const totalAmount = calculateTotal();

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg">
        <div className="p-6 md:p-8 border-b border-zinc-200 dark:border-[#1F1F2E]">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigateTo('orders')}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors p-2 -ml-2"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Edit Order</h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">Update customer information and items</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Customer Name */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={handleCustomerNameChange}
              placeholder="e.g., John Doe"
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-[#1A1A24] dark:text-zinc-100 transition-colors focus:outline-none focus:border-blue-500 ${
                errors.customerName
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-zinc-300 dark:border-[#272730]'
              }`}
            />
            {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Order Items *
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {errors.items && <p className="text-red-500 text-sm">{errors.items}</p>}

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#272730] rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Item Name */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Item Name
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="e.g., Wooden Box"
                        className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-[#111116] dark:text-zinc-100 text-sm transition-colors focus:outline-none focus:border-blue-500 ${
                          errors[`item_${index}_name`]
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-zinc-300 dark:border-[#272730]'
                        }`}
                      />
                      {errors[`item_${index}_name`] && <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_name`]}</p>}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        placeholder="1"
                        min="1"
                        className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-[#111116] dark:text-zinc-100 text-sm transition-colors focus:outline-none focus:border-blue-500 ${
                          errors[`item_${index}_qty`]
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-zinc-300 dark:border-[#272730]'
                        }`}
                      />
                      {errors[`item_${index}_qty`] && <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_qty`]}</p>}
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Unit Price (PHP)
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={`flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-[#111116] dark:text-zinc-100 text-sm transition-colors focus:outline-none focus:border-blue-500 ${
                            errors[`item_${index}_price`]
                              ? 'border-red-500 dark:border-red-500'
                              : 'border-zinc-300 dark:border-[#272730]'
                          }`}
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors p-2"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {errors[`item_${index}_price`] && <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_price`]}</p>}
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="flex justify-end border-t border-zinc-300 dark:border-[#272730] pt-3">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Line Total:</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        PHP {(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Total */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Order Total Amount:</span>
              <span className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                PHP {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigateTo('orders')}
              className="flex-1 bg-zinc-200 dark:bg-[#1A1A24] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-[#272730] px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
