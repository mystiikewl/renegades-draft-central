import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { fetchProfileByUserId } from '@/integrations/supabase/services/profiles';
import { fetchTeamById } from '@/integrations/supabase/services/teams'; // Assuming this service exists or will be created

export type TeamPresence = {
  teamId: string;
  teamName: string;
  userId: string;
  timestamp: number;
};

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export const useTeamPresence = () => {
  const [activeTeams, setActiveTeams] = useState<TeamPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let teamId: string | null = null;
    let teamName: string | null = null;
    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      setConnectionStatus('connecting');
      channel = supabase.channel('team-presence');

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel!.presenceState();
          const uniqueTeams = new Map<string, TeamPresence>(); // Map to store unique teams by teamId

          Object.keys(presenceState).forEach((key) => {
            const presence = presenceState[key];
            presence.forEach((item: { presence_ref: string | object }) => {
              let parsedItem: { teamId: string; teamName: string; userId: string; timestamp: number } | null = null;
              if (typeof item.presence_ref === 'string' && item.presence_ref.length > 0) {
                // Check if it's valid JSON before parsing
                try {
                  const trimmed = item.presence_ref.trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    parsedItem = JSON.parse(item.presence_ref);
                  } else {
                    // Skip if it doesn't look like JSON
                    return;
                  }
                } catch (e) {
                  console.error("Error parsing presence_ref:", e);
                  return; // Skip this item if parsing fails
                }
              } else if (typeof item.presence_ref === 'object' && item.presence_ref !== null) {
                parsedItem = item.presence_ref as { teamId: string; teamName: string; userId: string; timestamp: number }; // Assume it's already an object
              } else {
                // Skip if presence_ref is neither a non-empty string nor an object
                return;
              }

              if (parsedItem.teamId && parsedItem.teamName && parsedItem.userId) {
                // Only add if teamId is not already in the map, or if the new timestamp is more recent
                if (!uniqueTeams.has(parsedItem.teamId) || uniqueTeams.get(parsedItem.teamId)!.timestamp < parsedItem.timestamp) {
                  uniqueTeams.set(parsedItem.teamId, {
                    teamId: parsedItem.teamId,
                    teamName: parsedItem.teamName,
                    userId: parsedItem.userId,
                    timestamp: parsedItem.timestamp,
                  });
                }
              }
            });
          });
          
          setActiveTeams(Array.from(uniqueTeams.values()));
          setLoading(false);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              try {
                const profile = await fetchProfileByUserId(user.id);
                
                if (profile?.team_id) {
                  teamId = profile.team_id;
                  const team = await fetchTeamById(teamId);
                  teamName = team?.name || 'Your Team';
                  
                  channel!.track({
                    teamId: teamId,
                    teamName: teamName,
                    userId: user.id,
                    timestamp: Date.now(),
                  });
                }
              } catch (error) {
                console.error('Error fetching profile or team:', error);
              }
            }
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('disconnected');
          } else if (status === 'TIMED_OUT') {
            setConnectionStatus('reconnecting');
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        if (teamId) {
          channel.untrack();
        }
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { activeTeams, loading, connectionStatus };
};
