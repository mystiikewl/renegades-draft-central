import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom'; // Import Link for navigation

const AdminSettings: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
        <CardDescription>Manage various administrative aspects of the league.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>Draft Settings</CardTitle>
              <CardDescription>Configure draft rules, order, and pick trades.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to="/admin/draft">Go to Draft Settings</Link>
              </Button>
            </CardContent>
          </Card>
          {/* You can add more admin sections here later */}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminSettings;
