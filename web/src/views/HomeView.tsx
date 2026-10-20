import React, { useEffect, useState } from 'react';
import type { RecentProject, StepId } from '../types';
import { fetchRecentProjects } from '../services/api';
import { useProject } from '../contexts/ProjectContext'; // 전역 보관소 불러오기
import { Button, Card, StatusBadge, EmptyState } from '../components/common';

interface HomeViewProps {
  onSelectProject: (projectId: string) => void;
  onNavigateStep: (step: StepId) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectProject,
  onNavigateStep,
}) => {
  // 전역 보관소에서 setProjectId 함수 꺼내기
  const { setProjectId } = useProject();

  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchRecentProjects()
      .then((data) => setProjects(data))
      .catch((error) => console.error('Failed to load recent projects:', error))
      .finally(() => setIsLoading(false));
  }, []);

  // '새 프로젝트 설정 시작' 또는 '새 프로젝트 추가' 버튼 클릭 시
  const handleStartNewSetup = () => {
    // 새 프로젝트를 만들 때는 아직 확정된 ID가 없으므로 보관소를 비워줍니다.
    setProjectId(null);
    onNavigateStep('SETUP');
  };

  // 목록에서 기존 프로젝트 '열기' 버튼 클릭 시
  const handleOpenProject = (id: string) => {
    // 전역 보관소에 선택한 프로젝트의 ID를 저장합니다.
    setProjectId(id);
    onSelectProject(id);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* 상단 환영 및 서비스 소개 배너 */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-600 block mb-1">
            00 시작하기
          </span>
          <h1 className="text-xl font-bold text-neutral-800">
            요구사항과 코드의 정합성을 검증하세요
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            명세서 분석부터 소스코드 AST 검증, QA 테스트 사양서 자동 생성까지 한 번에 진행합니다.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleStartNewSetup}
          className="shrink-0"
        >
          새 프로젝트 설정 시작
        </Button>
      </div>

      {/* 최근 프로젝트 목록 섹션 */}
      <Card
        title="최근 프로젝트"
        description="이전에 분석 및 검증을 진행했던 프로젝트 목록입니다."
        extra={
          <span className="text-xs text-neutral-400">
            총 {projects.length}개
          </span>
        }
      >
        {isLoading ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            프로젝트 목록을 불러오는 중입니다...
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            title="등록된 최근 프로젝트가 없습니다."
            description="새 프로젝트 설정을 통해 명세서와 소스코드를 연결해 보세요."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartNewSetup}
              >
                새 프로젝트 추가
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {projects.map((project) => (
              <div
                key={project.id}
                className="py-3.5 flex items-center justify-between hover:bg-neutral-50/70 px-2 rounded-md transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-neutral-800">
                      {project.name}
                    </span>
                    <StatusBadge status={project.verificationStatus} />
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-neutral-400">
                    <span>{project.techStack}</span>
                    <span>·</span>
                    <span>마지막 작업: {project.lastOpened}</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenProject(project.id)}
                >
                  열기
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};