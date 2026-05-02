import { createHttpError } from "../middleware/error.middleware.js";

/**
 * @param {string} sortBy
 * @param {string} sortOrder
 * @param {Record<string, string>} columnBySortKey allowed sort field -> SQL identifier (validated)
 */
export function buildOrderBySql(sortBy, sortOrder, columnBySortKey) {
  const col = columnBySortKey[sortBy];
  if (!col) throw createHttpError(400, "Invalid sort field", "VALIDATION_ERROR");
  const dir = String(sortOrder).toLowerCase() === "desc" ? "DESC" : "ASC";
  return `order by ${col} ${dir}`;
}
