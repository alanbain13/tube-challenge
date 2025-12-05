import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAdminRole(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  if (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
  
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract and verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has admin role
    const isAdmin = await verifyAdminRole(supabase, user.id);
    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin user ${user.id} authorized for update-station-zones`);
    console.log('Fetching stations GeoJSON...');
    
    // Fetch the GeoJSON file from the public directory
    const geojsonUrl = `${supabaseUrl.replace('.supabase.co', '.supabase.co')}/storage/v1/object/public/data/stations.json`;
    
    // Try fetching from the local path first (works in dev/production)
    let geojsonData;
    try {
      const response = await fetch('https://demmocgrnvkjbzxlhcdz.supabase.co/storage/v1/object/public/data/stations.json');
      if (!response.ok) {
        throw new Error('GeoJSON not in storage, will try alternative');
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

    console.log('Processing station zones...');
    
    // Extract station features (Point type)
    const stationFeatures = geojsonData.features.filter(
      (feature: any) => feature.geometry.type === 'Point'
    );

    console.log(`Found ${stationFeatures.length} station features in GeoJSON`);

    let updatedCount = 0;
    let errors = 0;

    // Update zones for each station
    for (const feature of stationFeatures) {
      const tflId = feature.properties.id || feature.properties.station_id || feature.properties.tfl_id;
      const zone = feature.properties.zone || feature.properties.zones;

      if (!tflId || !zone || zone === '1') {
        // Skip if no tfl_id or zone, or if zone is just '1' (likely default)
        continue;
      }

      try {
        const { error } = await supabase
          .from('stations')
          .update({ zone: String(zone) })
          .eq('tfl_id', tflId);

        if (error) {
          console.error(`Error updating station ${tflId}:`, error);
          errors++;
        } else {
          updatedCount++;
        }
      } catch (err) {
        console.error(`Exception updating station ${tflId}:`, err);
        errors++;
      }
    }

    console.log(`Updated ${updatedCount} stations, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedCount} station zones`,
        updatedCount,
        errors,
        totalProcessed: stationFeatures.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error updating station zones:', error);
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
