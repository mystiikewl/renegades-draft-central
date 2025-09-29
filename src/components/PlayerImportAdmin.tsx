import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { parseCSV, mapPlayerToSupabaseSchema, validatePlayer, PlayerData, ImportResult } from '@/utils/playerImport';
import { supabase } from '@/integrations/supabase/client';
import { PlayerEditing } from './PlayerEditing';

// Define the steps for the import process
enum ImportStep {
  UPLOAD = 'upload',
  FIELD_MAPPING = 'field_mapping',
  PREVIEW = 'preview',
  CONFIRM = 'confirm',
  EDIT = 'edit',
}

enum ImportMode {
  OVERWRITE = 'overwrite',
  UPSERT = 'upsert',
}

export const PlayerImportAdmin = () => {
  const [currentStep, setCurrentStep] = useState<ImportStep>(ImportStep.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [parsedCsvData, setParsedCsvData] = useState<Record<string, string>[]>([]);
  const [mappedPlayers, setMappedPlayers] = useState<PlayerData[]>([]);
  const [validationResults, setValidationResults] = useState<Array<{ isValid: boolean; errors: string[]; player: PlayerData }>>([]);
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>(ImportMode.OVERWRITE); // New state for import mode
  const { toast } = useToast();

  // Define expected database fields and their types for mapping
  const databaseFields = [
    { key: 'rank', label: 'Rank', type: 'number' },
    { key: 'name', label: 'Player Name', type: 'string', required: true },
    { key: 'position', label: 'Position', type: 'string', required: true },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'nba_team', label: 'NBA Team', type: 'string', required: true },
    { key: 'games_played', label: 'Games Played', type: 'number' },
    { key: 'minutes_per_game', label: 'Minutes Per Game', type: 'number' },
    { key: 'field_goals_made', label: 'Field Goals Made', type: 'number' },
    { key: 'field_goal_percentage', label: 'Field Goal Percentage', type: 'number' },
    { key: 'free_throw_percentage', label: 'Free Throw Percentage', type: 'number' },
    { key: 'three_pointers_made', label: 'Three Pointers Made', type: 'number' },
    { key: 'three_point_percentage', label: 'Three Point Percentage', type: 'number' },
    { key: 'points', label: 'Points', type: 'number' },
    { key: 'total_rebounds', label: 'Total Rebounds', type: 'number' },
    { key: 'assists', label: 'Assists', type: 'number' },
    { key: 'steals', label: 'Steals', type: 'number' },
    { key: 'blocks', label: 'Blocks', type: 'number' },
    { key: 'turnovers', label: 'Turnovers', type: 'number' },
    { key: 'is_rookie', label: 'Is Rookie', type: 'boolean' },
  ];

  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>(() => {
    const initialMappings: Record<string, string> = {};
    databaseFields.forEach(field => {
      // Attempt to pre-map common CSV header names to database fields
      const commonCsvNames: Record<string, string> = {
        'Player Name': 'name', 'Player': 'name',
        'Position': 'position', 'Pos': 'position',
        'NBA Team': 'nba_team', 'Team': 'nba_team',
        'Rank': 'rank',
        'Age': 'age', 'GP': 'games_played', 'MPG': 'minutes_per_game',
        'FGM': 'field_goals_made', 'FG%': 'field_goal_percentage',
        'FT%': 'free_throw_percentage', '3PM': 'three_pointers_made',
        '3P%': 'three_point_percentage', 'PTS': 'points', 'TREB': 'total_rebounds',
        'AST': 'assists', 'STL': 'steals', 'BLK': 'blocks', 'TO': 'turnovers',
        'Rookie': 'is_rookie',
      };
      const mappedCsvHeader = Object.keys(commonCsvNames).find(csvName => commonCsvNames[csvName] === field.key);
      if (mappedCsvHeader) {
        initialMappings[field.key] = mappedCsvHeader;
      }
    });
    return initialMappings;
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      // Reset state for new file
      setCsvHeaders([]);
      setParsedCsvData([]);
      setMappedPlayers([]);
      setValidationResults([]);
      setFieldMappings({}); // Reset mappings for new file
    }
  };

  const handleParseFile = async () => {
    if (!file) {
      toast({ title: "Error", description: "Please select a CSV file.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const csvText = await file.text();
      const parsedData = parseCSV(csvText);
      if (parsedData.length === 0) {
        toast({ title: "Error", description: "No data found in CSV file.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const headers = Object.keys(parsedData[0]);
      setCsvHeaders(headers);
      setParsedCsvData(parsedData);

      // Attempt to pre-map fields based on headers
      const newMappings: Record<string, string> = {};
      databaseFields.forEach(dbField => {
        const matchingCsvHeader = headers.find(header => 
          header.toLowerCase().replace(/[^a-z0-9]/g, '') === dbField.label.toLowerCase().replace(/[^a-z0-9]/g, '') ||
          header.toLowerCase().replace(/[^a-z0-9]/g, '') === dbField.key.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (matchingCsvHeader) {
          newMappings[dbField.key] = matchingCsvHeader;
        } else {
          // Fallback to common names if direct match not found
          const commonCsvNames: Record<string, string> = {
            'Player Name': 'name', 'Player': 'name',
            'Position': 'position', 'Pos': 'position',
            'NBA Team': 'nba_team', 'Team': 'nba_team',
            'Rank': 'rank',
            'Age': 'age', 'GP': 'games_played', 'MPG': 'minutes_per_game',
            'FGM': 'field_goals_made', 'FG%': 'field_goal_percentage',
            'FT%': 'free_throw_percentage', '3PM': 'three_pointers_made',
            '3P%': 'three_point_percentage', 'PTS': 'points', 'TREB': 'total_rebounds',
            'AST': 'assists', 'STL': 'steals', 'BLK': 'blocks', 'TO': 'turnovers',
            'Rookie': 'is_rookie',
          };
          const preMappedCsvHeader = Object.keys(commonCsvNames).find(csvName => commonCsvNames[csvName] === dbField.key);
          if (preMappedCsvHeader && headers.includes(preMappedCsvHeader)) {
            newMappings[dbField.key] = preMappedCsvHeader;
          }
        }
      });
      setFieldMappings(newMappings);

      setCurrentStep(ImportStep.FIELD_MAPPING);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({ title: "Error", description: "Failed to parse CSV file. Please check format.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (dbFieldKey: string, csvHeader: string) => {
    setFieldMappings(prev => ({ ...prev, [dbFieldKey]: csvHeader }));
  };

  const handleApplyMapping = () => {
    const mapped: PlayerData[] = [];
    const validationResults: Array<{ isValid: boolean; errors: string[]; player: PlayerData }> = [];

    for (const csvPlayer of parsedCsvData) {
      const tempPlayer: Record<string, string> = {};
      for (const dbField of databaseFields) {
        const csvHeader = fieldMappings[dbField.key];
        if (csvHeader && csvPlayer[csvHeader] !== undefined) {
          tempPlayer[dbField.key] = csvPlayer[csvHeader];
        }
      }
      const player = mapPlayerToSupabaseSchema(tempPlayer);
      const validation = validatePlayer(player);
      mapped.push(player);
      validationResults.push({ ...validation, player });
    }

    setMappedPlayers(mapped);
    setValidationResults(validationResults);
    setCurrentStep(ImportStep.PREVIEW);
  };

  const handleImportPlayers = async () => {
    setLoading(true);
    try {
      const validPlayersToImport = mappedPlayers.filter((_, index) => validationResults[index].isValid);

      if (validPlayersToImport.length === 0) {
        toast({ title: "Error", description: "No valid players to import.", variant: "destructive" });
        setLoading(false);
        return;
      }

      let successCount = 0;
      const errorMessages: string[] = [];
      const batchSize = 50;

      if (importMode === ImportMode.OVERWRITE) {
        // Clear existing players first
        const { error: deleteError } = await supabase.from('players').delete().gte('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) {
          throw deleteError;
        }

        // Insert new players in batches
        for (let i = 0; i < validPlayersToImport.length; i += batchSize) {
          const batch = validPlayersToImport.slice(i, i + batchSize);
          const { data, error } = await supabase
            .from('players')
            .insert(batch)
            .select();

          if (error) {
            errorMessages.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
          } else {
            successCount += data.length;
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }
      } else if (importMode === ImportMode.UPSERT) {
        // Upsert players in batches
        for (let i = 0; i < validPlayersToImport.length; i += batchSize) {
          const batch = validPlayersToImport.slice(i, i + batchSize);
          const { data, error } = await supabase
            .from('players')
            .upsert(batch, { onConflict: 'name' }) // Assuming 'name' is a unique identifier for upsert
            .select();

          if (error) {
            errorMessages.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
          } else {
            successCount += data.length;
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }
      }

      if (errorMessages.length > 0) {
        toast({
          title: "Partial Import Success",
          description: `Imported ${successCount} players with some errors.`,
          variant: "destructive"
        });
        console.error("Import errors:", errorMessages);
      } else {
        toast({
          title: "Success",
          description: `Successfully imported ${successCount} players.`,
        });
      }

      // Reset to upload step after successful import
      setCurrentStep(ImportStep.UPLOAD);
      setFile(null);
      setCsvHeaders([]);
      setParsedCsvData([]);
      setMappedPlayers([]);
      setValidationResults([]);
      setFieldMappings({});

    } catch (error) {
      console.error('Import error:', error);
      toast({ title: "Error", description: "Failed to import players.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Upload CSV</CardTitle>
        <CardDescription>Select a CSV file containing player data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>
        <Button onClick={handleParseFile} disabled={!file || loading}>
          {loading ? "Parsing..." : "Next: Map Fields"}
        </Button>
      </CardContent>
    </Card>
  );

  const renderFieldMappingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Field Mapping</CardTitle>
        <CardDescription>Map your CSV columns to the database fields.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Database Field</TableHead>
              <TableHead>CSV Column</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {databaseFields.map(dbField => (
              <TableRow key={dbField.key}>
                <TableCell className={dbField.required ? 'font-medium' : ''}>
                  {dbField.label} {dbField.required && <span className="text-red-500">*</span>}
                </TableCell>
                <TableCell>
                  <Select
                    value={fieldMappings[dbField.key] || "__skip__"}
                    onValueChange={(value) => handleMappingChange(dbField.key, value === "__skip__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select CSV Column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">(Skip)</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(ImportStep.UPLOAD)}>Back</Button>
          <Button onClick={handleApplyMapping}>Next: Preview Data</Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderPreviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Data Preview & Validation</CardTitle>
        <CardDescription>Review the mapped data and address any validation errors.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[500px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {databaseFields.map(field => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validationResults.slice(0, 50).map((result, index) => ( // Show first 50 rows for preview
                <TableRow key={index} className={!result.isValid ? 'bg-red-100' : ''}>
                  {databaseFields.map(field => (
                    <TableCell key={field.key}>
                      {String(result.player[field.key as keyof PlayerData] || '')}
                    </TableCell>
                  ))}
                  <TableCell>
                    {result.isValid ? (
                      <span className="text-green-600">Valid</span>
                    ) : (
                      <span className="text-red-600" title={result.errors.join('\n')}>Invalid ({result.errors.length} errors)</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {validationResults.length > 50 && (
          <p className="text-sm text-muted-foreground">Showing first 50 rows. Total rows: {validationResults.length}</p>
        )}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(ImportStep.FIELD_MAPPING)}>Back</Button>
          <Button onClick={() => setCurrentStep(ImportStep.CONFIRM)} disabled={loading}>
            Next: Confirm Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderConfirmStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Import</CardTitle>
        <CardDescription>
          You are about to import {mappedPlayers.filter(p => validatePlayer(p).isValid).length} valid players.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Import Mode</Label>
          <RadioGroup value={importMode} onValueChange={(value: ImportMode) => setImportMode(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={ImportMode.OVERWRITE} id="overwrite" />
              <Label htmlFor="overwrite">Overwrite All Existing Players</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={ImportMode.UPSERT} id="upsert" />
              <Label htmlFor="upsert">Add New / Update Existing Players (by Name)</Label>
            </div>
          </RadioGroup>
          <p className="text-sm text-muted-foreground">
            {importMode === ImportMode.OVERWRITE
              ? "Choosing this option will delete all current player data before importing the new CSV data."
              : "Choosing this option will add new players if their names don't exist, and update existing players if their names match."}
          </p>
        </div>
        <Button onClick={handleImportPlayers} disabled={loading} className="w-full">
          {loading ? "Importing..." : "Confirm and Import Players"}
        </Button>
        <Button variant="outline" onClick={() => setCurrentStep(ImportStep.PREVIEW)} className="w-full">
          Back to Preview
        </Button>
      </CardContent>
    </Card>
  );

  const renderPlayerEditing = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player Data Editing</CardTitle>
          <CardDescription>Manage and edit individual player records.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerEditing onBackToImport={() => setCurrentStep(ImportStep.UPLOAD)} />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-4">
        <Button 
          variant={currentStep === ImportStep.UPLOAD || currentStep === ImportStep.FIELD_MAPPING || currentStep === ImportStep.PREVIEW || currentStep === ImportStep.CONFIRM ? "default" : "outline"}
          onClick={() => setCurrentStep(ImportStep.UPLOAD)}
        >
          Import Players
        </Button>
        <Button 
          variant={currentStep === ImportStep.EDIT ? "default" : "outline"}
          onClick={() => setCurrentStep(ImportStep.EDIT)}
        >
          Edit Players
        </Button>
      </div>

      {currentStep === ImportStep.UPLOAD && renderUploadStep()}
      {currentStep === ImportStep.FIELD_MAPPING && renderFieldMappingStep()}
      {currentStep === ImportStep.PREVIEW && renderPreviewStep()}
      {currentStep === ImportStep.CONFIRM && renderConfirmStep()}
      {currentStep === ImportStep.EDIT && renderPlayerEditing()}
    </div>
  );
};
