import React, { useState } from 'react';
import { ChevronDown, ArrowLeft } from 'lucide-react';

export default function EditDelivery({ data, onSave, navigateTo, addActivity, showModal }) {
  const delivery = data || {};
  const [formData, setFormData] = useState({
    location: delivery.location || '',
    amount: delivery.amount || '',
    size: delivery.size || '',
    status: delivery.status || 'Not Yet Delivered',
    product: delivery.product || ''
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.amount) newErrors.amount = 'Amount is required';
    if (isNaN(formData.amount) || formData.amount <= 0) newErrors.amount = 'Amount must be a valid number';
    if (!formData.size.trim()) newErrors.size = 'Size/Type is required';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Show confirmation modal
    showModal(
      'Confirm Update',
      `Update delivery to ${formData.location}?`,
      () => {
        onSave({
          id: delivery.id,
          ...formData,
          amount: parseFloat(formData.amount)
        });
        
        addActivity?.({
          type: 'Delivery',
          title: 'Delivery Updated',
          description: `Updated delivery: ${formData.product} to ${formData.location}`,
          color: 'bg-blue-500'
        });

        navigateTo('deliveries');
      }
    );
  };

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl overflow-hidden shadow-sm dark:shadow-lg">
        <div className="p-6 md:p-8 border-b border-zinc-200 dark:border-[#1F1F2E]">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigateTo('deliveries')}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors p-2 -ml-2"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Edit Delivery</h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">Update delivery details and status</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Product/Order Info (Read-only) */}
          <div className="bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-200 dark:border-[#272730] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">Delivery Information</h3>
            <p className="text-zinc-900 dark:text-zinc-100 font-medium">{formData.product}</p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Delivery Location *
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Manila, Quezon City, Cebu"
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-[#1A1A24] dark:text-zinc-100 transition-colors focus:outline-none focus:border-blue-500 ${
                errors.location
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-zinc-300 dark:border-[#272730]'
              }`}
            />
            {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
          </div>

          {/* Size/Type */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Size/Type *
            </label>
            <input
              type="text"
              name="size"
              value={formData.size}
              onChange={handleChange}
              placeholder="e.g., Small, Medium, Large, Order Package"
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-[#1A1A24] dark:text-zinc-100 transition-colors focus:outline-none focus:border-blue-500 ${
                errors.size
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-zinc-300 dark:border-[#272730]'
              }`}
            />
            {errors.size && <p className="text-red-500 text-sm mt-1">{errors.size}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Amount *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-[#1A1A24] dark:text-zinc-100 transition-colors focus:outline-none focus:border-blue-500 ${
                errors.amount
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-zinc-300 dark:border-[#272730]'
              }`}
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Delivery Status
            </label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`appearance-none w-full px-4 py-3 rounded-xl border bg-zinc-50 dark:bg-[#1A1A24] dark:text-zinc-100 transition-colors focus:outline-none focus:border-blue-500 cursor-pointer ${
                  formData.status === 'Not Yet Delivered'
                    ? 'border-red-300 dark:border-red-900/50'
                    : formData.status === 'Delivered'
                    ? 'border-emerald-300 dark:border-emerald-900/50'
                    : 'border-yellow-300 dark:border-yellow-900/50'
                }`}
              >
                <option value="Not Yet Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Not Yet Delivered</option>
                <option value="On The Way" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">On The Way</option>
                <option value="Delivered" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">Delivered</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
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
              onClick={() => navigateTo('deliveries')}
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
