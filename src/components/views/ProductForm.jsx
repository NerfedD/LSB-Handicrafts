import React, { useState } from 'react';
import { ArrowLeft, Save, Lightbulb } from '../icons';
import {
  PRODUCT_TYPE,
  PRODUCT_TYPE_OPTIONS,
  SELL_UNIT_OPTIONS,
} from '../../utils/constants';
import { formatDimensions, suggestProductName } from '../../utils/productFormat';
import { statusOf } from '../../utils/stockLedger';

const EMPTY = {
  sku: '',
  name: '',
  category: '',
  price: '',
  stock: '',
  maxStock: '',
  lowStockThreshold: 50,
  productType: PRODUCT_TYPE.BALL,
  diameterIn: '',
  thicknessIn: '',
  lengthFt: '',
  widthFt: '',
  unit: 'piece',
  packSize: 1,
  isCuttable: false,
  reserved: 0,
};

const inputClass =
  'w-full bg-zinc-50 dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors';
const labelClass = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400';

export default function ProductForm({ mode, record, navigateTo, inventory, setInventory, showModal }) {
  const [formData, setFormData] = useState(record ? { ...EMPTY, ...record } : EMPTY);
  const [error, setError] = useState('');

  const isBall = formData.productType === PRODUCT_TYPE.BALL;
  const isFlat =
    formData.productType === PRODUCT_TYPE.SHEET ||
    formData.productType === PRODUCT_TYPE.BLOCK;

  const set = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  // Changing the type invalidates whichever dimensions the old type used, so
  // clear them rather than shipping a ball with a length.
  const handleTypeChange = (productType) => {
    set(
      productType === PRODUCT_TYPE.BALL
        ? { productType, thicknessIn: '', lengthFt: '', widthFt: '', isCuttable: false }
        : { productType, diameterIn: '' }
    );
  };

  const suggestion = suggestProductName(formData);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // The SKU column has no unique constraint — a rejected upsert would be
    // invisible here, so the duplicate has to be caught before it is written.
    const sku = formData.sku.trim();
    const clash = inventory.some(
      (item) => item.id !== record?.id && String(item.sku).toLowerCase() === sku.toLowerCase()
    );
    if (clash) {
      setError(`SKU "${sku}" is already used by another product.`);
      return;
    }

    showModal(
      mode === 'edit' ? 'Save Changes' : 'Add Product',
      `Are you sure you want to ${mode === 'edit' ? 'save changes to' : 'add'} this product?`,
      () => {
        const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
        const cleaned = {
          ...formData,
          sku,
          name: formData.name.trim() || suggestion,
          price: Number(formData.price) || 0,
          stock: Number(formData.stock) || 0,
          maxStock: Number(formData.maxStock) || 0,
          lowStockThreshold: Number(formData.lowStockThreshold) || 0,
          packSize: formData.unit === 'piece' ? 1 : Number(formData.packSize) || 1,
          reserved: Number(formData.reserved) || 0,
          diameterIn: isBall ? numOrNull(formData.diameterIn) : null,
          thicknessIn: isFlat ? numOrNull(formData.thicknessIn) : null,
          lengthFt: isFlat ? numOrNull(formData.lengthFt) : null,
          widthFt: isFlat ? numOrNull(formData.widthFt) : null,
          isCuttable: isFlat ? !!formData.isCuttable : false,
        };
        // Status is derived from what's sellable, never typed.
        cleaned.status = statusOf(cleaned);

        if (mode === 'edit') {
          setInventory(inventory.map((item) => (item.id === record.id ? cleaned : item)));
        } else {
          setInventory([...inventory, { ...cleaned, id: Date.now() }]);
        }
        navigateTo('inventory');
      }
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 w-full">

      <button onClick={() => navigateTo('inventory')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-2 mb-6 text-sm font-medium transition-colors w-fit">
        <ArrowLeft size={16} /> Back
      </button>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className={labelClass}>Product Type <span className="text-red-500">*</span></label>
                <select required value={formData.productType}
                  onChange={e => handleTypeChange(e.target.value)}
                  className={`${inputClass} cursor-pointer`}>
                  {PRODUCT_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>SKU <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g., SB-040"
                  value={formData.sku} onChange={e => set({ sku: e.target.value })}
                  className={inputClass} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass}>Product Description <span className="text-red-500">*</span></label>
                <input required type="text" placeholder={suggestion || 'e.g., Styro Ball 4"'}
                  value={formData.name} onChange={e => set({ name: e.target.value })}
                  className={inputClass} />
                {suggestion && suggestion !== formData.name && (
                  <button type="button" onClick={() => set({ name: suggestion })}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Use suggested name: {suggestion}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Category <span className="text-red-500">*</span></label>
                <input required type="text" placeholder="e.g., Styro Balls"
                  value={formData.category} onChange={e => set({ category: e.target.value })}
                  className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Price (Php) <span className="text-red-500">*</span></label>
                <input required type="number" step="0.01" min="0" placeholder="0"
                  value={formData.price} onChange={e => set({ price: e.target.value })}
                  className={inputClass} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Size</h3>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDimensions(formData)}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {isBall && (
                <div className="space-y-2">
                  <label className={labelClass}>Diameter (inches) <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.25" min="0" placeholder="4"
                    value={formData.diameterIn ?? ''} onChange={e => set({ diameterIn: e.target.value })}
                    className={inputClass} />
                </div>
              )}
              {isFlat && (
                <>
                  <div className="space-y-2">
                    <label className={labelClass}>Thickness (inches) <span className="text-red-500">*</span></label>
                    <input required type="number" step="0.25" min="0" placeholder="1"
                      value={formData.thicknessIn ?? ''} onChange={e => set({ thicknessIn: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Length (feet) <span className="text-red-500">*</span></label>
                    <input required type="number" step="0.5" min="0" placeholder="8"
                      value={formData.lengthFt ?? ''} onChange={e => set({ lengthFt: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Width (feet) <span className="text-red-500">*</span></label>
                    <input required type="number" step="0.5" min="0" placeholder="4"
                      value={formData.widthFt ?? ''} onChange={e => set({ widthFt: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!formData.isCuttable}
                        onChange={e => set({ isCuttable: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-[#272730] text-blue-600 focus:ring-blue-500/50" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Can be cut to size
                        <span className="block text-xs text-zinc-500 dark:text-zinc-500">
                          Makes this sheet selectable as the source for a cut-to-size order line.
                        </span>
                      </span>
                    </label>
                  </div>
                </>
              )}
              {!isBall && !isFlat && (
                <p className="md:col-span-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Pick a product type above to record its dimensions.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Stock Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className={labelClass}>Unit of Sale <span className="text-red-500">*</span></label>
                <select required value={formData.unit}
                  onChange={e => set({ unit: e.target.value, packSize: e.target.value === 'piece' ? 1 : formData.packSize })}
                  className={`${inputClass} cursor-pointer`}>
                  {SELL_UNIT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">{o.label}</option>
                  ))}
                </select>
              </div>
              {formData.unit !== 'piece' && (
                <div className="space-y-2">
                  <label className={labelClass}>Pieces per {formData.unit} <span className="text-red-500">*</span></label>
                  <input required type="number" min="1" placeholder="25"
                    value={formData.packSize} onChange={e => set({ packSize: e.target.value })}
                    className={inputClass} />
                </div>
              )}
              <div className="space-y-2">
                <label className={labelClass}>Current Stock Level <span className="text-red-500">*</span></label>
                <input required type="number" min="0" placeholder="0"
                  value={formData.stock} onChange={e => set({ stock: e.target.value })}
                  className={inputClass} />
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  Counted in {formData.unit === 'piece' ? 'pieces' : `${formData.unit}s`}.
                </p>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Maximum Stock <span className="text-red-500">*</span></label>
                <input required type="number" min="0" placeholder="0"
                  value={formData.maxStock ?? ''} onChange={e => set({ maxStock: e.target.value })}
                  className={inputClass} />
                <p className="text-xs text-zinc-500 dark:text-zinc-500">Storage ceiling.</p>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Low-Stock Threshold <span className="text-red-500">*</span></label>
                <input required type="number" min="0" placeholder="50"
                  value={formData.lowStockThreshold ?? ''} onChange={e => set({ lowStockThreshold: e.target.value })}
                  className={inputClass} />
                <p className="text-xs text-zinc-500 dark:text-zinc-500">Reorder floor — flags this product when available falls below it.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6 shrink-0">
          <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Actions</h3>
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="space-y-3">
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {mode === 'edit' ? <><Save size={18} /> Update Product</> : 'Add Product'}
              </button>
              <button type="button" onClick={() => navigateTo('inventory')} className="w-full bg-zinc-100 dark:bg-[#1A1A24] hover:bg-zinc-200 dark:hover:bg-[#22222E] text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-[#0f1422] border border-blue-200 dark:border-blue-900/30 rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
              <Lightbulb size={20} />
              <h3 className="text-lg font-semibold">Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 list-disc pl-4 marker:text-zinc-400 dark:marker:text-zinc-600">
              <li>One row per size — a 2" ball and a 4" ball are separate products</li>
              <li>SKU should be unique for each product</li>
              <li>Stock counts whichever unit you sell in, not pieces</li>
              <li>Status is calculated from what's available after pending orders</li>
              <li>All fields marked with * are required</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
