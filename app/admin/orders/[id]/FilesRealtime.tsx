'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FilesRealtime({
  orderId,
  initialFiles,
}: {
  orderId: string
  initialFiles: any[]
}) {
  const supabase = createClient()
  const [files, setFiles] = useState(initialFiles)

  useEffect(() => {
	console.log('Realtime init for order:', orderId)

	const channel = supabase
	  .channel(`order-files-${orderId}`)
	  .on(
		'postgres_changes',
		{
		  event: 'INSERT',
		  schema: 'public',
		  table: 'order_files',
		  filter: `order_id=eq.${orderId}`,
		},
		(payload) => {
		  console.log('REALTIME PAYLOAD:', payload)
		  setFiles((prev) => [...prev, payload.new])
		}
	  )
	  .subscribe((status) => {
		console.log('SUBSCRIBE STATUS:', status)
	  })

	return () => {
	  supabase.removeChannel(channel)
	}
  }, [orderId])

  return (
	<div>
	  <h3>Files (realtime)</h3>
	  <pre className="text-xs bg-black/5 p-2 rounded">
		{JSON.stringify(files, null, 2)}
	  </pre>
	</div>
  )
}