import { Box, Package } from "../icons";
import {
  DetailBackLink,
  DetailCard,
  DetailField,
  DetailHeaderCard,
} from "../shared/ProfileDetail";
import { ProfileNotFound } from "../shared/ProfilePanels";
import StatusPill from "../shared/StatusPill";
import { formatPeso } from "../../utils/profileFormat";
import {
  formatDimensions,
  formatProductType,
  formatUnit,
} from "../../utils/productFormat";
import { stockForProduct } from "../../utils/productStock";

/**
 * LSB Handicrafts — Product / Item Details
 * Figma: Screen #18, nodes 174:3021 (record), 174:3247 (record not found)
 */
export default function ProductDetailPage({
  product,
  inventory = [],
  onBack,
  onEdit,
}) {
  // Read-only: this screen reports stock, the inventory workspace owns it.
  const stock = product ? stockForProduct(product, inventory) : { tracked: false };
  return (
    <div className="mx-auto w-full max-w-[860px]">
      {!product ? (
        <ProfileNotFound label="Product" onBack={onBack} />
      ) : (
        <>
          <DetailBackLink label="Product / Item Profiles" onClick={onBack} />

          <DetailHeaderCard
            badge={
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#17263a] text-white">
                <Package className="h-6 w-6" />
              </span>
            }
            eyebrow="Product Profile"
            title={product.name}
            meta={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  Item Code:{" "}
                  <span className="font-semibold text-[#17263a]">
                    {product.itemCode}
                  </span>
                </span>
                <span className="text-[#5f6875]/50">·</span>
                <StatusPill status={product.status} />
              </span>
            }
            editLabel="Edit Product"
            onEdit={() => onEdit(product.id)}
            backLabel="Back to Product List"
            onBack={onBack}
          />

          <DetailCard
            className="mt-5"
            icon={<Box className="h-4 w-4" />}
            title="Product Information"
          >
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailField label="Item Code">{product.itemCode}</DetailField>
              <DetailField label="Product Name">{product.name}</DetailField>
              <DetailField label="Product Type">
                {formatProductType(product.productType)}
              </DetailField>
              <DetailField label="Size">{formatDimensions(product)}</DetailField>
              <DetailField label="Unit Price">
                {formatPeso(product.unitPrice)}
              </DetailField>
              <DetailField label="Sold">{formatUnit(product)}</DetailField>
              <DetailField label="Low-Stock Threshold">
                {product.lowStockThreshold ?? "—"} units
              </DetailField>
              <DetailField label="Status">
                <StatusPill status={product.status} />
              </DetailField>
            </div>
          </DetailCard>

          <DetailCard
            className="mt-5"
            icon={<Package className="h-4 w-4" />}
            title="Stock on Hand"
          >
            {!stock.tracked ? (
              <p className="text-[13px] text-[#5f6875]">
                This product has no matching inventory record, so its stock
                isn&rsquo;t being tracked. Stock is kept against the item code{" "}
                <span className="font-semibold text-[#17263a]">
                  {product.itemCode}
                </span>{" "}
                in the inventory workspace.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <DetailField label="Available">
                    <span
                      className={`text-[15px] font-bold ${
                        stock.isOut
                          ? "text-[#b54747]"
                          : stock.isLow
                            ? "text-[#8a5600]"
                            : "text-[#17263a]"
                      }`}
                    >
                      {stock.available}
                    </span>
                  </DetailField>
                  <DetailField label="On Hand">{stock.onHand}</DetailField>
                  <DetailField label="Reserved">
                    {stock.reserved}
                    {stock.reserved > 0 && (
                      <span className="block text-[11.5px] text-[#5f6875]">
                        Promised to pending orders
                      </span>
                    )}
                  </DetailField>
                </div>
                <p className="mt-4 text-[12.5px] text-[#5f6875]">
                  Counted {formatUnit({ unit: stock.unit, packSize: stock.packSize })}.
                  {stock.isOut
                    ? " Nothing available to sell."
                    : stock.isLow
                      ? ` At or below the ${stock.threshold} low-stock threshold.`
                      : ` Threshold is ${stock.threshold}.`}
                </p>
              </>
            )}
          </DetailCard>
        </>
      )}
    </div>
  );
}
