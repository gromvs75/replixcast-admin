export default function Debug() {
  return (
	<pre>
	  URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
	  {"\n"}
	  KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10)}...
	</pre>
  );
}