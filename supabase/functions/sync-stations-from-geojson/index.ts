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

    console.log('Fetching GeoJSON data...');
    
    // Fetch the GeoJSON file from public storage
    const geojsonUrl = `${supabaseUrl}/storage/v1/object/public/data/stations.json`;
    
    let geojsonData;
    try {
      const response = await fetch(geojsonUrl);
      if (!response.ok) {
        throw new Error(`GeoJSON not in storage (${response.status}), trying request body`);
      }
      geojsonData = await response.json();
    } catch {
      // If storage doesn't work, try to get it from the request body
      const body = await req.json();
      if (body.geojsonData) {
        geojsonData = body.geojsonData;
      } else {
        throw new Error('Could not load GeoJSON data. Please provide it in the request body as { geojsonData: {...} }');
      }
    }

    console.log('Processing stations from GeoJSON...');
    
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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (clearError) {
      console.error('Error clearing stations:', clearError);
    }

    let insertedCount = 0;
    let errors = 0;

    // Insert stations from GeoJSON
    for (const feature of stationFeatures) {
      const tflId = feature.properties.id;
      const name = feature.properties.name;
      const zone = feature.properties.zone || '1';
      const coordinates = feature.geometry.coordinates;
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      
      // Extract line names from the lines array
      const lines = feature.properties.lines?.map((l: any) => l.name) || [];

      try {
        const { error } = await supabase
          .from('stations')
          .insert({
            tfl_id: tflId,
            name: name,
            zone: String(zone),
            lines: lines,
            longitude: longitude,
            latitude: latitude,
            metro_system_id: null // Will be set later if needed
          });

        if (error) {
          console.error(`Error inserting station ${tflId}:`, error);
          errors++;
        } else {
          insertedCount++;
        }
      } catch (err) {
        console.error(`Exception inserting station ${tflId}:`, err);
        errors++;
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
