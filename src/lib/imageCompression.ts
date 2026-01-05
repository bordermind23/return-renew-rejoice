// 图片压缩工具函数

export interface CompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  mimeType: 'image/jpeg' | 'image/webp';
}

// 默认压缩配置
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

// 高压缩配置（适用于缩略图等）
export const HIGH_COMPRESSION_CONFIG: CompressionConfig = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.7,
  mimeType: 'image/jpeg',
};

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param config 压缩配置
 * @returns 压缩后的 Blob
 */
export async function compressImage(
  file: File | Blob,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('无法创建 canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;
      
      // 计算缩放比例，保持宽高比
      const scale = Math.min(
        config.maxWidth / width,
        config.maxHeight / height,
        1 // 不放大小图片
      );
      
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      
      canvas.width = width;
      canvas.height = height;
      
      // 设置白色背景（对于透明PNG转JPEG）
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height);
      
      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalSize = file.size;
            const compressedSize = blob.size;
            const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            
            console.log(
              `图片压缩: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} ` +
              `(节省 ${compressionRatio}%, 尺寸 ${img.width}x${img.height} → ${width}x${height})`
            );
            
            resolve(blob);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        config.mimeType,
        config.quality
      );
      
      // 释放内存
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('图片加载失败'));
    };
    
    // 从 File 或 Blob 创建 URL
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 从 Base64 数据压缩图片
 * @param dataUrl Base64 图片数据
 * @param config 压缩配置
 * @returns 压缩后的 Blob
 */
export async function compressImageFromDataUrl(
  dataUrl: string,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG
): Promise<Blob> {
  // 将 base64 转换为 Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return compressImage(blob, config);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 检查文件是否是图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 获取图片尺寸
 */
export async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('无法读取图片尺寸'));
    };
    img.src = URL.createObjectURL(file);
  });
}
