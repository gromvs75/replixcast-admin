"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function ThanksPage() {
  const router = useRouter();

  return (
	<div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
	  <motion.div
		initial={{ opacity: 0, y: 12, scale: 0.98 }}
		animate={{ opacity: 1, y: 0, scale: 1 }}
		transition={{ duration: 0.35, ease: "easeOut" }}
		className="w-full max-w-md rounded-xl bg-white p-6 shadow"
	  >
		<div className="text-center space-y-4">
		  <div className="text-4xl">✅</div>

		  <h1 className="text-2xl font-semibold">
			Спасибо!
		  </h1>

		  <p className="text-slate-600">
			Ваша заявка успешно отправлена.  
			Мы скоро свяжемся с вами.
		  </p>

		  <button
			onClick={() => router.push("/")}
			className="mt-4 w-full rounded bg-black px-4 py-2 text-white hover:opacity-90"
		  >
			Вернуться на главную
		  </button>
		</div>
	  </motion.div>
	</div>
  );
}