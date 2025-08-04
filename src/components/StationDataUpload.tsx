import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StationDataUploadProps {
  onDataUploaded: () => void;
  hasData: boolean;
}

const StationDataUpload: React.FC<StationDataUploadProps> = ({ onDataUploaded, hasData }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        
        if (!Array.isArray(jsonData)) {
          toast({
            title: "Invalid JSON format",
            description: "Expected an array of station data",
            variant: "destructive"
          });
          return;
        }

        // Upload to backend
        const { data, error } = await supabase.functions.invoke('upload-stations', {
          body: { stationsData: jsonData }
        });

        if (error) {
          console.error('Upload error:', error);
          toast({
            title: "Upload failed",
            description: error.message || "Failed to upload station data",
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Data uploaded successfully",
          description: `${data.stationsCount} stations stored in database`
        });

        onDataUploaded();
        
      } catch (error) {
        console.error('File processing error:', error);
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>{hasData ? 'Replace Data' : 'Upload Stations Data'}</span>
        </CardTitle>
        <CardDescription>
          {hasData 
            ? 'Upload a new JSON file to replace the current stations data'
            : 'Upload your JSON file to permanently store tube stations data in the database'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasData && (
          <div className="flex items-center space-x-2 text-green-600 mb-4">
            <Database className="h-5 w-5" />
            <span className="text-sm font-medium">Custom stations currently loaded</span>
          </div>
        )}
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
          <p className="text-sm text-muted-foreground">Uploading to database...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StationDataUpload;