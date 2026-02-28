import { create } from 'zustand'

export const useAppStore = create((set) => ({
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
}))
