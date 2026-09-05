import { Box, Circle, Shapes, Square } from "../icons";
import { PRODUCT_TYPE } from "../../utils/constants";

/**
 * A shape icon per product kind.
 *
 * A ball gets a circle, a sheet a square, a block a cube. It is almost
 * embarrassingly literal and that is the point: the products list is scanned
 * for a kind before it is read for a name, and a row of forty identical
 * package icons cannot be scanned at all.
 *
 * The same glyph appears on the kind choice buttons on the add-a-product form,
 * so the button somebody pressed and the row that appears afterwards are
 * recognisably the same thing.
 */
const BY_TYPE = {
  [PRODUCT_TYPE.BALL]: Circle,
  [PRODUCT_TYPE.SHEET]: Square,
  [PRODUCT_TYPE.BLOCK]: Box,
  [PRODUCT_TYPE.OTHER]: Shapes,
};

export function productIcon(productType, className = "h-5 w-5") {
  const Icon = BY_TYPE[productType] ?? Shapes;
  return <Icon className={className} />;
}

/** The same map, sized for the form's choice buttons. */
export function productChoiceIcon(productType) {
  return productIcon(productType, "h-5 w-5");
}
