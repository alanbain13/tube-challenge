import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing GeoJSON data from request body...');
    
    // Get GeoJSON from request body
    const body = await req.json();
    if (!body.geojsonData) {
      throw new Error('GeoJSON data required in request body as { geojsonData: {...} }');
    }
    const geojsonData = body.geojsonData;

    // Extract station features (Point type) - station-level IDs only
    const stationFeatures = geojsonData.features.filter(
      (feature: any) => feature.geometry.type === 'Point' && 
                       feature.properties.id && 
                       (feature.properties.id.startsWith('940G') || 
                        feature.properties.id.startsWith('910G') ||
                        feature.properties.id === 'HUBPAD')
    );

    console.log(`Found ${stationFeatures.length} station features in GeoJSON`);

    // Clear existing stations
    console.log('Clearing existing stations...');
    const { error: clearError } = await supabase
      .from('stations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (clearError) {
      console.error('Error clearing stations:', clearError);
      throw new Error(`Failed to clear stations: ${clearError.message}`);
    }

    // Prepare all stations for batch insert
    const stationsToInsert = stationFeatures.map((feature: any) => {
      const tflId = feature.properties.id;
      const name = feature.properties.name;
      const zone = feature.properties.zone || '1';
      const coordinates = feature.geometry.coordinates;
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      const lines = feature.properties.lines?.map((l: any) => l.name) || [];

      return {
        tfl_id: tflId,
        name: name,
        zone: String(zone),
        lines: lines,
        longitude: longitude,
        latitude: latitude,
        metro_system_id: null
      };
    });

    // Batch insert in chunks of 100 to avoid payload limits
    const CHUNK_SIZE = 100;
    let insertedCount = 0;
    let errors = 0;

    for (let i = 0; i < stationsToInsert.length; i += CHUNK_SIZE) {
      const chunk = stationsToInsert.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('stations')
        .insert(chunk);

      if (error) {
        console.error(`Error inserting chunk ${i / CHUNK_SIZE + 1}:`, error);
        errors += chunk.length;
      } else {
        insertedCount += chunk.length;
      }
    }

    console.log(`Inserted ${insertedCount} stations, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${insertedCount} stations from GeoJSON`,
        insertedCount,
        errors,
        totalProcessed: stationFeatures.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error syncing stations from GeoJSON:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
