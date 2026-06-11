import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase = createClient('https://wtbwngzkxjlpysrngofp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0YnduZ3preGpscHlzcm5nb2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Nzc4OTcsImV4cCI6MjA5NjA1Mzg5N30.dyW70-_YcLv2K4_Qto3bJi8RevRPibOaeUPVE72FBBw');

async function test() {
  const notifications = [{
      user_id: '85c0ce9a-9bf3-49fc-9368-5bc1020073f2',
      title: 'Test Notification',
      message: 'This is a test notification.',
      type: 'complaint',
      is_read: false,
      link: '/admin/complaints.html',
      related_id: null
    }];
  const { data, error } = await supabase.from('notifications').insert(notifications).select();
  console.log('Result:', data, error);
}
test();
