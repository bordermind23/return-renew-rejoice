import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LingxingTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

interface LingxingApiResponse {
  code: number;
  msg: string;
  data?: any;
  total?: number;
}

// Get access token from Lingxing
async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  console.log('Getting Lingxing access token...');
  
  const response = await fetch('https://openapi.lingxing.com/api/auth-server/oauth/access-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      appId: appId,
      appSecret: appSecret,
    }),
  });

  const result: LingxingTokenResponse = await response.json();
  console.log('Token response code:', result.code);

  if (result.code !== 0 || !result.data?.access_token) {
    throw new Error(`Failed to get access token: ${result.msg}`);
  }

  return result.data.access_token;
}

// Call Lingxing API with token
async function callLingxingApi(
  endpoint: string, 
  token: string, 
  params: Record<string, any> = {}
): Promise<LingxingApiResponse> {
  const timestamp = Math.floor(Date.now() / 1000);
  
  const url = `https://openapi.lingxing.com${endpoint}`;
  console.log(`Calling Lingxing API: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-AK-Request-Timestamp': timestamp.toString(),
    },
    body: JSON.stringify({
      ...params,
      timestamp,
    }),
  });

  const result: LingxingApiResponse = await response.json();
  console.log(`API response code: ${result.code}, msg: ${result.msg}`);
  
  return result;
}

// Sync removal shipments from Lingxing
async function syncRemovalShipments(
  token: string, 
  supabase: any,
  startDate?: string,
  endDate?: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.log('Starting removal shipments sync...');
  
  const result = { success: 0, failed: 0, errors: [] as string[] };
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  // Default date range: last 30 days
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  while (hasMore) {
    try {
      // Call Lingxing FBA removal order API
      const response = await callLingxingApi('/erp/sc/routing/fbaReport/removeOrderList', token, {
        start_date: start,
        end_date: end,
        offset,
        length: limit,
      });

      if (response.code !== 0) {
        result.errors.push(`API error: ${response.msg}`);
        break;
      }

      const items = response.data?.list || response.data || [];
      console.log(`Fetched ${items.length} removal shipments at offset ${offset}`);

      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        continue;
      }

      // Process each item
      for (const item of items) {
        try {
          const shipmentData = {
            order_id: item.order_id || item.removal_order_id || `LX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tracking_number: item.tracking_number || item.tracking_id || '',
            carrier: item.carrier || item.carrier_name || '未知',
            product_sku: item.sku || item.seller_sku || '',
            product_name: item.product_name || item.title || '',
            fnsku: item.fnsku || '',
            msku: item.msku || item.sku || '',
            quantity: parseInt(item.quantity) || 1,
            status: mapRemovalStatus(item.status || item.order_status),
            store_name: item.store_name || item.sid_name || '',
            country: item.country || item.marketplace || '',
            ship_date: item.ship_date || item.shipped_date || null,
            product_type: item.product_type || item.removal_type || '',
            note: item.note || item.remark || '',
          };

          // Upsert to avoid duplicates
          const { error } = await supabase
            .from('removal_shipments')
            .upsert(shipmentData, { 
              onConflict: 'order_id',
              ignoreDuplicates: false 
            });

          if (error) {
            console.error('Insert error:', error);
            result.failed++;
            result.errors.push(`Failed to insert ${shipmentData.order_id}: ${error.message}`);
          } else {
            result.success++;
          }
        } catch (itemError: unknown) {
          result.failed++;
          const errMsg = itemError instanceof Error ? itemError.message : String(itemError);
          result.errors.push(`Item processing error: ${errMsg}`);
        }
      }

      offset += limit;
      hasMore = items.length === limit;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fetch error: ${errMsg}`);
      hasMore = false;
    }
  }

  console.log(`Removal shipments sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

// Sync return orders from Lingxing
async function syncReturnOrders(
  token: string, 
  supabase: any,
  startDate?: string,
  endDate?: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.log('Starting return orders sync...');
  
  const result = { success: 0, failed: 0, errors: [] as string[] };
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  // Default date range: last 30 days
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  while (hasMore) {
    try {
      // Call Lingxing return order API
      const response = await callLingxingApi('/erp/sc/routing/fbaReport/returnOrderList', token, {
        start_date: start,
        end_date: end,
        offset,
        length: limit,
      });

      if (response.code !== 0) {
        result.errors.push(`API error: ${response.msg}`);
        break;
      }

      const items = response.data?.list || response.data || [];
      console.log(`Fetched ${items.length} return orders at offset ${offset}`);

      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        continue;
      }

      // Process each item
      for (const item of items) {
        try {
          const orderData = {
            lpn: item.lpn || item.license_plate_number || `LPN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            removal_order_id: item.removal_order_id || item.order_id || '',
            order_number: item.order_number || item.amazon_order_id || '',
            product_sku: item.sku || item.seller_sku || '',
            product_name: item.product_name || item.title || '',
            store_name: item.store_name || item.sid_name || '',
            station: item.station || item.marketplace || '',
            country: item.country || '',
            asin: item.asin || '',
            fnsku: item.fnsku || '',
            msku: item.msku || item.sku || '',
            return_reason: item.return_reason || item.reason || '',
            return_quantity: parseInt(item.quantity) || 1,
            return_time: item.return_date || item.return_time || null,
            order_time: item.order_date || item.order_time || null,
            buyer_note: item.buyer_note || item.buyer_comment || '',
            inventory_attribute: item.inventory_disposition || item.disposition || '',
          };

          // Upsert to avoid duplicates
          const { error } = await supabase
            .from('orders')
            .upsert(orderData, { 
              onConflict: 'lpn',
              ignoreDuplicates: false 
            });

          if (error) {
            console.error('Insert error:', error);
            result.failed++;
            result.errors.push(`Failed to insert ${orderData.lpn}: ${error.message}`);
          } else {
            result.success++;
          }
        } catch (itemError: unknown) {
          result.failed++;
          const errMsg = itemError instanceof Error ? itemError.message : String(itemError);
          result.errors.push(`Item processing error: ${errMsg}`);
        }
      }

      offset += limit;
      hasMore = items.length === limit;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Fetch error: ${errMsg}`);
      hasMore = false;
    }
  }

  console.log(`Return orders sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

// Map Lingxing status to local status
function mapRemovalStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Pending': 'pending',
    'Planning': 'planning',
    'Processing': 'processing',
    'Shipped': 'shipping',
    'Completed': 'completed',
    'Cancelled': 'cancelled',
  };
  return statusMap[status] || status?.toLowerCase() || 'shipping';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('LINGXING_APP_ID');
    const appSecret = Deno.env.get('LINGXING_APP_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!appId || !appSecret) {
      throw new Error('Lingxing API credentials not configured');
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { 
      syncType = 'all', // 'all', 'removals', 'orders'
      startDate,
      endDate 
    } = body;

    console.log(`Starting sync: type=${syncType}, startDate=${startDate}, endDate=${endDate}`);

    // Get access token
    const token = await getAccessToken(appId, appSecret);
    console.log('Successfully obtained access token');

    const results: Record<string, any> = {};

    // Sync removal shipments
    if (syncType === 'all' || syncType === 'removals') {
      results.removalShipments = await syncRemovalShipments(token, supabase, startDate, endDate);
    }

    // Sync return orders
    if (syncType === 'all' || syncType === 'orders') {
      results.returnOrders = await syncReturnOrders(token, supabase, startDate, endDate);
    }

    console.log('Sync completed:', JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
