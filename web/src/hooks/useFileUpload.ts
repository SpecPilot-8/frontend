/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 파일 선택창과 드래그 앤 드롭 방식의 파일 업로드를 처리하는 커스텀 훅 파일
 * - 주요 기능:
 *   1) 허용된 파일 확장자 검사 및 파일 선택 상태 관리
 *   2) 드래그 앤 드롭 이벤트 처리와 파일 초기화 기능 제공
 */

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

  // 선택한 파일의 확장자를 검사하고 상태를 갱신하는 로직
  const selectFile = (selectedFile: File) => {
    const allowed = options.accept?.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) || [];
    const name = selectedFile.name.toLowerCase();
    const type = selectedFile.type.toLowerCase();
    const matches = allowed.length === 0 || allowed.some(value => value.startsWith('.')
      ? name.endsWith(value)
      : value.endsWith('/*') ? type.startsWith(value.slice(0, -1)) : type === value);
    if (!matches) {
      alert(`지원하는 파일 형식(${options.accept})을 선택해주세요. 선택한 파일: ${selectedFile.name}`);
      return;
    }
    setFile(selectedFile);
    options.onFileSelect?.(selectedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      selectFile(selectedFile);
    }
    e.target.value = '';
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
      selectFile(droppedFile);
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
