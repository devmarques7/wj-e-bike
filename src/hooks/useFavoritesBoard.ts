import { useCallback, useEffect, useState } from "react";

export type FavoritesFolder = {
  id: string;
  name: string;
  /** Locked folders cannot be renamed or deleted (e.g. Next purchase). */
  locked?: boolean;
  itemIds: string[];
};

const STORAGE_KEY = "wj_favorites_board_v1";

const DEFAULT_FOLDERS: FavoritesFolder[] = [
  { id: "next-purchase", name: "Next purchase", locked: true, itemIds: [] },
  { id: "wishlist", name: "Wishlist", itemIds: [] },
];

function load(): FavoritesFolder[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FOLDERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FOLDERS;
    return parsed as FavoritesFolder[];
  } catch {
    return DEFAULT_FOLDERS;
  }
}

/** Folder-based favorites board persisted in this browser. */
export function useFavoritesBoard() {
  const [folders, setFolders] = useState<FavoritesFolder[]>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    } catch {
      /* storage unavailable */
    }
  }, [folders]);

  const allItemIds = folders.flatMap((f) => f.itemIds);

  const addItem = useCallback((itemId: string, folderId?: string) => {
    setFolders((prev) => {
      if (prev.some((f) => f.itemIds.includes(itemId))) return prev;
      const target = folderId ?? prev[0]?.id;
      return prev.map((f) =>
        f.id === target ? { ...f, itemIds: [itemId, ...f.itemIds] } : f,
      );
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setFolders((prev) =>
      prev.map((f) => ({ ...f, itemIds: f.itemIds.filter((i) => i !== itemId) })),
    );
  }, []);

  const moveItem = useCallback((itemId: string, toFolderId: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id === toFolderId) {
          return f.itemIds.includes(itemId)
            ? f
            : { ...f, itemIds: [itemId, ...f.itemIds] };
        }
        return { ...f, itemIds: f.itemIds.filter((i) => i !== itemId) };
      }),
    );
  }, []);

  const createFolder = useCallback((name: string) => {
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    setFolders((prev) => [...prev, { id, name, itemIds: [] }]);
    return id;
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => {
      const target = prev.find((f) => f.id === id);
      if (!target || target.locked) return prev;
      const rest = prev.filter((f) => f.id !== id);
      if (rest.length === 0) return prev;
      return rest.map((f, i) =>
        i === 0
          ? {
              ...f,
              itemIds: [...target.itemIds.filter((x) => !f.itemIds.includes(x)), ...f.itemIds],
            }
          : f,
      );
    });
  }, []);

  return {
    folders,
    allItemIds,
    isFavorite: (id: string) => allItemIds.includes(id),
    addItem,
    removeItem,
    moveItem,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}