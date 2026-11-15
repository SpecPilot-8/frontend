/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 각 단계 화면 상단에 단계 태그와 제목 및 액션 버튼을 표시하는 공통 헤더 컴포넌트
 * - 주요 기능:
 *   1) 단계 태그와 화면 제목 및 설명 표시
 *   2) 우측 상단 액션 버튼 영역 배치
 */

import React from 'react';
import { VIEW_HEADER } from '../../styles/typography';

interface PageHeaderProps {
  stepTag: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  stepTag,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <span className={VIEW_HEADER.stepTag}>{stepTag}</span>
        <h1 className={VIEW_HEADER.title}>{title}</h1>
        <p className={VIEW_HEADER.desc}>{description}</p>
      </div>
      {action && (
        <div className="flex items-center space-x-2 self-start sm:self-center">
          {action}
        </div>
      )}
    </div>
  );
};