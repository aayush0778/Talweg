import React from 'react';
import { PanelLoading, PanelEmpty, PanelError } from './PanelStates';

interface StatusMessageProps {
  type?: 'loading' | 'error' | 'empty';
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type = 'empty',
  title,
  message,
  onRetry,
  className = '',
}) => {
  if (type === 'loading') {
    return (
      <PanelLoading
        title={title || message}
        description={title ? message : undefined}
        className={className}
      />
    );
  }

  if (type === 'error') {
    return (
      <PanelError
        title={title || 'Request Failed'}
        description={message}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  return (
    <PanelEmpty
      title={title || message}
      description={title ? message : undefined}
      className={className}
    />
  );
};

