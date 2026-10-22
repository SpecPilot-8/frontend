import React, { useEffect, useState } from 'react';
import type { RecentProject, StepId } from '../types';
import { fetchRecentProjects, BASE_URL } from '../services/api';
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadProjects = () => {
    fetchRecentProjects()
      .then((data) => {
        setProjects([...data].reverse());
      })
      .catch((error) => console.error('Failed to load recent projects:', error))
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

  // 서버에 실제 삭제(DELETE) 요청 보내기
  const handleDeleteProject = async (id: string) => {
    if (window.confirm("이 프로젝트를 완전히 삭제하시겠습니까?")) {
      setProjects((prev) => prev.filter((p) => String(p.id) !== id));

      try {
        const res = await fetch(`${BASE_URL}/projects/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          throw new Error('서버 삭제 실패');
        }
      } catch (error) {
        console.error('프로젝트 삭제 오류:', error);
        alert('삭제에 실패했습니다. 서버 연결 상태를 확인해주세요.');
        loadProjects();
      }
    }
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
                  <button
                    onClick={() => handleDeleteProject(String(project.id))}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};