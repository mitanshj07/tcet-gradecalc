import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calculateSemester } from '../utils/grading'
import { getSemesterMeta } from '../utils/semesterData'
import { deleteRemoteSnapshot, saveRemoteSnapshot } from '../utils/supabaseData'

const defaultProfile = {
  name: '',
  leaderboardName: '',
  branch: 'AIDS',
  batchYear: '2025',
  rollNo: '',
  isPublic: false,
  tcetVerified: false,
  authProvider: '',
  emailDomain: '',
}

export const useStore = create(
  persist(
    (set, get) => ({
      branch: 'AIDS',
      semester: 1,
      marks: {},
      profile: defaultProfile,
      history: [],
      theme: 'dark',
      remoteUserId: null,
      remoteStatus: 'idle',
      remoteError: null,
      toasts: [],

      setBranch: (branch) =>
        set((state) => ({
          branch,
          profile: { ...state.profile, branch },
        })),
      setSemester: (semester) => set({ semester: Number(semester) }),
      setTheme: (theme) => set({ theme }),
      pushToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, { id: crypto.randomUUID(), tone: 'info', ...toast }].slice(-4),
        })),
      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
      setRemoteSession: ({ userId, status, error = null }) =>
        set({
          remoteUserId: userId,
          remoteStatus: status,
          remoteError: error,
        }),
      hydrateRemoteData: ({ profile, history, userId }) =>
        set({
          profile,
          branch: profile.branch,
          history,
          remoteUserId: userId,
          remoteStatus: 'ready',
          remoteError: null,
        }),
      updateMark: (subjectCode, key, value) =>
        set((state) => ({
          marks: {
            ...state.marks,
            [subjectCode]: {
              ...(state.marks[subjectCode] ?? {}),
              [key]: value,
            },
          },
        })),
      clearSubject: (subjectCode) =>
        set((state) => {
          const nextMarks = { ...state.marks }
          delete nextMarks[subjectCode]
          return { marks: nextMarks }
        }),
      resetMarks: () => set({ marks: {} }),
      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
          branch: updates.branch ?? state.branch,
        })),
      applyParsedResult: ({ branch, semester, marksByCode, profileUpdates = {} }) =>
        set((state) => ({
          branch: branch ?? state.branch,
          semester: semester ?? state.semester,
          marks: marksByCode ?? state.marks,
          profile: { ...state.profile, ...profileUpdates, branch: branch ?? profileUpdates.branch ?? state.profile.branch },
        })),
      restoreSnapshot: (snapshot) =>
        set((state) => ({
          branch: snapshot.branch ?? state.branch,
          semester: snapshot.semester ?? state.semester,
          marks: snapshot.marksByCode ?? state.marks,
          profile: {
            ...state.profile,
            branch: snapshot.branch ?? state.profile.branch,
          },
        })),
      saveCurrentResult: async ({
        locked = false,
        official = false,
        source = 'manual',
        parserConfidence = null,
        uploadedPdfName = null,
        officialSgpa = null,
        marksOverride = null,
        subjectMetadataByCode = {},
        user = null,
      } = {}) => {
        const { branch, semester, marks, profile, remoteUserId } = get()
        const meta = getSemesterMeta(branch, semester)
        const activeMarks = marksOverride ?? marks
        const calculation = calculateSemester(meta.subjects, activeMarks)

        if (!calculation.sgpa) return null

        const fallbackSaved = {
          id: crypto.randomUUID(),
          branch,
          branchLabel: meta.branch.label,
          semester,
          academicYear: '2025-26',
          sgpa: Number(calculation.sgpa.toFixed(2)),
          totalCredits: calculation.totalCredits,
          earnedCredits: calculation.earnedCredits,
          creditPoints: Number(calculation.creditPoints.toFixed(2)),
          marksByCode: activeMarks,
          source,
          isOfficial: official,
          isLocked: locked,
          isPublic: profile.isPublic,
          officialSgpa: officialSgpa ?? null,
          parserConfidence,
          uploadedPdfName,
          createdAt: new Date().toISOString(),
        }

        const saved = remoteUserId
          ? await saveRemoteSnapshot({
              userId: remoteUserId,
              user,
              branchId: branch,
              semester,
              marksByCode: activeMarks,
              profile,
              locked,
              official,
              source,
              parserConfidence,
              uploadedPdfName,
              officialSgpa,
              subjectMetadataByCode,
            })
          : fallbackSaved

        set((state) => ({
          history: [saved, ...state.history.filter((item) => item.id !== saved.id)].slice(0, 24),
        }))

        return saved
      },
      deleteHistoryItem: async (id) => {
        const { remoteUserId } = get()
        if (remoteUserId) {
          await deleteRemoteSnapshot(id)
        }

        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        }))
      },
    }),
    {
      name: 'tcet-gradecalc-v2',
      partialize: (state) => ({
        branch: state.branch,
        semester: state.semester,
        marks: state.marks,
        profile: state.profile,
        history: state.history,
        theme: state.theme,
      }),
    },
  ),
)
