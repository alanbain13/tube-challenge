import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Station IDs from stations.json (GeoJSON format - 940GZZLU prefix)
const STATION_IDS = {
  // Victoria Line stations (south to north)
  brixton: '940GZZLUBXN',
  stockwell: '940GZZLUSKW',
  vauxhall: '940GZZLUVXL',
  pimlico: '940GZZLUPCO',
  victoria: '940GZZLUVIC',
  greenPark: '940GZZLUGPK',
  oxfordCircus: '940GZZLUOXC',
  warrenStreet: '940GZZLUWRR',
  euston: '940GZZLUEUS',
  kingsCross: '940GZZLUKSX',
  highburyIslington: '940GZZLUHBN',
  finsburyPark: '940GZZLUFPK',
  sevenSisters: '940GZZLUSST',
  tottenhamHale: '940GZZLUTML',
  blackhorseRoad: '940GZZLUBLR',
  walthamstowCentral: '940GZZLUWWL',
  
  // Circle Line key stations
  paddington: '940GZZLUPAD',
  edgwareRoad: '940GZZLUERC',
  bakerStreet: '940GZZLUBST',
  greatPortlandStreet: '940GZZLUGPS',
  kingsXStPancras: '940GZZLUKSX',
  farringdon: '940GZZLUFAR',
  barbican: '940GZZLUBBN',
  moorgate: '940GZZLUMGT',
  liverpool: '940GZZLULVT',
  aldgate: '940GZZLUALD',
  towerHill: '940GZZLUTWR',
  monument: '940GZZLUMMT',
  cannon: '940GZZLUCST',
  mansion: '940GZZLUMSH',
  blackfriars: '940GZZLUBKF',
  temple: '940GZZLUTML',
  embankment: '940GZZLUEMB',
  westminster: '940GZZLUWSM',
  stJames: '940GZZLUSJP',
  victoriaCircle: '940GZZLUVIC',
  sloane: '940GZZLUSKS',
  southKensington: '940GZZLUSKS',
  gloucesterRoad: '940GZZLUGTR',
  highStreetKensington: '940GZZLUHSK',
  nottingHillGate: '940GZZLUNHG',
  bayswater: '940GZZLUBWT',
  
  // Point-to-point
  stratford: '940GZZLUSTD',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Victoria Line stations sequence (5 stations for sprint)
    const victoriaLineStations = [
      STATION_IDS.brixton,
      STATION_IDS.stockwell,
      STATION_IDS.vauxhall,
      STATION_IDS.pimlico,
      STATION_IDS.victoria,
    ];

    // Circle Line stations (subset for explorer)
    const circleLineStations = [
      STATION_IDS.paddington,
      STATION_IDS.edgwareRoad,
      STATION_IDS.bakerStreet,
      STATION_IDS.greatPortlandStreet,
      STATION_IDS.kingsXStPancras,
      STATION_IDS.farringdon,
      STATION_IDS.barbican,
      STATION_IDS.moorgate,
      STATION_IDS.liverpool,
      STATION_IDS.aldgate,
      STATION_IDS.towerHill,
      STATION_IDS.monument,
      STATION_IDS.embankment,
      STATION_IDS.westminster,
      STATION_IDS.victoriaCircle,
      STATION_IDS.gloucesterRoad,
      STATION_IDS.highStreetKensington,
      STATION_IDS.nottingHillGate,
      STATION_IDS.bayswater,
    ];

    // Prepare challenge data with CORRECT station IDs
    const newChallenges = [
      // 1. Sequenced Route Challenge - Victoria Line (visit in order)
      {
        name: 'Victoria Line Sprint',
        description: 'Visit 5 Victoria Line stations in sequence - Brixton to Victoria',
        metro_system_id: metroSystem.id,
        challenge_type: 'sequenced_route',
        is_official: true,
        is_sequenced: true,
        station_tfl_ids: victoriaLineStations,
        start_station_tfl_id: STATION_IDS.brixton,
        end_station_tfl_id: STATION_IDS.victoria,
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
        station_tfl_ids: circleLineStations,
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
        station_tfl_ids: [STATION_IDS.kingsCross, STATION_IDS.stratford],
        start_station_tfl_id: STATION_IDS.kingsCross,
        end_station_tfl_id: STATION_IDS.stratford,
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
          console.log(`✅ Updated challenge: ${challenge.name}`);
          results.push({ name: challenge.name, status: 'updated', id: updated.id });
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
          console.log(`✅ Inserted challenge: ${challenge.name}`);
          results.push({ name: challenge.name, status: 'created', id: inserted.id });
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
