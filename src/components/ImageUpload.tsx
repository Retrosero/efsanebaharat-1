import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Link, Smartphone, Clipboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
  maxFiles?: number; // Maksimum dosya sayısı (default: 1)
  bucketName: string; // Supabase storage bucket adı
  onUploadComplete: (urls: string[]) => void; // Upload tamamlandığında çağrılacak callback
  existingImages?: string[]; // Mevcut görseller (düzenleme modunda)
  accept?: string; // Kabul edilecek dosya tipleri
  maxSizeMB?: number; // Maksimum dosya boyutu (MB)
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  maxFiles = 1,
  bucketName,
  onUploadComplete,
  existingImages = [],
  accept = 'image/*',
  maxSizeMB = 8
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'device' | 'url'>('device');
  const [urlInput, setUrlInput] = useState('');
  const [addingFromUrl, setAddingFromUrl] = useState(false);

  // Mevcut görseller yüklendiğinde previewUrls'i güncelle
  React.useEffect(() => {
    if (existingImages.length > 0) {
      setPreviewUrls(existingImages);
    }
  }, [existingImages]);

  // Clipboard'dan yapıştırma
  const handlePaste = async () => {
    try {
      // Clipboard API'sini dene
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setUrlInput(text.trim())
          toast.success('URL clipboard\'dan başarıyla yapıştırıldı')
          return
        }
      }
      
      // Alternatif: Input'u seç ve kullanıcının manuel yapıştırmasını bekle
      const inputElement = document.querySelector('input[type="url"]') as HTMLInputElement
      if (inputElement) {
        inputElement.focus()
        inputElement.select()
        toast('Input alanı seçildi, URL\'yi yapıştırmak için Ctrl+V tuşlarına basın', { icon: 'ℹ️' })
      }
    } catch (error) {
      toast.error('Clipboard erişimi başarısız. URL\'yi manuel olarak girin.')
    }
  };

  // Dosya seçimi
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  // Dosya ekleme
  const addFiles = (files: File[]) => {
    // Dosya sayısı kontrolü
    if (selectedFiles.length + previewUrls.length + files.length > maxFiles) {
      toast.error(`Maksimum ${maxFiles} görsel yükleyebilirsiniz`);
      return;
    }

    // Dosya boyutu kontrolü
    const invalidFiles = files.filter(file => file.size > maxSizeMB * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error(`Dosya boyutu maksimum ${maxSizeMB}MB olmalıdır`);
      return;
    }

    // Dosya tipi kontrolü
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      toast.error('Sadece görsel dosyaları yükleyebilirsiniz');
      return;
    }

    // Preview URL'leri oluştur
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  };

  // URL'den görsel yükleme
  const handleUrlAdd = async () => {
    if (!urlInput.trim()) {
      toast.error('Lütfen geçerli bir URL girin');
      return;
    }

    if (previewUrls.length >= maxFiles) {
      toast.error(`Maksimum ${maxFiles} görsel yükleyebilirsiniz`);
      return;
    }

    setAddingFromUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('image-storage-upload', {
        body: {
          imageUrl: urlInput.trim(),
          bucketName
        }
      });

      if (error || data?.error) {
        throw error || new Error(data.error.message || 'Upload hatasi');
      }

      const publicUrl = data?.data?.publicUrl;

      if (data?.success && publicUrl) {
        const nextUrls = [...previewUrls, publicUrl];
        setPreviewUrls(nextUrls);
        onUploadComplete(nextUrls);
        toast.success('Görsel başarıyla yüklendi');
        setUrlInput('');
      } else {
        throw new Error('Upload basarisiz: Gecersiz response');
      }

    } catch (error: any) {
      console.error('URL upload error:', error);
      toast.error(error.message || 'Görsel yüklenirken hata oluştu');
    } finally {
      setAddingFromUrl(false);
    }
  };

  // Görsel silme
  const removeImage = (index: number) => {
    const imageToRemove = previewUrls[index];
    const nextPreviewUrls = previewUrls.filter((_, i) => i !== index);
    
    // Eğer mevcut URL ise (http/https ile başlıyor), previewUrls'den kaldır
    if (imageToRemove && (imageToRemove.startsWith('http') || imageToRemove.startsWith('blob:'))) {
      setPreviewUrls(nextPreviewUrls);
    } else {
      // Yeni eklenen dosya ise hem preview hem file'dan kaldır
      const fileIndex = index - (previewUrls.length - selectedFiles.length);
      setPreviewUrls(nextPreviewUrls);
      setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex));
    }

    onUploadComplete(nextPreviewUrls.filter(url => url.startsWith('http')));
  };

  // Upload işlemi
  const handleUpload = async () => {
    if (selectedFiles.length === 0 && !previewUrls.some(url => url.startsWith('data:') || url.startsWith('blob:'))) {
      toast.error('Lütfen en az bir görsel seçin');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const finalUrls: string[] = [];
      
      // Mevcut URL'leri koru (http/https ile başlayanlar)
      const existingUrls = previewUrls.filter(url => url.startsWith('http'));
      finalUrls.push(...existingUrls);

      // Yeni dosyaları upload et
      const filesToUpload = [...selectedFiles];
      const filesToUploadCount = filesToUpload.length;
      
      if (filesToUploadCount > 0) {
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          
          // Base64'e çevir
          const base64 = await fileToBase64(file);
          
          const { data, error } = await supabase.functions.invoke('image-storage-upload', {
            body: {
              imageData: base64,
              bucketName,
              fileName: `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}`
            }
          });

          if (error || data?.error) {
            console.error('Upload error:', error || data);
            toast.error(`${file.name} yüklenemedi`);
            continue;
          }

          const publicUrl = data?.data?.publicUrl;

          if (data?.success && publicUrl) {
            finalUrls.push(publicUrl);
            setUploadProgress(((i + 1) / filesToUploadCount) * 100);
          } else {
            console.error('Upload response error:', data);
            toast.error(`${file.name} yüklenemedi: ${data?.error?.message || 'Gecersiz response'}`);
          }
        }
      }

      toast.success(`${finalUrls.length} görsel başarıyla yüklendi`);
      onUploadComplete(finalUrls);
      
      // Seçili dosyaları temizle
      setSelectedFiles([]);
      setPreviewUrls(finalUrls);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Görseller yüklenirken hata oluştu');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('device')}
          className={`
            flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium transition-all
            ${activeTab === 'device' 
              ? 'bg-white text-orange-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <Smartphone className="w-4 h-4" />
          <span>Cihazdan Seç</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`
            flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium transition-all
            ${activeTab === 'url' 
              ? 'bg-white text-orange-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <Link className="w-4 h-4" />
          <span>Link ile Ekle</span>
        </button>
      </div>

      {/* Device Upload Tab */}
      {activeTab === 'device' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
            ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-orange-400'}
            ${previewUrls.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            onChange={handleFileSelect}
            className="hidden"
            disabled={previewUrls.length >= maxFiles}
          />
          
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            {maxFiles > 1 
              ? `Görselleri sürükleyip bırakın veya tıklayarak seçin (Maksimum ${maxFiles} adet)`
              : 'Görseli sürükleyip bırakın veya tıklayarak seçin'
            }
          </p>
          <p className="text-sm text-gray-500">
            Maksimum dosya boyutu: {maxSizeMB}MB
          </p>
        </div>
      )}

      {/* URL Upload Tab */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Görsel URL'sini girin (https://...)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={addingFromUrl}
            />
            <button
              type="button"
              onClick={handlePaste}
              disabled={addingFromUrl}
              className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Clipboard'dan yapıştır"
            >
              <Clipboard className="w-4 h-4" />
              <span>Yapıştır</span>
            </button>
            <button
              type="button"
              onClick={handleUrlAdd}
              disabled={addingFromUrl || !urlInput.trim() || previewUrls.length >= maxFiles}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Link className="w-4 h-4" />
              <span>{addingFromUrl ? 'Ekleniyor...' : 'Ekle'}</span>
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Geçerli bir görsel URL'si girin (JPEG, PNG, GIF, WebP vb.) veya "Yapıştır" butonuyla clipboard'tan URL ekleyin
          </p>
        </div>
      )}

      {/* Preview Grid */}
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              {index === 0 && maxFiles > 1 && (
                <div className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                  Ana Görsel
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-center text-gray-600">
            Yükleniyor... {Math.round(uploadProgress)}%
          </p>
        </div>
      )}

      {/* Upload Button - Hem seçili dosyalar hem de yüklenmemiş görseller varsa göster */}
      {(selectedFiles.length > 0 || previewUrls.some(url => url.startsWith('data:') || url.startsWith('blob:'))) && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <ImageIcon className="w-5 h-5" />
          <span>
            {uploading ? 'Yükleniyor...' : 
             selectedFiles.length > 0 ? `${selectedFiles.length} Görseli Yükle` : 
             'Yükle'
            }
          </span>
        </button>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 text-center">
        {previewUrls.length} / {maxFiles} görsel seçildi
      </p>
    </div>
  );
};
