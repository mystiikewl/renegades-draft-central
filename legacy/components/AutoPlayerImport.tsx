import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importPlayersFromCSV, getPlayerCount, type ImportResult } from '@/utils/playerImport';

export const AutoPlayerImport = () => {
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getPlayerCount();
      setPlayerCount(count);
    };
    fetchCount();
  }, []);

  const handleAutoImport = async () => {
    setLoading(true);
    setImportResult(null);

    try {
      // Fetch the CSV file from the public directory or project root
      // Note: In a real deployment, you'd want to place this file in the public directory
      // For now, we'll simulate the CSV content or provide instructions
      
      const csvContent = await fetchCSVContent();
      
      if (!csvContent) {
        toast({
          title: "Error",
          description: "Could not load NBA player data. Please ensure the CSV file is available.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const result = await importPlayersFromCSV(csvContent);
      setImportResult(result);

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully imported ${result.importedPlayers} players`,
        });
        
        // Update player count
        const newCount = await getPlayerCount();
        setPlayerCount(newCount);
      } else {
        toast({
          title: "Import Failed",
          description: result.errors[0] || "Unknown error occurred",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Error",
        description: "Failed to import players. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCSVContent = async (): Promise<string | null> => {
    try {
      // Try to fetch from public directory first
      const response = await fetch('/nba_player_stats_complete.csv');
      if (response.ok) {
        return await response.text();
      }
      
      // If not found, return null and show instructions
      return null;
    } catch (error) {
      console.error('Error fetching CSV:', error);
      return null;
    }
  };

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          NBA Player Database Import
        </CardTitle>
        <CardDescription>
          Import NBA player statistics from the project CSV file. 
          Current players in database: {playerCount !== null ? playerCount : 'Loading...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Import Button */}
        <Button 
          onClick={handleAutoImport} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? "Importing Players..." : "Import NBA Player Data"}
        </Button>

        {/* Loading Progress */}
        {loading && (
          <div className="space-y-2">
            <Progress value={undefined} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Processing player data and updating database...
            </p>
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div className="space-y-4">
            <Alert className={importResult.success ? "border-green-200" : "border-red-200"}>
              <div className="flex items-center gap-2">
                {getStatusIcon(importResult.success)}
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">
                      {importResult.success ? "Import Completed" : "Import Failed"}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>Total players processed: {importResult.totalPlayers}</p>
                      <p>Valid players: {importResult.validPlayers}</p>
                      <p>Invalid players: {importResult.invalidPlayers}</p>
                      <p>Successfully imported: {importResult.importedPlayers}</p>
                    </div>
                  </div>
                </AlertDescription>
              </div>
            </Alert>

            {/* Invalid Players Details */}
            {importResult.invalidPlayerDetails.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Players with validation errors:</p>
                    <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {importResult.invalidPlayerDetails.map(({ player, errors }, index) => (
                        <div key={index} className="border-l-2 border-yellow-200 pl-2">
                          <p className="font-medium">{player}</p>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {errors.map((error, errorIndex) => (
                              <li key={errorIndex}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Import Errors */}
            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Import errors:</p>
                    <ul className="text-sm space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Copy <code>nba_player_stats_complete.csv</code> to the <code>public</code> directory</li>
            <li>Click "Import NBA Player Data" to load all player statistics</li>
            <li>The import will clear existing data and load fresh player information</li>
          </ol>
          
          <div className="mt-4 p-3 bg-muted rounded-lg overflow-x-auto">
            <p className="font-medium">Expected CSV format:</p>
            <code className="text-xs whitespace-nowrap">
              Rank,Overall,Conference,Regional,Player,Position,Age,Team,GP,MPG,FGM,FG%,FT%,3PM,3P%,PTS,TREB,AST,STL,BLK,TO,DD,Total
            </code>
          </div>
        </div>

        {/* Current Database Status */}
        {playerCount !== null && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Database Status:</span> {playerCount} players currently stored
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
