import React, { useState, useRef } from 'react';
import { Upload, File, AlertTriangle } from 'lucide-react';

interface UploadAreaProps {
  onFileLoaded: (file: File | string) => void;
  isLoading: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onFileLoaded, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.fits', '.fit', '.fits.gz'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      setError("Invalid file type. Please upload a calibrated TESS FITS file (.fits, .fit, .fits.gz).");
      setSelectedFile(null);
      return false;
    }
    
    setError(null);
    setSelectedFile({ name: file.name, size: file.size });
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileLoaded(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileLoaded(file);
      }
    }
  };


  return (
    <div className="bg-space-900 border border-space-800 rounded-xl p-6 shadow-xl max-w-2xl mx-auto">
      <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase mb-2 flex items-center space-x-2">
        <Upload className="w-5 h-5 text-indigo-400" />
        <span>TESS FITS Curve Upload</span>
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Drag and drop a calibrated TESS light curve FITS file to run the AI exoplanet detection pipeline.
      </p>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${
          dragActive
            ? 'border-indigo-400 bg-indigo-950/20'
            : selectedFile
            ? 'border-emerald-500 bg-emerald-950/10'
            : 'border-space-800 hover:border-indigo-500 bg-space-950/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".fits,.fit,.fits.gz"
          onChange={handleFileChange}
          disabled={isLoading}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center space-y-3">
            <File className="w-12 h-12 text-emerald-400" />
            <div className="text-slate-200 font-medium break-all max-w-md">{selectedFile.name}</div>
            <div className="text-xs text-slate-500 font-mono">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </div>
            <div className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold uppercase tracking-wider">
              File Validated
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3 text-slate-400">
            <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
            <span className="font-semibold text-slate-200">Choose file or drag & drop here</span>
            <span className="text-xs text-slate-500">Supports .fits, .fit, .fits.gz (max 50MB)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-950/20 border border-red-500/30 rounded-lg flex items-start space-x-3 text-sm text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
