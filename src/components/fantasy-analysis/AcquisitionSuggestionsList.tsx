import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  UserPlus,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Target
} from 'lucide-react';
import { AcquisitionSuggestion } from '@/utils/fantasyAnalysis';

interface AcquisitionSuggestionsListProps {
  suggestions: AcquisitionSuggestion[];
  isMobile?: boolean;
  onPlayerSelect?: (playerId: string) => void;
}

export function AcquisitionSuggestionsList({
  suggestions,
  isMobile,
  onPlayerSelect,
}: AcquisitionSuggestionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'impact' | 'name' | 'cost'>('impact');

  const filteredAndSortedSuggestions = suggestions
    .filter(suggestion => {
      const matchesSearch = !searchTerm ||
        suggestion.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        suggestion.nbaTeam.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPosition = !positionFilter || positionFilter === 'all' || suggestion.position === positionFilter;

      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'impact':
          return b.projectedImpact - a.projectedImpact;
        case 'name':
          return a.playerName.localeCompare(b.playerName);
        case 'cost':
          const costOrder = { 'Low': 0, 'Medium': 1, 'High': 2, 'Premium': 3 };
          return (costOrder[a.estimatedCost as keyof typeof costOrder] || 0) -
                 (costOrder[b.estimatedCost as keyof typeof costOrder] || 0);
        default:
          return 0;
      }
    });

  const getCostColor = (cost?: string) => {
    switch (cost) {
      case 'Low': return 'bg-green-500';
      case 'Medium': return 'bg-blue-500';
      case 'High': return 'bg-orange-500';
      case 'Premium': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 8) return 'text-green-600';
    if (impact >= 6) return 'text-blue-600';
    if (impact >= 4) return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-green-500" />
          Acquisition Suggestions
        </CardTitle>

        {/* Search and Filter Controls */}
        <div className={`space-y-3 ${isMobile ? 'space-y-2' : ''}`}>
          <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className={isMobile ? 'w-full' : 'w-40'}>
                <SelectValue placeholder="All Positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="PG">Point Guard</SelectItem>
                <SelectItem value="SG">Shooting Guard</SelectItem>
                <SelectItem value="SF">Small Forward</SelectItem>
                <SelectItem value="PF">Power Forward</SelectItem>
                <SelectItem value="C">Center</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className={isMobile ? 'w-full' : 'w-40'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="impact">Sort by Impact</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="cost">Sort by Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedSuggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No acquisition suggestions available</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className={`space-y-3 ${isMobile ? 'space-y-2' : ''}`}>
            {filteredAndSortedSuggestions.map((suggestion) => (
              <Card
                key={suggestion.playerId}
                className="border border-green-200 bg-green-50/30 hover:bg-green-50/50 transition-colors"
              >
                <CardContent className={`p-4 ${isMobile ? 'p-3' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
                          {suggestion.playerName}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.position}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.nbaTeam}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mb-2 text-sm">
                        <div className={`flex items-center gap-1 ${getImpactColor(suggestion.projectedImpact)}`}>
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">
                            {suggestion.projectedImpact.toFixed(1)} Impact
                          </span>
                        </div>

                        {suggestion.estimatedCost && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getCostColor(suggestion.estimatedCost)} text-white`}
                            >
                              {suggestion.estimatedCost}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {suggestion.primaryBenefit}
                        </span>
                      </div>

                      <p className={`text-sm text-muted-foreground ${isMobile ? 'text-xs' : ''}`}>
                        {suggestion.rationale}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => onPlayerSelect?.(suggestion.playerId)}
                        className="flex items-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        {isMobile ? 'Add' : 'Target'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredAndSortedSuggestions.length > 0 && (
          <div className={`text-xs text-muted-foreground mt-4 ${isMobile ? 'text-center' : ''}`}>
            Showing {filteredAndSortedSuggestions.length} of {suggestions.length} suggestions
          </div>
        )}
      </CardContent>
    </Card>
  );
}