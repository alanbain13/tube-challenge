import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TfLStation {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  zone: string;
  lines: Array<{
    id: string;
    name: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching TfL Underground stations...');
    
    // Fetch all Underground stations from TfL API
    const response = await fetch(
      'https://api.tfl.gov.uk/StopPoint/Mode/tube',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TfL API error: ${response.status} ${response.statusText}`);
    }

    const tflData = await response.json();
    console.log(`Fetched ${tflData.stopPoints?.length || 0} stations from TfL`);

    // Transform TfL data to our format
    const stations = tflData.stopPoints?.map((station: any) => ({
      id: station.id,
      tfl_id: station.id,
      name: station.commonName,
      latitude: station.lat,
      longitude: station.lon,
      zone: station.zone || '1', // Default to zone 1 if not specified
      lines: station.lines?.map((line: any) => line.name) || []
    })) || [];

    console.log(`Transformed ${stations.length} stations`);

    return new Response(JSON.stringify({ stations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching TfL stations:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch TfL station data',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});