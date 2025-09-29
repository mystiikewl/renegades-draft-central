import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  Calendar,
  TrendingUp,
  HelpCircle,
  BookOpen,
  MessageCircle
} from 'lucide-react';
import { SidebarProps } from '@/types/onboarding';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  leagueData,
  className,
}) => {
  const isMobile = useIsMobile();

  const tips = [
    {
      id: 'keeper-strategy',
      title: 'Keeper Strategy',
      description: 'Balance young talent with proven veterans. Don\'t keep all your early picks - save some for future drafts!',
      icon: Star,
      color: 'yellow',
    },
    {
      id: 'draft-preparation',
      title: 'Draft Preparation',
      description: 'Research player rankings and create a strategy before the draft. Know your positional needs!',
      icon: Calendar,
      color: 'blue',
    },
    {
      id: 'team-building',
      title: 'Team Building',
      description: 'Aim for balance across all categories. Don\'t focus only on points - rebounds and assists matter too!',
      icon: TrendingUp,
      color: 'green',
    },
  ];

  const successMetrics = [
    'Win your division',
    'Make the playoffs',
    'Win the championship',
    'Tank for a dynasty',
  ];

  const getTipByStep = (step: number) => {
    return tips[step - 1] || tips[0];
  };

  const currentTip = getTipByStep(currentStep);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Pro Tips Card */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-base" : "text-lg"
          )}>
            <Star className={cn(
              "text-yellow-500",
              isMobile ? "h-4 w-4" : "h-5 w-5"
            )} />
            Pro Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn(
            "p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg",
            isMobile ? "p-2" : "p-3"
          )}>
            <div className="flex items-start gap-2 mb-2">
              <currentTip.icon className={cn(
                "text-yellow-500 mt-0.5",
                isMobile ? "h-3 w-3" : "h-4 w-4"
              )} />
              <h4 className={cn(
                "font-semibold",
                isMobile ? "text-xs" : "text-sm"
              )}>
                {currentTip.title}
              </h4>
            </div>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              {currentTip.description}
            </p>
          </div>

          {/* Additional Quick Tips */}
          <div className="space-y-2">
            <h4 className={cn(
              "font-medium text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Quick Tips:
            </h4>
            <ul className={cn(
              "space-y-1",
              isMobile ? "text-xs" : "text-sm"
            )}>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Monitor waiver wire daily</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Trade early and often</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Stay active in the community</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* League Info Card */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-base" : "text-lg"
          )}>
            <Calendar className={cn(
              "text-primary",
              isMobile ? "h-4 w-4" : "h-5 w-5"
            )} />
            League Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                League Size
              </span>
              <Badge variant="secondary" className={cn(
                isMobile ? "text-xs" : "text-sm"
              )}>
                {leagueData?.size || 12} Teams
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Roster Size
              </span>
              <Badge variant="secondary" className={cn(
                isMobile ? "text-xs" : "text-sm"
              )}>
                {leagueData?.rosterSize || 15} Players
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Draft Rounds
              </span>
              <Badge variant="secondary" className={cn(
                isMobile ? "text-xs" : "text-sm"
              )}>
                {leagueData?.draftRounds || 15} Rounds
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Keeper Limit
              </span>
              <Badge variant="secondary" className={cn(
                isMobile ? "text-xs" : "text-sm"
              )}>
                {leagueData?.keeperLimit || 9} Players
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Draft Type
              </span>
              <Badge variant="secondary" className={cn(
                isMobile ? "text-xs" : "text-sm"
              )}>
                {leagueData?.draftType || 'Snake'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Metrics Card */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-base" : "text-lg"
          )}>
            <TrendingUp className={cn(
              "text-green-500",
              isMobile ? "h-4 w-4" : "h-5 w-5"
            )} />
            Success Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className={cn(
            "space-y-2",
            isMobile ? "text-xs" : "text-sm"
          )}>
            {successMetrics.map((metric, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>{metric}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Help & Support Card */}
      {isMobile && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className={cn(
            isMobile ? "p-4" : "p-6"
          )}>
            <div className="flex flex-col space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help Center
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Documentation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Community
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};