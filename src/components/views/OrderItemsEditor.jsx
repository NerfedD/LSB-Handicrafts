import React, { useState } from 'react';
import { Trash2, ChevronDown } from '../icons';
import { LINE_KIND, LINE_KIND_OPTIONS, PRODUCT_TYPE } from '../../utils/constants';
import { formatDimensions } from '../../utils/productFormat';
import { availableOf, piecesPerSheet, sheetsNeeded } from '../../utils/stockLedger';
import { withLineTotal } from '../../utils/orderItems';

/**
 * The one line-item editor, shared by the add and edit order screens.
 *
 * These two screens used to have separate editors that had drifted apart: the
 * add screen picked products from inventory, the edit screen took free text and
 * dropped productId on save, so editing an order once severed it from stock for
 * good. One component is the only way they stay in step.
 *
 * The four line kinds and what they mean live in src/utils/orderItems.js.
 */

const inputClass =
  'w-full bg-white dark:bg-[#1A1A24] border border-zinc-300 dark:border-[#272730] rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors';
const labelClass =
  'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider';

const EMPTY_DRAFT = {
  kind: LINE_KIND.CATALOG,
  productId: '',
  quantity: 1,
  unitPrice: '',
  name: '',
  description: '',
  notes: '',
  reason: '',
  cutLengthFt: '',
  cutWidthFt: '',
  stockUnits: '',
};

const KIND_BADGE = {
  [LINE_KIND.CATALOG]: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  [LINE_KIND.NEGOTIATED]: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  [LINE_KIND.CUT]: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  [LINE_KIND.CUSTOM]: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
};

const kindLabel = (kind) =>
  LINE_KIND_OPTIONS.find((o) => o.value === kind)?.label || 'Catalog';

export default function OrderItemsEditor({ items, setItems, inventory, disabled = false }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState('');

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const isCut = draft.kind === LINE_KIND.CUT;
  const isCustom = draft.kind === LINE_KIND.CUSTOM;
  const needsProduct = !isCustom;

  // A cut has to come off a sheet somebody is willing to cut up.
  const selectableProducts = isCut
    ? inventory.filter(
        (p) =>
          p.isCuttable &&
          (p.productType === PRODUCT_TYPE.SHEET || p.productType === PRODUCT_TYPE.BLOCK)
      )
    : inventory;

  const parent = inventory.find((p) => p.id === Number(draft.productId));

  const cutSpec = {
    lengthFt: Number(draft.cutLengthFt),
    widthFt: Number(draft.cutWidthFt),
    thicknessIn: parent?.thicknessIn ?? null,
  };
  const yieldPerSheet =
    isCut && parent && cutSpec.lengthFt && cutSpec.widthFt
      ? piecesPerSheet(parent, cutSpec)
      : null;
  const suggestedSheets =
    yieldPerSheet && yieldPerSheet > 0
      ? sheetsNeeded(parent, cutSpec, draft.quantity)
      : null;

  const changeKind = (kind) => {
    setError('');
    setDraft({ ...EMPTY_DRAFT, kind, quantity: draft.quantity });
  };

  // Picking a catalog product prefills its price; on a negotiated line that
  // becomes the starting point staff discount from.
  const changeProduct = (productId) => {
    const product = inventory.find((p) => p.id === Number(productId));
    set({
      productId,
      unitPrice: isCut ? draft.unitPrice : product ? String(product.price) : '',
      name: product && !isCut ? product.name : draft.name,
    });
  };

  const handleAdd = () => {
    setError('');
    const quantity = Number(draft.quantity);
    if (!quantity || quantity <= 0) return setError('Enter a quantity of at least 1.');

    if (needsProduct && !draft.productId) return setError('Pick a product first.');
    if (isCustom && !draft.name.trim()) return setError('Describe the custom piece.');

    const unitPrice = Number(draft.unitPrice);
    if (draft.unitPrice === '' || Number.isNaN(unitPrice) || unitPrice < 0) {
      return setError(
        isCut || isCustom ? 'Enter your quoted price per piece.' : 'Enter a unit price.'
      );
    }

    let line;

    if (isCustom) {
      line = {
        kind: LINE_KIND.CUSTOM,
        productId: null,
        name: draft.name.trim(),
        description: draft.description.trim(),
        quantity,
        unitPrice,
        stockUnits: 0,
      };
    } else if (isCut) {
      if (!cutSpec.lengthFt || !cutSpec.widthFt) {
        return setError('Enter the length and width of the cut.');
      }
      if (!yieldPerSheet) {
        return setError(
          `That cut doesn't fit a ${formatDimensions(parent)} sheet — pick a larger parent sheet.`
        );
      }
      const stockUnits =
        draft.stockUnits === '' ? suggestedSheets : Number(draft.stockUnits);
      if (!stockUnits || stockUnits <= 0) {
        return setError('Enter how many parent sheets this consumes.');
      }
      line = {
        kind: LINE_KIND.CUT,
        productId: parent.id,
        sku: parent.sku,
        name:
          draft.name.trim() ||
          `Cut ${parent.name} — ${cutSpec.lengthFt}ft × ${cutSpec.widthFt}ft`,
        cut: cutSpec,
        quantity,
        unitPrice,
        yieldPerSheet,
        stockUnits,
        notes: draft.notes.trim(),
      };
    } else {
      const isNegotiated = draft.kind === LINE_KIND.NEGOTIATED;
      line = {
        kind: draft.kind,
        productId: parent.id,
        sku: parent.sku,
        name: parent.name,
        unit: parent.unit,
        packSize: parent.packSize,
        quantity,
        unitPrice,
        stockUnits: quantity,
        ...(isNegotiated
          ? { listPrice: Number(parent.price), reason: draft.reason.trim() }
          : {}),
      };
    }

    setItems([...items, withLineTotal(line)]);
    setDraft({ ...EMPTY_DRAFT, kind: draft.kind });
  };

  const removeAt = (index) => setItems(items.filter((_, i) => i !== index));

  return (
    <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Order Items</h3>

      {!disabled && (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {LINE_KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeKind(option.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  draft.kind === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-[#1A1A24] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#22222E]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {needsProduct && (
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass}>
                  {isCut ? 'Cut From Sheet' : 'Product'}
                </label>
                <div className="relative">
                  <select
                    value={draft.productId}
                    onChange={(e) => changeProduct(e.target.value)}
                    className={`appearance-none cursor-pointer ${inputClass}`}
                  >
                    <option value="" className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">
                      {isCut ? 'Select a cuttable sheet' : 'Select product'}
                    </option>
                    {selectableProducts.map((p) => (
                      <option key={p.id} value={p.id} className="bg-white text-zinc-900 dark:bg-[#1A1A24] dark:text-zinc-200">
                        {p.name} · {formatDimensions(p)} · {availableOf(p)} available · PHP {Number(p.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={16} />
                </div>
                {isCut && selectableProducts.length === 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    No sheets are marked "can be cut to size" yet — set that on a sheet in Inventory first.
                  </p>
                )}
              </div>
            )}

            {isCustom && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>What is being made</label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder='e.g., Foam letters "HAPPY BIRTHDAY" — 12in, 2in thick'
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>Details</label>
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder="Finish, colour, deadline…"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {isCut && (
              <>
                <div className="space-y-2">
                  <label className={labelClass}>Cut Length (ft)</label>
                  <input type="number" step="0.25" min="0" value={draft.cutLengthFt}
                    onChange={(e) => set({ cutLengthFt: e.target.value })}
                    placeholder="1.5" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Cut Width (ft)</label>
                  <input type="number" step="0.25" min="0" value={draft.cutWidthFt}
                    onChange={(e) => set({ cutWidthFt: e.target.value })}
                    placeholder="2" className={inputClass} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>Sheets Consumed</label>
                  <input type="number" min="1" value={draft.stockUnits}
                    onChange={(e) => set({ stockUnits: e.target.value })}
                    placeholder={suggestedSheets ? String(suggestedSheets) : '—'}
                    className={inputClass} />
                  {parent && cutSpec.lengthFt && cutSpec.widthFt && (
                    <p className={`text-xs ${yieldPerSheet ? 'text-zinc-500 dark:text-zinc-500' : 'text-orange-600 dark:text-orange-400'}`}>
                      {yieldPerSheet
                        ? `${yieldPerSheet} piece${yieldPerSheet === 1 ? '' : 's'} per sheet, so ${suggestedSheets} sheet${suggestedSheets === 1 ? '' : 's'} for ${draft.quantity || 0}. Override if you can nest them tighter.`
                        : `That cut doesn't fit a ${formatDimensions(parent)} sheet.`}
                    </p>
                  )}
                </div>
              </>
            )}

            {draft.kind === LINE_KIND.NEGOTIATED && (
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass}>Reason</label>
                <input type="text" value={draft.reason}
                  onChange={(e) => set({ reason: e.target.value })}
                  placeholder="e.g., Bulk order — 500 pcs, regular account"
                  className={inputClass} />
                {parent && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Catalog price is PHP {Number(parent.price).toFixed(2)}.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className={labelClass}>Quantity</label>
              <input type="number" min="1" value={draft.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
                className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>
                {isCut || isCustom ? 'Quoted Price Each' : 'Unit Price'}
              </label>
              <input type="number" step="0.01" min="0" value={draft.unitPrice}
                onChange={(e) => set({ unitPrice: e.target.value })}
                placeholder="0.00" className={inputClass} />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button type="button" onClick={handleAdd}
            className="mt-4 w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
            Add Item
          </button>
        </>
      )}

      {disabled && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Items can't be changed once an order is completed or cancelled — its stock has
          already been settled. Move it back to Pending first.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-8 border-t border-zinc-100 dark:border-[#1F1F2E] pt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="pb-3">Item</th>
                <th className="pb-3">Kind</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Qty</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3 text-right">Subtotal</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-[#1F1F2E]">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="py-4 font-medium text-zinc-900 dark:text-zinc-200">
                    {item.name}
                    {item.notes && <span className="block text-xs text-zinc-500">{item.notes}</span>}
                    {item.description && <span className="block text-xs text-zinc-500">{item.description}</span>}
                    {item.reason && <span className="block text-xs text-zinc-500">{item.reason}</span>}
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${KIND_BADGE[item.kind] || KIND_BADGE[LINE_KIND.CATALOG]}`}>
                      {kindLabel(item.kind)}
                    </span>
                  </td>
                  <td className="py-4 text-zinc-500">
                    PHP {Number(item.unitPrice).toFixed(2)}
                    {item.listPrice && item.listPrice !== item.unitPrice && (
                      <span className="block text-xs text-zinc-400 line-through">
                        PHP {Number(item.listPrice).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="py-4 text-zinc-500">{item.quantity}</td>
                  <td className="py-4 text-zinc-500">
                    {item.stockUnits > 0 ? item.stockUnits : '—'}
                  </td>
                  <td className="py-4 text-right font-semibold text-zinc-900 dark:text-zinc-200">
                    PHP {Number(item.lineTotal).toFixed(2)}
                  </td>
                  <td className="py-4 text-right">
                    {!disabled && (
                      <button type="button" onClick={() => removeAt(index)}
                        className="text-zinc-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
