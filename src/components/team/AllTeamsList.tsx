import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface AllTeamsListProps {
  teamsData: Team[];
}

export const AllTeamsList = ({ teamsData }: AllTeamsListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Teams</CardTitle>
        <CardDescription>League members and their teams</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teamsData.map((team) => (
            <div key={team.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-lg">
              <div className="mb-2 sm:mb-0">
                <h4 className="font-medium">{team.name}</h4>
                <p className="text-sm text-muted-foreground break-all">
                  {team.owner_email || 'No owner'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
