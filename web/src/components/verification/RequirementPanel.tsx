import React from 'react';
import { Card, Button } from '../common';
import type { Requirement, SourceRef } from '../../types/verification';

interface ConditionVerdict {
  condition_id: string;
  status: string;
  stable_key?: string;
}

interface Condition {
  id: string;
  stable_key: string;
  category: string;
}

interface VerificationData {
  condition_verdicts?: ConditionVerdict[];
}

interface RequirementPanelProps {
  requirement: Requirement;
  verificationData?: VerificationData;
}

export const RequirementPanel: React.FC<RequirementPanelProps> = ({ requirement, verificationData }) => {
  const primaryRef: SourceRef | undefined = requirement.source_refs?.[0];
  const pageIndex = primaryRef?.location?.index || 0;
  const bbox = primaryRef?.location?.bbox;

  const categories = [
    { key: 'display', label: '화면 표시' },
    { key: 'validation', label: '입력값 검증' },
    { key: 'navigation', label: '경로 및 이동' },
    { key: 'business_logic', label: '비즈니스 로직' },
    { key: 'data', label: '데이터 저장' },
    { key: 'error_message', label: '오류 메시지' },
  ];

  const conditions = (requirement as unknown as { conditions?: Condition[] }).conditions || [];
  const verdicts = verificationData?.condition_verdicts || [];

  const statsList = categories.map(cat => {
    const catConditions = conditions.filter((c: Condition) => c.category === cat.key);
    if (catConditions.length === 0) return null;
    
    const implementedCount = catConditions.filter((c: Condition) => {
      const v = verdicts.find((v: ConditionVerdict) => v.condition_id === c.id || v.condition_id === c.stable_key);
      return v && v.status === 'implemented';
    }).length;

    return { ...cat, total: catConditions.length, implemented: implementedCount };
  }).filter(Boolean) as { key: string; label: string; total: number; implemented: number }[];

  return (
    <div className="w-[320px] shrink-0 space-y-6">
      <Card className="p-6 flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">요구사항</h3>
          <p className="text-sm text-slate-500 mb-4">
            {requirement.stable_key} · 문서 {pageIndex > 0 ? `${pageIndex}페이지` : '위치 미상'}
          </p>
          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
            {requirement.original_text}
          </p>
        </div>

        {primaryRef && (
          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-900 mb-3">
              기획서 원문 발췌 (PDF {pageIndex}페이지)
            </h4>
            
            <div className="bg-white border border-slate-200 rounded-md p-4 mb-2 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold">화면 ID</span>
                <span className="text-xs text-slate-800 font-mono">
                  {requirement.stable_key.split('-').slice(0, 2).join('-')}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-1 font-medium">Description</div>
              
              <p className="text-sm text-slate-900 leading-relaxed mt-2">
                <span className="bg-yellow-200/80 px-1 py-0.5 rounded text-[13px] leading-relaxed box-decoration-clone">
                  {primaryRef.quote}
                </span>
              </p>
            </div>
            
            <p className="text-xs text-slate-500">
              위치: {pageIndex}페이지 · Description 
              {bbox && ` (좌표: x:${Math.round(bbox[0])}, y:${Math.round(bbox[1])})`}
            </p>
          </div>
        )}

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-bold text-slate-900 mb-3">수락 조건 검증</h4>
          <ul className="space-y-2.5 text-sm">
            {statsList.length > 0 ? (
              statsList.map(stat => (
                <li key={stat.key} className="flex justify-between items-center">
                  <span className="text-slate-600">{stat.label}</span> 
                  <span className={`font-medium ${stat.implemented === stat.total ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {stat.implemented} / {stat.total}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 text-xs text-center py-2">조건 데이터가 없습니다.</li>
            )}
          </ul>
        </div>

        <Button variant="outline" className="w-full mt-2 text-slate-700">
          명세 원문 검토
        </Button>
      </Card>
    </div>
  );
};