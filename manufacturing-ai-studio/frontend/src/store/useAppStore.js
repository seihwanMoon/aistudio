import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(persist((set) => ({
  uploadedFile: null,
  targetColumn: '',
  featureColumns: [],
  taskType: 'classification',
  trainingSessionId: null,
  trainedModelId: null,
  trainingResult: null,

  setUploadedFile: (uploadedFile) => set({ uploadedFile }),
  setTargetColumn: (targetColumn) => set({ targetColumn }),
  setFeatureColumns: (featureColumns) => set({ featureColumns }),
  setTaskType: (taskType) => set({ taskType }),
  setTrainingSessionId: (trainingSessionId) => set({ trainingSessionId }),
  setTrainedModelId: (trainedModelId) => set({ trainedModelId }),
  setTrainingResult: (trainingResult) => set({ trainingResult }),
  resetFlow: () => set({
    uploadedFile: null,
    targetColumn: '',
    featureColumns: [],
    taskType: 'classification',
    trainingSessionId: null,
    trainedModelId: null,
    trainingResult: null,
  }),
}), {
  name: 'app_flow_store',
}))
