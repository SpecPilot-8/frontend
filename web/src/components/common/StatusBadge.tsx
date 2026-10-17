import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLE_MAP: Record<string, string> = {
  // 정상 / 통과
  '구현': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  '완료': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  '통과': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  '정상 예상': 'bg-emerald-50 text-emerald-600 border-emerald-200',

  // 실패 / 불일치
  '불일치': 'bg-rose-50 text-rose-600 border-rose-200',
  '실패': 'bg-rose-50 text-rose-600 border-rose-200',
  '실패 예상': 'bg-rose-50 text-rose-600 border-rose-200',

  // 주의 / 부분
  '부분구현': 'bg-amber-50 text-amber-600 border-amber-200',
  '검토 필요': 'bg-amber-50 text-amber-600 border-amber-200',
  '보류': 'bg-amber-50 text-amber-600 border-amber-200',

  // 정보 / 기본
  '미구현 후보': 'bg-blue-50 text-blue-600 border-blue-200',
  '검토 완료': 'bg-blue-50 text-blue-600 border-blue-200',
  '일치': 'bg-blue-50 text-blue-600 border-blue-200',

  // 기타 확인
  '확인 필요': 'bg-purple-50 text-purple-600 border-purple-200',
  '호출 근거': 'bg-purple-50 text-purple-600 border-purple-200',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const style = STATUS_STYLE_MAP[status] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${style} ${className}`}
    >
      {status}
    </span>
  );
};