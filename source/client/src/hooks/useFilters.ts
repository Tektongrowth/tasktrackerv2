import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  selectedProjectId: string | null;
  selectedClientId: string | null;
  selectedAssignees: string[];
  selectedTags: string[];
  selectedStatuses: string[];
  searchQuery: string;
  dueDateRange: { start: string | null; end: string | null };

  setSelectedProject: (id: string | null) => void;
  setSelectedClient: (id: string | null) => void;
  setSelectedAssignees: (ids: string[]) => void;
  toggleAssignee: (id: string) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setSelectedStatuses: (statuses: string[]) => void;
  toggleStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  setDueDateRange: (range: { start: string | null; end: string | null }) => void;
  clearFilters: () => void;
}

export const useFilters = create<FilterState>()(persist((set) => ({
  selectedProjectId: null,
  selectedClientId: null,
  selectedAssignees: [],
  selectedTags: [],
  selectedStatuses: [],
  searchQuery: '',
  dueDateRange: { start: null, end: null },

  setSelectedProject: (id) => set({ selectedProjectId: id, selectedClientId: null }),
  setSelectedClient: (id) => set({ selectedClientId: id, selectedProjectId: null }),
  setSelectedAssignees: (ids) => set({ selectedAssignees: ids }),
  toggleAssignee: (id) => set((state) => ({
    selectedAssignees: state.selectedAssignees.includes(id)
      ? state.selectedAssignees.filter((a) => a !== id)
      : [...state.selectedAssignees, id]
  })),
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  toggleTag: (tag) => set((state) => ({
    selectedTags: state.selectedTags.includes(tag)
      ? state.selectedTags.filter((t) => t !== tag)
      : [...state.selectedTags, tag]
  })),
  setSelectedStatuses: (statuses) => set({ selectedStatuses: statuses }),
  toggleStatus: (status) => set((state) => ({
    selectedStatuses: state.selectedStatuses.includes(status)
      ? state.selectedStatuses.filter((s) => s !== status)
      : [...state.selectedStatuses, status]
  })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDueDateRange: (range) => set({ dueDateRange: range }),
  clearFilters: () => set({
    selectedProjectId: null,
    selectedClientId: null,
    selectedAssignees: [],
    selectedTags: [],
    selectedStatuses: [],
    searchQuery: '',
    dueDateRange: { start: null, end: null }
  }),
}), {
  name: 'task-filters',
  storage: {
    getItem: (name) => {
      const str = sessionStorage.getItem(name);
      return str ? JSON.parse(str) : null;
    },
    setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => sessionStorage.removeItem(name),
  },
}));
