import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { tasks as tasksApi, users } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { useConfirm } from '@/components/ConfirmDialog';
import { X, Trash2, Archive, UserPlus, CheckCircle, Circle, Clock } from 'lucide-react';
import type { TaskStatus, User } from '@/lib/types';

export function BulkActionBar() {
  const { selectedIds, clearSelection } = useBulkSelection();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showAssigneeSelect, setShowAssigneeSelect] = useState(false);

  const { data: userList } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const selectedCount = selectedIds.size;

  const bulkStatusMutation = useMutation({
    mutationFn: ({ taskIds, status }: { taskIds: string[]; status: TaskStatus }) =>
      tasksApi.bulkUpdateStatus(taskIds, status),
    onSuccess: (data) => {
      toast({ title: `Updated ${data.count} tasks` });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkAssigneeMutation = useMutation({
    mutationFn: ({ taskIds, assigneeIds }: { taskIds: string[]; assigneeIds: string[] }) =>
      tasksApi.bulkUpdateAssignees(taskIds, assigneeIds),
    onSuccess: (data) => {
      toast({ title: `Updated ${data.count} tasks` });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      clearSelection();
      setShowAssigneeSelect(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.bulkDelete(taskIds),
    onSuccess: (data) => {
      toast({ title: `Deleted ${data.count} tasks` });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.bulkArchive(taskIds),
    onSuccess: (data) => {
      toast({ title: `Archived ${data.count} tasks` });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleStatusChange = (status: TaskStatus) => {
    bulkStatusMutation.mutate({ taskIds: Array.from(selectedIds), status });
  };

  const handleAssigneeChange = (userId: string) => {
    bulkAssigneeMutation.mutate({
      taskIds: Array.from(selectedIds),
      assigneeIds: userId === 'unassigned' ? [] : [userId],
    });
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Tasks',
      description: `Are you sure you want to delete ${selectedCount} task${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleArchive = () => {
    bulkArchiveMutation.mutate(Array.from(selectedIds));
  };

  if (selectedCount === 0) return null;

  const isPending =
    bulkStatusMutation.isPending ||
    bulkAssigneeMutation.isPending ||
    bulkDeleteMutation.isPending ||
    bulkArchiveMutation.isPending;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-slate-900 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-4">
        <span className="font-medium text-sm">
          {selectedCount} selected
        </span>

        <div className="h-6 w-px bg-slate-700" />

        {/* Status Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800 h-8"
            onClick={() => handleStatusChange('todo')}
            disabled={isPending}
          >
            <Circle className="h-4 w-4 mr-1" />
            To Do
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800 h-8"
            onClick={() => handleStatusChange('in_review')}
            disabled={isPending}
          >
            <Clock className="h-4 w-4 mr-1" />
            In Review
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800 h-8"
            onClick={() => handleStatusChange('completed')}
            disabled={isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Complete
          </Button>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        {/* Assignee */}
        {showAssigneeSelect ? (
          <Select onValueChange={handleAssigneeChange}>
            <SelectTrigger className="w-40 h-8 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {userList?.map((user: User) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800 h-8"
            onClick={() => setShowAssigneeSelect(true)}
            disabled={isPending}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Assign
          </Button>
        )}

        <div className="h-6 w-px bg-slate-700" />

        {/* Archive & Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-slate-800 h-8"
          onClick={handleArchive}
          disabled={isPending}
        >
          <Archive className="h-4 w-4 mr-1" />
          Archive
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        <div className="h-6 w-px bg-slate-700" />

        {/* Close */}
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-slate-800 h-8 px-2"
          onClick={clearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
