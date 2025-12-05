import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

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

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log(`Admin user ${user.id} authorized for fetch-tfl-stations`);
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
        details: error instanceof Error ? error.message : String(error) 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
