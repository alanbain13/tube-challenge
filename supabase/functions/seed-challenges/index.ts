import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Station IDs from stations.json (GeoJSON format - 940GZZLU prefix)
// Victoria Line stations in order (south to north)
const VICTORIA_LINE_CONSECUTIVE = [
  '940GZZLUBXN',  // Brixton
  '940GZZLUSKW',  // Stockwell
  '940GZZLUVXL',  // Vauxhall
  '940GZZLUPCO',  // Pimlico
  '940GZZLUVIC',  // Victoria
];

// Circle Line key stations
const CIRCLE_LINE_STATIONS = [
  '940GZZLUPAD',  // Paddington
  '940GZZLUERC',  // Edgware Road (Circle)
  '940GZZLUBST',  // Baker Street
  '940GZZLUGPS',  // Great Portland Street
  '940GZZLUKSX',  // King's Cross St. Pancras
  '940GZZLUFAR',  // Farringdon
  '940GZZLUBBN',  // Barbican
  '940GZZLUMGT',  // Moorgate
  '940GZZLULVT',  // Liverpool Street
  '940GZZLUALD',  // Aldgate
  '940GZZLUTWR',  // Tower Hill
  '940GZZLUMMT',  // Monument
  '940GZZLUEMB',  // Embankment
  '940GZZLUWSM',  // Westminster
  '940GZZLUVIC',  // Victoria
  '940GZZLUSKS',  // Sloane Square
  '940GZZLUSSQ',  // South Kensington (fixed)
  '940GZZLUGTR',  // Gloucester Road
  '940GZZLUHSK',  // High Street Kensington
  '940GZZLUNHG',  // Notting Hill Gate
  '940GZZLUBWT',  // Bayswater
];

// Point-to-point stations
const KINGS_CROSS = '940GZZLUKSX';
const STRATFORD = '940GZZLUSTD';

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

    console.log(`Admin user ${user.id} authorized for seed-challenges`);
    console.log('🌱 Starting challenge seeding with correct station IDs...');

    // Get London Underground metro system ID
    const { data: metroSystem } = await supabase
      .from('metro_systems')
      .select('id')
      .eq('code', 'london')
      .single();

    if (!metroSystem) {
      throw new Error('London Underground metro system not found');
    }

    console.log('✅ Found London Underground metro system:', metroSystem.id);
    console.log('📍 Victoria Line stations:', VICTORIA_LINE_CONSECUTIVE);
    console.log('📍 Point-to-point:', { kingsCross: KINGS_CROSS, stratford: STRATFORD });

    // Prepare challenge data with CORRECT station IDs
    const newChallenges = [
      // 1. Sequenced Route Challenge - Victoria Line (visit in order)
      {
        name: 'Victoria Line Sprint',
        description: 'Visit 5 consecutive Victoria Line stations - Brixton to Victoria',
        metro_system_id: metroSystem.id,
        challenge_type: 'sequenced_route',
        is_official: true,
        is_sequenced: true,
        station_tfl_ids: VICTORIA_LINE_CONSECUTIVE,
        start_station_tfl_id: VICTORIA_LINE_CONSECUTIVE[0], // Brixton
        end_station_tfl_id: VICTORIA_LINE_CONSECUTIVE[4], // Victoria
        estimated_duration_minutes: 15,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
      // 2. Circle Line Unsequenced (any order)
      {
        name: 'Circle Line Explorer',
        description: 'Visit all Circle Line stations in any order',
        metro_system_id: metroSystem.id,
        challenge_type: 'unsequenced_route',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: CIRCLE_LINE_STATIONS,
        estimated_duration_minutes: 120,
        ranking_metric: 'time',
        difficulty: 'Medium',
      },
      // 3. Timed Challenge - 1 Hour
      {
        name: 'One Hour Rush',
        description: 'Visit as many stations as possible in 60 minutes',
        metro_system_id: metroSystem.id,
        challenge_type: 'timed',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [], // Any stations count
        time_limit_seconds: 3600, // 1 hour
        ranking_metric: 'stations',
        difficulty: 'Medium',
      },
      // 4. Station Count Challenge - 10 Stations
      {
        name: 'Ten Station Dash',
        description: 'Visit any 10 stations as fast as possible',
        metro_system_id: metroSystem.id,
        challenge_type: 'station_count',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [], // Any stations count
        target_station_count: 10,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
      // 5. Point-to-Point Challenge - King's Cross to Stratford
      {
        name: "King's Cross to Stratford",
        description: 'Travel from King\'s Cross to Stratford as fast as possible',
        metro_system_id: metroSystem.id,
        challenge_type: 'point_to_point',
        is_official: true,
        is_sequenced: false,
        station_tfl_ids: [KINGS_CROSS, STRATFORD],
        start_station_tfl_id: KINGS_CROSS,
        end_station_tfl_id: STRATFORD,
        estimated_duration_minutes: 20,
        ranking_metric: 'time',
        difficulty: 'Easy',
      },
    ];

    // Upsert challenges (update if exists, insert if not)
    const results = [];
    for (const challenge of newChallenges) {
      // Check if exists
      const { data: existing } = await supabase
        .from('challenges')
        .select('id, name')
        .eq('name', challenge.name)
        .maybeSingle();

      if (existing) {
        // Update existing challenge with correct station IDs
        const { data: updated, error } = await supabase
          .from('challenges')
          .update(challenge)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error(`❌ Error updating ${challenge.name}:`, error.message);
          results.push({ name: challenge.name, status: 'error', error: error.message });
        } else {
          console.log(`✅ Updated challenge: ${challenge.name} with stations:`, challenge.station_tfl_ids);
          results.push({ name: challenge.name, status: 'updated', id: updated.id, stations: challenge.station_tfl_ids });
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('challenges')
          .insert(challenge)
          .select()
          .single();

        if (error) {
          console.error(`❌ Error inserting ${challenge.name}:`, error.message);
          results.push({ name: challenge.name, status: 'error', error: error.message });
        } else {
          console.log(`✅ Inserted challenge: ${challenge.name} with stations:`, challenge.station_tfl_ids);
          results.push({ name: challenge.name, status: 'created', id: inserted.id, stations: challenge.station_tfl_ids });
        }
      }
    }

    console.log('✅ Seeding complete');

    return new Response(
      JSON.stringify({ 
        message: 'Challenge seeding complete', 
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error seeding challenges:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
