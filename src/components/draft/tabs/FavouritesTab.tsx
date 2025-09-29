import React from 'react';
import { PlayerPool } from '@/components/PlayerPool';
import { useFavourites } from '@/hooks/useFavourites';
import { useAuth } from '@/contexts/AuthContext';
import { Star } from 'lucide-react';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface FavouritesTabProps {
  canMakePick: boolean;
  draftStats: DraftStats;
  isMobile: boolean;
}

const FavouritesHeader: React.FC<{ favouriteCount: number }> = ({ favouriteCount }) => {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
      <div>
        <h3 className="text-xl md:text-2xl font-bold font-montserrat">My Favourite Players</h3>
        <p className="text-muted-foreground text-sm">
          {favouriteCount} favourite{favouriteCount !== 1 ? 's' : ''} saved
        </p>
      </div>
    </div>
  );
};

const FavouritesContent: React.FC<{ favouritePlayers: any[], canMakePick: boolean }> = ({
  favouritePlayers,
  canMakePick
}) => {
  if (favouritePlayers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md mx-auto">
          <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Favourite Players Yet</h3>
          <p className="text-muted-foreground">
            Click the star icon on any player card in the Player Pool to add them to your favourites.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PlayerPool
      players={favouritePlayers}
      canMakePick={canMakePick}
    />
  );
};

export const FavouritesTab: React.FC<FavouritesTabProps> = ({
  canMakePick,
  draftStats,
  isMobile
}) => {
  const { user } = useAuth();
  const { favouritePlayers, isLoading } = useFavourites();

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md mx-auto">
          <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Authentication Required</h3>
          <p className="text-muted-foreground">
            Please sign in to view and manage your favourite players.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md mx-auto">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your favourites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6">
        <FavouritesHeader favouriteCount={favouritePlayers.length} />

        <FavouritesContent
          favouritePlayers={favouritePlayers}
          canMakePick={canMakePick}
        />
      </div>
    </div>
  );
};