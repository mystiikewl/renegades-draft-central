import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDraftState } from '@/hooks/useDraftState';
import { useTeams } from '@/hooks/useTeams';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SortableTeamItemProps {
  team: { id: string; name: string };
  index: number;
}

function SortableTeamItem({ team, index }: SortableTeamItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between p-4 border rounded-md bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center space-x-3">
        <button 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <span className="font-medium">{team.name}</span>
      </div>
      <div className="text-muted-foreground text-sm">
        Pick {index + 1}
      </div>
    </div>
  );
}

export const DraftOrderManager: React.FC = () => {
  const { draftSettings, isLoadingDraftState, mutateDraftSettings } = useDraftState();
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const [currentDraftOrder, setCurrentDraftOrder] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoadingDraftState && !isLoadingTeams && teamsData.length > 0) {
      let newDraftOrder = [];
      if (draftSettings.draftOrder && draftSettings.draftOrder.length > 0) {
        // Filter out teams that no longer exist and preserve order
        newDraftOrder = draftSettings.draftOrder.filter(teamId =>
          teamsData.some(team => team.id === teamId)
        );
        // Add any new teams to the end
        const existingTeamIds = new Set(newDraftOrder);
        teamsData.forEach(team => {
          if (!existingTeamIds.has(team.id)) {
            newDraftOrder.push(team.id);
          }
        });
      } else {
        // If no draft order is set, initialize with all current teams
        newDraftOrder = teamsData.map(team => team.id);
      }
      setCurrentDraftOrder(newDraftOrder);
    }
  }, [draftSettings, isLoadingDraftState, teamsData, isLoadingTeams]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: { active: { id: string }; over: { id: string } }) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setCurrentDraftOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newItems = [...items];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);
        return newItems;
      });
    }
  }, []);

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const { data: existingSettings, error: fetchError } = await supabase
        .from('draft_settings')
        .select('id')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSettings) {
        const { error } = await supabase
          .from('draft_settings')
          .update({ draft_order: currentDraftOrder })
          .eq('id', existingSettings.id);
        if (error) throw error;
      } else {
        // This case should ideally not happen if general settings are saved first
        const { error } = await supabase
          .from('draft_settings')
          .insert({ draft_order: currentDraftOrder, league_size: teamsData.length, roster_size: 15 }); // Provide defaults
        if (error) throw error;
      }

      await mutateDraftSettings(); // Re-fetch draft settings after saving

      toast({
        title: "Success",
        description: "Draft order saved successfully.",
      });
    } catch (error: unknown) {
      console.error('Error saving draft order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to save draft order: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const orderedTeams = currentDraftOrder
    .map(teamId => teamsData.find(team => team.id === teamId))
    .filter(Boolean) as { id: string; name: string }[];

  if (isLoadingDraftState || isLoadingTeams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft Order Management</CardTitle>
          <CardDescription>Loading draft order...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Order Management</CardTitle>
        <CardDescription>Manually set the draft order for the first round.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTitle>Draft Order Instructions</AlertTitle>
          <AlertDescription>
            Drag and drop teams to reorder them for the first round. The draft order will determine the picking order for all teams.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentDraftOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {orderedTeams.map((team, index) => (
                  <SortableTeamItem key={team.id} team={team} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          
          <Button
            onClick={handleSaveOrder}
            disabled={isSavingOrder || orderedTeams.length === 0}
            className="w-full"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavingOrder ? 'Saving...' : 'Save Draft Order'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
