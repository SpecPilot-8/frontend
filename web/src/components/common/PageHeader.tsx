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