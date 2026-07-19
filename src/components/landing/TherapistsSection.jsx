import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, User, AlertCircle, WifiOff } from 'lucide-react';
import { getActivePhysiotherapists } from '@/lib/api';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TherapistProfileCard from '@/components/public/TherapistProfileCard';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const TherapistCardSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 flex flex-col items-center border border-slate-100 h-full">
    <Skeleton className="w-24 h-24 rounded-full mb-4" />
    <Skeleton className="h-6 w-3/4 mb-3" />
    <Skeleton className="h-5 w-1/2 mb-4 rounded-full" />
    <div className="w-full space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3 mx-auto" />
    </div>
  </div>
);

const TherapistsSection = () => {
  // Use the custom hook for safe data fetching
  const { 
    data: therapists, 
    error, 
    loading, 
    refetch 
  } = useSupabaseQuery(
    () => getActivePhysiotherapists({ showOnLanding: true }), 
    [], 
    { enabled: true }
  );

  return (
    <section id="therapists" className="py-20 bg-gradient-to-b from-slate-50 to-blue-50/30 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600 leading-tight pb-2"
          >
            Tim Fisioterapis Profesional
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 font-medium font-inter"
          >
            Tenaga kesehatan berdedikasi tinggi dengan sertifikasi resmi dan pengalaman klinis yang teruji.
          </motion.p>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <TherapistCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                {error.isNetworkError ? (
                  <WifiOff className="w-8 h-8 text-red-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {error.isNetworkError ? 'Koneksi Terputus' : 'Terjadi Kesalahan'}
              </h3>
              <p className="text-slate-600 mb-6 font-medium max-w-md">
                {error.message || 'Gagal memuat data fisioterapis. Silakan coba lagi.'}
              </p>
              <Button onClick={refetch} variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                <RefreshCw className="w-4 h-4" /> Coba Lagi
              </Button>
            </div>
          ) : !therapists || therapists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Belum Ada Fisioterapis</h3>
              <p className="text-slate-500">Saat ini belum ada data fisioterapis yang aktif untuk ditampilkan.</p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-wrap justify-center gap-6 max-w-7xl mx-auto"
            >
              {therapists.map((therapist) => (
                <div
                  key={therapist.id}
                  className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]"
                >
                  <TherapistProfileCard
                      therapist={therapist}
                      isSelected={false}
                      onSelect={() => {}} // No selection on landing page
                  />
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Disclaimer / Footer */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 italic text-sm bg-white/60 inline-block px-6 py-3 rounded-full border border-slate-200/60 shadow-sm backdrop-blur-sm">
            *Pemilihan fisioterapis dapat disesuaikan dengan kondisi klinis dan jadwal yang tersedia.
          </p>
        </div>
      </div>
    </section>
  );
};

export default TherapistsSection;