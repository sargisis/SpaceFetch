import { motion } from 'framer-motion';

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background glow circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto glass-panel p-12 border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent shadow-2xl"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
            Ready to explore?
          </h2>
          <p className="text-slate-400 font-body font-light mb-8 max-w-xl mx-auto leading-relaxed">
            Get started with our free tier today. Access clean, structured space data and generate descriptions powered by Llama-3.3 in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.a
              href="#"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-blue-400/20"
            >
              Sign Up Now
            </motion.a>
            <motion.a
              href="https://github.com/sargisis/SpaceFetch"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold border border-white/10 backdrop-blur-md transition-all"
            >
              View Repository
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
