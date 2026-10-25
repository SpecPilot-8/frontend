import React, { useEffect, useState } from 'react';
import type { RecentProject, StepId } from '../types';
import { fetchRecentProjects } from '../services/api';
import { useProject } from '../contexts/ProjectContext';
import { Button, Card, StatusBadge, EmptyState } from '../components/common';

interface HomeViewProps {
  onSelectProject: (projectId: string) => void;
  onNavigateStep: (step: StepId) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectProject,
  onNavigateStep,
}) => {
  const { setProjectId } = useProject();

  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadProjects = () => {
    fetchRecentProjects()
      .then((data) => {
        setProjects([...data].reverse());
      })
      .catch((error: Error) => setError(error.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleStartNewSetup = () => {
    setProjectId(null);
    onNavigateStep('SETUP');
  };

  const handleOpenProject = (id: string) => {
    setProjectId(id);
    onSelectProject(id);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
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

      {error && <p role="alert" className="text-red-600">{error}</p>}
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
          <div className="divide-y divide-neutral-100 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
            {projects.map((project) => (
              <div
                key={String(project.id)}
                className="py-3.5 flex items-center justify-between hover:bg-neutral-50/70 px-2 rounded-md transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-neutral-800">
                      {String(project.name || '제목 없음')}
                    </span>
                    {typeof project.verificationStatus === 'string' &&
                    project.verificationStatus !== 'not_run' &&
                    project.verificationStatus !== '' ? (
                      <StatusBadge status={project.verificationStatus} />
                    ) : null}
                  </div>
                  
                  {project.techStack || project.lastOpened ? (
                    <div className="flex items-center space-x-2 text-xs text-neutral-400">
                      {project.techStack ? <span>{String(project.techStack)}</span> : null}
                      {project.techStack && project.lastOpened ? <span>·</span> : null}
                      {project.lastOpened ? <span>마지막 작업: {String(project.lastOpened)}</span> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center space-x-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenProject(String(project.id))}
                  >
                    열기
                  </Button>

                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};