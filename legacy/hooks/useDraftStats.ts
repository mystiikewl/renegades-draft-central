import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define types for draft settings from the database
export type DraftSettingsDb = Tables<'draft_settings'>;

export type DraftStats = {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
};

export const useDraftStats = () => {
  const [draftPicks, setDraftPicks] = useState<Tables<'draft_picks'>[]>([]);
  const [players, setPlayers] = useState<Tables<'players'>[]>([]);
  const [draftSettings, setDraftSettings] = useState<DraftSettingsDb | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let picksChannel: RealtimeChannel | null = null;
    let playersChannel: RealtimeChannel | null = null;
    let settingsChannel: RealtimeChannel | null = null;

    const fetchData = async () => {
      try {
        // Fetch initial draft settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('draft_settings')
          .select('*')
          .single();
        if (settingsError) throw settingsError;
        setDraftSettings(settingsData);

        // Fetch initial draft picks
        const { data: picksData, error: picksError } = await supabase
          .from('draft_picks')
          .select('*');
        if (picksError) throw picksError;
        setDraftPicks(picksData);

        // Fetch initial players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*');
        if (playersError) throw playersError;
        setPlayers(playersData);

      } catch (err: any) {
        console.error('Error fetching initial draft stats data:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscriptions
    picksChannel = supabase
      .channel('draft_picks_stats_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_picks' },
        (payload: RealtimePostgresChangesPayload<Tables<'draft_picks'>>) => {
          if (payload.eventType === 'INSERT') {
            setDraftPicks((prev) => [...prev, payload.new as Tables<'draft_picks'>]);
          } else if (payload.eventType === 'UPDATE') {
            setDraftPicks((prev) =>
              prev.map((pick) =>
                pick.id === payload.old.id ? (payload.new as Tables<'draft_picks'>) : pick
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setDraftPicks((prev) => prev.filter((pick) => pick.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    playersChannel = supabase
      .channel('players_stats_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload: RealtimePostgresChangesPayload<Tables<'players'>>) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => [...prev, payload.new as Tables<'players'>]);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) =>
              prev.map((player) =>
                player.id === payload.old.id ? (payload.new as Tables<'players'>) : player
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter((player) => player.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    settingsChannel = supabase
      .channel('draft_settings_stats_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_settings' },
        (payload: RealtimePostgresChangesPayload<Tables<'draft_settings'>>) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setDraftSettings(payload.new as Tables<'draft_settings'>);
          }
        }
      )
      .subscribe();

    return () => {
      if (picksChannel) supabase.removeChannel(picksChannel);
      if (playersChannel) supabase.removeChannel(playersChannel);
      if (settingsChannel) supabase.removeChannel(settingsChannel);
    };
  }, []);

  const draftStats: DraftStats = useMemo(() => {
    const totalPicks = draftSettings ? draftSettings.roster_size * draftSettings.league_size : 0;
    const completedPicks = draftPicks.filter(pick => pick.is_used).length;
    const availablePlayers = players.filter(p => !p.is_drafted && !p.is_keeper).length;
    const progress = totalPicks > 0 ? Math.round((completedPicks / totalPicks) * 100) : 0;

    return {
      totalPicks,
      completedPicks,
      availablePlayers,
      progress,
    };
  }, [draftPicks, players, draftSettings]);

  return { draftStats, loading, error };
};
