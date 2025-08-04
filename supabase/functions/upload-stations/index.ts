import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StationData {
  id?: string;
  tfl_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  zone: string | number;
  lines: string[];
  // Support various field name variations
  station_name?: string;
  lat?: number;
  lng?: number;
  lon?: number;
  geocoords?: {
    lat: number;
    lng: number;
  };
  zone_number?: string | number;
  line_names?: string[];
}

function processStationData(data: StationData[], source: string = 'uploaded'): any[] {
  return data.map((item, index) => ({
    tfl_id: item.tfl_id || item.id || `${source}-${index}`,
    name: item.name || item.station_name || 'Unknown Station',
    latitude: parseFloat(String(item.latitude || item.lat || item.geocoords?.lat || 0)),
    longitude: parseFloat(String(item.longitude || item.lng || item.lon || item.geocoords?.lng || 0)),
    zone: String(item.zone || item.zone_number || '1'),
    lines: Array.isArray(item.lines) ? item.lines : 
           Array.isArray(item.line_names) ? item.line_names :
           typeof item.lines === 'string' ? [item.lines] : []
  })).filter(station => station.latitude !== 0 && station.longitude !== 0);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { stationsData } = await req.json();
    
    if (!Array.isArray(stationsData)) {
      return new Response(
        JSON.stringify({ error: 'Invalid data format. Expected array of stations.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📥 Received ${stationsData.length} stations for upload`);

    // Process the station data
    const processedStations = processStationData(stationsData, 'custom');
    
    console.log(`✅ Processed ${processedStations.length} valid stations`);

    // Clear existing stations and insert new ones
    const { error: deleteError } = await supabase
      .from('stations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all stations
    
    if (deleteError) {
      console.error('❌ Error clearing stations:', deleteError);
      throw deleteError;
    }

    console.log('🗑️ Cleared existing stations');

    // Insert new stations in batches to avoid timeout
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < processedStations.length; i += batchSize) {
      const batch = processedStations.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('stations')
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
        throw insertError;
      }
      
      insertedCount += batch.length;
      console.log(`📦 Inserted batch ${i / batchSize + 1}/${Math.ceil(processedStations.length / batchSize)} (${insertedCount}/${processedStations.length} stations)`);
    }

    console.log(`🎉 Successfully uploaded ${insertedCount} stations to database`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully uploaded ${insertedCount} stations`,
        stationsCount: insertedCount 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Upload error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to upload stations', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});