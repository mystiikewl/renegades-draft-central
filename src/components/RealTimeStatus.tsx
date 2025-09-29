import React, { useEffect, Component, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff, Loader2, RefreshCw, Settings, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ConnectionStatus, useTeamPresence } from '@/hooks/useTeamPresence';
import { useToast } from '@/hooks/use-toast';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import useOfflineStatus from '@/hooks/useOfflineStatus';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

interface RealTimeStatusProps {
  activeTeams?: { teamId: string; teamName: string }[];
  connectionStatus?: ConnectionStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'detailed';
  showActions?: boolean;
  onRefresh?: () => void;
  onSettings?: () => void;
}

export const RealTimeStatus = React.memo(({
  activeTeams: propActiveTeams,
  connectionStatus: propConnectionStatus,
  className,
  size = 'sm',
  variant = 'default',
  showActions = true,
  onRefresh,
  onSettings
}: RealTimeStatusProps) => {
  // Integrate existing hooks
  const { activeTeams: hookActiveTeams, connectionStatus: hookConnectionStatus } = useTeamPresence();
  const { toast } = useToast();
  const isOffline = useOfflineStatus();
  const { invalidateQueries } = useRealTimeUpdates({
    season: '2025-26',
    onUpdate: () => {
      console.log('Real-time update received for RealTimeStatus');
    }
  });

  usePerformanceMonitoring('RealTimeStatus');

  // Use props if provided, otherwise fall back to hook data
  const activeTeams = propActiveTeams || hookActiveTeams || [];
  const connectionStatus = propConnectionStatus || hookConnectionStatus || 'disconnected';

  // Enhanced error handling with toast notifications
  useEffect(() => {
    if (isOffline) {
      toast({
        title: "Connection Lost",
        description: "Real-time updates may be delayed",
        variant: "destructive"
      });
    }
  }, [isOffline, toast]);

  // Memoized connection indicator configuration
  const connectionConfig = React.useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return {
          colorClass: 'bg-green-500',
          icon: Wifi,
          tooltipText: 'Real-time connection active',
          accessibility: 'Connection established successfully'
        };
      case 'connecting':
        return {
          colorClass: 'bg-yellow-500',
          icon: Loader2,
          tooltipText: 'Connecting to real-time service...',
          accessibility: 'Attempting to connect to real-time service'
        };
      case 'reconnecting':
        return {
          colorClass: 'bg-orange-500',
          icon: Loader2,
          tooltipText: 'Connection lost, attempting to reconnect...',
          accessibility: 'Reconnecting to real-time service'
        };
      case 'disconnected':
        return {
          colorClass: 'bg-red-500',
          icon: WifiOff,
          tooltipText: 'Disconnected from real-time service. Please refresh.',
          accessibility: 'Disconnected from real-time service'
        };
      default:
        return {
          colorClass: 'bg-gray-500',
          icon: WifiOff,
          tooltipText: 'Unknown connection status',
          accessibility: 'Unknown connection status'
        };
    }
  }, [connectionStatus]);

  // Memoized size classes
  const sizeClasses = React.useMemo(() => {
    switch (size) {
      case 'sm':
        return { indicator: 'h-3 w-3', icon: 'h-3 w-3', badge: 'text-xs', gap: 'gap-1' };
      case 'md':
        return { indicator: 'h-4 w-4', icon: 'h-4 w-4', badge: 'text-sm', gap: 'gap-2' };
      case 'lg':
        return { indicator: 'h-5 w-5', icon: 'h-5 w-5', badge: 'text-base', gap: 'gap-3' };
      default:
        return { indicator: 'h-3 w-3', icon: 'h-3 w-3', badge: 'text-xs', gap: 'gap-1' };
    }
  }, [size]);

  // Memoized team stats
  const teamStats = React.useMemo(() => ({
    count: activeTeams.length,
    display: activeTeams.length === 1 ? 'Team' : 'Teams',
    shouldShowList: activeTeams.length > 0 && activeTeams.length <= 3,
    teamList: activeTeams.map(t => t.teamName).join(', ')
  }), [activeTeams]);

  // Connection indicator component
  const ConnectionIndicator = () => {
    const IconComponent = connectionConfig.icon;
    const isSpinning = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
    const isConnected = connectionStatus === 'connected';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <div
                className={`
                  ${sizeClasses.indicator} rounded-full ${connectionConfig.colorClass}
                  flex items-center justify-center transition-all duration-300
                  ${isConnected ? 'shadow-lg shadow-green-500/30' : ''}
                  ${isSpinning ? 'animate-pulse' : ''}
                `}
                role="status"
                aria-label={connectionConfig.accessibility}
              >
                <IconComponent
                  className={`${sizeClasses.icon} ${isSpinning ? 'animate-spin' : ''}`}
                />
              </div>
              {isConnected && (
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{connectionConfig.tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Team counter component
  const TeamCounter = () => (
    <Badge
      variant="secondary"
      className={`
        flex items-center ${sizeClasses.gap} ${sizeClasses.badge}
        transition-all duration-300 hover:scale-105
        ${teamStats.count > 0 ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
      `}
    >
      <Users className={`${sizeClasses.icon} transition-transform duration-200`} />
      <span className="font-medium">
        {teamStats.count} {teamStats.display} Active
      </span>
    </Badge>
  );

  // Team list component
  const TeamList = () => {
    if (teamStats.shouldShowList) {
      return (
        <div className={`flex ${sizeClasses.gap}`}>
          {activeTeams.map((team) => (
            <Badge key={team.teamId} variant="outline" className={sizeClasses.badge}>
              {team.teamName}
            </Badge>
          ))}
        </div>
      );
    }

    if (activeTeams.length > 3) {
      return (
        <Badge variant="outline" className={sizeClasses.badge}>
          {teamStats.teamList}
        </Badge>
      );
    }

    return null;
  };

  // Action buttons component
  const StatusActions = () => {
    if (!showActions) return null;

    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        onRefresh?.();
        invalidateQueries();
        toast({
          title: "Refreshed",
          description: "Real-time status updated",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to refresh status",
          variant: "destructive"
        });
      } finally {
        setIsRefreshing(false);
      }
    };

    return (
      <div className={`flex items-center ${sizeClasses.gap}`}>
        {connectionStatus === 'disconnected' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`h-auto p-1 ${sizeClasses.badge}`}
            aria-label="Refresh connection"
          >
            <RefreshCw className={`${sizeClasses.icon} ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onSettings}
          className={`h-auto p-1 ${sizeClasses.badge}`}
          aria-label="Open settings"
        >
          <Settings className={sizeClasses.icon} />
        </Button>
      </div>
    );
  };

  return (
    <div
      className={`
        flex items-center ${sizeClasses.gap} ${className || ''}
        p-2 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50
        transition-all duration-300 hover:bg-background/70
        ${isOffline ? 'opacity-75 border-orange-200' : ''}
      `}
      role="region"
      aria-label="Real-time status dashboard"
    >
      <ConnectionIndicator />
      <TeamCounter />
      <TeamList />
      <StatusActions />
    </div>
  );
});

// Error Boundary for RealTimeStatus
interface RealTimeStatusErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface RealTimeStatusErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class RealTimeStatusErrorBoundary extends Component<
  RealTimeStatusErrorBoundaryProps,
  RealTimeStatusErrorBoundaryState
> {
  constructor(props: RealTimeStatusErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RealTimeStatusErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RealTimeStatus Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">Real-time status unavailable</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
            className="h-6 px-2 text-xs"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
