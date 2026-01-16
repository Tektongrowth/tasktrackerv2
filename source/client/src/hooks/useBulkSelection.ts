import { create } from 'zustand';

interface BulkSelectionState {
  selectedIds: Set<string>;
  isSelectionMode: boolean;

  toggleSelection: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  clearSelection: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  isSelected: (id: string) => boolean;
}

export const useBulkSelection = create<BulkSelectionState>((set, get) => ({
  selectedIds: new Set(),
  isSelectionMode: false,

  toggleSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return {
      selectedIds: newSet,
      isSelectionMode: newSet.size > 0 ? true : state.isSelectionMode
    };
  }),

  selectMultiple: (ids) => set((state) => {
    const newSet = new Set(state.selectedIds);
    ids.forEach(id => newSet.add(id));
    return { selectedIds: newSet, isSelectionMode: true };
  }),

  selectAll: (ids) => set({
    selectedIds: new Set(ids),
    isSelectionMode: true
  }),

  deselectAll: () => set({ selectedIds: new Set() }),

  clearSelection: () => set({
    selectedIds: new Set(),
    isSelectionMode: false
  }),

  enterSelectionMode: () => set({ isSelectionMode: true }),

  exitSelectionMode: () => set({
    isSelectionMode: false,
    selectedIds: new Set()
  }),

  isSelected: (id) => get().selectedIds.has(id),
}));
