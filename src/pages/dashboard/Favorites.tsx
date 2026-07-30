import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import FavoritesAdvisorCard from "@/components/dashboard/favorites/FavoritesAdvisorCard";
import FavoritesBoard from "@/components/dashboard/favorites/FavoritesBoard";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoritesBoard } from "@/hooks/useFavoritesBoard";

export default function Favorites() {
  const { isAuthenticated, isLoading } = useAuth();
  const board = useFavoritesBoard();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-wj-green">Favorites</p>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground mt-1">
            Your saved rides & gear
          </h1>
        </div>

        <FavoritesAdvisorCard
          isFavorite={board.isFavorite}
          onAdd={(item) => {
            if (board.isFavorite(item.id)) {
              toast.info(`${item.name} is already in your lists`);
              return;
            }
            board.addItem(item.id);
            toast.success(`${item.name} added to ${board.folders[0]?.name ?? "favorites"}`);
          }}
        />

        <FavoritesBoard
          folders={board.folders}
          onMove={board.moveItem}
          onRemove={board.removeItem}
          onCreateFolder={board.createFolder}
          onRenameFolder={board.renameFolder}
          onDeleteFolder={board.deleteFolder}
        />
      </div>
    </RoleDashboardLayout>
  );
}