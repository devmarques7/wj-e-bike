import { useState } from "react";
import { motion } from "framer-motion";
import { Bike, FolderPlus, GripVertical, Package, Pencil, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCatalogItem } from "@/lib/favorites/catalog";
import type { FavoritesFolder } from "@/hooks/useFavoritesBoard";

interface Props {
  folders: FavoritesFolder[];
  onMove: (itemId: string, folderId: string) => void;
  onRemove: (itemId: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

export default function FavoritesBoard({
  folders,
  onMove,
  onRemove,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    setDragOver(null);
    if (itemId) onMove(itemId, folderId);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">My lists</h2>
          <p className="text-sm text-muted-foreground">
            Drag items between folders to organise what you buy next.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newFolder.trim()) return;
            onCreateFolder(newFolder.trim());
            setNewFolder("");
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder"
            className="rounded-full h-9 w-40 bg-muted/40 border-border/40"
          />
          <Button type="submit" size="sm" variant="outline" className="rounded-full gap-2">
            <FolderPlus className="h-4 w-4" />
            Create
          </Button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <div
            key={folder.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(folder.id);
            }}
            onDragLeave={() => setDragOver((d) => (d === folder.id ? null : d))}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={cn(
              "rounded-3xl border p-4 bg-background/50 backdrop-blur-xl transition-colors min-h-[220px] flex flex-col",
              dragOver === folder.id
                ? "border-wj-green bg-wj-green/10"
                : folder.locked
                  ? "border-wj-green/30"
                  : "border-border/40",
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              {folder.locked && <ShoppingBag className="h-4 w-4 text-wj-green shrink-0" />}
              {editing === folder.id ? (
                <form
                  className="flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editValue.trim()) onRenameFolder(folder.id, editValue.trim());
                    setEditing(null);
                  }}
                >
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => setEditing(null)}
                    className="h-8 rounded-full bg-muted/40 border-border/40"
                  />
                </form>
              ) : (
                <p className="flex-1 font-medium text-foreground truncate">{folder.name}</p>
              )}
              <span className="text-xs text-muted-foreground">{folder.itemIds.length}</span>
              {!folder.locked && (
                <>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditing(folder.id);
                      setEditValue(folder.name);
                    }}
                    aria-label="Rename folder"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteFolder(folder.id)}
                    aria-label="Delete folder"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="space-y-2 flex-1">
              {folder.itemIds.length === 0 && (
                <div className="h-full min-h-[130px] rounded-2xl border border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
                  Drop items here
                </div>
              )}
              {folder.itemIds.map((id) => {
                const item = getCatalogItem(id);
                if (!item) return null;
                return (
                  <motion.div
                    key={id}
                    layout
                    draggable
                    onDragStart={(e) =>
                      (e as unknown as React.DragEvent).dataTransfer.setData("text/plain", id)
                    }
                    className="rounded-2xl border border-border/40 bg-muted/30 p-2.5 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-wj-green/40 transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    {item.type === "bike" ? (
                      <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-wj-green">€{item.price.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => onRemove(id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {folder.itemIds.length > 0 && (
              <p className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground flex justify-between">
                <span>Total</span>
                <span className="text-foreground font-medium">
                  €
                  {folder.itemIds
                    .reduce((sum, id) => sum + (getCatalogItem(id)?.price ?? 0), 0)
                    .toLocaleString()}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}