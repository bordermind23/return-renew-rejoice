/**
 * Error handler utility to map database errors to safe user-friendly messages
 * This prevents exposing sensitive database schema information to end users
 */

export const mapDatabaseError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  
  // Log full error for debugging (server-side or development only)
  if (process.env.NODE_ENV === 'development') {
    console.error('[Database Error]', {
      message,
      error,
    });
  }
  
  // Return safe user-friendly messages based on error patterns
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return '该记录已存在，请检查唯一字段';
  }
  
  if (message.includes('foreign key')) {
    return '无法执行操作，该记录被其他数据引用';
  }
  
  if (message.includes('invalid input syntax')) {
    return '数据格式不正确，请检查输入';
  }
  
  if (message.includes('violates check constraint')) {
    return '数据不符合业务规则，请检查输入';
  }
  
  if (message.includes('row-level security') || message.includes('RLS')) {
    return '您没有权限执行此操作';
  }
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return '请求的数据不存在';
  }
  
  if (message.includes('timeout') || message.includes('connection')) {
    return '网络连接超时，请稍后重试';
  }
  
  if (message.includes('null value') || message.includes('not-null constraint')) {
    return '必填字段不能为空';
  }
  
  if (message.includes('authentication') || message.includes('unauthorized')) {
    return '请先登录后再操作';
  }
  
  // Generic fallback - don't expose actual error message
  return '操作失败，请稍后重试或联系管理员';
};

/**
 * Sanitize a string for safe database insertion
 * Removes potentially harmful characters and enforces length limits
 */
export const sanitizeString = (
  str: string | null | undefined, 
  maxLength: number = 500
): string | null => {
  if (!str) return null;
  
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
    .slice(0, maxLength);
};

/**
 * Validate and parse a quantity value
 */
export const parseQuantity = (
  value: string | number | undefined,
  defaultValue: number = 1,
  min: number = 1,
  max: number = 10000
): number => {
  const num = parseInt(String(value));
  
  if (isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  
  return num;
};

/**
 * Maximum field lengths for database columns
 */
export const MAX_FIELD_LENGTHS = {
  lpn: 255,
  product_name: 500,
  product_sku: 255,
  order_number: 255,
  store_name: 255,
  buyer_note: 1000,
  return_reason: 500,
  tracking_number: 255,
  note: 1000,
  country: 100,
  carrier: 255,
  msku: 255,
  asin: 255,
  fnsku: 255,
  removal_order_id: 255,
  station: 255,
  warehouse_location: 255,
  inventory_attribute: 255,
} as const;
