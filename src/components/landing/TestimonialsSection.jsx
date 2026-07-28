import React from 'react';
import { motion } from 'framer-motion';
import { Star, ExternalLink, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURED_TESTIMONIALS, GOOGLE_RATING_SUMMARY } from '@/data/testimonials';
import { BUSINESS } from '@/lib/businessInfo';

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const TestimonialsSection = () => {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Kata Pasien Kami</h2>
            <div className="flex items-center justify-center gap-2 text-slate-600">
              <div className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>
              <span className="font-semibold text-slate-900">{GOOGLE_RATING_SUMMARY.ratingValue.toFixed(1)}</span>
              <span>dari {GOOGLE_RATING_SUMMARY.reviewCount} ulasan Google</span>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {FEATURED_TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              <Quote className="w-6 h-6 text-kaffah-blue/30 mb-3" />
              <p className="text-slate-600 text-sm leading-relaxed mb-5 flex-grow">{testimonial.text}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 rounded-full bg-kaffah-navy/10 text-kaffah-navy flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {initials(testimonial.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{testimonial.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <span>· {testimonial.relativeTime}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <a href={BUSINESS.googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-kaffah-navy text-kaffah-navy hover:bg-blue-50 gap-2">
              Lihat Semua Ulasan di Google <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
