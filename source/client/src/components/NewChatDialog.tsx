import { useState } from 'react';
import { Search, X } from 'lucide-react';

type ChatUser = { id: string; name: string; email: string; avatarUrl: string | null };

interface NewChatDialogProps {
  users: ChatUser[];
  onClose: () => void;
  onCreate: (participantIds: string[], isGroup: boolean, name?: string) => void;
}

export function NewChatDialog({ users, onClose, onCreate }: NewChatDialogProps) {
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    onCreate(selectedUsers, isGroup, isGroup ? groupName : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">New Chat</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.04] rounded" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="rounded"
            />
            <span>Create group chat</span>
          </label>

          {isGroup && (
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 bg-white/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/[0.04] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredUsers.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  selectedUsers.includes(u.id) ? 'bg-primary/10' : 'hover:bg-white/[0.04]'
                }`}
              >
                <input
                  type={isGroup ? 'checkbox' : 'radio'}
                  name="participant"
                  checked={selectedUsers.includes(u.id)}
                  onChange={(e) => {
                    if (isGroup) {
                      setSelectedUsers((prev) =>
                        e.target.checked
                          ? [...prev, u.id]
                          : prev.filter((id) => id !== u.id)
                      );
                    } else {
                      setSelectedUsers([u.id]);
                    }
                  }}
                  className="rounded"
                />
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-medium text-sm">
                      {u.name[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-white/60 truncate">{u.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm hover:bg-white/[0.04] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0 || (isGroup && !groupName.trim())}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  );
}
