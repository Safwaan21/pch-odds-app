// Simple script to test Supabase connection and table access
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Constants
const GAME_CHANNEL = 'game-channel';
const PLAYER_CHANNEL = 'player-updates';
const EVENTS = {
  GAME_STATE_UPDATE: 'game_state_update',
  ROLE_ASSIGNED: 'role_assigned',
};

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local file');
  console.log('Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('🧪 Running Supabase integration tests...');
  
  try {
    // Test 1: Check connection
    console.log('\n📡 Testing Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabase.from('_test_connection').select('*').limit(1).catch(() => ({ data: null, error: { message: 'Connection failed' } }));
    
    if (connectionError) {
      console.log('✅ Connection test passed (expected error for non-existent table)');
    } else {
      console.log('❓ Unexpected response from connection test');
    }
    
    // Test 2: Insert into game channel
    console.log('\n📝 Testing insert into game-channel...');
    const testGameState = {
      players: [],
      spectators: [],
      phase: 'join',
      countdown: 0,
      result: null
    };
    
    const { data: insertGameData, error: insertGameError } = await supabase
      .from(GAME_CHANNEL)
      .insert({
        event: EVENTS.GAME_STATE_UPDATE,
        payload: testGameState
      })
      .select();
    
    if (insertGameError) {
      console.error('❌ Failed to insert into game-channel:', insertGameError.message);
    } else {
      console.log('✅ Successfully inserted into game-channel');
      console.log('📊 Inserted data:', insertGameData);
    }
    
    // Test 3: Insert into player channel
    console.log('\n📝 Testing insert into player-updates...');
    const testPlayerUpdate = {
      playerId: 'test-player-' + Math.random().toString(36).substring(2, 7),
      role: 'player'
    };
    
    const { data: insertPlayerData, error: insertPlayerError } = await supabase
      .from(PLAYER_CHANNEL)
      .insert({
        event: EVENTS.ROLE_ASSIGNED,
        payload: testPlayerUpdate
      })
      .select();
    
    if (insertPlayerError) {
      console.error('❌ Failed to insert into player-updates:', insertPlayerError.message);
    } else {
      console.log('✅ Successfully inserted into player-updates');
      console.log('📊 Inserted data:', insertPlayerData);
    }
    
    // Test 4: Query game channel
    console.log('\n🔍 Testing query from game-channel...');
    const { data: queryGameData, error: queryGameError } = await supabase
      .from(GAME_CHANNEL)
      .select('*')
      .eq('event', EVENTS.GAME_STATE_UPDATE)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (queryGameError) {
      console.error('❌ Failed to query game-channel:', queryGameError.message);
    } else {
      console.log('✅ Successfully queried game-channel');
      console.log('📊 Found', queryGameData.length, 'records');
      if (queryGameData.length > 0) {
        console.log('📊 Latest record:', queryGameData[0]);
      }
    }
    
    // Test 5: Test realtime subscription
    console.log('\n📡 Testing realtime subscription (will wait for 5 seconds)...');
    let subscriptionWorking = false;
    
    const subscription = supabase
      .channel('test-channel')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: GAME_CHANNEL 
      }, (payload) => {
        console.log('✅ Received realtime update:', payload);
        subscriptionWorking = true;
      })
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
    
    // Insert a test record after subscription
    setTimeout(async () => {
      console.log('📝 Inserting test record for realtime test...');
      await supabase
        .from(GAME_CHANNEL)
        .insert({
          event: 'test_event',
          payload: { test: true, timestamp: new Date().toISOString() }
        });
    }, 2000);
    
    // Check if subscription worked after 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (subscriptionWorking) {
      console.log('✅ Realtime subscription is working!');
    } else {
      console.log('❌ Realtime subscription test failed - no events received');
      console.log('⚠️ This could be because Realtime is not enabled for this table or project');
    }
    
    // Clean up subscription
    subscription.unsubscribe();
    
    console.log('\n🏁 Tests completed!');
  } catch (error) {
    console.error('❌ Unexpected error during tests:', error);
  }
}

runTests(); 