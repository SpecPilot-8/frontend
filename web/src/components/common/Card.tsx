/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 제목과 설명 및 본문 영역을 감싸는 공통 카드 레이아웃 컴포넌트
 * - 주요 기능:
 *   1) 카드 상단 제목과 부가 액션 영역 렌더링
 *   2) 카드 본문 콘텐츠 영역 표시
 */

import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  extra,
  children,
  className = '',
  bodyClassName = '',
}) => {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm ${className}`}>
      {(title || description || extra) && (
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-slate-100 shrink-0">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {description && <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};