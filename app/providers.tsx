"use client";

import { Toaster } from "react-hot-toast";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
	<>
	  {children}

	  {/* 🔔 Глобальный Toaster */}
	  <Toaster
		position="top-right"
		toastOptions={{
		  duration: 4000,
		  style: {
			background: "#0f172a",
			color: "#fff",
		  },
		}}
	  />
	</>
  );
}