import React from 'react';
import { DraftOrderManager } from '@/components/admin/DraftOrderManager';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { ListOrdered } from 'lucide-react';

const DraftOrderManagerPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/draft">Draft Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Draft Order</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <ListOrdered className="h-8 w-8" />
            Draft Order Management
          </h1>
          <p className="text-muted-foreground">Manage the draft order for all rounds.</p>
        </div>
        
        <DraftOrderManager />
        
        <div className="flex justify-between">
          <Button asChild variant="outline">
            <Link to="/admin/draft">← Back to Draft Admin Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftOrderManagerPage;
