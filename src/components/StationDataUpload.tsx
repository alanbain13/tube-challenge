import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StationDataUploadProps {
  onDataUploaded: (data: any) => void;
  hasData: boolean;
}

const StationDataUpload: React.FC<StationDataUploadProps> = ({ onDataUploaded, hasData }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({
        title: "Invalid file type",
        description: "Please upload a JSON file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        
        // Store in localStorage for persistence
        localStorage.setItem('tube_stations_data', content);
        
        onDataUploaded(jsonData);
        
        toast({
          title: "Data uploaded successfully",
          description: "Your tube stations data has been loaded"
        });
      } catch (error) {
        toast({
          title: "Invalid JSON file",
          description: "Please check your file format",
          variant: "destructive"
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Failed to read the file",
        variant: "destructive"
      });
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  if (hasData) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Stations data loaded</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Stations Data</span>
        </CardTitle>
        <CardDescription>
          Upload your JSON file containing tube stations data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="stations-file">JSON File</Label>
          <Input
            id="stations-file"
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </div>
        {isUploading && (
          <p className="text-sm text-muted-foreground">Uploading...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StationDataUpload;