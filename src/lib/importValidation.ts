import { z } from 'zod';
import { sanitizeString, parseQuantity, MAX_FIELD_LENGTHS } from './errorHandler';

/**
 * Maximum number of rows allowed in an import file
 */
export const MAX_IMPORT_ROWS = 10000;

/**
 * Zod schema for Order import validation
 */
export const OrderImportSchema = z.object({
  lpn: z.string()
    .min(1, 'LPN编号不能为空')
    .max(MAX_FIELD_LENGTHS.lpn, `LPN编号不能超过${MAX_FIELD_LENGTHS.lpn}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.lpn) || ''),
  
  product_name: z.string()
    .max(MAX_FIELD_LENGTHS.product_name)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.product_name)),
  
  buyer_note: z.string()
    .max(MAX_FIELD_LENGTHS.buyer_note)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.buyer_note)),
  
  return_reason: z.string()
    .max(MAX_FIELD_LENGTHS.return_reason)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.return_reason)),
  
  inventory_attribute: z.string()
    .max(MAX_FIELD_LENGTHS.inventory_attribute)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.inventory_attribute)),
  
  store_name: z.string()
    .min(1, '店铺名称不能为空')
    .max(MAX_FIELD_LENGTHS.store_name, `店铺名称不能超过${MAX_FIELD_LENGTHS.store_name}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.store_name) || ''),
  
  country: z.string()
    .max(MAX_FIELD_LENGTHS.country)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.country)),
  
  product_sku: z.string()
    .max(MAX_FIELD_LENGTHS.product_sku)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.product_sku)),
  
  order_number: z.string()
    .min(1, '订单号不能为空')
    .max(MAX_FIELD_LENGTHS.order_number, `订单号不能超过${MAX_FIELD_LENGTHS.order_number}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.order_number) || ''),
  
  msku: z.string()
    .max(MAX_FIELD_LENGTHS.msku)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.msku)),
  
  asin: z.string()
    .max(MAX_FIELD_LENGTHS.asin)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.asin)),
  
  fnsku: z.string()
    .max(MAX_FIELD_LENGTHS.fnsku)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.fnsku)),
  
  return_quantity: z.preprocess(
    (val) => parseQuantity(val as string | number | undefined, 1, 1, 10000),
    z.number().int().min(1).max(10000)
  ),
  
  warehouse_location: z.string()
    .max(MAX_FIELD_LENGTHS.warehouse_location)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.warehouse_location)),
  
  return_time: z.string().optional().nullable(),
  order_time: z.string().optional().nullable(),
});

export type ValidatedOrderImport = z.infer<typeof OrderImportSchema>;

/**
 * Validate a single order import row
 */
export const validateOrderRow = (
  row: string[], 
  rowIndex: number
): { valid: true; data: ValidatedOrderImport } | { valid: false; error: string } => {
  try {
    const data = OrderImportSchema.parse({
      lpn: row[0]?.trim(),
      product_name: row[1]?.trim() || null,
      buyer_note: row[2]?.trim() || null,
      return_reason: row[3]?.trim() || null,
      inventory_attribute: row[4]?.trim() || null,
      store_name: row[5]?.trim(),
      country: row[6]?.trim() || null,
      product_sku: row[7]?.trim() || null,
      order_number: row[8]?.trim(),
      msku: row[9]?.trim() || null,
      asin: row[10]?.trim() || null,
      fnsku: row[11]?.trim() || null,
      return_quantity: row[12]?.trim() || 1,
      warehouse_location: row[13]?.trim() || null,
      return_time: row[14]?.trim() || null,
      order_time: row[15]?.trim() || null,
    });
    
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join('; ');
      return { valid: false, error: `第${rowIndex}行：${messages}` };
    }
    return { valid: false, error: `第${rowIndex}行：数据格式错误` };
  }
};

/**
 * Zod schema for Removal Shipment import validation
 */
export const RemovalShipmentImportSchema = z.object({
  order_id: z.string()
    .min(1, '移除订单号不能为空')
    .max(MAX_FIELD_LENGTHS.removal_order_id, `移除订单号不能超过${MAX_FIELD_LENGTHS.removal_order_id}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.removal_order_id) || ''),
  
  store_name: z.string()
    .max(MAX_FIELD_LENGTHS.store_name)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.store_name)),
  
  country: z.string()
    .max(MAX_FIELD_LENGTHS.country)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.country)),
  
  product_sku: z.string()
    .max(MAX_FIELD_LENGTHS.product_sku)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.product_sku)),
  
  msku: z.string()
    .max(MAX_FIELD_LENGTHS.msku)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.msku)),
  
  product_name: z.string()
    .max(MAX_FIELD_LENGTHS.product_name)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.product_name)),
  
  product_type: z.string()
    .max(255)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, 255)),
  
  fnsku: z.string()
    .min(1, 'FNSKU不能为空')
    .max(MAX_FIELD_LENGTHS.fnsku, `FNSKU不能超过${MAX_FIELD_LENGTHS.fnsku}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.fnsku) || ''),
  
  quantity: z.preprocess(
    (val) => parseQuantity(val as string | number | undefined, 1, 1, 10000),
    z.number().int().min(1, '退件数量必须大于0').max(10000, '退件数量不能超过10000')
  ),
  
  carrier: z.string()
    .min(1, '物流承运商不能为空')
    .max(MAX_FIELD_LENGTHS.carrier, `物流承运商不能超过${MAX_FIELD_LENGTHS.carrier}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.carrier) || ''),
  
  tracking_number: z.string()
    .min(1, '物流跟踪号不能为空')
    .max(MAX_FIELD_LENGTHS.tracking_number, `物流跟踪号不能超过${MAX_FIELD_LENGTHS.tracking_number}个字符`)
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.tracking_number) || ''),
  
  ship_date: z.string().optional().nullable(),
  
  status: z.enum(['未到货', '入库'])
    .default('未到货'),
  
  note: z.string()
    .max(MAX_FIELD_LENGTHS.note)
    .optional()
    .nullable()
    .transform(val => sanitizeString(val, MAX_FIELD_LENGTHS.note)),
});

export type ValidatedRemovalShipmentImport = z.infer<typeof RemovalShipmentImportSchema>;

/**
 * Validate a single removal shipment import row
 */
export const validateRemovalShipmentRow = (
  row: string[], 
  rowIndex: number
): { valid: true; data: ValidatedRemovalShipmentImport } | { valid: false; error: string } => {
  try {
    const statusValue = (row[12] || '未到货');
    const validStatuses = ['未到货', '入库'];
    
    const data = RemovalShipmentImportSchema.parse({
      order_id: row[0]?.trim(),
      store_name: row[1]?.trim() || null,
      country: row[2]?.trim() || null,
      product_sku: row[3]?.trim() || null,
      msku: row[4]?.trim() || null,
      product_name: row[5]?.trim() || null,
      product_type: row[6]?.trim() || null,
      fnsku: row[7]?.trim(),
      quantity: row[8]?.trim() || 1,
      carrier: row[9]?.trim(),
      tracking_number: row[10]?.trim(),
      ship_date: row[11]?.trim() || null,
      status: validStatuses.includes(statusValue) ? statusValue as '未到货' | '入库' : '未到货',
      note: row[13]?.trim() || null,
    });
    
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join('; ');
      return { valid: false, error: `第${rowIndex}行：${messages}` };
    }
    return { valid: false, error: `第${rowIndex}行：数据格式错误` };
  }
};
