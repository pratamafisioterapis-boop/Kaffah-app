import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, MessageCircle } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { Button } from '@/components/ui/button';
import { ARTICLES, getArticleBySlug } from '@/data/articles';
import { getServiceBySlug } from '@/data/services';
import { BUSINESS } from '@/lib/businessInfo';

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const BlogArticlePage = () => {
  const { slug } = useParams();
  const article = getArticleBySlug(slug);

  if (!article) {
    return <Navigate to="/artikel" replace />;
  }

  const relatedService = article.relatedServiceSlug ? getServiceBySlug(article.relatedServiceSlug) : null;
  const otherArticles = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedDate,
    author: { '@type': 'Organization', name: BUSINESS.name },
    publisher: { '@id': `${BUSINESS.url}/#business` },
    mainEntityOfPage: `${BUSINESS.url}/artikel/${article.slug}`,
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title={article.metaTitle}
        description={article.metaDescription}
        path={`/artikel/${article.slug}`}
        schema={articleSchema}
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <nav className="text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-kaffah-blue">Home</Link>
              <span className="mx-2">/</span>
              <Link to="/artikel" className="hover:text-kaffah-blue">Artikel</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-700">{article.title}</span>
            </nav>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <Calendar className="w-4 h-4" />
                {formatDate(article.publishedDate)}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{article.title}</h1>
            </motion.div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-10">
            {article.sections.map((section, idx) => (
              <div key={idx}>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">{section.heading}</h2>
                {section.paragraphs?.map((p, pIdx) => (
                  <p key={pIdx} className="text-slate-600 leading-relaxed mb-4">{p}</p>
                ))}
                {section.list && (
                  <ul className="space-y-2 list-disc list-inside text-slate-600">
                    {section.list.map((item, lIdx) => (
                      <li key={lIdx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-2">
                {relatedService ? `Butuh penanganan untuk ${relatedService.title.replace(/^Fisioterapi\s/, '')}?` : 'Punya keluhan serupa?'}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Konsultasikan kondisi Anda dengan fisioterapis bersertifikat kami di Balikpapan Utara.
              </p>
              <div className="flex flex-wrap gap-3">
                {relatedService && (
                  <Link to={`/layanan/${relatedService.slug}`}>
                    <Button className="bg-kaffah-navy hover:bg-kaffah-navy/90 text-white gap-2">
                      Lihat Layanan Terkait <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-kaffah-navy text-kaffah-navy hover:bg-blue-50 gap-2">
                    <MessageCircle className="w-4 h-4" /> Konsultasi via WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {otherArticles.length > 0 && (
          <section className="py-16 bg-slate-50">
            <div className="container mx-auto px-4 md:px-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-8">Artikel Lainnya</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {otherArticles.map((other) => (
                  <Link
                    key={other.slug}
                    to={`/artikel/${other.slug}`}
                    className="block p-6 rounded-xl border border-slate-100 bg-white hover:border-kaffah-blue/30 hover:shadow-lg transition-all group"
                  >
                    <h3 className="font-bold text-slate-900 mb-2 leading-snug">{other.title}</h3>
                    <p className="text-slate-500 text-sm mb-3">{other.excerpt}</p>
                    <span className="text-kaffah-navy text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Baca <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogArticlePage;
