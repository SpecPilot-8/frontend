/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 텍스트 입력과 오류 상태 테두리 표시를 지원하는 공통 입력창 컴포넌트
 * - 주요 기능:
 *   1) 기본 텍스트 입력 필드 렌더링
 *   2) 오류 여부 및 비활성화 상태에 따른 스타일 전환
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({
  error = false,
  className = '',
  ...props
}) => {
  return (
    <input
      className={`w-full px-3 py-2 text-xs text-slate-800 bg-white border rounded-lg placeholder-slate-400 focus:outline-none transition-colors ${
        error
          ? 'border-rose-400 focus:border-rose-500'
          : 'border-slate-200 focus:border-blue-500'
      } disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      {...props}
    />
  );
};