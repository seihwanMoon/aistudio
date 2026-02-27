import { create } from 'zustand'

export const useAppStore = create((set) => ({
  uploadedFile: null,
  targetColumn: '',
  featureColumns: [],
  trainingSessionId: null,
  setUploadedFile: (uploadedFile) => set({ uploadedFile }),
  setTargetColumn: (targetColumn) => set({ targetColumn }),
  setFeatureColumns: (featureColumns) => set({ featureColumns }),
  setTrainingSessionId: (trainingSessionId) => set({ trainingSessionId }),
}))
