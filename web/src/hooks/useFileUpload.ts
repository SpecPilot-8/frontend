import { useState, useRef } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

interface FileUploadOptions {
  accept?: string;
  onFileSelect?: (file: File) => void;
}

export const useFileUpload = (options: FileUploadOptions = {}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      options.onFileSelect?.(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      options.onFileSelect?.(droppedFile);
    }
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const resetFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return {
    file,
    isDragging,
    inputRef,
    openFileDialog,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetFile,
  };
};