export const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  thinking: '#3b82f6',
  executing: '#8b5cf6',
  waiting_input: '#f59e0b',
  idle: '#6b7280',
  stopped: '#ef4444',
  starting: '#94a3b8',
  error: '#ef4444',
};

export const CHANGE_COLORS: Record<string, { bg: string; text: string }> = {
  create: { bg: '#dcfce7', text: '#166534' },
  modify: { bg: '#dbeafe', text: '#1e40af' },
  delete: { bg: '#fef2f2', text: '#991b1b' },
};
