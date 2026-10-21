import React from 'react';
import { Card, Button } from '../common';
import type { Requirement, SourceRef } from '../../types/verification';

interface RequirementPanelProps {
  requirement: Requirement;
  stats: {
    input: number;
    navigation: number;
    businessLogic: number;
    data: number;
    errorMessage: number;
  };
}

export const RequirementPanel: React.FC<RequirementPanelProps> = ({ requirement, stats }) => {
  const primaryRef: SourceRef | undefined = requirement.source_refs?.[0];
  const pageIndex = primaryRef?.location?.index || 0;
  const bbox = primaryRef?.location?.bbox;

  return (
    <div className="w-[320px] shrink-0 space-y-6">
      <Card className="p-6 flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">요구사항</h3>
          <p className="text-sm text-gray-500 mb-4">
            {requirement.stable_key} · 문서 {pageIndex > 0 ? `${pageIndex}페이지` : '위치 미상'}
          </p>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
            {requirement.original_text}
          </p>
        </div>

        {primaryRef && (
          <div className="border-t border-gray-100 pt-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3">
              기획서 원문 발췌 (PDF {pageIndex}페이지)
            </h4>
            
            <div className="bg-white border border-gray-300 rounded-md p-4 mb-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded font-bold">화면 ID</span>
                <span className="text-xs text-gray-800 font-mono">
                  {requirement.stable_key.split('-').slice(0, 2).join('-')}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-1 font-medium">Description</div>
              
              <p className="text-sm text-gray-900 leading-relaxed mt-2">
                <span className="bg-yellow-200/80 px-1 py-0.5 rounded text-[13px] leading-relaxed box-decoration-clone">
                  {primaryRef.quote}
                </span>
              </p>
            </div>
            
            <p className="text-xs text-gray-500">
              위치: {pageIndex}페이지 · Description 
              {bbox && ` (좌표: x:${Math.round(bbox[0])}, y:${Math.round(bbox[1])})`}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-6">
          <h4 className="text-sm font-bold text-gray-900 mb-3">수락 조건 검증</h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between items-center">
              <span className="text-gray-600">입력값 검증</span> 
              <span className="text-green-600 font-medium">{stats.input} / {stats.input}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600">경로 및 이동</span> 
              <span className="text-green-600 font-medium">{stats.navigation} / {stats.navigation}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600">비즈니스 로직</span> 
              <span className="text-green-600 font-medium">{stats.businessLogic} / {stats.businessLogic}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600">데이터 저장</span> 
              <span className="text-green-600 font-medium">{stats.data} / {stats.data}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600">오류 메시지</span> 
              <span className="text-red-500 font-medium">{stats.errorMessage} / {stats.errorMessage + 1}</span>
            </li>
          </ul>
        </div>

        <Button variant="outline" className="w-full mt-2 text-gray-700">
          명세 원문 검토
        </Button>
      </Card>
    </div>
  );
};