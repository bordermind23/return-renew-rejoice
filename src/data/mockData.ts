// Mock data for the refurbishment system

export interface RemovalShipment {
  id: string;
  orderId: string;
  note: string;
  carrier: string;
  trackingNumber: string;
  productSku: string;
  productName: string;
  productImage?: string;
  fnsku: string;
  quantity: number;
  status: "shipping" | "arrived" | "inbound" | "shelved";
  createdAt: string;
}

export interface InboundItem {
  id: string;
  lpn: string;
  removalOrderId: string;
  productSku: string;
  productName: string;
  returnReason: string;
  grade: "A" | "B" | "C" | "new";
  packagePhoto?: string;
  productPhoto?: string;
  missingParts?: string[];
  processedAt: string;
  processedBy: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  productCategory: string;
  warehouse: string;
  totalStock: number;
  newStock: number;
  gradeAStock: number;
  gradeBStock: number;
  gradeCStock: number;
  productImage?: string;
}

export interface OrderItem {
  id: string;
  lpn: string;
  removalOrderId: string;
  orderNumber: string;
  storeName: string;
  station: string;
  removedAt: string;
  inboundAt: string;
}

export const mockRemovalShipments: RemovalShipment[] = [
  {
    id: "1",
    orderId: "RM-2024-001",
    note: "客户退货-尺寸不合适",
    carrier: "顺丰速运",
    trackingNumber: "SF1234567890",
    productSku: "SKU-001",
    productName: "运动蓝牙耳机",
    fnsku: "X001ABC123",
    quantity: 5,
    status: "arrived",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    orderId: "RM-2024-002",
    note: "仓库移除",
    carrier: "京东物流",
    trackingNumber: "JD9876543210",
    productSku: "SKU-002",
    productName: "智能手表",
    fnsku: "X002DEF456",
    quantity: 3,
    status: "shipping",
    createdAt: "2024-01-16",
  },
  {
    id: "3",
    orderId: "RM-2024-003",
    note: "产品质量问题",
    carrier: "圆通快递",
    trackingNumber: "YT1122334455",
    productSku: "SKU-003",
    productName: "无线充电器",
    fnsku: "X003GHI789",
    quantity: 10,
    status: "inbound",
    createdAt: "2024-01-17",
  },
  {
    id: "4",
    orderId: "RM-2024-004",
    note: "包装破损",
    carrier: "中通快递",
    trackingNumber: "ZT5566778899",
    productSku: "SKU-004",
    productName: "便携式音箱",
    fnsku: "X004JKL012",
    quantity: 8,
    status: "shelved",
    createdAt: "2024-01-18",
  },
];

export const mockInboundItems: InboundItem[] = [
  {
    id: "1",
    lpn: "LPN-001-A",
    removalOrderId: "RM-2024-001",
    productSku: "SKU-001",
    productName: "运动蓝牙耳机",
    returnReason: "尺寸不合适",
    grade: "A",
    missingParts: [],
    processedAt: "2024-01-16 10:30",
    processedBy: "张三",
  },
  {
    id: "2",
    lpn: "LPN-001-B",
    removalOrderId: "RM-2024-001",
    productSku: "SKU-001",
    productName: "运动蓝牙耳机",
    returnReason: "尺寸不合适",
    grade: "B",
    missingParts: ["耳塞套"],
    processedAt: "2024-01-16 10:35",
    processedBy: "张三",
  },
  {
    id: "3",
    lpn: "LPN-003-A",
    removalOrderId: "RM-2024-003",
    productSku: "SKU-003",
    productName: "无线充电器",
    returnReason: "产品质量问题",
    grade: "C",
    missingParts: ["充电线", "说明书"],
    processedAt: "2024-01-18 14:20",
    processedBy: "李四",
  },
];

export const mockInventory: InventoryItem[] = [
  {
    id: "1",
    sku: "SKU-001",
    productName: "运动蓝牙耳机",
    productCategory: "电子产品",
    warehouse: "华东仓",
    totalStock: 150,
    newStock: 80,
    gradeAStock: 45,
    gradeBStock: 20,
    gradeCStock: 5,
  },
  {
    id: "2",
    sku: "SKU-002",
    productName: "智能手表",
    productCategory: "电子产品",
    warehouse: "华东仓",
    totalStock: 88,
    newStock: 50,
    gradeAStock: 25,
    gradeBStock: 10,
    gradeCStock: 3,
  },
  {
    id: "3",
    sku: "SKU-003",
    productName: "无线充电器",
    productCategory: "配件",
    warehouse: "华南仓",
    totalStock: 200,
    newStock: 120,
    gradeAStock: 50,
    gradeBStock: 22,
    gradeCStock: 8,
  },
  {
    id: "4",
    sku: "SKU-004",
    productName: "便携式音箱",
    productCategory: "电子产品",
    warehouse: "华东仓",
    totalStock: 65,
    newStock: 30,
    gradeAStock: 20,
    gradeBStock: 10,
    gradeCStock: 5,
  },
];

export const mockOrders: OrderItem[] = [
  {
    id: "1",
    lpn: "LPN-001-A",
    removalOrderId: "RM-2024-001",
    orderNumber: "ORD-2024-0001",
    storeName: "品牌旗舰店",
    station: "FBA-US",
    removedAt: "2024-01-15",
    inboundAt: "2024-01-16",
  },
  {
    id: "2",
    lpn: "LPN-001-B",
    removalOrderId: "RM-2024-001",
    orderNumber: "ORD-2024-0002",
    storeName: "品牌旗舰店",
    station: "FBA-US",
    removedAt: "2024-01-15",
    inboundAt: "2024-01-16",
  },
  {
    id: "3",
    lpn: "LPN-003-A",
    removalOrderId: "RM-2024-003",
    orderNumber: "ORD-2024-0003",
    storeName: "电子专营店",
    station: "FBA-EU",
    removedAt: "2024-01-17",
    inboundAt: "2024-01-18",
  },
];
