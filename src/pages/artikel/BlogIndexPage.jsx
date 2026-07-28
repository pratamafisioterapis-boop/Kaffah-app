import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { ARTICLES } from '@/data/articles';

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const BlogIndexPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="Artikel Fisioterapi | Kaffah Physiotherapy Balikpapan"
        description="Artikel seputar fisioterapi: biaya, kapan harus konsultasi, pemulihan cedera olahraga, stroke, dan tips kesehatan gerak dari Kaffah Physiotherapy Balikpapan."
        path="/artikel"
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Artikel Fisioterapi
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Informasi seputar fisioterapi, pemulihan cedera, dan kesehatan gerak dari tim Kaffah Physiotherapy, Balikpapan.
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ARTICLES.map((article, index) => (
                <motion.div
                  key={article.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={`/artikel/${article.slug}`}
                    className="block h-full p-6 rounded-xl border border-slate-100 hover:border-kaffah-blue/30 hover:shadow-lg transition-all group bg-white"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(article.publishedDate)}
                    </div>
                    <h2 className="font-bold text-lg text-slate-900 mb-2 leading-snug">{article.title}</h2>
                    <p className="text-slate-500 text-sm mb-4">{article.excerpt}</p>
                    <span className="text-kaffah-navy text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Baca Selengkapnya <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogIndexPage;
