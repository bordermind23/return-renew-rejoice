// 图片压缩工具函数

export interface CompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  mimeType: 'image/jpeg' | 'image/webp';
}

// 默认压缩配置（更激进压缩）
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.6,
  mimeType: 'image/jpeg',
};

// 高压缩配置（适用于缩略图等）
export const HIGH_COMPRESSION_CONFIG: CompressionConfig = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.5,
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
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 如果无法创建 canvas context，返回原始文件
    if (!ctx) {
      console.warn('无法创建 canvas context，使用原始文件');
      URL.revokeObjectURL(objectUrl);
      resolve(file instanceof Blob ? file : new Blob([file]));
      return;
    }

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      try {
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
            cleanup();
            
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
              // canvas.toBlob 返回 null 时，回退到原始文件
              console.warn('canvas.toBlob 返回 null，使用原始文件');
              resolve(file instanceof Blob ? file : new Blob([file]));
            }
          },
          config.mimeType,
          config.quality
        );
      } catch (error) {
        console.warn('图片压缩过程出错，使用原始文件:', error);
        cleanup();
        resolve(file instanceof Blob ? file : new Blob([file]));
      }
    };
    
    img.onerror = () => {
      console.warn('图片加载失败，使用原始文件');
      cleanup();
      resolve(file instanceof Blob ? file : new Blob([file]));
    };
    
    img.src = objectUrl;
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
  try {
    // 将 base64 转换为 Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return compressImage(blob, config);
  } catch (error) {
    console.warn('从 DataUrl 压缩图片失败:', error);
    // 尝试直接从 base64 创建 Blob
    try {
      const base64Data = dataUrl.split(',')[1];
      const mimeType = dataUrl.split(':')[1]?.split(';')[0] || 'image/jpeg';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (fallbackError) {
      console.warn('回退方案也失败，返回空 Blob:', fallbackError);
      return new Blob([], { type: 'image/jpeg' });
    }
  }
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
