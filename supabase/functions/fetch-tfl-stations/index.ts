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
    console.log('Fetching TfL Underground stations and line sequences...');
    
    // Fetch all Underground stations from TfL API
    const stationsResponse = await fetch(
      'https://api.tfl.gov.uk/StopPoint/Mode/tube',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!stationsResponse.ok) {
      throw new Error(`TfL API error: ${stationsResponse.status} ${stationsResponse.statusText}`);
    }

    const tflData = await stationsResponse.json();
    console.log(`Fetched ${tflData.stopPoints?.length || 0} stations from TfL`);

    // Filter for actual Underground stations only and group by name
    const stationGroups = new Map();
    
    tflData.stopPoints?.forEach((station: any) => {
      // Only include stations that have tube lines and are actual Underground stations
      const hasUndergroundLines = station.lines?.some((line: any) => 
        ['bakerloo', 'central', 'circle', 'district', 'hammersmith-city',
         'jubilee', 'metropolitan', 'northern', 'piccadilly', 'victoria', 
         'waterloo-city', 'elizabeth'].includes(line.id)
      );
      
      if (!hasUndergroundLines) return;
      
      const stationName = station.commonName;
      if (!stationGroups.has(stationName)) {
        stationGroups.set(stationName, {
          id: station.id,
          tfl_id: station.id,
          name: stationName,
          latitude: station.lat,
          longitude: station.lon,
          zone: station.zone || '1',
          lines: new Set(station.lines?.map((line: any) => line.name) || [])
        });
      } else {
        // If station already exists, merge the lines
        const existing = stationGroups.get(stationName);
        station.lines?.forEach((line: any) => existing.lines.add(line.name));
      }
    });

    // Convert back to array format with lines as array
    const stations = Array.from(stationGroups.values()).map(station => ({
      ...station,
      lines: Array.from(station.lines)
    }));

    console.log(`Filtered and grouped ${tflData.stopPoints?.length || 0} points into ${stations.length} Underground stations`);

    // Fetch line sequences for major tube lines
    const tubeLines = [
      'bakerloo', 'central', 'circle', 'district', 'hammersmith-city',
      'jubilee', 'metropolitan', 'northern', 'piccadilly', 'victoria', 'waterloo-city'
    ];

    const lineSequences: { [key: string]: any } = {};
    
    for (const lineId of tubeLines) {
      try {
        console.log(`Fetching sequence for ${lineId} line...`);
        const lineResponse = await fetch(
          `https://api.tfl.gov.uk/Line/${lineId}/Route/Sequence/all`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (lineResponse.ok) {
          const lineData = await lineResponse.json();
          lineSequences[lineId] = lineData;
          console.log(`Fetched ${lineId} line sequence with ${lineData.stations?.length || 0} stations`);
        } else {
          console.warn(`Failed to fetch ${lineId} line sequence: ${lineResponse.status}`);
        }
      } catch (lineError) {
        console.error(`Error fetching ${lineId} line:`, lineError);
      }
    }

    return new Response(JSON.stringify({ stations, lineSequences }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching TfL data:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch TfL data',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});