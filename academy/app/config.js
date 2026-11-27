// Public configuration for Canonical Studies Academy. The key is the publishable (anon) key: safe in the browser,
// every table is protected by row level security. Never put a service-role key or any other secret here.
window.ACADEMY_CONFIG = {
  url: 'https://swfgfsokuszlfkpduzcr.supabase.co',
  key: 'sb_publishable_0I3q4ru4m4nKMHieAWBGow_0CTZ6H_d',
  appUrl: 'https://www.mret.co.za/academy/app/',
  functionsUrl: 'https://swfgfsokuszlfkpduzcr.supabase.co/functions/v1',
  voice: true, // human-sounding Google voice from the ac-voice function; falls back to the device voice until it is switched on
  google: false // switch on once a Google OAuth client is configured in Supabase
};
