export const WorkflowCacheKeys = {
  execution: (executionId: string) => `workflow:execution:${executionId}`,
  executionSteps: (executionId: string) => `workflow:execution:${executionId}:steps`,
  executorToken: (applicationId: string) => `executor:token:${applicationId}`,
};
