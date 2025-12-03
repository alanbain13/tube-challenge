import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Badge {
  id: string;
  name: string;
  badge_type: string;
  criteria: {
    threshold?: number;
    zone?: string;
    line?: string;
  } | null;
}

interface Station {
  tfl_id: string;
  zone: string;
  lines: string[];
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

    const { user_id, activity_id } = await req.json();

    if (!user_id) {
      console.error('Missing user_id in request');
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Evaluating badges for user ${user_id}, activity ${activity_id || 'N/A'}`);

    // Get all badges with criteria
    const { data: allBadges, error: badgesError } = await supabase
      .from('badges')
      .select('id, name, badge_type, criteria')
      .not('criteria', 'is', null);

    if (badgesError) {
      console.error('Error fetching badges:', badgesError);
      throw badgesError;
    }

    console.log(`Found ${allBadges?.length || 0} badges with criteria`);

    // Get user's already earned badge IDs
    const { data: earnedBadges, error: earnedError } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user_id);

    if (earnedError) {
      console.error('Error fetching earned badges:', earnedError);
      throw earnedError;
    }

    const earnedBadgeIds = new Set(earnedBadges?.map(eb => eb.badge_id) || []);
    console.log(`User has ${earnedBadgeIds.size} earned badges`);

    // Filter to unearned badges only
    const unearnedBadges = (allBadges as Badge[])?.filter(b => !earnedBadgeIds.has(b.id)) || [];
    console.log(`Checking ${unearnedBadges.length} unearned badges`);

    if (unearnedBadges.length === 0) {
      return new Response(
        JSON.stringify({ awarded: [], message: 'No unearned badges to evaluate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's verified station visits (unique stations)
    const { data: userVisits, error: visitsError } = await supabase
      .from('station_visits')
      .select('station_tfl_id')
      .eq('user_id', user_id)
      .eq('status', 'verified');

    if (visitsError) {
      console.error('Error fetching user visits:', visitsError);
      throw visitsError;
    }

    const visitedStationIds = new Set(
      userVisits?.map(v => v.station_tfl_id).filter(Boolean) || []
    );
    const totalUniqueVisits = visitedStationIds.size;
    console.log(`User has visited ${totalUniqueVisits} unique stations`);

    // Get all stations for zone/line evaluation
    const { data: allStations, error: stationsError } = await supabase
      .from('stations')
      .select('tfl_id, zone, lines');

    if (stationsError) {
      console.error('Error fetching stations:', stationsError);
      throw stationsError;
    }

    const stations = allStations as Station[];

    // Group stations by zone
    const stationsByZone: Record<string, string[]> = {};
    stations.forEach(station => {
      // Handle zones like "1", "2", "2/3", etc - extract primary zone
      const primaryZone = station.zone?.split('/')[0];
      if (primaryZone && !isNaN(parseInt(primaryZone))) {
        if (!stationsByZone[primaryZone]) {
          stationsByZone[primaryZone] = [];
        }
        stationsByZone[primaryZone].push(station.tfl_id);
      }
    });

    // Group stations by line
    const stationsByLine: Record<string, string[]> = {};
    stations.forEach(station => {
      station.lines?.forEach(line => {
        const lineLower = line.toLowerCase();
        if (!stationsByLine[lineLower]) {
          stationsByLine[lineLower] = [];
        }
        stationsByLine[lineLower].push(station.tfl_id);
      });
    });

    console.log('Zones available:', Object.keys(stationsByZone));
    console.log('Lines available:', Object.keys(stationsByLine));

    // Evaluate each unearned badge
    const awardedBadges: { id: string; name: string }[] = [];

    for (const badge of unearnedBadges) {
      let shouldAward = false;

      if (badge.badge_type === 'milestone' && badge.criteria?.threshold) {
        // Milestone badge: check total unique stations
        shouldAward = totalUniqueVisits >= badge.criteria.threshold;
        console.log(`Milestone badge "${badge.name}": need ${badge.criteria.threshold}, have ${totalUniqueVisits} -> ${shouldAward}`);
      } 
      else if (badge.badge_type === 'zone' && badge.criteria?.zone) {
        // Zone badge: check if all stations in zone are visited
        const zoneStations = stationsByZone[badge.criteria.zone] || [];
        const visitedInZone = zoneStations.filter(s => visitedStationIds.has(s));
        shouldAward = zoneStations.length > 0 && visitedInZone.length === zoneStations.length;
        console.log(`Zone badge "${badge.name}": need ${zoneStations.length}, have ${visitedInZone.length} -> ${shouldAward}`);
      }
      else if (badge.badge_type === 'line' && badge.criteria?.line) {
        // Line badge: check if all stations on line are visited
        const lineStations = stationsByLine[badge.criteria.line] || [];
        const visitedOnLine = lineStations.filter(s => visitedStationIds.has(s));
        shouldAward = lineStations.length > 0 && visitedOnLine.length === lineStations.length;
        console.log(`Line badge "${badge.name}": need ${lineStations.length}, have ${visitedOnLine.length} -> ${shouldAward}`);
      }

      if (shouldAward) {
        // Award the badge
        const { error: insertError } = await supabase
          .from('user_badges')
          .insert({
            user_id,
            badge_id: badge.id,
            earned_at: new Date().toISOString(),
          });

        if (insertError) {
          // Check if it's a duplicate (race condition)
          if (insertError.code === '23505') {
            console.log(`Badge "${badge.name}" already awarded (race condition)`);
          } else {
            console.error(`Error awarding badge "${badge.name}":`, insertError);
          }
        } else {
          console.log(`Awarded badge: ${badge.name}`);
          awardedBadges.push({ id: badge.id, name: badge.name });
        }
      }
    }

    console.log(`Evaluation complete. Awarded ${awardedBadges.length} badges`);

    return new Response(
      JSON.stringify({ 
        awarded: awardedBadges,
        stats: {
          total_unique_visits: totalUniqueVisits,
          badges_evaluated: unearnedBadges.length,
          badges_awarded: awardedBadges.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-badges function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
